import { beforeEach, describe, expect, it } from "vitest";
import { createBooking } from "@/server/bookings";
import { prisma } from "@/server/db";
import { DomainError, postgresError } from "@/server/errors";
import { createItem, createUser, day, resetDatabase } from "./fixtures";

const PARALLEL_REQUESTS = 25;

describe("concurrent bookings", () => {
  beforeEach(resetDatabase);

  // Repeated because a race only shows up some of the time. Generous timeout:
  // Postgres waits deadlock_timeout (1s) before resolving each deadlock.
  it(
    `lets exactly one of ${PARALLEL_REQUESTS} simultaneous overlapping bookings succeed`,
    { repeats: 4, timeout: 120_000 },
    async () => {
    await resetDatabase();
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
    const reasons = failed.map((f) =>
      f.reason instanceof DomainError
        ? f.reason.code
        : `unexpected ${(f.reason as { code?: string }).code ?? postgresError(f.reason)?.code ?? String(f.reason)}`,
    );
    expect(new Set(reasons)).toEqual(new Set(["CONFLICT"]));
    expect(await prisma.booking.count({ where: { itemId: item.id, status: "CONFIRMED" } })).toBe(1);
    },
  );

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
