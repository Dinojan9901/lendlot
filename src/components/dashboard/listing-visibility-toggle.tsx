"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** Shows/hides a listing via PATCH /api/items/:id. */
export function ListingVisibilityToggle({ itemId, title, isActive }: { itemId: string; title: string; isActive: boolean }) {
  const router = useRouter();
  const [active, setActive] = useState(isActive);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !active;
    setError(null);
    setActive(next); // optimistic
    startTransition(async () => {
      const response = await fetch(`/api/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!response.ok) {
        setActive(!next);
        setError("Couldn't update this listing.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={`Listed publicly: ${title}`}
        onClick={toggle}
        disabled={pending}
        className="flex items-center gap-2 text-sm font-medium text-ink"
      >
        <span
          aria-hidden="true"
          className={`relative h-6 w-11 rounded-full transition-colors ${active ? "bg-brand-700" : "bg-stone-300"}`}
        >
          <span
            className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
              active ? "translate-x-5.5" : "translate-x-0.5"
            }`}
          />
        </span>
        {active ? "Listed" : "Hidden"}
      </button>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
