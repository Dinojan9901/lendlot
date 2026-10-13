import { prisma } from "./db";
import { postgresError } from "./errors";
import type { PaddleSubscription } from "./paddle";
import type { MembershipStatus } from "@/generated/prisma/enums";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Provider-neutral view of a subscription; only this module's mappers know Paddle's shape. */
export type SubscriptionSnapshot = {
  subscriptionId: string;
  customerId: string;
  userId?: string;
  status: MembershipStatus;
  periodEnd: Date | null;
};

export function toMembershipStatus(status: PaddleSubscription["status"]): MembershipStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
    case "paused":
      return "CANCELED";
    default:
      return "NONE";
  }
}

export function fromPaddleSubscription(subscription: PaddleSubscription): SubscriptionSnapshot {
  const userId = subscription.custom_data?.userId;
  return {
    subscriptionId: subscription.id,
    customerId: subscription.customer_id,
    userId: typeof userId === "string" ? userId : undefined,
    status: toMembershipStatus(subscription.status),
    periodEnd: subscription.current_billing_period ? new Date(subscription.current_billing_period.ends_at) : null,
  };
}

/**
 * Writes a subscription's state onto its user, unless newer state was already
 * written. `asOf` is when that state was true: the event's occurred_at for
 * webhooks, or "now" when the subscription was just fetched from the API.
 * Webhooks are not delivered in order, so an older event arriving late is
 * ignored (compare-and-set on membershipSyncedAt in a single UPDATE).
 */
export async function syncSubscription(db: Tx | typeof prisma, snapshot: SubscriptionSnapshot, asOf: Date) {
  const owner = await db.user.findFirst({
    where: {
      OR: [{ billingCustomerId: snapshot.customerId }, ...(snapshot.userId ? [{ id: snapshot.userId }] : [])],
    },
    select: { id: true },
  });
  if (!owner) return { updated: false, reason: "unknown customer" as const };

  const { count } = await db.user.updateMany({
    where: { id: owner.id, OR: [{ membershipSyncedAt: null }, { membershipSyncedAt: { lte: asOf } }] },
    data: {
      billingCustomerId: snapshot.customerId,
      billingSubscriptionId: snapshot.subscriptionId,
      membershipStatus: snapshot.status,
      membershipPeriodEnd: snapshot.periodEnd,
      membershipSyncedAt: asOf,
    },
  });
  return count === 1 ? { updated: true as const } : { updated: false, reason: "stale event" as const };
}

export type BillingEventInput = {
  id: string;
  type: string;
  occurredAt: Date;
  /** The subscription the event is about, or null for events we don't act on. */
  subscription: SubscriptionSnapshot | null;
};

export type WebhookResult = "processed" | "duplicate" | "ignored";

/**
 * Idempotent webhook processing. The event id is inserted into BillingEvent in
 * the same transaction as the event's effect, so either both happen or neither
 * does. A redelivery (provider retries, or two deliveries racing) hits the
 * primary key and is skipped instead of being applied twice.
 */
export async function processBillingEvent(event: BillingEventInput): Promise<WebhookResult> {
  const { subscription } = event;
  if (!subscription) return "ignored";
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.billingEvent.create({ data: { id: event.id, type: event.type } });
        await syncSubscription(tx, subscription, event.occurredAt);
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
