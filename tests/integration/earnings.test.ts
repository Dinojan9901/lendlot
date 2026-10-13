import { beforeEach, describe, expect, it } from "vitest";
import { createBooking, cancelBooking } from "@/server/bookings";
import { getOwnerEarnings } from "@/server/earnings";
import { createItem, createUser, day, resetDatabase } from "./fixtures";

describe("owner earnings", () => {
  beforeEach(resetDatabase);

  it("counts only the owner's own items and only confirmed bookings", async () => {
    const owner = await createUser("OWNER");
    const otherOwner = await createUser("OWNER");
    const renter = await createUser("RENTER");
    const mine = await createItem(owner.id, { dailyPriceCents: 1000 });
    const theirs = await createItem(otherOwner.id, { dailyPriceCents: 5000 });

    await createBooking({ itemId: mine.id, renterId: renter.id, startDate: day(2), endDate: day(3) });
    const cancelled = await createBooking({ itemId: mine.id, renterId: renter.id, startDate: day(5), endDate: day(5) });
    await cancelBooking(cancelled.id, renter);
    await createBooking({ itemId: theirs.id, renterId: renter.id, startDate: day(2), endDate: day(3) });

    const summary = await getOwnerEarnings(owner.id);
    expect(summary.bookingCount).toBe(1);
    expect(summary.upcomingCents).toBe(2000);
    expect(summary.earnedCents).toBe(0);
    expect(summary.upcoming.map((b) => b.itemTitle)).toEqual([mine.title]);
  });
});
