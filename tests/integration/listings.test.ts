import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { DomainError } from "@/server/errors";
import { createListing, setListingActive, updateListing } from "@/server/listings";
import { createItem, createUser, resetDatabase } from "./fixtures";

const input = (categoryId: string) => ({
  title: "Updated title",
  description: "An updated description that is long enough.",
  dailyPrice: 2500,
  location: "Elsewhere",
  categoryId,
  imageUrl: "/items/test.webp",
});

describe("listing ownership", () => {
  beforeEach(resetDatabase);

  it("lets an owner update their own listing", async () => {
    const owner = await createUser("OWNER");
    const item = await createItem(owner.id);
    const updated = await updateListing(owner, item.id, input(item.categoryId));
    expect(updated.title).toBe("Updated title");
    expect(updated.dailyPriceCents).toBe(2500);
  });

  it("hides another owner's listing as if it did not exist", async () => {
    const owner = await createUser("OWNER");
    const intruder = await createUser("OWNER");
    const item = await createItem(owner.id);

    await expect(updateListing(intruder, item.id, input(item.categoryId))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(setListingActive(intruder, item.id, false)).rejects.toBeInstanceOf(DomainError);
    const unchanged = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
    expect(unchanged.title).toBe(item.title);
    expect(unchanged.isActive).toBe(true);
  });

  it("does not let renters create listings", async () => {
    const renter = await createUser("RENTER");
    const owner = await createUser("OWNER");
    const item = await createItem(owner.id);
    await expect(createListing(renter, input(item.categoryId))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lets an admin manage any listing", async () => {
    const owner = await createUser("OWNER");
    const admin = await createUser("ADMIN");
    const item = await createItem(owner.id);
    await expect(setListingActive(admin, item.id, false)).resolves.toMatchObject({ isActive: false });
  });

  it("creates listings owned by the acting user with a unique slug", async () => {
    const owner = await createUser("OWNER");
    const existing = await createItem(owner.id);
    const a = await createListing(owner, input(existing.categoryId));
    const b = await createListing(owner, input(existing.categoryId));
    expect(a.ownerId).toBe(owner.id);
    expect(a.slug).toMatch(/^updated-title-[0-9a-f]{6}$/);
    expect(a.slug).not.toBe(b.slug);
  });
});
