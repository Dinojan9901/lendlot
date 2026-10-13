"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/session";

const roleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["RENTER", "OWNER", "ADMIN"]),
});

export async function changeRoleAction(formData: FormData) {
  const admin = await requireRole(["ADMIN"], "/admin");
  const parsed = roleSchema.safeParse({ userId: formData.get("userId"), role: formData.get("role") });
  // Admins can't demote themselves, so the site can't be left without one.
  if (!parsed.success || parsed.data.userId === admin.id) return;

  await prisma.user.update({ where: { id: parsed.data.userId }, data: { role: parsed.data.role } });
  revalidatePath("/admin");
}
