/**
 * Calendar-date helpers.
 *
 * Bookings are whole days, so the app passes dates around as ISO strings
 * ("2026-10-13") and does all arithmetic in UTC. This avoids the classic bug
 * where a local-time Date shifts by one day across a timezone boundary.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && toIsoDate(date) === value;
}

export function parseIsoDate(value: string): Date {
  if (!isIsoDate(value)) throw new RangeError(`Invalid ISO date: ${value}`);
  return new Date(`${value}T00:00:00Z`);
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now);
}

export function addDays(value: string, days: number): string {
  return toIsoDate(new Date(parseIsoDate(value).getTime() + days * DAY_MS));
}

/** Number of rental days, counting both the start and the end day. */
export function daysInclusive(start: string, end: string): number {
  return Math.round((parseIsoDate(end).getTime() - parseIsoDate(start).getTime()) / DAY_MS) + 1;
}

export function eachDay(start: string, end: string): string[] {
  const days: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

export type DateRange = { start: string; end: string };

/** Inclusive ranges overlap if each one starts before the other ends. */
export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}

export function formatDate(value: string): string {
  return parseIsoDate(value).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
