import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingPanel } from "@/components/booking/booking-panel";
import { catalogueHref } from "@/lib/catalogue-url";
import { formatCents } from "@/lib/pricing";
import { siteUrl } from "@/lib/site";
import { getItem } from "@/server/catalog";
import { listPopularSlugs } from "@/server/items";

/**
 * Item pages are statically generated: the newest items at build time, any
 * other item on its first request. They are then served from the cache and
 * refreshed when the cached data expires or the owner edits the listing.
 */
export async function generateStaticParams() {
  const slugs = await listPopularSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/items/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const item = await getItem(slug);
  if (!item) return { title: "Item not found" };

  const description = `${formatCents(item.dailyPriceCents)}/day in ${item.location}. ${truncate(item.description, 140)}`;
  return {
    title: item.title,
    description,
    alternates: { canonical: `/items/${item.slug}` },
    openGraph: {
      type: "website",
      title: `${item.title} — ${formatCents(item.dailyPriceCents)}/day`,
      description,
      url: `/items/${item.slug}`,
      images: [{ url: item.imageUrl, width: 1200, height: 800, alt: item.title }],
    },
    twitter: { card: "summary_large_image", title: item.title, description, images: [item.imageUrl] },
  };
}

export default async function ItemPage({ params }: PageProps<"/items/[slug]">) {
  const { slug } = await params;
  const item = await getItem(slug);
  if (!item) notFound();

  // Structured data so search engines can show price and availability.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.title,
    description: item.description,
    image: new URL(item.imageUrl, siteUrl()).toString(),
    category: item.category.name,
    offers: {
      "@type": "Offer",
      price: (item.dailyPriceCents / 100).toFixed(2),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-ink hover:underline">
              Browse
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={catalogueHref({ category: item.category.slug })} className="hover:text-ink hover:underline">
              {item.category.name}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink">
            {item.title}
          </li>
        </ol>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <article>
          <div className="relative aspect-[3/2] overflow-hidden rounded-2xl bg-stone-100">
            <Image
              src={item.imageUrl}
              alt={item.title}
              fill
              preload
              sizes="(min-width: 1024px) 700px, 100vw"
              className="object-cover"
            />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-ink">{item.title}</h1>
          <p className="mt-2 text-muted">
            {item.location} · Listed by {item.owner.name}
          </p>
          <h2 className="mt-8 text-lg font-semibold text-ink">About this item</h2>
          <p className="mt-2 max-w-prose leading-7 text-ink">{item.description}</p>
          <h2 className="mt-8 text-lg font-semibold text-ink">How it works</h2>
          <ol className="mt-2 max-w-prose list-decimal space-y-1 pl-5 text-ink">
            <li>Pick your dates on the calendar — booked days are crossed out.</li>
            <li>Check the price. Rentals of 7 days or more get 10% off.</li>
            <li>Confirm, then arrange pickup with the owner from “My bookings”.</li>
          </ol>
        </article>
        <aside aria-label="Book this item" className="lg:sticky lg:top-6 lg:self-start">
          <BookingPanel itemId={item.id} itemSlug={item.slug} dailyPriceCents={item.dailyPriceCents} />
        </aside>
      </div>
    </div>
  );
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
