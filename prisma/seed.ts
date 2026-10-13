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

/**
 * Bookings relative to today: future ones so the calendar always shows booked
 * days, and past ones so owners' earnings dashboards have some history.
 */
const sampleBookings: { item: string; startOffset: number; days: number; renter?: UserKey }[] = [
  { item: "cordless-drill-driver-kit", startOffset: 3, days: 3 },
  { item: "cordless-drill-driver-kit", startOffset: 12, days: 2 },
  { item: "four-person-dome-tent", startOffset: 5, days: 4 },
  { item: "outdoor-projector-and-screen", startOffset: 8, days: 1 },
  { item: "full-frame-mirrorless-camera", startOffset: 2, days: 7 },
  { item: "sit-on-top-kayak", startOffset: 10, days: 3 },
  // History (Maya's items, rented by Alex and Daniel)
  { item: "electric-pressure-washer", startOffset: -150, days: 2 },
  { item: "powered-pa-speaker-pair", startOffset: -120, days: 2, renter: "owner2" },
  { item: "outdoor-projector-and-screen", startOffset: -95, days: 1 },
  { item: "compact-4k-camera-drone", startOffset: -70, days: 3, renter: "owner2" },
  { item: "touring-skis-with-skins", startOffset: -60, days: 7 },
  { item: "retro-popcorn-machine", startOffset: -40, days: 1, renter: "owner2" },
  { item: "powered-pa-speaker-pair", startOffset: -25, days: 3 },
  { item: "cordless-drill-driver-kit", startOffset: -12, days: 2 },
  { item: "two-burner-camping-stove", startOffset: -6, days: 4, renter: "owner2" },
];

async function main() {
  // Wipe in dependency order so the seed can be re-run safely.
  await prisma.booking.deleteMany();
  await prisma.item.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  // Local development and tests use the public DEMO_PASSWORD; a deployed site
  // is seeded with a private one so the published password doesn't work there.
  const demoPassword = process.env.SEED_DEMO_PASSWORD || DEMO_PASSWORD;
  const passwordHash = await hashPassword(demoPassword);
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
        renterId: userIds[booking.renter ?? "renter"],
        startDate: parseIsoDate(startDate),
        endDate: parseIsoDate(endDate),
        totalCents: quotePrice({ dailyPriceCents: item.dailyPriceCents, startDate, endDate }).totalCents,
      },
    });
  }

  console.log(
    `Seeded ${users.length} users, ${categories.length} categories, ${items.length} items, ${sampleBookings.length} bookings.`,
  );
  console.log(
    `Sample accounts: ${users.map((u) => u.email).join(", ")} — password ${
      process.env.SEED_DEMO_PASSWORD ? "from SEED_DEMO_PASSWORD" : `"${DEMO_PASSWORD}"`
    }`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
