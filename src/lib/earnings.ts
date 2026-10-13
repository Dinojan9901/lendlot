import { parseIsoDate } from "./dates";

export type EarningsBooking = {
  id: string;
  startDate: string;
  endDate: string;
  totalCents: number;
  itemTitle: string;
  itemSlug: string;
  renterName: string;
};

export type MonthTotal = { month: string; label: string; cents: number };

export type EarningsSummary = {
  /** Rentals that have started (the owner has handed the item over). */
  earnedCents: number;
  /** Confirmed rentals that haven't started yet. */
  upcomingCents: number;
  bookingCount: number;
  months: MonthTotal[];
  /** Current and future rentals, soonest first. */
  upcoming: (EarningsBooking & { inProgress: boolean })[];
};

/** "2026-10" for the month `offset` months before `today`'s month. */
function monthKey(today: string, offset: number): string {
  const date = parseIsoDate(`${today.slice(0, 7)}-01`);
  date.setUTCMonth(date.getUTCMonth() - offset);
  return date.toISOString().slice(0, 7);
}

/**
 * Turns an owner's confirmed bookings into dashboard numbers. Pure, so it is
 * unit-tested without a database. Revenue counts toward the month the rental
 * starts in.
 */
export function summarizeEarnings(bookings: EarningsBooking[], today: string, monthCount = 6): EarningsSummary {
  const months: MonthTotal[] = Array.from({ length: monthCount }, (_, i) => {
    const month = monthKey(today, monthCount - 1 - i);
    const label = parseIsoDate(`${month}-01`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
    return { month, label, cents: 0 };
  });
  const byMonth = new Map(months.map((m) => [m.month, m]));

  let earnedCents = 0;
  let upcomingCents = 0;
  for (const booking of bookings) {
    if (booking.startDate <= today) earnedCents += booking.totalCents;
    else upcomingCents += booking.totalCents;
    const bucket = byMonth.get(booking.startDate.slice(0, 7));
    if (bucket) bucket.cents += booking.totalCents;
  }

  const upcoming = bookings
    .filter((b) => b.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((b) => ({ ...b, inProgress: b.startDate <= today }));

  return { earnedCents, upcomingCents, bookingCount: bookings.length, months, upcoming };
}
