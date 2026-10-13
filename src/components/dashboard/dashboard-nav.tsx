import { getCurrentUser } from "@/server/session";
import { NavLink } from "./nav-link";

export async function DashboardNav() {
  const user = await getCurrentUser();
  if (!user) return null;
  const isOwner = user.role === "OWNER" || user.role === "ADMIN";

  return (
    <nav aria-label="Dashboard" className="mb-8 border-b border-line">
      <ul className="-mb-px flex gap-6 text-sm font-medium">
        <li>
          <NavLink href="/dashboard/bookings">My bookings</NavLink>
        </li>
        {isOwner && (
          <li>
            <NavLink href="/dashboard/listings">My listings</NavLink>
          </li>
        )}
      </ul>
    </nav>
  );
}
