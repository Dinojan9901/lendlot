import Link from "next/link";
import { connection } from "next/server";
import { auth, signOut } from "@/auth";

const linkClass = "rounded-lg px-3 py-2 font-medium text-muted hover:bg-stone-100 hover:text-ink";

export async function UserNav() {
  // Per-request: depends on the session cookie, so never prerendered.
  await connection();
  const session = await auth();
  const user = session?.user;

  if (!user) {
    return (
      <>
        <Link href="/login" className={linkClass}>
          Sign in
        </Link>
        <Link href="/signup" className="btn-primary py-2">
          Sign up
        </Link>
      </>
    );
  }

  return (
    <>
      <Link href="/dashboard/bookings" className={linkClass}>
        My bookings
      </Link>
      {(user.role === "OWNER" || user.role === "ADMIN") && (
        <Link href="/dashboard/listings" className={linkClass}>
          My listings
        </Link>
      )}
      {user.role === "ADMIN" && (
        <Link href="/admin" className={linkClass}>
          Admin
        </Link>
      )}
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button type="submit" className="btn-secondary py-2">
          Sign out
        </button>
      </form>
    </>
  );
}
