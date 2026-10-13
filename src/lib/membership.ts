/** Shown on the membership page; the amount actually charged comes from the Paddle price. */
export const MEMBERSHIP_MONTHLY_CENTS = 900;

/** The Paddle events the webhook handles (and subscribes to); each carries the subscription. */
export const BILLING_WEBHOOK_EVENTS = [
  "subscription.created",
  "subscription.updated",
  "subscription.activated",
  "subscription.canceled",
  "subscription.past_due",
  "subscription.paused",
  "subscription.resumed",
  "subscription.trialing",
] as const;

type MembershipFields = {
  membershipStatus: string;
  membershipPeriodEnd: Date | string | null;
};

/**
 * A member gets the discount while their subscription is active and the paid
 * period hasn't ended. Checking the period end too means a missed
 * "subscription deleted" webhook can't grant the discount forever.
 */
export function isActiveMember(user: MembershipFields | null | undefined, now: Date = new Date()): boolean {
  if (!user || user.membershipStatus !== "ACTIVE" || !user.membershipPeriodEnd) return false;
  return new Date(user.membershipPeriodEnd).getTime() > now.getTime();
}
