import { Suspense } from "react";
import { CategoryFilter } from "@/components/catalogue/category-filter";
import { ItemCard } from "@/components/catalogue/item-card";
import { Pagination } from "@/components/catalogue/pagination";
import { SearchForm } from "@/components/catalogue/search-form";
import { CatalogueSkeleton } from "@/components/catalogue/catalogue-skeleton";
import { catalogueHref } from "@/lib/catalogue-url";
import { parseCatalogueParams } from "@/lib/validation";
import { getCatalogue, getCategories } from "@/server/catalog";

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Static: part of the prerendered shell. */}
      <section className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Rent it from someone nearby.
        </h1>
        <p className="mt-3 text-lg text-muted">
          Tools, camping gear, cameras and party kit from owners in your neighbourhood — booked by the day.
        </p>
      </section>
      {/* Dynamic: depends on the URL, so it streams in behind a skeleton. */}
      <Suspense fallback={<CatalogueSkeleton />}>
        <Catalogue searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Catalogue({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const params = parseCatalogueParams(await searchParams);
  const [result, categories] = await Promise.all([getCatalogue(params), getCategories()]);
  const activeCategory = categories.find((c) => c.slug === params.category);

  return (
    <>
      <div className="flex flex-col gap-4">
        <SearchForm q={params.q} category={params.category} />
        <CategoryFilter categories={categories} active={params.category} q={params.q} />
      </div>

      <section aria-labelledby="results-heading" className="mt-8">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="results-heading" className="text-lg font-semibold text-ink">
            {activeCategory?.name ?? "All items"}
            {params.q && <> matching “{params.q}”</>}
          </h2>
          <p className="text-sm text-muted" role="status">
            {result.total} {result.total === 1 ? "item" : "items"}
            {result.pageCount > 1 && ` · page ${result.page} of ${result.pageCount}`}
          </p>
        </div>

        {result.items.length > 0 ? (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((item, index) => (
              <li key={item.id} className="flex">
                <ItemCard item={item} priority={index < 3} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="card px-6 py-12 text-center">
            <p className="font-medium text-ink">No items match your search.</p>
            <p className="mt-1 text-sm text-muted">
              Try a different word or{" "}
              <a href={catalogueHref({})} className="font-medium text-brand-700 underline">
                browse everything
              </a>
              .
            </p>
          </div>
        )}

        <Pagination page={result.page} pageCount={result.pageCount} q={params.q} category={params.category} />
      </section>
    </>
  );
}
