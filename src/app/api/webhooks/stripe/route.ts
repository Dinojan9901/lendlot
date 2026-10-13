import { NextResponse } from "next/server";
import { processStripeEvent } from "@/server/membership";
import { verifyWebhook } from "@/server/stripe";

/**
 * POST /api/webhooks/stripe — Stripe calls this when a subscription changes.
 *
 * 1. Verify the signature against the *raw* body, so nobody can forge events.
 * 2. Process idempotently (see processStripeEvent).
 * 3. Answer 2xx only once the change is committed; on 5xx Stripe retries,
 *    which is safe precisely because processing is idempotent.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret) return NextResponse.json({ error: "Webhooks are not configured" }, { status: 503 });
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const payload = await request.text();
  let event;
  try {
    event = verifyWebhook(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const result = await processStripeEvent(event);
    return NextResponse.json({ received: true, result });
  } catch (error) {
    console.error("Stripe webhook failed", event.id, error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
