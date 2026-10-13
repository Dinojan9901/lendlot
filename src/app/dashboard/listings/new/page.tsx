import type { Metadata } from "next";
import { ListingForm } from "@/components/dashboard/listing-form";
import { getCategories } from "@/server/catalog";
import { OWNER_ROLES, requireRole } from "@/server/session";

export const metadata: Metadata = { title: "New listing" };

export default async function NewListingPage() {
  await requireRole(OWNER_ROLES, "/dashboard/listings/new");
  const categories = await getCategories();
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-ink">New listing</h1>
      <ListingForm itemId={null} categories={categories} />
    </div>
  );
}
