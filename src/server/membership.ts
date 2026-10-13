import type Stripe from "stripe";
import { prisma } from "./db";
import { postgresError } from "./errors";
import { STRIPE_WEBHOOK_EVENTS } from "@/lib/membership";
import type { MembershipStatus } from "@/generated/prisma/enums";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const HANDLED_EVENTS = new Set<string>(STRIPE_WEBHOOK_EVENTS);

export function toMembershipStatus(status: Stripe.Subscription.Status): MembershipStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
    case "paused":
      return "CANCELED";
    default:
      // "incomplete": the first payment hasn't gone through yet.
      return "NONE";
  }
}

/** The paid-through date. Since Stripe API 2025-03, the period lives on each item. */
export function periodEnd(subscription: Stripe.Subscription): Date | null {
  const ends = subscription.items.data.map((item) => item.current_period_end).filter(Boolean);
  return ends.length ? new Date(Math.max(...ends) * 1000) : null;
}

const idOf = (value: string | { id: string } | null): string | null =>
  value === null ? null : typeof value === "string" ? value : value.id;

/**
 * Writes a subscription's state onto its user, unless newer state was already
 * written. `asOf` is when that state was true: the event's creation time for
 * webhooks, or "now" when the subscription was just fetched from Stripe. Stripe
 * doesn't guarantee delivery order, so an older event arriving late is ignored.
 */
export async function syncSubscription(db: Tx | typeof prisma, subscription: Stripe.Subscription, asOf: Date) {
  const customerId = idOf(subscription.customer);
  const userId = subscription.metadata?.userId;
  const owner = await db.user.findFirst({
    where: { OR: [...(customerId ? [{ stripeCustomerId: customerId }] : []), ...(userId ? [{ id: userId }] : [])] },
    select: { id: true },
  });
  if (!owner) return { updated: false, reason: "unknown customer" as const };

  const { count } = await db.user.updateMany({
    where: { id: owner.id, OR: [{ membershipSyncedAt: null }, { membershipSyncedAt: { lte: asOf } }] },
    data: {
      stripeCustomerId: customerId ?? undefined,
      stripeSubscriptionId: subscription.id,
      membershipStatus: toMembershipStatus(subscription.status),
      membershipPeriodEnd: periodEnd(subscription),
      membershipSyncedAt: asOf,
    },
  });
  return count === 1 ? { updated: true as const } : { updated: false, reason: "stale event" as const };
}

async function applyEvent(tx: Tx, event: Stripe.Event) {
  const asOf = new Date(event.created * 1000);
  switch (event.type) {
    case "checkout.session.completed": {
      // Normally the customer was linked before Checkout started; this is a
      // safety net in case that write was lost.
      const session = event.data.object;
      const customerId = idOf(session.customer);
      if (session.mode === "subscription" && session.client_reference_id && customerId) {
        await tx.user.updateMany({
          where: { id: session.client_reference_id, stripeCustomerId: null },
          data: { stripeCustomerId: customerId },
        });
      }
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await syncSubscription(tx, event.data.object, asOf);
      return;
    case "customer.subscription.deleted":
      await syncSubscription(tx, { ...event.data.object, status: "canceled" }, asOf);
      return;
  }
}

export type WebhookResult = "processed" | "duplicate" | "ignored";

/**
 * Idempotent webhook processing. The event id is inserted into StripeEvent in
 * the same transaction as the event's effect, so either both happen or
 * neither does. A redelivery (Stripe retries, or two deliveries racing) hits
 * the primary key and is skipped instead of being applied twice.
 */
export async function processStripeEvent(event: Stripe.Event): Promise<WebhookResult> {
  if (!HANDLED_EVENTS.has(event.type)) return "ignored";
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.stripeEvent.create({ data: { id: event.id, type: event.type } });
        await applyEvent(tx, event);
      },
      { maxWait: 10_000, timeout: 20_000 },
    );
    return "processed";
  } catch (error) {
    if (isDuplicateEvent(error)) return "duplicate";
    throw error;
  }
}

function isDuplicateEvent(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002" || postgresError(error)?.code === "23505";
}
