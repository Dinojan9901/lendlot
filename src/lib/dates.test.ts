import { describe, expect, it } from "vitest";
import { addDays, daysInclusive, eachDay, isIsoDate, rangesOverlap, todayIso } from "./dates";

describe("dates", () => {
  it("validates real calendar dates only", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-2-3")).toBe(false);
    expect(isIsoDate("not a date")).toBe(false);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("counts inclusive days", () => {
    expect(daysInclusive("2026-11-01", "2026-11-01")).toBe(1);
    expect(daysInclusive("2026-11-01", "2026-11-10")).toBe(10);
  });

  it("lists each day in a range", () => {
    expect(eachDay("2026-11-29", "2026-12-01")).toEqual(["2026-11-29", "2026-11-30", "2026-12-01"]);
  });

  it("uses UTC for 'today' so the date doesn't depend on the server timezone", () => {
    expect(todayIso(new Date("2026-10-13T23:30:00-05:00"))).toBe("2026-10-14");
  });

  it.each([
    [{ start: "2026-11-01", end: "2026-11-05" }, { start: "2026-11-05", end: "2026-11-07" }, true],
    [{ start: "2026-11-01", end: "2026-11-05" }, { start: "2026-11-06", end: "2026-11-07" }, false],
    [{ start: "2026-11-03", end: "2026-11-03" }, { start: "2026-11-01", end: "2026-11-05" }, true],
  ])("rangesOverlap(%o, %o) is %s (end days are inclusive)", (a, b, expected) => {
    expect(rangesOverlap(a, b)).toBe(expected);
    expect(rangesOverlap(b, a)).toBe(expected);
  });
});
