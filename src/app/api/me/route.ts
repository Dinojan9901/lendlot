import { NextResponse } from "next/server";
import { isActiveMember } from "@/lib/membership";
import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/session";

/**
 * GET /api/me — who is signed in and whether they get member pricing.
 * Lets the cached (ISR) item page show a personalised price on the client.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null }, { headers: { "Cache-Control": "no-store" } });

  const membership = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { membershipStatus: true, membershipPeriodEnd: true },
  });
  return NextResponse.json(
    { user: { name: user.name, role: user.role, isMember: isActiveMember(membership) } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
