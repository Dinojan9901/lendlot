import Stripe from "stripe";

let client: Stripe | undefined;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

/**
 * Lazily created Stripe client. This demo refuses live keys outright, so a
 * misconfiguration can never charge a real card.
 */
export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!key.startsWith("sk_test_")) throw new Error("Lendlot only runs Stripe in test mode (sk_test_… keys)");
  client ??= new Stripe(key);
  return client;
}

export function membershipPriceId(): string {
  const price = process.env.STRIPE_PRICE_ID;
  if (!price) throw new Error("STRIPE_PRICE_ID is not set");
  return price;
}

/** Verifies the Stripe-Signature header against the raw body; throws if it doesn't match. */
export function verifyWebhook(payload: string, signature: string, secret: string): Stripe.Event {
  return Stripe.webhooks.constructEvent(payload, signature, secret);
}
