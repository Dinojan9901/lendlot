import { prisma } from "./db";
import { fromPaddleSubscription, syncSubscription } from "./membership";
import {
  createMembershipTransaction,
  createPortalSession,
  findOrCreateCustomer,
  getSubscription,
  getTransaction,
} from "./paddle";

type BillingUser = { id: string; name: string; email: string };

/**
 * The user's Paddle customer, created on first use and linked *before*
 * checkout, so every later webhook can find the user by customer id
 * regardless of the order events arrive in.
 */
export async function ensureBillingCustomer(user: BillingUser): Promise<string> {
  const existing = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { billingCustomerId: true } });
  if (existing.billingCustomerId) return existing.billingCustomerId;

  const customerId = await findOrCreateCustomer({ email: user.email, name: user.name, userId: user.id });
  await prisma.user.updateMany({
    where: { id: user.id, billingCustomerId: null },
    data: { billingCustomerId: customerId },
  });
  return customerId;
}

/**
 * Creates the transaction on the server (customer, price and user are set
 * here, not in the browser) and returns its id for Paddle Checkout to open.
 */
export async function startMembershipCheckout(user: BillingUser): Promise<string> {
  const priceId = process.env.PADDLE_PRICE_ID;
  if (!priceId) throw new Error("PADDLE_PRICE_ID is not set");
  const customerId = await ensureBillingCustomer(user);
  return createMembershipTransaction(customerId, user.id, priceId);
}

/**
 * Called when the user returns from checkout: fetch the subscription live and
 * apply it now, so the page doesn't wait for the webhook. Uses the same
 * compare-and-set as the webhook, with "now" as the time it was observed.
 * Returns false if the subscription isn't ready yet (the webhook will follow).
 */
export async function syncCheckoutTransaction(transactionId: string, userId: string): Promise<boolean> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { billingCustomerId: true } });
  const transaction = await getTransaction(transactionId);
  if (!user.billingCustomerId || transaction.customer_id !== user.billingCustomerId) return false;
  if (!transaction.subscription_id) return false;
  const subscription = await getSubscription(transaction.subscription_id);
  await syncSubscription(prisma, fromPaddleSubscription(subscription), new Date());
  return true;
}

export async function membershipPortalUrl(customerId: string, subscriptionId: string | null): Promise<string> {
  return createPortalSession(customerId, subscriptionId ? [subscriptionId] : []);
}
