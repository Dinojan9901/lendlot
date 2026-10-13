"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isActiveMember } from "@/lib/membership";
import { siteUrl } from "@/lib/site";
import { createBillingPortal, createMembershipCheckout } from "@/server/billing";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/session";
import { isStripeConfigured } from "@/server/stripe";

/** Where to send the user back to: this deployment's own origin. */
async function requestOrigin(): Promise<string> {
  return (await headers()).get("origin") ?? siteUrl();
}

export async function startMembershipCheckoutAction() {
  const user = await requireUser("/dashboard/membership");
  if (!isStripeConfigured()) redirect("/dashboard/membership?error=unavailable");

  const membership = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { membershipStatus: true, membershipPeriodEnd: true },
  });
  if (isActiveMember(membership)) redirect("/dashboard/membership");

  const url = await createMembershipCheckout(user, await requestOrigin());
  redirect(url);
}

export async function manageMembershipAction() {
  const user = await requireUser("/dashboard/membership");
  const { stripeCustomerId } = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { stripeCustomerId: true },
  });
  if (!stripeCustomerId || !isStripeConfigured()) redirect("/dashboard/membership?error=unavailable");

  const url = await createBillingPortal(stripeCustomerId, await requestOrigin());
  redirect(url);
}
