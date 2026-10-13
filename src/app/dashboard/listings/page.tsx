import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ListingVisibilityToggle } from "@/components/dashboard/listing-visibility-toggle";
import { formatCents } from "@/lib/pricing";
import { firstParam } from "@/lib/validation";
import { listOwnerListings } from "@/server/listings";
import { OWNER_ROLES, requireRole } from "@/server/session";

export const metadata: Metadata = { title: "My listings" };

export default async function MyListingsPage({ searchParams }: PageProps<"/dashboard/listings">) {
  const user = await requireRole(OWNER_ROLES, "/dashboard/listings");
  const saved = firstParam((await searchParams).saved);
  const listings = await listOwnerListings(user.id);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-ink">My listings</h1>
        <Link href="/dashboard/listings/new" className="btn-primary">
          New listing
        </Link>
      </div>

      {saved && (
        <div role="status" className="mt-4 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          Listing saved.{" "}
          <Link href={`/items/${saved}`} className="font-medium underline">
            View it
          </Link>
        </div>
      )}

      {listings.length === 0 ? (
        <div className="card mt-6 px-6 py-12 text-center">
          <p className="font-medium text-ink">You haven&apos;t listed anything yet.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {listings.map((item) => (
            <li key={item.id} className="card flex flex-wrap items-center gap-4 p-4">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                <Image src={item.imageUrl} alt="" fill sizes="64px" className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/items/${item.slug}`} className="font-semibold text-ink hover:underline">
                  {item.title}
                </Link>
                <p className="text-sm text-muted">
                  {item.category.name} · {formatCents(item.dailyPriceCents)}/day · {item._count.bookings}{" "}
                  {item._count.bookings === 1 ? "booking" : "bookings"}
                </p>
              </div>
              <ListingVisibilityToggle itemId={item.id} title={item.title} isActive={item.isActive} />
              <Link href={`/dashboard/listings/${item.id}/edit`} className="btn-secondary py-2" aria-label={`Edit ${item.title}`}>
                Edit
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
