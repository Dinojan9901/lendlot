/** Shown on the membership page; the amount actually charged comes from the Stripe price. */
export const MEMBERSHIP_MONTHLY_CENTS = 900;

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
