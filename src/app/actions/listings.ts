"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { fieldErrors, listingInputSchema, type FieldErrors } from "@/lib/validation";
import { ITEMS_TAG, itemTag } from "@/server/catalog";
import { DomainError } from "@/server/errors";
import { createListing, updateListing } from "@/server/listings";
import { requireRole, OWNER_ROLES } from "@/server/session";

export type ListingFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: FieldErrors;
  values?: Record<string, string>;
};

function readForm(formData: FormData) {
  return Object.fromEntries(
    ["title", "description", "dailyPrice", "location", "categoryId", "imageUrl"].map((key) => [
      key,
      String(formData.get(key) ?? ""),
    ]),
  );
}

/**
 * Create and edit share one action. The item id comes from a bound argument
 * (not a form field), and ownership is enforced inside the service.
 */
export async function saveListingAction(
  itemId: string | null,
  _prev: ListingFormState,
  formData: FormData,
): Promise<ListingFormState> {
  const user = await requireRole(OWNER_ROLES, "/dashboard/listings");
  const values = readForm(formData);
  const parsed = listingInputSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error), values };
  }

  let slug: string;
  try {
    const item = itemId ? await updateListing(user, itemId, parsed.data) : await createListing(user, parsed.data);
    slug = item.slug;
  } catch (error) {
    if (error instanceof DomainError) return { status: "error", message: error.message, values };
    throw error;
  }

  // Read-your-own-writes: expire the cached catalogue and item page now.
  updateTag(ITEMS_TAG);
  updateTag(itemTag(slug));
  redirect(`/dashboard/listings?saved=${slug}`);
}
