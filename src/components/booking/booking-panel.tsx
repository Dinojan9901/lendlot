"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { createBookingAction, type BookingFormState } from "@/app/actions/bookings";
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
  const [booked, setBooked] = useState<DateRange[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [today] = useState(() => todayIso());
  const errorRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);

  // The page itself is cached (ISR), so availability is fetched live from
  // the REST endpoint instead of being baked into the HTML.
  const loadAvailability = useCallback(async () => {
    try {
      const response = await fetch(`/api/items/${itemId}/availability`, { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as { booked: DateRange[] };
      setBooked(data.booked);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [itemId]);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  // After a failed submit, move focus to the first invalid field (or the
  // error summary) so keyboard and screen-reader users land on the problem.
  useEffect(() => {
    if (state.status !== "error") return;
    if (state.fieldErrors?.startDate) startRef.current?.focus();
    else if (state.fieldErrors?.endDate) endRef.current?.focus();
    else errorRef.current?.focus();
    if (state.code === "CONFLICT") {
      setSelection({});
      void loadAvailability();
    }
  }, [state, loadAvailability]);

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
      {booked ? (
        <AvailabilityCalendar
          booked={booked}
          today={today}
          value={selection}
          onChange={setSelection}
          maxDays={MAX_RENTAL_DAYS}
        />
      ) : loadError ? (
        <p className="text-sm text-danger" role="alert">
          Couldn&apos;t load availability.{" "}
          <button type="button" className="font-medium underline" onClick={() => void loadAvailability()}>
            Try again
          </button>
        </p>
      ) : (
        <div className="h-72 animate-pulse rounded-lg bg-stone-100" aria-label="Loading availability" />
      )}

      <form action={formAction} className="mt-5 space-y-4" noValidate>
        {state.status === "error" && state.message && (
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger"
          >
            {state.message}
          </div>
        )}

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
              ref={startRef}
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
              ref={endRef}
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
          <dl className="space-y-1.5 border-t border-line pt-4 text-sm" aria-label="Price breakdown">
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
            <p className="text-xs text-muted">
              {formatDate(start)} – {formatDate(end)}
            </p>
          </dl>
        )}

        <button type="submit" className="btn-primary w-full" disabled={pending} aria-disabled={pending}>
          {pending ? "Booking…" : "Confirm booking"}
        </button>
        <p className="text-center text-xs text-muted">You won&apos;t be charged in this demo.</p>
      </form>
    </div>
  );
}
