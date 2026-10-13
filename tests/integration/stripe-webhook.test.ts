import Stripe from "stripe";
import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/webhooks/stripe/route";
import { prisma } from "@/server/db";
import { createUser, resetDatabase } from "./fixtures";

const SECRET = "whsec_test_secret_for_integration_tests";
process.env.STRIPE_WEBHOOK_SECRET = SECRET;

const NOW = Math.floor(Date.now() / 1000);
const MONTH = 30 * 24 * 60 * 60;

function subscriptionEvent(
  id: string,
  type: "customer.subscription.created" | "customer.subscription.updated" | "customer.subscription.deleted",
  opts: { customer: string; status: Stripe.Subscription.Status; created: number; periodEnd?: number },
) {
  return {
    id,
    object: "event",
    type,
    created: opts.created,
    data: {
      object: {
        id: "sub_123",
        object: "subscription",
        customer: opts.customer,
        status: opts.status,
        metadata: {},
        items: { object: "list", data: [{ id: "si_1", current_period_end: opts.periodEnd ?? NOW + MONTH }] },
      },
    },
  };
}

/** Sends a correctly signed webhook request to the route handler. */
function deliver(event: object, { sign = true } = {}) {
  const payload = JSON.stringify(event);
  const signature = sign
    ? Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET })
    : Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_wrong" });
  return POST(
    new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": signature, "content-type": "application/json" },
      body: payload,
    }),
  );
}

async function membershipOf(userId: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { membershipStatus: true, membershipPeriodEnd: true, stripeSubscriptionId: true },
  });
}

describe("Stripe webhook", () => {
  let userId: string;

  beforeEach(async () => {
    await resetDatabase();
    await prisma.stripeEvent.deleteMany();
    const user = await createUser("RENTER");
    userId = user.id;
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: "cus_123" } });
  });

  it("rejects requests without a valid signature", async () => {
    const event = subscriptionEvent("evt_forged", "customer.subscription.created", {
      customer: "cus_123",
      status: "active",
      created: NOW,
    });
    const response = await deliver(event, { sign: false });
    expect(response.status).toBe(400);
    expect((await membershipOf(userId)).membershipStatus).toBe("NONE");
  });

  it("activates the membership when a subscription is created", async () => {
    const response = await deliver(
      subscriptionEvent("evt_1", "customer.subscription.created", { customer: "cus_123", status: "active", created: NOW }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, result: "processed" });
    const membership = await membershipOf(userId);
    expect(membership.membershipStatus).toBe("ACTIVE");
    expect(membership.stripeSubscriptionId).toBe("sub_123");
    expect(membership.membershipPeriodEnd?.getTime()).toBe((NOW + MONTH) * 1000);
  });

  it("is idempotent: a redelivered event is recorded once and skipped", async () => {
    const event = subscriptionEvent("evt_dup", "customer.subscription.created", {
      customer: "cus_123",
      status: "active",
      created: NOW,
    });
    const first = await deliver(event);
    const second = await deliver(event);
    expect(await first.json()).toMatchObject({ result: "processed" });
    expect(await second.json()).toMatchObject({ result: "duplicate" });
    expect(second.status).toBe(200); // so Stripe stops retrying
    expect(await prisma.stripeEvent.count({ where: { id: "evt_dup" } })).toBe(1);
  });

  it("processes simultaneous duplicate deliveries exactly once", async () => {
    const event = subscriptionEvent("evt_race", "customer.subscription.created", {
      customer: "cus_123",
      status: "active",
      created: NOW,
    });
    const responses = await Promise.all(Array.from({ length: 5 }, () => deliver(event)));
    const results = await Promise.all(responses.map((r) => r.json()));
    expect(results.filter((r) => r.result === "processed")).toHaveLength(1);
    expect(results.filter((r) => r.result === "duplicate")).toHaveLength(4);
  });

  it("ignores an older event that arrives after a newer one", async () => {
    // Cancelled at NOW, but the earlier "active" update is delivered late.
    await deliver(
      subscriptionEvent("evt_new", "customer.subscription.deleted", { customer: "cus_123", status: "canceled", created: NOW }),
    );
    await deliver(
      subscriptionEvent("evt_old", "customer.subscription.updated", {
        customer: "cus_123",
        status: "active",
        created: NOW - 60,
      }),
    );
    expect((await membershipOf(userId)).membershipStatus).toBe("CANCELED");
  });

  it("marks failed renewals as past due", async () => {
    await deliver(
      subscriptionEvent("evt_pd", "customer.subscription.updated", { customer: "cus_123", status: "past_due", created: NOW }),
    );
    expect((await membershipOf(userId)).membershipStatus).toBe("PAST_DUE");
  });

  it("links the customer from checkout.session.completed if it wasn't linked yet", async () => {
    const other = await createUser("RENTER");
    await deliver({
      id: "evt_checkout",
      object: "event",
      type: "checkout.session.completed",
      created: NOW,
      data: { object: { id: "cs_1", object: "checkout.session", mode: "subscription", client_reference_id: other.id, customer: "cus_999" } },
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: other.id } });
    expect(user.stripeCustomerId).toBe("cus_999");
  });

  it("acknowledges but ignores event types it doesn't handle", async () => {
    const response = await deliver({ id: "evt_other", object: "event", type: "invoice.created", created: NOW, data: { object: {} } });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ result: "ignored" });
    expect(await prisma.stripeEvent.count()).toBe(0);
  });
});
