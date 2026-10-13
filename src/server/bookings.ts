import { prisma } from "./db";
import { DomainError, isExclusionViolation, isRetryableConflict } from "./errors";
import { parseIsoDate, toIsoDate, todayIso, type DateRange } from "@/lib/dates";
import { quotePrice } from "@/lib/pricing";
import type { BookingInput } from "@/lib/validation";

export const OVERLAP_CONSTRAINT = "booking_no_overlap";
const MAX_INSERT_ATTEMPTS = 5;

/**
 * Creates a booking. There is deliberately no "is it free?" query first:
 * two requests could both see the dates as free and both insert. Instead the
 * database's exclusion constraint is the single source of truth, and a
 * violation is translated into a friendly CONFLICT error.
 */
export async function createBooking(input: BookingInput & { renterId: string }) {
  const item = await prisma.item.findFirst({
    where: { id: input.itemId, isActive: true },
    select: { id: true, ownerId: true, dailyPriceCents: true },
  });
  if (!item) throw new DomainError("NOT_FOUND", "This item is no longer available.");
  if (item.ownerId === input.renterId) {
    throw new DomainError("OWN_ITEM", "You can't book your own item.");
  }

  // Price is always recomputed on the server; the client's preview is never trusted.
  const quote = quotePrice({
    dailyPriceCents: item.dailyPriceCents,
    startDate: input.startDate,
    endDate: input.endDate,
  });

  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.booking.create({
        data: {
          itemId: item.id,
          renterId: input.renterId,
          startDate: parseIsoDate(input.startDate),
          endDate: parseIsoDate(input.endDate),
          totalCents: quote.totalCents,
        },
      });
    } catch (error) {
      if (isExclusionViolation(error, OVERLAP_CONSTRAINT)) {
        throw new DomainError("CONFLICT", "Sorry, some of those dates were just booked. Please pick other dates.");
      }
      // Two overlapping inserts at the same instant can each wait for the
      // other's uncommitted row; Postgres breaks that deadlock by aborting one.
      // Retrying is safe: the retry either succeeds or hits the constraint.
      if (isRetryableConflict(error) && attempt < MAX_INSERT_ATTEMPTS) {
        // Small random backoff so retrying requests don't collide again.
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 25 * attempt));
        continue;
      }
      throw error;
    }
  }
}

/** Booked (confirmed) ranges for an item that end today or later. */
export async function getBookedRanges(itemId: string, from: string = todayIso()): Promise<DateRange[]> {
  const bookings = await prisma.booking.findMany({
    where: { itemId, status: "CONFIRMED", endDate: { gte: parseIsoDate(from) } },
    select: { startDate: true, endDate: true },
    orderBy: { startDate: "asc" },
  });
  return bookings.map((b) => ({ start: toIsoDate(b.startDate), end: toIsoDate(b.endDate) }));
}

export async function listBookingsForRenter(renterId: string) {
  const bookings = await prisma.booking.findMany({
    where: { renterId },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    include: { item: { select: { title: true, slug: true, imageUrl: true, location: true } } },
  });
  return bookings.map(serializeBooking);
}

export type BookingWithItem = Awaited<ReturnType<typeof listBookingsForRenter>>[number];

type DateFields = "startDate" | "endDate" | "createdAt";

/** Dates become ISO strings so the result can cross the server→client boundary as plain JSON. */
function serializeBooking<T extends Record<DateFields, Date>>(
  booking: T,
): Omit<T, DateFields> & Record<DateFields, string> {
  return {
    ...booking,
    startDate: toIsoDate(booking.startDate),
    endDate: toIsoDate(booking.endDate),
    createdAt: booking.createdAt.toISOString(),
  };
}

/**
 * Renters may cancel their own bookings that have not started yet; admins may
 * cancel any booking. Cancelled rows stay for history but no longer block the
 * dates, because the exclusion constraint only covers CONFIRMED rows.
 */
export async function cancelBooking(bookingId: string, actor: { id: string; role: string }) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new DomainError("NOT_FOUND", "Booking not found.");

  const isAdmin = actor.role === "ADMIN";
  if (!isAdmin && booking.renterId !== actor.id) {
    // Same message as "not found" so we don't leak which ids exist.
    throw new DomainError("NOT_FOUND", "Booking not found.");
  }
  if (booking.status === "CANCELLED") return booking;
  if (!isAdmin && toIsoDate(booking.startDate) <= todayIso()) {
    throw new DomainError("INVALID", "Bookings that have already started can't be cancelled.");
  }

  return prisma.booking.update({ where: { id: bookingId }, data: { status: "CANCELLED" } });
}
