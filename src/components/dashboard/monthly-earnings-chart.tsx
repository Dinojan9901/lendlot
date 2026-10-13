import type { MonthTotal } from "@/lib/earnings";
import { formatCents } from "@/lib/pricing";

const CHART_HEIGHT = 160;

/**
 * Column chart of revenue per month. One series, so no legend: the heading
 * names it. Columns are capped at 24px with a rounded top and square base;
 * only the latest month is labelled directly, every column has a hover/focus
 * tooltip, and the same numbers are available as a table for screen readers.
 */
export function MonthlyEarningsChart({ months }: { months: MonthTotal[] }) {
  const max = Math.max(...months.map((m) => m.cents), 1);
  const latest = months.at(-1);

  return (
    <figure>
      <div aria-hidden="true" className="flex items-end gap-2 border-b border-line" style={{ height: CHART_HEIGHT + 28 }}>
        {months.map((month) => {
          const height = Math.round((month.cents / max) * CHART_HEIGHT);
          const isLatest = month === latest;
          return (
            <div key={month.month} className="group relative flex h-full flex-1 flex-col items-center justify-end">
              {isLatest && month.cents > 0 && (
                <span className="mb-1 text-xs font-semibold text-ink">{formatCents(month.cents)}</span>
              )}
              <div
                className="w-full max-w-6 rounded-t bg-brand-600 transition-opacity group-hover:opacity-80"
                style={{ height: Math.max(height, month.cents > 0 ? 2 : 0) }}
              />
              {/* Hit target taller than the mark, so short columns are easy to hover. */}
              <span className="pointer-events-none absolute bottom-full mb-1 hidden whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-white shadow group-hover:block">
                {month.label}: {formatCents(month.cents)}
              </span>
            </div>
          );
        })}
      </div>
      <div aria-hidden="true" className="mt-2 flex gap-2 text-xs text-muted">
        {months.map((month) => (
          <span key={month.month} className="flex-1 text-center">
            {month.label}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">Revenue by month, last {months.length} months</figcaption>
      <table className="sr-only">
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {months.map((month) => (
            <tr key={month.month}>
              <th scope="row">{month.label}</th>
              <td>{formatCents(month.cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
