import { beforeEach, describe, expect, it } from "vitest";
import { createBooking } from "@/server/bookings";
import { prisma } from "@/server/db";
import { DomainError } from "@/server/errors";
import { createItem, createUser, day, resetDatabase } from "./fixtures";

const PARALLEL_REQUESTS = 25;

describe("concurrent bookings", () => {
  beforeEach(resetDatabase);

  it(`lets exactly one of ${PARALLEL_REQUESTS} simultaneous overlapping bookings succeed`, async () => {
    const owner = await createUser("OWNER");
    const item = await createItem(owner.id);
    const renters = await Promise.all(Array.from({ length: PARALLEL_REQUESTS }, () => createUser("RENTER")));

    // Every request wants a different but overlapping window around day 10,
    // and all of them are fired at once — the classic check-then-insert race.
    const results = await Promise.allSettled(
      renters.map((renter, i) =>
        createBooking({
          itemId: item.id,
          renterId: renter.id,
          startDate: day(8 + (i % 3)),
          endDate: day(10 + (i % 4)),
        }),
      ),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(PARALLEL_REQUESTS - 1);
    // Every loser failed with the friendly conflict error, not a crash.
    for (const failure of failed) {
      expect(failure.reason).toBeInstanceOf(DomainError);
      expect((failure.reason as DomainError).code).toBe("CONFLICT");
    }
    expect(await prisma.booking.count({ where: { itemId: item.id, status: "CONFIRMED" } })).toBe(1);
  });

  it("lets non-overlapping bookings made at the same time all succeed", async () => {
    const owner = await createUser("OWNER");
    const item = await createItem(owner.id);
    const renters = await Promise.all(Array.from({ length: 10 }, () => createUser("RENTER")));

    const results = await Promise.allSettled(
      renters.map((renter, i) =>
        createBooking({ itemId: item.id, renterId: renter.id, startDate: day(1 + i * 2), endDate: day(2 + i * 2) }),
      ),
    );

    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
  });
});
