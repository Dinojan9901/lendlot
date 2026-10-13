import { cacheLife, cacheTag } from "next/cache";
import { getItemBySlug, listCategories, searchItems } from "./items";
import type { CatalogueParams } from "@/lib/validation";

/**
 * Cached reads for public pages. These are Next.js "use cache" functions: the
 * result is stored and reused until its cache life expires (time-based
 * revalidation) or one of its tags is invalidated after a listing changes
 * (on-demand revalidation). Together that is what ISR means in Next 16.
 */

export const itemTag = (slug: string) => `item:${slug}`;
export const ITEMS_TAG = "items";

export async function getCatalogue(params: CatalogueParams) {
  "use cache";
  cacheLife("minutes");
  cacheTag(ITEMS_TAG);
  return searchItems(params);
}

export async function getItem(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(ITEMS_TAG, itemTag(slug));
  return getItemBySlug(slug);
}

export async function getCategories() {
  "use cache";
  cacheLife("days");
  cacheTag("categories");
  return listCategories();
}
