import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingForm } from "@/components/dashboard/listing-form";
import { getCategories } from "@/server/catalog";
import { DomainError } from "@/server/errors";
import { getListingForEdit } from "@/server/listings";
import { OWNER_ROLES, requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Edit listing" };

export default async function EditListingPage({ params }: PageProps<"/dashboard/listings/[id]/edit">) {
  const user = await requireRole(OWNER_ROLES, "/dashboard/listings");
  const { id } = await params;

  // Another owner's listing is a 404, exactly like a missing one.
  const item = await getListingForEdit(user, id).catch((error: unknown) => {
    if (error instanceof DomainError) notFound();
    throw error;
  });
  const categories = await getCategories();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-ink">Edit listing</h1>
      <ListingForm
        itemId={item.id}
        categories={categories}
        defaults={{
          title: item.title,
          description: item.description,
          dailyPrice: (item.dailyPriceCents / 100).toFixed(2),
          location: item.location,
          categoryId: item.categoryId,
          imageUrl: item.imageUrl,
        }}
      />
    </div>
  );
}
