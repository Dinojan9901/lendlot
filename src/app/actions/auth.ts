"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { fieldErrors, signInSchema, signUpSchema, type FieldErrors } from "@/lib/validation";
import { prisma } from "@/server/db";
import { hashPassword } from "@/server/password";

export type AuthFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: FieldErrors;
  values?: Record<string, string>;
};

function safeCallback(value: FormDataEntryValue | null): string {
  const path = String(value ?? "");
  return path.startsWith("/") && !path.startsWith("//") ? path : "/dashboard/bookings";
}

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = { email: String(formData.get("email") ?? ""), password: String(formData.get("password") ?? "") };
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: { email: raw.email } };
  }

  try {
    await signIn("credentials", { ...parsed.data, redirectTo: safeCallback(formData.get("callbackUrl")) });
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
