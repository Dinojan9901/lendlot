import Link from "next/link";
import { catalogueHref, paginationRange } from "@/lib/catalogue-url";

type Props = { page: number; pageCount: number; q?: string; category?: string };

export function Pagination({ page, pageCount, q, category }: Props) {
  if (pageCount <= 1) return null;
  const href = (p: number) => catalogueHref({ q, category, page: p });
  const base = "grid h-10 min-w-10 place-items-center rounded-lg px-3 text-sm font-medium";

  return (
    <nav aria-label="Pagination" className="mt-10 flex justify-center">
      <ul className="flex items-center gap-1">
        <li>
          {page > 1 ? (
            <Link href={href(page - 1)} className={`${base} text-ink hover:bg-stone-100`} rel="prev">
              Previous
            </Link>
          ) : (
            <span className={`${base} text-stone-400`} aria-disabled="true">
              Previous
            </span>
          )}
        </li>
        {paginationRange(page, pageCount).map((p, index) =>
          p === null ? (
            <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-muted">
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={href(p)}
                aria-current={p === page ? "page" : undefined}
                aria-label={`Page ${p}`}
                className={`${base} ${p === page ? "bg-brand-700 text-white" : "text-ink hover:bg-stone-100"}`}
              >
                {p}
              </Link>
            </li>
          ),
        )}
        <li>
          {page < pageCount ? (
            <Link href={href(page + 1)} className={`${base} text-ink hover:bg-stone-100`} rel="next">
              Next
            </Link>
          ) : (
            <span className={`${base} text-stone-400`} aria-disabled="true">
              Next
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
