import { randomBytes } from "node:crypto";
import { prisma } from "./db";
import { DomainError } from "./errors";
import type { ListingInput } from "@/lib/validation";
import type { Role } from "@/generated/prisma/enums";

export type Actor = { id: string; role: Role };

/**
 * Loads an item the actor is allowed to manage: their own, or any item for an
 * admin. Every owner write goes through this, so "owners only manage their
 * own listings" is enforced on the server no matter which UI or API is used.
 * Someone else's item looks exactly like a missing one (no id probing).
 */
async function findManageableItem(actor: Actor, itemId: string) {
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) throw new DomainError("NOT_FOUND", "Listing not found.");
  if (actor.role !== "ADMIN" && item.ownerId !== actor.id) {
    throw new DomainError("NOT_FOUND", "Listing not found.");
  }
  return item;
}

function assertOwnerRole(actor: Actor) {
  if (actor.role !== "OWNER" && actor.role !== "ADMIN") {
    throw new DomainError("FORBIDDEN", "Only owners can manage listings.");
  }
}

export async function listOwnerListings(ownerId: string) {
  return prisma.item.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      imageUrl: true,
      dailyPriceCents: true,
      isActive: true,
      category: { select: { name: true } },
      _count: { select: { bookings: { where: { status: "CONFIRMED" } } } },
    },
  });
}

export async function getListingForEdit(actor: Actor, itemId: string) {
  assertOwnerRole(actor);
  return findManageableItem(actor, itemId);
}

export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "item"}-${randomBytes(3).toString("hex")}`;
}

export async function createListing(actor: Actor, input: ListingInput) {
  assertOwnerRole(actor);
  return prisma.item.create({
    data: {
      slug: slugify(input.title),
      title: input.title,
      description: input.description,
      dailyPriceCents: input.dailyPrice,
      location: input.location,
      imageUrl: input.imageUrl,
      categoryId: input.categoryId,
      ownerId: actor.id,
    },
  });
}

export async function updateListing(actor: Actor, itemId: string, input: ListingInput) {
  assertOwnerRole(actor);
  await findManageableItem(actor, itemId);
  return prisma.item.update({
    where: { id: itemId },
    data: {
      title: input.title,
      description: input.description,
      dailyPriceCents: input.dailyPrice,
      location: input.location,
      imageUrl: input.imageUrl,
      categoryId: input.categoryId,
    },
  });
}

export async function setListingActive(actor: Actor, itemId: string, isActive: boolean) {
  assertOwnerRole(actor);
  await findManageableItem(actor, itemId);
  return prisma.item.update({ where: { id: itemId }, data: { isActive } });
}
