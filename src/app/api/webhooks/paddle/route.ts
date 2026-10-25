import { NextResponse } from "next/server";
import { z } from "zod";
import { BILLING_WEBHOOK_EVENTS } from "@/lib/membership";
import { fromPaddleSubscription, processBillingEvent } from "@/server/membership";
import { verifyPaddleSignature } from "@/server/paddle";

const SUBSCRIPTION_EVENTS = new Set<string>(BILLING_WEBHOOK_EVENTS);

const timestamp = z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Invalid timestamp");

/** Even signed payloads are validated, so a malformed event is a clear 400, not a crash mid-processing. */
const eventSchema = z.object({
  event_id: z.string().min(1).max(100),
  event_type: z.string().min(1).max(100),
  occurred_at: timestamp,
  data: z.unknown(),
});

const subscriptionSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["active", "canceled", "past_due", "paused", "trialing"]),
  customer_id: z.string().min(1),
  custom_data: z.record(z.string(), z.unknown()).nullable(),
  current_billing_period: z.object({ starts_at: timestamp, ends_at: timestamp }).nullable(),
});

/**
 * POST /api/webhooks/paddle — Paddle calls this when a subscription changes.
 *
 * 1. Verify the signature against the *raw* body, so nobody can forge events.
 * 2. Process idempotently (see processBillingEvent).
 * 3. Answer 2xx only once the change is committed; on 5xx Paddle retries,
 *    which is safe precisely because processing is idempotent.
 */
export async function POST(request: Request) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  const signature = request.headers.get("paddle-signature");
  if (!secret) return NextResponse.json({ error: "Webhooks are not configured" }, { status: 503 });
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const payload = await request.text();
  if (!verifyPaddleSignature(payload, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Malformed event" }, { status: 400 });
  }
  const parsedEvent = eventSchema.safeParse(json);
  if (!parsedEvent.success) return NextResponse.json({ error: "Malformed event" }, { status: 400 });
  const event = parsedEvent.data;

  let subscription = null;
  if (SUBSCRIPTION_EVENTS.has(event.event_type)) {
    const parsedSubscription = subscriptionSchema.safeParse(event.data);
    if (!parsedSubscription.success) return NextResponse.json({ error: "Malformed event" }, { status: 400 });
    subscription = fromPaddleSubscription(parsedSubscription.data);
  }

  try {
    const result = await processBillingEvent({
      id: event.event_id,
      type: event.event_type,
      occurredAt: new Date(event.occurred_at),
      subscription,
    });
    return NextResponse.json({ received: true, result });
  } catch (error) {
    console.error("Paddle webhook failed", event.event_id, error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
