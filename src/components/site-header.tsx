import Link from "next/link";
import { Suspense } from "react";
import { UserNav } from "./user-nav";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-ink">
          <span aria-hidden="true" className="grid size-8 place-items-center rounded-lg bg-brand-700 text-white">
            L
          </span>
          Lendlot
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm sm:gap-2">
          <Link href="/" className="rounded-lg px-3 py-2 font-medium text-muted hover:bg-stone-100 hover:text-ink">
            Browse
          </Link>
          {/* The only per-user part of the header. It streams in separately so
              every page around it can still be served from the static cache. */}
          <Suspense fallback={<div className="h-9 w-20" aria-hidden="true" />}>
            <UserNav />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
