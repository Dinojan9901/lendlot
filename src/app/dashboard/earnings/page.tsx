import type { Metadata } from "next";
import Link from "next/link";
import { MonthlyEarningsChart } from "@/components/dashboard/monthly-earnings-chart";
import { formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/pricing";
import { getOwnerEarnings } from "@/server/earnings";
import { OWNER_ROLES, requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Earnings" };

export default async function EarningsPage() {
  const user = await requireRole(OWNER_ROLES, "/dashboard/earnings");
  const summary = await getOwnerEarnings(user.id);

  const tiles = [
    { label: "Earned to date", value: formatCents(summary.earnedCents) },
    { label: "Upcoming revenue", value: formatCents(summary.upcomingCents) },
    { label: "Confirmed bookings", value: String(summary.bookingCount) },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Earnings</h1>

      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="card p-4">
            <dt className="text-sm text-muted">{tile.label}</dt>
            <dd className="mt-1 text-2xl font-semibold text-ink">{tile.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="monthly-heading" className="card mt-6 p-5">
        <h2 id="monthly-heading" className="mb-1 font-semibold text-ink">
          Revenue by month
        </h2>
        <p className="mb-4 text-sm text-muted">Confirmed bookings, by the month the rental starts.</p>
        <MonthlyEarningsChart months={summary.months} />
      </section>

      <section aria-labelledby="upcoming-heading" className="mt-8">
        <h2 id="upcoming-heading" className="mb-3 text-lg font-semibold text-ink">
          Upcoming bookings
        </h2>
        {summary.upcoming.length === 0 ? (
          <p className="text-sm text-muted">No upcoming bookings yet.</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Item</th>
                  <th scope="col" className="px-4 py-3 font-medium">Renter</th>
                  <th scope="col" className="px-4 py-3 font-medium">Dates</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {summary.upcoming.map((booking) => (
                  <tr key={booking.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/items/${booking.itemSlug}`} className="font-medium text-ink hover:underline">
                        {booking.itemTitle}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{booking.renterName}</td>
                    <td className="px-4 py-3 text-muted">
                      {formatDate(booking.startDate)} – {formatDate(booking.endDate)}
                      {booking.inProgress && (
                        <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                          In progress
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-ink">{formatCents(booking.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
