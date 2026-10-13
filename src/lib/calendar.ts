import { addDays, eachDay, parseIsoDate, rangesOverlap, toIsoDate, type DateRange } from "./dates";

/** "2026-10" → the 6×7 grid of ISO dates (Sunday first) that displays that month. */
export function monthGrid(month: string): string[][] {
  const first = parseIsoDate(`${month}-01`);
  const start = addDays(toIsoDate(first), -first.getUTCDay());
  const weeks: string[][] = [];
  for (let w = 0; w < 6; w++) {
    weeks.push(Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  }
  return weeks;
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function addMonths(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1 + delta, 1));
  return toIsoDate(date).slice(0, 7);
}

export function formatMonth(month: string): string {
  return parseIsoDate(`${month}-01`).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
}

export function formatLongDate(date: string): string {
  return parseIsoDate(date).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Set of every individual booked day, for O(1) lookups while rendering. */
export function bookedDaySet(ranges: DateRange[]): Set<string> {
  const days = new Set<string>();
  for (const range of ranges) for (const day of eachDay(range.start, range.end)) days.add(day);
  return days;
}

export function rangeIsFree(range: DateRange, booked: DateRange[]): boolean {
  return !booked.some((b) => rangesOverlap(range, b));
}
