"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { addDays, daysInclusive, type DateRange } from "@/lib/dates";
import {
  addMonths,
  bookedDaySet,
  formatLongDate,
  formatMonth,
  monthGrid,
  monthOf,
  rangeIsFree,
} from "@/lib/calendar";

export type Selection = { start?: string; end?: string };

type Props = {
  booked: DateRange[];
  today: string;
  value: Selection;
  onChange: (value: Selection) => void;
  maxDays: number;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Month grid following the WAI-ARIA date-grid pattern: one tab stop for the
 * whole grid (roving tabindex), arrow keys move by day/week, Home/End jump to
 * the start/end of the week and PageUp/PageDown change month. Unavailable days
 * stay focusable (aria-disabled) so screen-reader users can still discover them.
 */
export function AvailabilityCalendar({ booked, today, value, onChange, maxDays }: Props) {
  const [month, setMonth] = useState(() => monthOf(value.start ?? today));
  const [focused, setFocused] = useState(() => value.start ?? today);
  const [message, setMessage] = useState("");
  const moveFocus = useRef(false);
  const buttons = useRef(new Map<string, HTMLButtonElement>());

  const bookedDays = useMemo(() => bookedDaySet(booked), [booked]);
  const weeks = useMemo(() => monthGrid(month), [month]);
  const minMonth = monthOf(today);

  // After keyboard navigation, move real DOM focus to the newly focused day.
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    buttons.current.get(focused)?.focus();
  }, [focused, month]);

  const isUnavailable = (day: string) => day < today || bookedDays.has(day);

  function focusDay(day: string) {
    const target = day < today ? today : day;
    moveFocus.current = true;
    setFocused(target);
    if (monthOf(target) !== month) setMonth(monthOf(target));
  }

  function select(day: string) {
    if (isUnavailable(day)) {
      setMessage(day < today ? "That date is in the past." : "That date is already booked.");
      return;
    }
    const { start, end } = value;
    if (!start || end || day < start) {
      onChange({ start: day, end: undefined });
      setMessage(`Start date ${formatLongDate(day)} selected. Now choose an end date.`);
      return;
    }
    if (!rangeIsFree({ start, end: day }, booked)) {
      setMessage("That range includes booked days. Choose an earlier end date or a new start date.");
      return;
    }
    if (daysInclusive(start, day) > maxDays) {
      setMessage(`Rentals can be at most ${maxDays} days.`);
      return;
    }
    onChange({ start, end: day });
    setMessage(`Selected ${formatLongDate(start)} to ${formatLongDate(day)}.`);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, day: string) {
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(day, -1),
      ArrowRight: () => addDays(day, 1),
      ArrowUp: () => addDays(day, -7),
      ArrowDown: () => addDays(day, 7),
      Home: () => addDays(day, -weekday),
      End: () => addDays(day, 6 - weekday),
      PageUp: () => shiftMonth(day, -1),
      PageDown: () => shiftMonth(day, 1),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    focusDay(move());
  }

  const inRange = (day: string) =>
    value.start !== undefined && value.end !== undefined && day >= value.start && day <= value.end;

  // The roving tab stop must sit on a day that is actually rendered.
  const tabStop = monthOf(focused) === month ? focused : weeks.flat().find((d) => monthOf(d) === month)!;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          className="btn-secondary px-3 py-1.5"
          onClick={() => setMonth(addMonths(month, -1))}
          disabled={month <= minMonth}
          aria-label="Previous month"
        >
          <span aria-hidden="true">←</span>
        </button>
        <h3 id="calendar-month" className="font-semibold text-ink" aria-live="polite">
          {formatMonth(month)}
        </h3>
        <button
          type="button"
          className="btn-secondary px-3 py-1.5"
          onClick={() => setMonth(addMonths(month, 1))}
          aria-label="Next month"
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <table role="grid" aria-labelledby="calendar-month" className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr>
            {WEEKDAYS.map((label, i) => (
              <th key={label} scope="col" abbr={WEEKDAY_NAMES[i]} className="pb-2 text-xs font-medium text-muted">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((day) => {
                const outside = monthOf(day) !== month;
                if (outside) return <td key={day} />;
                const unavailable = isUnavailable(day);
                const isBooked = bookedDays.has(day);
                const selected = day === value.start || day === value.end || inRange(day);
                const edge = day === value.start || day === value.end;
                const label = `${formatLongDate(day)}${isBooked ? ", booked" : day < today ? ", unavailable" : ""}`;
                return (
                  <td key={day} role="gridcell" aria-selected={selected} className="p-0.5">
                    <button
                      ref={(el) => {
                        if (el) buttons.current.set(day, el);
                        else buttons.current.delete(day);
                      }}
                      type="button"
                      tabIndex={day === tabStop ? 0 : -1}
                      aria-label={label}
                      aria-disabled={unavailable || undefined}
                      data-date={day}
                      onClick={() => select(day)}
                      onKeyDown={(event) => onKeyDown(event, day)}
                      onFocus={() => setFocused(day)}
                      className={[
                        "grid h-10 w-full place-items-center rounded-lg font-medium transition-colors",
                        edge
                          ? "bg-brand-700 text-white"
                          : selected
                            ? "bg-brand-100 text-brand-800"
                            : isBooked
                              ? "cursor-not-allowed bg-stone-100 text-stone-400 line-through"
                              : unavailable
                                ? "cursor-not-allowed text-stone-300"
                                : "text-ink hover:bg-brand-50",
                        day === today && !edge ? "ring-1 ring-inset ring-stone-400" : "",
                      ].join(" ")}
                    >
                      {Number(day.slice(8))}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-brand-700" /> Selected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-stone-200" /> Booked
        </span>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {message}
      </p>
      {message && !message.startsWith("Selected") && !message.startsWith("Start date") && (
        <p className="mt-2 text-sm text-danger" aria-hidden="true">
          {message}
        </p>
      )}
    </div>
  );
}

function shiftMonth(day: string, delta: number): string {
  const target = addMonths(monthOf(day), delta);
  const wanted = Number(day.slice(8));
  // Clamp e.g. Jan 31 → Feb 28.
  const lastDay = Number(addDays(`${addMonths(target, 1)}-01`, -1).slice(8));
  return `${target}-${String(Math.min(wanted, lastDay)).padStart(2, "0")}`;
}
