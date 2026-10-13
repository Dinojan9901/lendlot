import { prisma } from "./db";
import { toIsoDate, todayIso } from "@/lib/dates";
import { summarizeEarnings } from "@/lib/earnings";

/** Dashboard numbers for one owner: only their own items' confirmed bookings. */
export async function getOwnerEarnings(ownerId: string, today: string = todayIso()) {
  const bookings = await prisma.booking.findMany({
    where: { status: "CONFIRMED", item: { ownerId } },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      totalCents: true,
      item: { select: { title: true, slug: true } },
      renter: { select: { name: true } },
    },
  });

  return summarizeEarnings(
    bookings.map((b) => ({
      id: b.id,
      startDate: toIsoDate(b.startDate),
      endDate: toIsoDate(b.endDate),
      totalCents: b.totalCents,
      itemTitle: b.item.title,
      itemSlug: b.item.slug,
      renterName: b.renter.name,
    })),
    today,
  );
}
