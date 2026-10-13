import { describe, expect, it } from "vitest";
import { formatCents, quotePrice } from "./pricing";

describe("quotePrice", () => {
  it("charges the daily price for each day, counting both start and end day", () => {
    const quote = quotePrice({ dailyPriceCents: 1250, startDate: "2026-11-01", endDate: "2026-11-03" });
    expect(quote.days).toBe(3);
    expect(quote.subtotalCents).toBe(3750);
    expect(quote.discounts).toEqual([]);
    expect(quote.totalCents).toBe(3750);
  });

  it("treats a same-day rental as one day", () => {
    expect(quotePrice({ dailyPriceCents: 900, startDate: "2026-11-01", endDate: "2026-11-01" }).totalCents).toBe(900);
  });

  it("applies 10% off from 7 days", () => {
    const six = quotePrice({ dailyPriceCents: 1000, startDate: "2026-11-01", endDate: "2026-11-06" });
    const seven = quotePrice({ dailyPriceCents: 1000, startDate: "2026-11-01", endDate: "2026-11-07" });
    expect(six.totalCents).toBe(6000);
    expect(seven.discounts).toEqual([{ label: "Weekly discount (10%)", amountCents: 700 }]);
    expect(seven.totalCents).toBe(6300);
  });

  it("rounds discounts to whole cents", () => {
    const quote = quotePrice({ dailyPriceCents: 999, startDate: "2026-11-01", endDate: "2026-11-07" });
    expect(Number.isInteger(quote.totalCents)).toBe(true);
    expect(quote.totalCents).toBe(6993 - 699);
  });

  it("counts days correctly across a month boundary and DST change", () => {
    expect(quotePrice({ dailyPriceCents: 100, startDate: "2026-10-30", endDate: "2026-11-02" }).days).toBe(4);
  });

  it("gives members 15% off", () => {
    const quote = quotePrice({ dailyPriceCents: 1000, startDate: "2026-11-01", endDate: "2026-11-02", isMember: true });
    expect(quote.discounts).toEqual([{ label: "Member discount (15%)", amountCents: 300 }]);
    expect(quote.totalCents).toBe(1700);
  });

  it("adds the member and weekly discounts together (25% off a week)", () => {
    const quote = quotePrice({ dailyPriceCents: 1000, startDate: "2026-11-01", endDate: "2026-11-07", isMember: true });
    expect(quote.discounts.map((d) => d.amountCents)).toEqual([700, 1050]);
    expect(quote.totalCents).toBe(7000 - 1750);
  });

  it("rejects an end date before the start date", () => {
    expect(() => quotePrice({ dailyPriceCents: 100, startDate: "2026-11-05", endDate: "2026-11-01" })).toThrow();
  });
});

describe("formatCents", () => {
  it("formats cents as dollars", () => {
    expect(formatCents(2700)).toBe("$27.00");
    expect(formatCents(123456)).toBe("$1,234.56");
  });
});
