import { beforeEach, describe, expect, it } from "vitest";
import { parseIsoDate } from "@/lib/dates";
import { cancelBooking, createBooking, getBookedRanges } from "@/server/bookings";
import { prisma } from "@/server/db";
import { DomainError } from "@/server/errors";
import { createItem, createUser, day, resetDatabase } from "./fixtures";

async function expectDomainError(promise: Promise<unknown>, code: DomainError["code"]) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(DomainError);
  expect((error as DomainError).code).toBe(code);
}

describe("booking rules", () => {
  let owner: Awaited<ReturnType<typeof createUser>>;
  let renter: Awaited<ReturnType<typeof createUser>>;
  let otherRenter: Awaited<ReturnType<typeof createUser>>;
  let item: Awaited<ReturnType<typeof createItem>>;

  beforeEach(async () => {
    await resetDatabase();
    owner = await createUser("OWNER");
    renter = await createUser("RENTER");
    otherRenter = await createUser("RENTER");
    item = await createItem(owner.id, { dailyPriceCents: 1500 });
  });

  const book = (renterId: string, start: number, end: number, itemId = item.id) =>
    createBooking({ itemId, renterId, startDate: day(start), endDate: day(end) });

  it("stores a confirmed booking with a server-computed price", async () => {
    const booking = await book(renter.id, 1, 3);
    expect(booking.status).toBe("CONFIRMED");
    expect(booking.totalCents).toBe(3 * 1500);
  });

  it("applies the weekly discount for 7+ days", async () => {
    const booking = await book(renter.id, 1, 7);
    expect(booking.totalCents).toBe(Math.round(7 * 1500 * 0.9));
  });

  it.each([
    ["identical dates", 2, 4],
    ["overlapping the start", 0, 2],
    ["overlapping the end", 4, 6],
    ["inside the existing booking", 3, 3],
    ["surrounding the existing booking", 1, 5],
  ])("rejects a booking %s", async (_label, start, end) => {
    await book(renter.id, 2, 4);
    await expectDomainError(book(otherRenter.id, start, end), "CONFLICT");
  });

  it("treats end dates as inclusive: a booking may start the day after another ends", async () => {
    await book(renter.id, 2, 4);
    await expect(book(otherRenter.id, 5, 6)).resolves.toMatchObject({ status: "CONFIRMED" });
    await expectDomainError(book(otherRenter.id, 4, 4), "CONFLICT");
  });

  it("allows the same dates on a different item", async () => {
    const otherItem = await createItem(owner.id);
    await book(renter.id, 2, 4);
    await expect(book(otherRenter.id, 2, 4, otherItem.id)).resolves.toMatchObject({ status: "CONFIRMED" });
  });

  it("frees the dates again when a booking is cancelled", async () => {
    const first = await book(renter.id, 2, 4);
    await cancelBooking(first.id, renter);
    await expect(book(otherRenter.id, 2, 4)).resolves.toMatchObject({ status: "CONFIRMED" });
    expect(await getBookedRanges(item.id)).toEqual([{ start: day(2), end: day(4) }]);
  });

  it("does not let owners book their own item", async () => {
    await expectDomainError(book(owner.id, 1, 2), "OWN_ITEM");
  });

  it("does not allow booking a hidden (inactive) item", async () => {
    const hidden = await createItem(owner.id, { isActive: false });
    await expectDomainError(book(renter.id, 1, 2, hidden.id), "NOT_FOUND");
  });

  describe("database constraints (bypassing the app code)", () => {
    const insert = (start: number, end: number, status: "CONFIRMED" | "CANCELLED" = "CONFIRMED") =>
      prisma.booking.create({
        data: {
          itemId: item.id,
          renterId: renter.id,
          startDate: parseIsoDate(day(start)),
          endDate: parseIsoDate(day(end)),
          totalCents: 100,
          status,
        },
      });

    it("the exclusion constraint rejects overlapping confirmed rows", async () => {
      await insert(1, 5);
      await expect(insert(3, 8)).rejects.toThrow(/booking_no_overlap|23P01|exclusion/i);
    });

    it("cancelled rows are ignored by the exclusion constraint", async () => {
      await insert(1, 5, "CANCELLED");
      await expect(insert(3, 8)).resolves.toBeDefined();
    });

    it("the check constraint rejects an end date before the start date", async () => {
      await expect(insert(5, 3)).rejects.toThrow(/booking_dates_ordered|23514|check/i);
    });
  });

  describe("cancelling", () => {
    it("only lets renters cancel their own bookings", async () => {
      const booking = await book(renter.id, 2, 3);
      await expectDomainError(cancelBooking(booking.id, otherRenter), "NOT_FOUND");
    });

    it("does not let renters cancel a booking that has already started", async () => {
      const booking = await book(renter.id, 0, 2);
      await expectDomainError(cancelBooking(booking.id, renter), "INVALID");
    });

    it("lets an admin cancel any booking", async () => {
      const admin = await createUser("ADMIN");
      const booking = await book(renter.id, 0, 2);
      await expect(cancelBooking(booking.id, admin)).resolves.toMatchObject({ status: "CANCELLED" });
    });
  });
});
