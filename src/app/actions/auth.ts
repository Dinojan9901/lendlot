"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { fieldErrors, signInSchema, signUpSchema, type FieldErrors } from "@/lib/validation";
import { prisma } from "@/server/db";
import { hashPassword } from "@/server/password";
import { clientIp, rateLimit, retryMessage, signInRateLimit } from "@/server/rate-limit";

export type AuthFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: FieldErrors;
  values?: Record<string, string>;
};

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = { email: String(formData.get("email") ?? ""), password: String(formData.get("password") ?? "") };
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: { email: raw.email } };
  }

  const blocked = await signInRateLimit(clientIp(await headers()), parsed.data.email);
  if (blocked) return { status: "error", message: retryMessage(blocked), values: { email: raw.email } };

  try {
    await signIn("credentials", {
      ...parsed.data,
      redirectTo: safeRedirectPath(formData.get("callbackUrl"), "/dashboard/bookings"),
    });
  } catch (error) {
    // signIn redirects by throwing; only real auth failures are handled here.
    if (error instanceof AuthError) {
      return { status: "error", message: "Incorrect email or password.", values: { email: raw.email } };
    }
    throw error;
  }
  return { status: "idle" };
}

export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    role: String(formData.get("role") ?? ""),
  };
  const values = { name: raw.name, email: raw.email, role: raw.role };

  const limited = await rateLimit("signUp", clientIp(await headers()));
  if (!limited.success) return { status: "error", message: retryMessage(limited), values };

  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error), values };
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
  if (existing) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: { email: "An account with this email already exists." },
      values,
    };
  }

  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      passwordHash: await hashPassword(parsed.data.password),
    },
  });

  await signIn("credentials", {
    email: parsed.data.email,
    password: parsed.data.password,
    redirectTo: parsed.data.role === "OWNER" ? "/dashboard/listings" : "/",
  });
  return { status: "idle" };
}
