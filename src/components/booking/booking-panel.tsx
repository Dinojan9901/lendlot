"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createBookingAction, type BookingFormState } from "@/app/actions/bookings";
import { ErrorSummary } from "@/components/forms/field";
import { useFocusOnError } from "@/components/forms/use-focus-on-error";
import { daysInclusive, formatDate, isIsoDate, todayIso, type DateRange } from "@/lib/dates";
import { formatCents, quotePrice } from "@/lib/pricing";
import { MAX_RENTAL_DAYS } from "@/lib/validation";
import { AvailabilityCalendar, type Selection } from "./availability-calendar";

type Props = {
  itemId: string;
  itemSlug: string;
  dailyPriceCents: number;
};

const initialState: BookingFormState = { status: "idle" };

export function BookingPanel({ itemId, itemSlug, dailyPriceCents }: Props) {
  const [state, formAction, pending] = useActionState(createBookingAction, initialState);
  const [selection, setSelection] = useState<Selection>({});
  const [availability, setAvailability] = useState<{ booked: DateRange[] } | "error" | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [today] = useState(() => todayIso());
  const [seenState, setSeenState] = useState(state);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusOnError(formRef, state);

  // Someone else booked these dates first: clear the selection and reload
  // availability. Done while rendering (not in an effect) as React recommends
  // for reacting to a changed value.
  if (state !== seenState) {
    setSeenState(state);
    if (state.code === "CONFLICT") {
      setSelection({});
      setReloadKey((key) => key + 1);
    }
  }

  // The page itself is cached (ISR), so availability is fetched live from
  // the REST endpoint instead of being baked into the HTML.
  useEffect(() => {
    let ignore = false;
    fetch(`/api/items/${itemId}/availability`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((data: { booked: DateRange[] }) => {
        if (!ignore) setAvailability({ booked: data.booked });
      })
      .catch(() => {
        if (!ignore) setAvailability("error");
      });
    return () => {
      ignore = true;
    };
  }, [itemId, reloadKey]);

  const { start, end } = selection;
  const quote =
    start && end && isIsoDate(start) && isIsoDate(end) && end >= start && daysInclusive(start, end) <= MAX_RENTAL_DAYS
      ? quotePrice({ dailyPriceCents, startDate: start, endDate: end })
      : null;

  const startError = state.fieldErrors?.startDate;
  const endError = state.fieldErrors?.endDate;

  return (
    <div className="card p-5">
      <p className="text-2xl font-bold text-ink">
        {formatCents(dailyPriceCents)} <span className="text-base font-normal text-muted">/ day</span>
      </p>

      <h2 className="mt-5 mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Availability</h2>
      {availability === "error" ? (
        <p className="text-sm text-danger" role="alert">
          Couldn&apos;t load availability.{" "}
          <button type="button" className="font-medium underline" onClick={() => setReloadKey((key) => key + 1)}>
            Try again
          </button>
        </p>
      ) : availability ? (
        <AvailabilityCalendar
          booked={availability.booked}
          today={today}
          value={selection}
          onChange={setSelection}
          maxDays={MAX_RENTAL_DAYS}
        />
      ) : (
        <div className="h-72 animate-pulse rounded-lg bg-stone-100" aria-label="Loading availability" />
      )}

      <form ref={formRef} action={formAction} className="mt-5 space-y-4" noValidate>
        <ErrorSummary message={state.message} />

        <input type="hidden" name="itemId" value={itemId} />
        <input type="hidden" name="returnTo" value={`/items/${itemSlug}`} />

        {/* Real date inputs mirror the calendar: they work without JavaScript,
            can be typed into directly, and carry the values that get submitted. */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="startDate" className="label">
              Start date
            </label>
            <input
              id="startDate"
              name="startDate"
              type="date"
              min={today}
              required
              className="input"
              value={start ?? ""}
              onChange={(e) => setSelection({ start: e.target.value || undefined, end })}
              aria-invalid={startError ? true : undefined}
              aria-describedby={startError ? "startDate-error" : undefined}
            />
            {startError && (
              <p id="startDate-error" className="field-error">
                {startError}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="endDate" className="label">
              End date
            </label>
            <input
              id="endDate"
              name="endDate"
              type="date"
              min={start ?? today}
              required
              className="input"
              value={end ?? ""}
              onChange={(e) => setSelection({ start, end: e.target.value || undefined })}
              aria-invalid={endError ? true : undefined}
              aria-describedby={endError ? "endDate-error" : undefined}
            />
            {endError && (
              <p id="endDate-error" className="field-error">
                {endError}
              </p>
            )}
          </div>
        </div>

        {quote && start && end && (
          <div className="border-t border-line pt-4 text-sm">
            <h3 className="sr-only">Price breakdown</h3>
            <dl className="space-y-1.5">
              <div className="flex justify-between">
                <dt className="text-muted">
                  {formatCents(quote.dailyPriceCents)} × {quote.days} {quote.days === 1 ? "day" : "days"}
                </dt>
                <dd>{formatCents(quote.subtotalCents)}</dd>
              </div>
              {quote.discounts.map((line) => (
                <div key={line.label} className="flex justify-between text-brand-700">
                  <dt>{line.label}</dt>
                  <dd>−{formatCents(line.amountCents)}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd data-testid="total-price">{formatCents(quote.totalCents)}</dd>
              </div>
            </dl>
            <p className="mt-1.5 text-xs text-muted">
              {formatDate(start)} – {formatDate(end)}
            </p>
          </div>
        )}

        <button type="submit" className="btn-primary w-full" disabled={pending}>
          {pending ? "Booking…" : "Confirm booking"}
        </button>
        <p className="text-center text-xs text-muted">You won&apos;t be charged in this demo.</p>
      </form>
    </div>
  );
}
