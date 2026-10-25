"use server";

import { redirect } from "next/navigation";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { bookingInputSchema, fieldErrors, type FieldErrors } from "@/lib/validation";
import { createBooking } from "@/server/bookings";
import { DomainError, type DomainErrorCode } from "@/server/errors";
import { rateLimit, retryMessage } from "@/server/rate-limit";
import { getCurrentUser } from "@/server/session";

export type BookingFormState = {
  status: "idle" | "error";
  message?: string;
  code?: DomainErrorCode;
  fieldErrors?: FieldErrors;
  values?: { startDate: string; endDate: string };
};

/**
 * Server Action behind the "Confirm booking" form. It runs only on the
 * server, so validation, the price and the authorisation check cannot be
 * bypassed from the browser. It also works before JavaScript has loaded,
 * because it is wired to a regular <form>.
 */
export async function createBookingAction(_prev: BookingFormState, formData: FormData): Promise<BookingFormState> {
  const raw = {
    itemId: String(formData.get("itemId") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
  };
  const values = { startDate: raw.startDate, endDate: raw.endDate };
  const returnTo = safeRedirectPath(formData.get("returnTo"), "/");

  const user = await getCurrentUser();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(returnTo)}`);

  const limited = await rateLimit("booking", user.id);
  if (!limited.success) return { status: "error", message: retryMessage(limited), values };

  const parsed = bookingInputSchema().safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      code: "INVALID",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
      values,
    };
  }

  let bookingId: string;
  try {
    const booking = await createBooking({ ...parsed.data, renterId: user.id });
    bookingId = booking.id;
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", code: error.code, message: error.message, values };
    }
    throw error;
  }

  // redirect() works by throwing, so it must stay outside the try/catch above.
  redirect(`/dashboard/bookings?booked=${bookingId}`);
}
