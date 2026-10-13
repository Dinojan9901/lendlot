"use client";

import { useEffect } from "react";

/** Catches unexpected errors in any page below the root layout. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-2xl font-bold text-ink">Something went wrong</h1>
      <p className="mt-2 text-muted">
        An unexpected error occurred. Please try again.
        {error.digest && <span className="mt-1 block text-xs">Reference: {error.digest}</span>}
      </p>
      <button type="button" onClick={retry} className="btn-primary mt-6">
        Try again
      </button>
    </div>
  );
}
