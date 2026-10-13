import type { Metadata } from "next";
import { manageMembershipAction, startMembershipCheckoutAction } from "@/app/actions/membership";
import { formatDate, toIsoDate } from "@/lib/dates";
import { isActiveMember, MEMBERSHIP_MONTHLY_CENTS } from "@/lib/membership";
import { formatCents, MEMBER_DISCOUNT_PERCENT } from "@/lib/pricing";
import { firstParam } from "@/lib/validation";
import { PaddleCheckout } from "@/components/dashboard/paddle-checkout";
import { syncCheckoutTransaction } from "@/server/billing";
import { prisma } from "@/server/db";
import { isPaddleConfigured } from "@/server/paddle";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Membership" };

export default async function MembershipPage({ searchParams }: PageProps<"/dashboard/membership">) {
  const user = await requireUser("/dashboard/membership");
  const params = await searchParams;
  const configured = isPaddleConfigured();
  const checkoutTransaction = firstParam(params._ptxn);
  const completedTransaction = firstParam(params.transaction_id);

  // Back from checkout: apply the subscription now instead of waiting for the webhook.
  if (completedTransaction && configured) {
    await syncCheckoutTransaction(completedTransaction, user.id).catch((error: unknown) => {
      console.error("Checkout sync failed; the webhook will catch up", error);
    });
  }

  const membership = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { membershipStatus: true, membershipPeriodEnd: true },
  });
  const active = isActiveMember(membership);
  const periodEnd = membership.membershipPeriodEnd ? formatDate(toIsoDate(membership.membershipPeriodEnd)) : null;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-ink">Membership</h1>

      {checkoutTransaction && configured && !active && (
        <PaddleCheckout transactionId={checkoutTransaction} clientToken={process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN!} />
      )}
      {completedTransaction && active && (
        <div role="status" className="mt-4 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          <strong>Welcome aboard!</strong> Your member discount now applies to every booking.
        </div>
      )}
      {completedTransaction && !active && (
        <div role="status" className="mt-4 rounded-xl border border-line bg-white px-4 py-3 text-sm text-muted">
          Payment received — your membership is being activated. Refresh in a few seconds.
        </div>
      )}
      {firstParam(params.checkout) === "cancelled" && (
        <div role="status" className="mt-4 rounded-xl border border-line bg-white px-4 py-3 text-sm text-muted">
          Checkout cancelled — you haven&apos;t been charged.
        </div>
      )}
      {firstParam(params.error) === "unavailable" && (
        <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-danger">
          Payments aren&apos;t available right now. Please try again later.
        </div>
      )}

      <section className="card mt-6 p-6" aria-labelledby="plan-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="plan-heading" className="text-lg font-semibold text-ink">
            Lendlot Member
          </h2>
          <p className="text-ink">
            <span className="text-2xl font-bold">{formatCents(MEMBERSHIP_MONTHLY_CENTS)}</span>
            <span className="text-muted"> / month</span>
          </p>
        </div>
        <ul className="mt-4 space-y-2 text-sm text-ink">
          <li>✓ {MEMBER_DISCOUNT_PERCENT}% off every rental, on top of the weekly discount</li>
          <li>✓ Cancel any time from the billing portal</li>
          <li>✓ Sandbox only: pay with test card 4242 4242 4242 4242 and any future expiry date</li>
        </ul>

        <div className="mt-6 border-t border-line pt-5">
          {active ? (
            <>
              <p className="font-medium text-brand-700">You&apos;re a member{periodEnd && ` — paid through ${periodEnd}`}.</p>
              <form action={manageMembershipAction} className="mt-4">
                <button type="submit" className="btn-secondary">
                  Manage subscription
                </button>
              </form>
            </>
          ) : membership.membershipStatus === "PAST_DUE" ? (
            <>
              <p className="font-medium text-danger">Your last payment failed, so the discount is paused.</p>
              <form action={manageMembershipAction} className="mt-4">
                <button type="submit" className="btn-primary">
                  Update payment method
                </button>
              </form>
            </>
          ) : configured ? (
            <form action={startMembershipCheckoutAction}>
              <button type="submit" className="btn-primary">
                Become a member
              </button>
              <p className="mt-2 text-xs text-muted">Payments run through Paddle&apos;s sandbox, so no real money moves.</p>
            </form>
          ) : (
            <p className="text-sm text-muted">Payments aren&apos;t configured in this environment.</p>
          )}
        </div>
      </section>
    </div>
  );
}
