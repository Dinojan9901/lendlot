import { NextResponse } from "next/server";
import { z } from "zod";
import { cancelBooking } from "@/server/bookings";
import { handleRouteError, jsonError, readJson, validationError } from "@/server/http";
import { getCurrentUser } from "@/server/session";

const patchSchema = z.object({ status: z.literal("CANCELLED") }).strict();

/** PATCH /api/bookings/:id { status: "CANCELLED" } — cancel a booking. */
export async function PATCH(request: Request, { params }: RouteContext<"/api/bookings/[id]">) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "Sign in required");

  const parsed = patchSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  const { id } = await params;
  try {
    const booking = await cancelBooking(id, user);
    return NextResponse.json({ id: booking.id, status: booking.status });
  } catch (error) {
    return handleRouteError(error);
  }
}
