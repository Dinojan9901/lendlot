import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { changeRoleAction } from "@/app/actions/admin";
import { formatDate, toIsoDate } from "@/lib/dates";
import { formatCents } from "@/lib/pricing";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-ink">Admin</h1>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-2xl bg-stone-200" />}>
        <AdminContent />
      </Suspense>
    </div>
  );
}

async function AdminContent() {
  const admin = await requireRole(["ADMIN"], "/admin");
  const [users, bookings, stats] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true, _count: { select: { items: true, bookings: true } } },
    }),
    prisma.booking.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { item: { select: { title: true, slug: true } }, renter: { select: { name: true } } },
    }),
    Promise.all([prisma.item.count(), prisma.booking.count({ where: { status: "CONFIRMED" } })]),
  ]);

  return (
    <>
      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          ["Users", users.length],
          ["Listings", stats[0]],
          ["Confirmed bookings", stats[1]],
        ].map(([label, value]) => (
          <div key={label} className="card p-4">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="text-2xl font-bold text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="users-heading" className="mt-10">
        <h2 id="users-heading" className="mb-3 text-lg font-semibold text-ink">
          Users
        </h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Name</th>
                <th scope="col" className="px-4 py-3 font-medium">Email</th>
                <th scope="col" className="px-4 py-3 font-medium">Listings</th>
                <th scope="col" className="px-4 py-3 font-medium">Bookings</th>
                <th scope="col" className="px-4 py-3 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{user.name}</td>
                  <td className="px-4 py-3 text-muted">{user.email}</td>
                  <td className="px-4 py-3">{user._count.items}</td>
                  <td className="px-4 py-3">{user._count.bookings}</td>
                  <td className="px-4 py-3">
                    {user.id === admin.id ? (
                      <span className="text-muted">{user.role} (you)</span>
                    ) : (
                      <form action={changeRoleAction} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <label htmlFor={`role-${user.id}`} className="sr-only">
                          Role for {user.name}
                        </label>
                        <select id={`role-${user.id}`} name="role" defaultValue={user.role} className="input w-auto py-1.5">
                          <option value="RENTER">Renter</option>
                          <option value="OWNER">Owner</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                        <button type="submit" className="btn-secondary py-1.5">
                          Save
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="bookings-heading" className="mt-10">
        <h2 id="bookings-heading" className="mb-3 text-lg font-semibold text-ink">
          Latest bookings
        </h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Item</th>
                <th scope="col" className="px-4 py-3 font-medium">Renter</th>
                <th scope="col" className="px-4 py-3 font-medium">Dates</th>
                <th scope="col" className="px-4 py-3 font-medium">Total</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/items/${booking.item.slug}`} className="font-medium text-ink hover:underline">
                      {booking.item.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{booking.renter.name}</td>
                  <td className="px-4 py-3 text-muted">
                    {formatDate(toIsoDate(booking.startDate))} – {formatDate(toIsoDate(booking.endDate))}
                  </td>
                  <td className="px-4 py-3">{formatCents(booking.totalCents)}</td>
                  <td className="px-4 py-3">{booking.status === "CONFIRMED" ? "Confirmed" : "Cancelled"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
