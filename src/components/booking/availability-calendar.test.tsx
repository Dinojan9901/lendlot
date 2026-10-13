import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { AvailabilityCalendar, type Selection } from "./availability-calendar";

const TODAY = "2026-10-13";
const BOOKED = [{ start: "2026-10-16", end: "2026-10-18" }];

function Harness({ onChange = () => {} }: { onChange?: (s: Selection) => void }) {
  const [value, setValue] = useState<Selection>({});
  return (
    <AvailabilityCalendar
      booked={BOOKED}
      today={TODAY}
      value={value}
      maxDays={30}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

const day = (iso: string) => document.querySelector<HTMLButtonElement>(`button[data-date="${iso}"]`)!;

describe("AvailabilityCalendar", () => {
  it("renders the current month as an accessible grid", () => {
    render(<Harness />);
    expect(screen.getByRole("grid", { name: "October 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tuesday, October 13, 2026" })).toBeInTheDocument();
  });

  it("marks booked and past days as unavailable but keeps them discoverable", () => {
    render(<Harness />);
    const booked = screen.getByRole("button", { name: "Saturday, October 17, 2026, booked" });
    expect(booked).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Monday, October 12, 2026, unavailable" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("selects a start and end date with clicks", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(day("2026-10-20"));
    await user.click(day("2026-10-22"));
    expect(onChange).toHaveBeenLastCalledWith({ start: "2026-10-20", end: "2026-10-22" });
    expect(day("2026-10-21").closest("td")).toHaveAttribute("aria-selected", "true");
  });

  it("refuses a range that crosses booked days and explains why", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(day("2026-10-14"));
    await user.click(day("2026-10-20"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("That range includes booked days");
  });

  it("ignores clicks on booked days", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(day("2026-10-17"));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("already booked");
  });

  it("has a single tab stop and supports arrow-key navigation", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    const tabbable = document.querySelectorAll('[role="grid"] button[tabindex="0"]');
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toHaveAttribute("data-date", TODAY);

    (tabbable[0] as HTMLElement).focus();
    await user.keyboard("{ArrowDown}"); // Oct 20
    expect(day("2026-10-20")).toHaveFocus();
    await user.keyboard("{Enter}{ArrowRight}{ArrowRight}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith({ start: "2026-10-20", end: "2026-10-22" });
  });

  it("moves to the next month with PageDown", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    day("2026-10-20").focus();
    await user.keyboard("{PageDown}");
    expect(screen.getByRole("grid", { name: "November 2026" })).toBeInTheDocument();
    expect(day("2026-11-20")).toHaveFocus();
  });

  it("doesn't let you go back before the current month", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Previous month" })).toBeDisabled();
  });
});
