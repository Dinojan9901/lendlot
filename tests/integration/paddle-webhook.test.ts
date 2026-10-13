import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/webhooks/paddle/route";
import { prisma } from "@/server/db";
import { signPaddlePayload, type PaddleSubscriptionStatus } from "@/server/paddle";
import { createUser, resetDatabase } from "./fixtures";

const SECRET = "pdl_ntfset_integration_test_secret";
process.env.PADDLE_WEBHOOK_SECRET = SECRET;

const NOW = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();
const PERIOD_END = NOW + 30 * 86_400_000;

function subscriptionEvent(
  eventId: string,
  type: string,
  opts: { status: PaddleSubscriptionStatus; occurredAt: number; customer?: string },
) {
  return {
    event_id: eventId,
    event_type: type,
    occurred_at: iso(opts.occurredAt),
    notification_id: `ntf_${eventId}`,
    data: {
      id: "sub_123",
      status: opts.status,
      customer_id: opts.customer ?? "ctm_123",
      custom_data: null,
      current_billing_period:
        opts.status === "canceled" ? null : { starts_at: iso(NOW), ends_at: iso(PERIOD_END) },
    },
  };
}

/** Sends a request to the real route handler, signed like Paddle would (or not). */
function deliver(event: object, { secret = SECRET } = {}) {
  const body = JSON.stringify(event);
  return POST(
    new Request("http://localhost/api/webhooks/paddle", {
      method: "POST",
      headers: { "paddle-signature": signPaddlePayload(body, secret), "content-type": "application/json" },
      body,
    }),
  );
}

const membershipOf = (id: string) =>
  prisma.user.findUniqueOrThrow({
    where: { id },
    select: { membershipStatus: true, membershipPeriodEnd: true, billingSubscriptionId: true },
  });

describe("Paddle webhook", () => {
  let userId: string;

  beforeEach(async () => {
    await resetDatabase();
    const user = await createUser("RENTER");
    userId = user.id;
    await prisma.user.update({ where: { id: userId }, data: { billingCustomerId: "ctm_123" } });
  });

  it("rejects requests without a valid signature", async () => {
    const event = subscriptionEvent("evt_forged", "subscription.created", { status: "active", occurredAt: NOW });
    const response = await deliver(event, { secret: "pdl_ntfset_attacker" });
    expect(response.status).toBe(400);
    expect((await membershipOf(userId)).membershipStatus).toBe("NONE");
  });

  it("activates the membership when a subscription is created", async () => {
    const response = await deliver(subscriptionEvent("evt_1", "subscription.created", { status: "active", occurredAt: NOW }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, result: "processed" });
    const membership = await membershipOf(userId);
    expect(membership.membershipStatus).toBe("ACTIVE");
    expect(membership.billingSubscriptionId).toBe("sub_123");
    expect(membership.membershipPeriodEnd?.getTime()).toBe(PERIOD_END);
  });

  it("is idempotent: a redelivered event is recorded once and skipped", async () => {
    const event = subscriptionEvent("evt_dup", "subscription.created", { status: "active", occurredAt: NOW });
    const first = await deliver(event);
    const second = await deliver(event);
    expect(await first.json()).toMatchObject({ result: "processed" });
    expect(await second.json()).toMatchObject({ result: "duplicate" });
    expect(second.status).toBe(200); // so Paddle stops retrying
    expect(await prisma.billingEvent.count({ where: { id: "evt_dup" } })).toBe(1);
  });

  it("processes simultaneous duplicate deliveries exactly once", async () => {
    const event = subscriptionEvent("evt_race", "subscription.created", { status: "active", occurredAt: NOW });
    const responses = await Promise.all(Array.from({ length: 5 }, () => deliver(event)));
    const results = await Promise.all(responses.map((r) => r.json()));
    expect(results.filter((r) => r.result === "processed")).toHaveLength(1);
    expect(results.filter((r) => r.result === "duplicate")).toHaveLength(4);
  });

  it("ignores an older event that arrives after a newer one", async () => {
    // Cancelled now, but the earlier "active" update is delivered late.
    await deliver(subscriptionEvent("evt_new", "subscription.canceled", { status: "canceled", occurredAt: NOW }));
    await deliver(subscriptionEvent("evt_old", "subscription.updated", { status: "active", occurredAt: NOW - 60_000 }));
    expect((await membershipOf(userId)).membershipStatus).toBe("CANCELED");
  });

  it("marks failed renewals as past due", async () => {
    await deliver(subscriptionEvent("evt_pd", "subscription.past_due", { status: "past_due", occurredAt: NOW }));
    expect((await membershipOf(userId)).membershipStatus).toBe("PAST_DUE");
  });

  it("ignores events for customers it doesn't know", async () => {
    const response = await deliver(
      subscriptionEvent("evt_stranger", "subscription.created", { status: "active", occurredAt: NOW, customer: "ctm_x" }),
    );
    expect(response.status).toBe(200);
    expect((await membershipOf(userId)).membershipStatus).toBe("NONE");
  });

  it("acknowledges but ignores event types it doesn't handle", async () => {
    const response = await deliver({
      event_id: "evt_other",
      event_type: "transaction.created",
      occurred_at: iso(NOW),
      data: {},
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ result: "ignored" });
    expect(await prisma.billingEvent.count()).toBe(0);
  });
});
