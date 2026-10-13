import { z } from "zod";
import { daysInclusive, isIsoDate, todayIso } from "./dates";

export const MAX_RENTAL_DAYS = 30;
export const PAGE_SIZE = 12;

/**
 * Booking input as it arrives from a form or JSON body. `today` is injectable
 * so tests do not depend on the real clock.
 */
export function bookingInputSchema(today: string = todayIso()) {
  return z
    .object({
      itemId: z.string().min(1, { error: "Missing item" }),
      startDate: z.iso.date({ error: "Choose a start date" }),
      endDate: z.iso.date({ error: "Choose an end date" }),
    })
    .refine((v) => v.startDate >= today, {
      error: "Start date cannot be in the past",
      path: ["startDate"],
    })
    .refine((v) => v.endDate >= v.startDate, {
      error: "End date must be on or after the start date",
      path: ["endDate"],
    })
    .refine(
      (v) =>
        !isIsoDate(v.startDate) ||
        !isIsoDate(v.endDate) ||
        v.endDate < v.startDate ||
        daysInclusive(v.startDate, v.endDate) <= MAX_RENTAL_DAYS,
      {
        error: `Rentals can be at most ${MAX_RENTAL_DAYS} days`,
        path: ["endDate"],
      },
    );
}

export type BookingInput = z.infer<ReturnType<typeof bookingInputSchema>>;

/**
 * Catalogue filters come from the URL, which anyone can edit, so every field
 * falls back to a safe default instead of throwing.
 */
export const catalogueParamsSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  category: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).catch(1).default(1),
});

export type CatalogueParams = z.infer<typeof catalogueParamsSchema>;

/** Reads a single value from Next's searchParams, ignoring repeated keys. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseCatalogueParams(raw: Record<string, string | string[] | undefined>): CatalogueParams {
  return catalogueParamsSchema.parse({
    q: firstParam(raw.q) || undefined,
    category: firstParam(raw.category) || undefined,
    page: firstParam(raw.page),
  });
}

const ALLOWED_IMAGE = /^(\/items\/[a-z0-9-]+\.(jpg|webp|png)|https:\/\/images\.unsplash\.com\/.+)$/;

export const listingInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, { error: "Title must be at least 3 characters" })
    .max(80, { error: "Title must be at most 80 characters" }),
  description: z
    .string()
    .trim()
    .min(20, { error: "Description must be at least 20 characters" })
    .max(2000, { error: "Description must be at most 2000 characters" }),
  dailyPrice: z.coerce
    .number({ error: "Enter a price" })
    .positive({ error: "Price must be greater than zero" })
    .max(10_000, { error: "Price must be at most $10,000 per day" })
    .transform((dollars) => Math.round(dollars * 100)),
  location: z.string().trim().min(2, { error: "Enter a location" }).max(60),
  categoryId: z.string().min(1, { error: "Choose a category" }),
  imageUrl: z
    .string()
    .trim()
    .regex(ALLOWED_IMAGE, { error: "Use a /items/… image or an images.unsplash.com URL" }),
});

export type ListingInput = z.infer<typeof listingInputSchema>;

export const signUpSchema = z.object({
  name: z.string().trim().min(2, { error: "Enter your name" }).max(60),
  email: z.email({ error: "Enter a valid email address" }).trim().toLowerCase(),
  password: z
    .string()
    .min(8, { error: "Password must be at least 8 characters" })
    .max(100, { error: "Password must be at most 100 characters" }),
  role: z.enum(["RENTER", "OWNER"], { error: "Choose an account type" }),
});

export const signInSchema = z.object({
  email: z.email({ error: "Enter a valid email address" }).trim().toLowerCase(),
  password: z.string().min(1, { error: "Enter your password" }),
});

/** Field-name → first error message, the shape our forms render. */
export type FieldErrors = Partial<Record<string, string>>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const flat = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  return Object.fromEntries(
    Object.entries(flat)
      .filter((entry): entry is [string, string[]] => Boolean(entry[1]?.length))
      .map(([key, messages]) => [key, messages[0]]),
  );
}
