import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Minimal Paddle Billing client. Deliberately hard-wired to the *sandbox*
 * API: this demo can never reach live Paddle or charge a real card.
 */
const API_BASE = "https://sandbox-api.paddle.com";

export type PaddleSubscriptionStatus = "active" | "canceled" | "past_due" | "paused" | "trialing";

export type PaddleSubscription = {
  id: string;
  status: PaddleSubscriptionStatus;
  customer_id: string;
  custom_data: Record<string, unknown> | null;
  current_billing_period: { starts_at: string; ends_at: string } | null;
};

export type PaddleTransaction = {
  id: string;
  status: string;
  customer_id: string | null;
  subscription_id: string | null;
};

export class PaddleApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    detail: string | undefined,
  ) {
    super(`Paddle API ${status}${code ? ` ${code}` : ""}: ${detail ?? "request failed"}`);
    this.name = "PaddleApiError";
  }
}

export function isPaddleConfigured(): boolean {
  return Boolean(
    process.env.PADDLE_API_KEY && process.env.PADDLE_PRICE_ID && process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
  );
}

async function paddle<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const key = process.env.PADDLE_API_KEY;
  if (!key) throw new Error("PADDLE_API_KEY is not set");
  const response = await fetch(API_BASE + path, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const json = (await response.json().catch(() => null)) as { data?: unknown; error?: { code?: string; detail?: string } } | null;
  if (!response.ok) throw new PaddleApiError(response.status, json?.error?.code, json?.error?.detail);
  return json as T;
}

/**
 * Paddle allows one customer per email, so a second "create" (a double click,
 * or a user who started checkout before) returns 409 and we reuse the existing one.
 */
export async function findOrCreateCustomer(input: { email: string; name: string; userId: string }): Promise<string> {
  try {
    const created = await paddle<{ data: { id: string } }>("/customers", {
      method: "POST",
      body: { email: input.email, name: input.name, custom_data: { userId: input.userId } },
    });
    return created.data.id;
  } catch (error) {
    if (!(error instanceof PaddleApiError) || error.status !== 409) throw error;
    const existing = await paddle<{ data: { id: string }[] }>(`/customers?email=${encodeURIComponent(input.email)}`);
    if (!existing.data[0]) throw error;
    return existing.data[0].id;
  }
}

/** A transaction for one month of membership; the browser opens Paddle Checkout for it. */
export async function createMembershipTransaction(customerId: string, userId: string, priceId: string): Promise<string> {
  const transaction = await paddle<{ data: { id: string } }>("/transactions", {
    method: "POST",
    body: {
      items: [{ price_id: priceId, quantity: 1 }],
      customer_id: customerId,
      custom_data: { userId },
    },
  });
  return transaction.data.id;
}

export async function getTransaction(id: string): Promise<PaddleTransaction> {
  return (await paddle<{ data: PaddleTransaction }>(`/transactions/${encodeURIComponent(id)}`)).data;
}

export async function getSubscription(id: string): Promise<PaddleSubscription> {
  return (await paddle<{ data: PaddleSubscription }>(`/subscriptions/${encodeURIComponent(id)}`)).data;
}

export async function createPortalSession(customerId: string, subscriptionIds: string[]): Promise<string> {
  const session = await paddle<{ data: { urls: { general: { overview: string } } } }>(
    `/customers/${encodeURIComponent(customerId)}/portal-sessions`,
    { method: "POST", body: { subscription_ids: subscriptionIds } },
  );
  return session.data.urls.general.overview;
}

/**
 * Verifies a `Paddle-Signature: ts=…;h1=…` header: h1 must equal
 * HMAC-SHA256(secret, `${ts}:${rawBody}`). The raw body must be used exactly as
 * received; re-serialised JSON would not match. Old timestamps are rejected to
 * limit replays (and replays are harmless anyway, because processing is idempotent).
 */
export function verifyPaddleSignature(
  rawBody: string,
  header: string,
  secret: string,
  { now = Date.now(), toleranceSeconds = 300 } = {},
): boolean {
  const parts = new Map<string, string[]>();
  for (const part of header.split(";")) {
    const [key, value] = part.split("=", 2);
    if (key && value) parts.set(key.trim(), [...(parts.get(key.trim()) ?? []), value.trim()]);
  }
  const ts = parts.get("ts")?.[0];
  const signatures = parts.get("h1") ?? [];
  if (!ts || !/^\d+$/.test(ts) || signatures.length === 0) return false;
  if (Math.abs(now / 1000 - Number(ts)) > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest();
  // Several h1 values can appear while a secret is being rotated.
  return signatures.some((signature) => {
    const actual = Buffer.from(signature, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}

/** Builds a valid signature header; used by tests to simulate Paddle. */
export function signPaddlePayload(rawBody: string, secret: string, ts = Math.floor(Date.now() / 1000)): string {
  const h1 = createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest("hex");
  return `ts=${ts};h1=${h1}`;
}
