import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CancelBookingButton } from "@/components/dashboard/cancel-booking-button";
import { formatDate, todayIso } from "@/lib/dates";
import { formatCents } from "@/lib/pricing";
import { firstParam } from "@/lib/validation";
import { listBookingsForRenter, type BookingWithItem } from "@/server/bookings";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "My bookings" };

export default async function MyBookingsPage({ searchParams }: PageProps<"/dashboard/bookings">) {
  const user = await requireUser("/dashboard/bookings");
  const bookedId = firstParam((await searchParams).booked);
  const bookings = await listBookingsForRenter(user.id);
  const today = todayIso();

  const upcoming = bookings.filter((b) => b.status === "CONFIRMED" && b.endDate >= today).reverse();
  const past = bookings.filter((b) => b.status === "CONFIRMED" && b.endDate < today);
  const cancelled = bookings.filter((b) => b.status === "CANCELLED");
  const justBooked = bookings.find((b) => b.id === bookedId);

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">My bookings</h1>

      {justBooked && (
        <div role="status" className="mt-4 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          <strong>Booked!</strong> {justBooked.item.title}, {formatDate(justBooked.startDate)} –{" "}
          {formatDate(justBooked.endDate)}.
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="card mt-6 px-6 py-12 text-center">
          <p className="font-medium text-ink">You haven&apos;t booked anything yet.</p>
          <Link href="/" className="btn-primary mt-4">
            Browse items
          </Link>
        </div>
      ) : (
        <>
          <BookingSection title="Upcoming" bookings={upcoming} today={today} highlight={bookedId} empty="No upcoming bookings." />
          <BookingSection title="Past" bookings={past} today={today} />
          <BookingSection title="Cancelled" bookings={cancelled} today={today} />
        </>
      )}
    </div>
  );
}

function BookingSection({
  title,
  bookings,
  today,
  highlight,
  empty,
}: {
  title: string;
  bookings: BookingWithItem[];
  today: string;
  highlight?: string;
  empty?: string;
}) {
  if (bookings.length === 0 && !empty) return null;
  const headingId = `${title.toLowerCase()}-heading`;
  return (
    <section aria-labelledby={headingId} className="mt-8">
      <h2 id={headingId} className="mb-3 text-lg font-semibold text-ink">
        {title}
      </h2>
      {bookings.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {bookings.map((booking) => (
            <li
              key={booking.id}
              data-testid="booking-row"
              className={`card flex flex-wrap items-center gap-4 p-4 ${booking.id === highlight ? "ring-2 ring-brand-600" : ""}`}
            >
              <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                <Image src={booking.item.imageUrl} alt="" fill sizes="64px" className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/items/${booking.item.slug}`} className="font-semibold text-ink hover:underline">
                  {booking.item.title}
                </Link>
                <p className="text-sm text-muted">
                  {formatDate(booking.startDate)} – {formatDate(booking.endDate)} · {booking.item.location}
                </p>
              </div>
              <p className="font-semibold text-ink">{formatCents(booking.totalCents)}</p>
              {booking.status === "CONFIRMED" && booking.startDate > today && (
                <CancelBookingButton bookingId={booking.id} itemTitle={booking.item.title} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
