-- Provider-neutral names: billing moved from Stripe to Paddle. Renames keep
-- any existing data instead of dropping and recreating columns.
ALTER TABLE "User" RENAME COLUMN "stripeCustomerId" TO "billingCustomerId";
ALTER TABLE "User" RENAME COLUMN "stripeSubscriptionId" TO "billingSubscriptionId";
ALTER INDEX "User_stripeCustomerId_key" RENAME TO "User_billingCustomerId_key";
ALTER INDEX "User_stripeSubscriptionId_key" RENAME TO "User_billingSubscriptionId_key";

ALTER TABLE "StripeEvent" RENAME TO "BillingEvent";
ALTER TABLE "BillingEvent" RENAME CONSTRAINT "StripeEvent_pkey" TO "BillingEvent_pkey";
