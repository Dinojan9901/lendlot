import { NextResponse } from "next/server";
import { getBookedRanges } from "@/server/bookings";
import { getItemById } from "@/server/items";
import { jsonError } from "@/server/http";

/**
 * GET /api/items/:id/availability — booked date ranges from today onwards.
 * Always fresh (never cached) because it changes with every booking.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/items/[id]/availability">) {
  const { id } = await params;
  const item = await getItemById(id);
  if (!item) return jsonError(404, "Item not found");
  const booked = await getBookedRanges(id);
  return NextResponse.json({ booked }, { headers: { "Cache-Control": "no-store" } });
}
