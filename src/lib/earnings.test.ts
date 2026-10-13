import { describe, expect, it } from "vitest";
import { summarizeEarnings, type EarningsBooking } from "./earnings";

const booking = (id: string, startDate: string, endDate: string, totalCents: number): EarningsBooking => ({
  id,
  startDate,
  endDate,
  totalCents,
  itemTitle: `Item ${id}`,
  itemSlug: `item-${id}`,
  renterName: "Alex",
});

const TODAY = "2026-10-13";

describe("summarizeEarnings", () => {
  const bookings = [
    booking("past", "2026-08-02", "2026-08-04", 3000),
    booking("old", "2026-01-10", "2026-01-11", 9900), // outside the 6-month window
    booking("now", "2026-10-12", "2026-10-15", 4000), // in progress
    booking("soon", "2026-10-20", "2026-10-21", 2500),
    booking("later", "2026-11-05", "2026-11-06", 1000),
  ];
  const summary = summarizeEarnings(bookings, TODAY);

  it("splits earned (started) from upcoming revenue", () => {
    expect(summary.earnedCents).toBe(3000 + 9900 + 4000);
    expect(summary.upcomingCents).toBe(2500 + 1000);
    expect(summary.bookingCount).toBe(5);
  });

  it("buckets revenue into the last six months by start date", () => {
    expect(summary.months.map((m) => m.month)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(summary.months.map((m) => m.cents)).toEqual([0, 0, 0, 3000, 0, 6500]);
    expect(summary.months.at(-1)?.label).toBe("Oct");
  });

  it("lists current and future rentals soonest first, flagging ones in progress", () => {
    expect(summary.upcoming.map((b) => [b.id, b.inProgress])).toEqual([
      ["now", true],
      ["soon", false],
      ["later", false],
    ]);
  });

  it("handles a year boundary", () => {
    const january = summarizeEarnings([], "2027-01-05");
    expect(january.months.map((m) => m.month)).toEqual(["2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01"]);
  });
});
