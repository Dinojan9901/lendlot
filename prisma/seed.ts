import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { addDays, parseIsoDate, todayIso } from "../src/lib/dates";
import { quotePrice } from "../src/lib/pricing";
import { hashPassword } from "../src/server/password";
import { categories, DEMO_PASSWORD, items, users, type UserKey } from "./seed-data";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/** Bookings relative to today so the demo calendar always has booked days. */
const sampleBookings: { item: string; startOffset: number; days: number }[] = [
  { item: "cordless-drill-driver-kit", startOffset: 3, days: 3 },
  { item: "cordless-drill-driver-kit", startOffset: 12, days: 2 },
  { item: "four-person-dome-tent", startOffset: 5, days: 4 },
  { item: "outdoor-projector-and-screen", startOffset: 8, days: 1 },
  { item: "full-frame-mirrorless-camera", startOffset: 2, days: 7 },
  { item: "sit-on-top-kayak", startOffset: 10, days: 3 },
];

async function main() {
  // Wipe in dependency order so the seed can be re-run safely.
  await prisma.booking.deleteMany();
  await prisma.item.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const userIds = {} as Record<UserKey, string>;
  for (const user of users) {
    const created = await prisma.user.create({
      data: { id: `user_${user.key}`, name: user.name, email: user.email, role: user.role, passwordHash },
    });
    userIds[user.key] = created.id;
  }

  const categoryIds: Record<string, string> = {};
  for (const category of categories) {
    const created = await prisma.category.create({ data: { id: `cat_${category.slug}`, ...category } });
    categoryIds[category.slug] = created.id;
  }

  const itemIds: Record<string, { id: string; dailyPriceCents: number }> = {};
  // Seeded rows get stable ids, so re-seeding (e.g. before E2E runs) never
  // invalidates pages that were prerendered from an earlier seed.
  // Stagger createdAt so "newest first" ordering is stable and meaningful.
  const now = Date.now();
  for (const [index, item] of items.entries()) {
    const created = await prisma.item.create({
      data: {
        id: `item_${item.slug}`,
        slug: item.slug,
        title: item.title,
        description: item.description,
        dailyPriceCents: item.dailyPrice * 100,
        location: item.location,
        imageUrl: `/items/${item.slug}.webp`,
        categoryId: categoryIds[item.category],
        ownerId: userIds[item.owner],
        createdAt: new Date(now - index * 60 * 60 * 1000),
      },
    });
    itemIds[item.slug] = { id: created.id, dailyPriceCents: created.dailyPriceCents };
  }

  const today = todayIso();
  for (const booking of sampleBookings) {
    const item = itemIds[booking.item];
    const startDate = addDays(today, booking.startOffset);
    const endDate = addDays(startDate, booking.days - 1);
    await prisma.booking.create({
      data: {
        itemId: item.id,
        renterId: userIds.renter,
        startDate: parseIsoDate(startDate),
        endDate: parseIsoDate(endDate),
        totalCents: quotePrice({ dailyPriceCents: item.dailyPriceCents, startDate, endDate }).totalCents,
      },
    });
  }

  console.log(
    `Seeded ${users.length} users, ${categories.length} categories, ${items.length} items, ${sampleBookings.length} bookings.`,
  );
  console.log(`Demo accounts: ${users.map((u) => u.email).join(", ")} — password "${DEMO_PASSWORD}"`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
