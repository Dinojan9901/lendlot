import { NextResponse } from "next/server";
import { BILLING_WEBHOOK_EVENTS } from "@/lib/membership";
import { fromPaddleSubscription, processBillingEvent } from "@/server/membership";
import { verifyPaddleSignature, type PaddleSubscription } from "@/server/paddle";

type PaddleEvent = { event_id: string; event_type: string; occurred_at: string; data: unknown };

const SUBSCRIPTION_EVENTS = new Set<string>(BILLING_WEBHOOK_EVENTS);

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

  const event = JSON.parse(payload) as PaddleEvent;
  try {
    const result = await processBillingEvent({
      id: event.event_id,
      type: event.event_type,
      occurredAt: new Date(event.occurred_at),
      subscription: SUBSCRIPTION_EVENTS.has(event.event_type)
        ? fromPaddleSubscription(event.data as PaddleSubscription)
        : null,
    });
    return NextResponse.json({ received: true, result });
  } catch (error) {
    console.error("Paddle webhook failed", event.event_id, error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
