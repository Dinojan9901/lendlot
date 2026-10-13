import type { CatalogueParams } from "./validation";

/**
 * Builds a catalogue URL. All filter state lives in the URL so results are
 * shareable, bookmarkable, work with the back button and render on the
 * server without any client state.
 */
export function catalogueHref({ q, category, page }: Partial<CatalogueParams>): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

/**
 * Page numbers to show, with null standing for an ellipsis gap,
 * e.g. [1, null, 4, 5, 6, null, 10].
 */
export function paginationRange(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result: (number | null)[] = [];
  for (const [index, page] of sorted.entries()) {
    if (index > 0 && page - sorted[index - 1] > 1) result.push(null);
    result.push(page);
  }
  return result;
}
