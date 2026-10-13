import type Stripe from "stripe";
import { prisma } from "./db";
import { syncSubscription } from "./membership";
import { membershipPriceId, stripe } from "./stripe";

type BillingUser = { id: string; name: string; email: string };

/**
 * The user's Stripe customer, created on first use. It is linked *before*
 * Checkout starts, so every later webhook can find the user by customer id
 * regardless of the order Stripe delivers events in. The idempotency key stops
 * a double-click from creating two customers.
 */
export async function ensureStripeCustomer(user: BillingUser): Promise<string> {
  const existing = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { stripeCustomerId: true } });
  if (existing.stripeCustomerId) return existing.stripeCustomerId;

  const customer = await stripe().customers.create(
    { email: user.email, name: user.name, metadata: { userId: user.id } },
    { idempotencyKey: `lendlot-customer-${user.id}` },
  );
  await prisma.user.updateMany({
    where: { id: user.id, stripeCustomerId: null },
    data: { stripeCustomerId: customer.id },
  });
  const linked = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { stripeCustomerId: true } });
  return linked.stripeCustomerId!;
}

export async function createMembershipCheckout(user: BillingUser, origin: string): Promise<string> {
  const customer = await ensureStripeCustomer(user);
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: user.id,
    line_items: [{ price: membershipPriceId(), quantity: 1 }],
    subscription_data: { metadata: { userId: user.id } },
    success_url: `${origin}/dashboard/membership?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard/membership?checkout=cancelled`,
  });
  if (!session.url) throw new Error("Stripe did not return a Checkout URL");
  return session.url;
}

export async function createBillingPortal(customerId: string, origin: string): Promise<string> {
  const session = await stripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/dashboard/membership`,
  });
  return session.url;
}

/**
 * Called when the user returns from Checkout: fetch the subscription live and
 * apply it right away, so the page shows the membership without waiting for
 * the webhook. Uses the same compare-and-set as the webhook, with "now" as the
 * time the state was observed.
 */
export async function syncCheckoutSession(sessionId: string, userId: string): Promise<void> {
  const session = await stripe().checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
  if (session.client_reference_id !== userId) return;
  const subscription = session.subscription as Stripe.Subscription | string | null;
  if (subscription && typeof subscription !== "string") {
    await syncSubscription(prisma, subscription, new Date());
  }
}
