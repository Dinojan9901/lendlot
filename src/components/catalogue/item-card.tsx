import Image from "next/image";
import Link from "next/link";
import { formatCents } from "@/lib/pricing";
import type { ItemSummary } from "@/server/items";

type Props = {
  item: ItemSummary;
  /** "high": the likely LCP image; "eager": above the fold; "lazy": everything else. */
  load?: "high" | "eager" | "lazy";
};

export function ItemCard({ item, load = "lazy" }: Props) {
  return (
    <article className="group card relative flex w-full flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div className="relative aspect-[3/2] bg-stone-100">
        <Image
          src={item.imageUrl}
          alt=""
          fill
          loading={load === "lazy" ? "lazy" : "eager"}
          fetchPriority={load === "high" ? "high" : "auto"}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-700">{item.category.name}</p>
        <h3 className="font-semibold text-ink">
          {/* The stretched link makes the whole card clickable with one tab stop. */}
          <Link href={`/items/${item.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {item.title}
          </Link>
        </h3>
        <p className="text-sm text-muted">{item.location}</p>
        <p className="mt-auto pt-2 text-sm">
          <span className="text-base font-semibold text-ink">{formatCents(item.dailyPriceCents)}</span>{" "}
          <span className="text-muted">/ day</span>
        </p>
      </div>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl ring-brand-600 group-has-[:focus-visible]:ring-2"
      />
    </article>
  );
}
