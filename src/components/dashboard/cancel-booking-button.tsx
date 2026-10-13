"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** Cancels via the REST API, then refreshes the Server Component list. */
export function CancelBookingButton({ bookingId, itemTitle }: { bookingId: string; itemTitle: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function cancel() {
    if (!window.confirm(`Cancel your booking for ${itemTitle}?`)) return;
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Couldn't cancel this booking.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={cancel}
        disabled={pending}
        className="btn-danger py-2"
        aria-label={`Cancel booking for ${itemTitle}`}
      >
        {pending ? "Cancelling…" : "Cancel"}
      </button>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
