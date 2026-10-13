import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "No access", robots: { index: false } };

export default function ForbiddenPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-2xl font-bold text-ink">You don&apos;t have access to that page</h1>
      <p className="mt-2 text-muted">It&apos;s only available to a different type of account.</p>
      <Link href="/" className="btn-primary mt-6">
        Back to browsing
      </Link>
    </div>
  );
}
