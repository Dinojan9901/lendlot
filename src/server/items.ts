import { prisma } from "./db";
import type { Prisma } from "@/generated/prisma/client";
import { PAGE_SIZE, type CatalogueParams } from "@/lib/validation";

const summarySelect = {
  id: true,
  slug: true,
  title: true,
  dailyPriceCents: true,
  location: true,
  imageUrl: true,
  category: { select: { slug: true, name: true } },
} satisfies Prisma.ItemSelect;

export type ItemSummary = Prisma.ItemGetPayload<{ select: typeof summarySelect }>;

export type CatalogueResult = {
  items: ItemSummary[];
  total: number;
  page: number;
  pageCount: number;
};

export async function searchItems({ q, category, page }: CatalogueParams): Promise<CatalogueResult> {
  const where: Prisma.ItemWhereInput = {
    isActive: true,
    ...(category ? { category: { slug: category } } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { location: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  // Two independent reads; a transaction would only add latency and hold a
  // pooled connection. A count that is off by one during a concurrent edit is harmless.
  const [total, items] = await Promise.all([
    prisma.item.count({ where }),
    prisma.item.findMany({
      where,
      select: summarySelect,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

const detailSelect = {
  ...summarySelect,
  description: true,
  isActive: true,
  ownerId: true,
  owner: { select: { name: true } },
} satisfies Prisma.ItemSelect;

export type ItemDetail = Prisma.ItemGetPayload<{ select: typeof detailSelect }>;

export async function getItemBySlug(slug: string): Promise<ItemDetail | null> {
  const item = await prisma.item.findUnique({ where: { slug }, select: detailSelect });
  return item?.isActive ? item : null;
}

export async function getItemById(id: string): Promise<ItemDetail | null> {
  const item = await prisma.item.findUnique({ where: { id }, select: detailSelect });
  return item?.isActive ? item : null;
}

export async function listCategories() {
  return prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, slug: true, name: true } });
}

/** Slugs of the newest active items, prerendered at build time. */
export async function listPopularSlugs(limit = 24): Promise<string[]> {
  const items = await prisma.item.findMany({
    where: { isActive: true },
    select: { slug: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return items.map((item) => item.slug);
}
