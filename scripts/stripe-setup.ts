/**
 * One-time Stripe (test mode) setup. Safe to re-run.
 *
 *   npm run stripe:setup                         # price + billing portal
 *   npm run stripe:setup -- --webhook-url=https://lendlot.vercel.app/api/webhooks/stripe
 *
 * Prints STRIPE_PRICE_ID. With --webhook-url it (re)creates the webhook
 * endpoint and writes its signing secret to .env.stripe-webhook.local
 * (gitignored) instead of printing it.
 */
import "dotenv/config";
import fs from "node:fs";
import Stripe from "stripe";
import { MEMBERSHIP_MONTHLY_CENTS, STRIPE_WEBHOOK_EVENTS } from "../src/lib/membership";

const LOOKUP_KEY = "lendlot_member_monthly";

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key?.startsWith("sk_test_")) throw new Error("Set STRIPE_SECRET_KEY to a test-mode key (sk_test_…) in .env");
  const stripe = new Stripe(key);

  // 1. The membership price, found by lookup key so re-runs don't duplicate it.
  const existing = await stripe.prices.list({ lookup_keys: [LOOKUP_KEY], active: true, limit: 1 });
  const price =
    existing.data[0] ??
    (await stripe.prices.create({
      currency: "usd",
      unit_amount: MEMBERSHIP_MONTHLY_CENTS,
      recurring: { interval: "month" },
      lookup_key: LOOKUP_KEY,
      product_data: { name: "Lendlot Member" },
    }));
  console.log(`STRIPE_PRICE_ID=${price.id}`);

  // 2. The customer portal (where members update cards or cancel).
  const configurations = await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 });
  if (configurations.data.length === 0) {
    await stripe.billingPortal.configurations.create({
      business_profile: { headline: "Manage your Lendlot membership" },
      features: {
        subscription_cancel: { enabled: true, mode: "at_period_end" },
        payment_method_update: { enabled: true },
        invoice_history: { enabled: true },
      },
    });
    console.log("Created billing portal configuration");
  } else {
    console.log("Billing portal configuration already exists");
  }

  // 3. Optional: the webhook endpoint for a deployed URL.
  const webhookUrl = process.argv.find((arg) => arg.startsWith("--webhook-url="))?.split("=")[1];
  if (webhookUrl) {
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    for (const endpoint of endpoints.data.filter((e) => e.url === webhookUrl)) {
      // The signing secret is only revealed on creation, so replace rather than reuse.
      await stripe.webhookEndpoints.del(endpoint.id);
    }
    const endpoint = await stripe.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: [...STRIPE_WEBHOOK_EVENTS],
      description: "Lendlot membership sync",
    });
    fs.writeFileSync(".env.stripe-webhook.local", `STRIPE_WEBHOOK_SECRET=${endpoint.secret}\n`);
    console.log(`Webhook endpoint ${endpoint.id} → ${webhookUrl}`);
    console.log("Signing secret written to .env.stripe-webhook.local (gitignored)");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
