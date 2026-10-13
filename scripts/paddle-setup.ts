/**
 * One-time Paddle (sandbox) setup. Safe to re-run.
 *
 *   npm run billing:setup
 *   npm run billing:setup -- --webhook-url=https://lendlot.vercel.app/api/webhooks/paddle
 *
 * Prints PADDLE_PRICE_ID. With --webhook-url it (re)creates the notification
 * destination and writes its secret to .env.paddle-webhook.local (gitignored)
 * instead of printing it.
 */
import "dotenv/config";
import fs from "node:fs";
import { BILLING_WEBHOOK_EVENTS, MEMBERSHIP_MONTHLY_CENTS } from "../src/lib/membership";

const API = "https://sandbox-api.paddle.com";
const PRODUCT_NAME = "Lendlot Member";

async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${process.env.PADDLE_API_KEY}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${JSON.stringify(json?.error ?? json)}`);
  return json as T;
}

type List<T> = { data: T[] };

async function main() {
  if (!process.env.PADDLE_API_KEY) throw new Error("Set PADDLE_API_KEY (a sandbox API key) in .env");

  // 1. Product + monthly price, found by name so re-runs don't duplicate them.
  const products = await api<List<{ id: string; name: string }>>("/products?status=active&per_page=200");
  const product =
    products.data.find((p) => p.name === PRODUCT_NAME) ??
    (await api<{ data: { id: string } }>("/products", "POST", { name: PRODUCT_NAME, tax_category: "standard" })).data;

  const prices = await api<List<{ id: string; unit_price: { amount: string }; billing_cycle: { interval: string } | null }>>(
    `/prices?product_id=${product.id}&status=active`,
  );
  const price =
    prices.data.find((p) => p.billing_cycle?.interval === "month" && p.unit_price.amount === String(MEMBERSHIP_MONTHLY_CENTS)) ??
    (
      await api<{ data: { id: string } }>("/prices", "POST", {
        product_id: product.id,
        description: "Monthly membership",
        unit_price: { amount: String(MEMBERSHIP_MONTHLY_CENTS), currency_code: "USD" },
        billing_cycle: { interval: "month", frequency: 1 },
      })
    ).data;
  console.log(`PADDLE_PRICE_ID=${price.id}`);

  // 2. Optional: the webhook (notification destination) for a deployed URL.
  const webhookUrl = process.argv.find((arg) => arg.startsWith("--webhook-url="))?.split("=")[1];
  if (webhookUrl) {
    const settings = await api<List<{ id: string; destination: string }>>("/notification-settings");
    for (const setting of settings.data.filter((s) => s.destination === webhookUrl)) {
      // The secret is only useful to us if we know it, so replace rather than reuse.
      await api(`/notification-settings/${setting.id}`, "DELETE");
    }
    const created = await api<{ data: { id: string; endpoint_secret_key: string } }>("/notification-settings", "POST", {
      description: "Lendlot membership sync",
      type: "url",
      destination: webhookUrl,
      subscribed_events: [...BILLING_WEBHOOK_EVENTS],
      traffic_source: "all", // also receive events sent from Paddle's webhook simulator
    });
    fs.writeFileSync(".env.paddle-webhook.local", `PADDLE_WEBHOOK_SECRET=${created.data.endpoint_secret_key}\n`);
    console.log(`Notification destination ${created.data.id} → ${webhookUrl}`);
    console.log("Webhook secret written to .env.paddle-webhook.local (gitignored)");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
