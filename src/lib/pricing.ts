import { daysInclusive } from "./dates";

/** Rentals of a week or longer get this discount on the subtotal. */
export const WEEKLY_DISCOUNT_PERCENT = 10;
export const WEEKLY_DISCOUNT_MIN_DAYS = 7;
/** Members get this discount on every rental (stacks with the weekly one). */
export const MEMBER_DISCOUNT_PERCENT = 15;

export type PriceLine = { label: string; amountCents: number };

export type PriceQuote = {
  days: number;
  dailyPriceCents: number;
  subtotalCents: number;
  discounts: PriceLine[];
  totalCents: number;
};

type QuoteInput = {
  dailyPriceCents: number;
  startDate: string;
  endDate: string;
  isMember?: boolean;
};

/**
 * Prices are integers in cents so that no floating-point rounding can creep
 * into money. The same function runs in the browser (live preview) and on the
 * server (the amount that is actually stored), so they can never disagree.
 */
export function quotePrice({ dailyPriceCents, startDate, endDate, isMember = false }: QuoteInput): PriceQuote {
  const days = daysInclusive(startDate, endDate);
  if (days < 1) throw new RangeError("End date must be on or after the start date");

  const subtotalCents = days * dailyPriceCents;
  const discounts: PriceLine[] = [];

  if (days >= WEEKLY_DISCOUNT_MIN_DAYS) {
    discounts.push({
      label: `Weekly discount (${WEEKLY_DISCOUNT_PERCENT}%)`,
      amountCents: Math.round((subtotalCents * WEEKLY_DISCOUNT_PERCENT) / 100),
    });
  }

  if (isMember) {
    discounts.push({
      label: `Member discount (${MEMBER_DISCOUNT_PERCENT}%)`,
      amountCents: Math.round((subtotalCents * MEMBER_DISCOUNT_PERCENT) / 100),
    });
  }

  // Discounts are each a percentage of the subtotal, so they add up
  // (7 days as a member = 25% off) rather than compounding.
  const discountTotal = discounts.reduce((sum, line) => sum + line.amountCents, 0);
  return {
    days,
    dailyPriceCents,
    subtotalCents,
    discounts,
    totalCents: subtotalCents - discountTotal,
  };
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatCents(cents: number): string {
  return usd.format(cents / 100);
}
