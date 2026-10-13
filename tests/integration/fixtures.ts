import { prisma } from "@/server/db";
import { addDays, todayIso } from "@/lib/dates";
import type { Role } from "@/generated/prisma/enums";

export async function resetDatabase() {
  await prisma.$executeRawUnsafe('TRUNCATE "Booking", "Item", "Category", "User" CASCADE');
}

let counter = 0;

export async function createUser(role: Role = "RENTER") {
  counter += 1;
  return prisma.user.create({
    data: { name: `${role} ${counter}`, email: `${role.toLowerCase()}-${counter}@test.local`, role, passwordHash: "x" },
  });
}

export async function createItem(ownerId: string, overrides: { dailyPriceCents?: number; isActive?: boolean } = {}) {
  counter += 1;
  const category = await prisma.category.upsert({
    where: { slug: "test" },
    update: {},
    create: { slug: "test", name: "Test" },
  });
  return prisma.item.create({
    data: {
      slug: `item-${counter}`,
      title: `Item ${counter}`,
      description: "A test item used by integration tests.",
      dailyPriceCents: overrides.dailyPriceCents ?? 1000,
      isActive: overrides.isActive ?? true,
      location: "Testville",
      imageUrl: "/items/test.webp",
      categoryId: category.id,
      ownerId,
    },
  });
}

/** An ISO date `offset` days from today. */
export const day = (offset: number) => addDays(todayIso(), offset);
