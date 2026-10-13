"use server";

import { redirect } from "next/navigation";
import { isActiveMember } from "@/lib/membership";
import { membershipPortalUrl, startMembershipCheckout } from "@/server/billing";
import { prisma } from "@/server/db";
import { isPaddleConfigured } from "@/server/paddle";
import { requireUser } from "@/server/session";

export async function startMembershipCheckoutAction() {
  const user = await requireUser("/dashboard/membership");
  if (!isPaddleConfigured()) redirect("/dashboard/membership?error=unavailable");

  const membership = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { membershipStatus: true, membershipPeriodEnd: true },
  });
  if (isActiveMember(membership)) redirect("/dashboard/membership");

  // Back to the membership page with the transaction id; Paddle Checkout
  // opens there as an overlay for this server-created transaction.
  const transactionId = await startMembershipCheckout(user);
  redirect(`/dashboard/membership?_ptxn=${encodeURIComponent(transactionId)}`);
}

export async function manageMembershipAction() {
  const user = await requireUser("/dashboard/membership");
  const { billingCustomerId, billingSubscriptionId } = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { billingCustomerId: true, billingSubscriptionId: true },
  });
  if (!billingCustomerId || !isPaddleConfigured()) redirect("/dashboard/membership?error=unavailable");

  redirect(await membershipPortalUrl(billingCustomerId, billingSubscriptionId));
}
