import { NextResponse } from "next/server";
import type { z } from "zod";
import { DomainError, HTTP_STATUS } from "./errors";
import { fieldErrors } from "@/lib/validation";

/** Consistent JSON error shape for every Route Handler: { error, fields? }. */
export function jsonError(status: number, error: string, fields?: Record<string, string | undefined>) {
  return NextResponse.json(fields ? { error, fields } : { error }, { status });
}

export function validationError(error: z.ZodError) {
  return jsonError(422, "Validation failed", fieldErrors(error));
}

/** Maps expected domain errors to HTTP; anything else is a real 500. */
export function handleRouteError(error: unknown) {
  if (error instanceof DomainError) return jsonError(HTTP_STATUS[error.code], error.message);
  console.error(error);
  return jsonError(500, "Something went wrong");
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
