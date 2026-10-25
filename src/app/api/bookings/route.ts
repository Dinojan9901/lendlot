import { NextResponse } from "next/server";
import { bookingInputSchema } from "@/lib/validation";
import { createBooking, listBookingsForRenter } from "@/server/bookings";
import { handleRouteError, jsonError, readJson, validationError } from "@/server/http";
import { rateLimit, tooManyRequests } from "@/server/rate-limit";
import { getCurrentUser } from "@/server/session";

/** GET /api/bookings — the signed-in user's bookings. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "Sign in required");
  return NextResponse.json({ bookings: await listBookingsForRenter(user.id) });
}

/**
 * POST /api/bookings { itemId, startDate, endDate } — same rules as the
 * Server Action (they share createBooking). 409 if the dates were taken.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "Sign in required");

  const limited = await rateLimit("booking", user.id);
  if (!limited.success) return tooManyRequests(limited);

  const parsed = bookingInputSchema().safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  try {
    const booking = await createBooking({ ...parsed.data, renterId: user.id });
    return NextResponse.json(
      { id: booking.id, totalCents: booking.totalCents, status: booking.status },
      { status: 201, headers: { Location: `/api/bookings/${booking.id}` } },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
