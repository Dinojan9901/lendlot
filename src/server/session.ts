import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";
import { prisma } from "./db";
import type { Role } from "@/generated/prisma/enums";

export type CurrentUser = { id: string; name: string; email: string; role: Role };

/**
 * The signed-in user, loaded fresh from the database (once per request).
 * The JWT only proves who you are; the role is read from the DB so that a
 * role change or a deleted account takes effect immediately.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  await connection();
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true },
  });
});

export async function requireUser(callbackUrl = "/dashboard"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  return user;
}

/** Page-level guard. The proxy also checks this, but it is not the security boundary. */
export async function requireRole(roles: Role[], callbackUrl?: string): Promise<CurrentUser> {
  const user = await requireUser(callbackUrl);
  if (!roles.includes(user.role)) redirect("/forbidden");
  return user;
}

export const OWNER_ROLES: Role[] = ["OWNER", "ADMIN"];
