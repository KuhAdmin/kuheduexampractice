import crypto from "node:crypto";
import Razorpay from "razorpay";
import { pool } from "../db/pool.js";
import { env } from "../config/env.js";
import { toPublicUser } from "./userService.js";
import { getSetting, setSetting } from "./appSettingsService.js";
import { PaymentError } from "./paymentService.js";

// STEMLab Premium Monthly: a real recurring subscription (unlike the
// one-time Yearly purchase in paymentService.js) -- 12 monthly charges, then
// no further auto-charging. One amount (and one cached Razorpay Plan id) per
// pricing card -- see client/src/content/pricingContent.js for the card
// definitions these amounts must match.
const CARD_MONTHLY_AMOUNTS_PAISE = {
  english: 9900,
  "social-science": 19900,
  science: 39900,
  mathematics: 39900,
};
const MONTHLY_TOTAL_COUNT = 12;
const CURRENCY = "INR";

// Only English is on sale for now -- mirrors PricingPage.jsx's TEMPORARY
// visiblePricingCards filter (client/src/pages/PricingPage.jsx), enforced
// here too so a direct API call can't provision a Plan/subscription for a
// card that isn't actually for sale yet. Scoped to NEW checkouts only --
// existing subscriptions and their webhook-driven renewals for other cards
// (if any) go through verifyPremiumSubscription/razorpayWebhookService.js,
// not this function, so they're untouched.
const ENABLED_MONTHLY_CARDS = new Set(["english"]);

const isRazorpayConfigured = () => Boolean(env.razorpayKeyId && env.razorpayKeySecret);

let razorpayClient = null;
const getRazorpayClient = () => {
  if (!isRazorpayConfigured()) {
    throw new PaymentError("Razorpay is not configured on this server.", 401);
  }
  if (!razorpayClient) {
    razorpayClient = new Razorpay({ key_id: env.razorpayKeyId, key_secret: env.razorpayKeySecret });
  }
  return razorpayClient;
};

// Plan ids are scoped per Razorpay key-mode (test vs live) AND per pricing
// card -- caching under a mode-and-card-suffixed app_settings key means a
// prod cutover to live keys provisions its own plans automatically instead
// of reusing stale test-mode plan ids, and each card gets its own Razorpay
// Plan since they charge different amounts.
const planCacheKey = (cardId) =>
  `razorpay_monthly_plan_id_${cardId}_${env.razorpayKeyId.startsWith("rzp_live_") ? "live" : "test"}`;

const getOrCreateMonthlyPlanId = async (cardId) => {
  const amount = CARD_MONTHLY_AMOUNTS_PAISE[cardId];
  if (!amount) {
    throw new PaymentError("Invalid plan.", 400);
  }
  if (!ENABLED_MONTHLY_CARDS.has(cardId)) {
    throw new PaymentError("This subject isn't available for purchase yet.", 403);
  }

  const cached = await getSetting(planCacheKey(cardId));
  if (cached) {
    return cached;
  }

  const razorpay = getRazorpayClient();
  let plan;
  try {
    plan = await razorpay.plans.create({
      period: "monthly",
      interval: 1,
      item: {
        name: `STEMLab Premium Monthly — ${cardId}`,
        amount,
        currency: CURRENCY,
      },
    });
  } catch (error) {
    const statusCode = error?.statusCode === 401 ? 401 : 500;
    throw new PaymentError(error?.error?.description || "Failed to create Razorpay plan.", statusCode);
  }

  await setSetting(planCacheKey(cardId), plan.id);
  return plan.id;
};

export const createPremiumSubscription = async ({ userId, cardId }) => {
  const razorpay = getRazorpayClient();
  const planId = await getOrCreateMonthlyPlanId(cardId);

  let subscription;
  try {
    subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      total_count: MONTHLY_TOTAL_COUNT,
      customer_notify: 1,
      // start_at deliberately omitted, NOT pinned to Date.now() -- a fixed
      // "now" timestamp goes stale during the gap between subscription
      // creation and the customer actually completing checkout (script
      // load, method selection, UPI QR scan/approval can easily take
      // 10-30s+), and a UPI Autopay mandate whose requested start time has
      // already elapsed by the time it reaches NPCI/the bank is invalid --
      // this caused the checkout's UPI QR to refresh endlessly instead of
      // ever completing. Per Razorpay's docs, omitting start_at already
      // means "starts immediately after the authorisation payment" (cycle 1
      // billed as the authorization transaction itself, same paid-upfront
      // outcome), just with Razorpay handling the timing internally instead
      // of the app pinning a timestamp that can go stale mid-checkout.
      notes: { user_id: String(userId), card_id: cardId },
    });
  } catch (error) {
    const statusCode = error?.statusCode === 401 ? 401 : 500;
    throw new PaymentError(error?.error?.description || "Failed to create Razorpay subscription.", statusCode);
  }

  await pool.query(
    `
      INSERT INTO subscription (user_id, razorpay_subscription_id, razorpay_plan_id, card_id, status, total_count)
      VALUES ($1, $2, $3, $4, 'created', $5)
    `,
    [userId, subscription.id, planId, cardId, MONTHLY_TOTAL_COUNT]
  );

  return {
    mode: "subscription",
    subscriptionId: subscription.id,
    amount: CARD_MONTHLY_AMOUNTS_PAISE[cardId],
    currency: CURRENCY,
    plan: `${cardId}-monthly`,
  };
};

// Shared by verifyPremiumSubscription below and by razorpayWebhookService.js
// (subscription.activated/resumed) -- one code path for "subscription active
// -> premium on," mirroring paymentService.js's markOrderPaidAndActivatePremium.
export const markSubscriptionActiveAndActivatePremium = async ({
  razorpaySubscriptionId,
  expectedUserId = null,
}) => {
  const updateResult =
    expectedUserId != null
      ? await pool.query(
          `
            UPDATE subscription
            SET status = 'active', updated_at = NOW()
            WHERE razorpay_subscription_id = $1 AND user_id = $2
            RETURNING id, user_id
          `,
          [razorpaySubscriptionId, expectedUserId]
        )
      : await pool.query(
          `
            UPDATE subscription
            SET status = 'active', updated_at = NOW()
            WHERE razorpay_subscription_id = $1
            RETURNING id, user_id
          `,
          [razorpaySubscriptionId]
        );

  if (updateResult.rows.length === 0) {
    return null;
  }

  const userResult = await pool.query(
    "UPDATE users SET is_premium = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *",
    [updateResult.rows[0].user_id]
  );

  return { user: toPublicUser(userResult.rows[0]) };
};

export const verifyPremiumSubscription = async ({
  userId,
  razorpaySubscriptionId,
  razorpayPaymentId,
  razorpaySignature,
}) => {
  if (!razorpaySubscriptionId || !razorpayPaymentId || !razorpaySignature) {
    throw new PaymentError("Missing subscription verification fields.", 400);
  }
  if (!isRazorpayConfigured()) {
    throw new PaymentError("Razorpay is not configured on this server.", 401);
  }

  // Subscription signature formula is payment_id|subscription_id -- the
  // field order is flipped vs. the one-time order flow's order_id|payment_id
  // (see Razorpay's subscriptions checkout docs).
  const expectedSignature = crypto
    .createHmac("sha256", env.razorpayKeySecret)
    .update(`${razorpayPaymentId}|${razorpaySubscriptionId}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const actualBuffer = Buffer.from(String(razorpaySignature), "utf8");
  const signaturesMatch =
    expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);

  if (!signaturesMatch) {
    throw new PaymentError("Subscription verification failed.", 400);
  }

  const result = await markSubscriptionActiveAndActivatePremium({
    razorpaySubscriptionId,
    expectedUserId: userId,
  });

  if (!result) {
    throw new PaymentError("Subscription not found for this user.", 400);
  }

  return result;
};

// Status-only transition -- no premium change (e.g. subscription.authenticated:
// mandate verified, first charge hasn't necessarily happened yet).
export const updateSubscriptionStatus = async (razorpaySubscriptionId, status) => {
  await pool.query("UPDATE subscription SET status = $2, updated_at = NOW() WHERE razorpay_subscription_id = $1", [
    razorpaySubscriptionId,
    status,
  ]);
};

// subscription.completed/cancelled/paused: the term this access was paid for
// is over (or billing stopped), so revoke immediately -- see PRD lapse/
// completion decisions (no deferred/end-of-cycle expiry in this app).
export const updateSubscriptionStatusAndRevokePremium = async (razorpaySubscriptionId, status) => {
  const result = await pool.query(
    "UPDATE subscription SET status = $2, updated_at = NOW() WHERE razorpay_subscription_id = $1 RETURNING user_id",
    [razorpaySubscriptionId, status]
  );
  const userId = result.rows[0]?.user_id;
  if (!userId) return;
  await pool.query("UPDATE users SET is_premium = FALSE, updated_at = NOW() WHERE id = $1", [userId]);
};

// subscription.charged: keep paid_count/current_start/current_end in sync
// with Razorpay's record of this recurring subscription.
export const recordSubscriptionCharge = async ({ razorpaySubscriptionId, paidCount, currentStart, currentEnd }) => {
  await pool.query(
    `
      UPDATE subscription
      SET paid_count = $2, current_start = $3, current_end = $4, updated_at = NOW()
      WHERE razorpay_subscription_id = $1
    `,
    [razorpaySubscriptionId, paidCount, currentStart, currentEnd]
  );
};

// invoice.paid / invoice.partially_paid: one row per monthly charge, for
// admin visibility only (mirrors paymentService.js-adjacent payment_refund
// upserts in razorpayWebhookService.js).
export const upsertSubscriptionInvoice = async (invoice, status, paymentMethod = null) => {
  const subscriptionResult = await pool.query("SELECT id FROM subscription WHERE razorpay_subscription_id = $1", [
    invoice.subscription_id,
  ]);
  const subscriptionId = subscriptionResult.rows[0]?.id;
  if (!subscriptionId) return;

  const paidAt = invoice.paid_at ? new Date(invoice.paid_at * 1000) : null;

  await pool.query(
    `
      INSERT INTO subscription_invoice (subscription_id, razorpay_invoice_id, amount, status, paid_at, payment_method)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (razorpay_invoice_id) DO UPDATE
      SET status = EXCLUDED.status,
          paid_at = EXCLUDED.paid_at,
          payment_method = COALESCE(EXCLUDED.payment_method, subscription_invoice.payment_method),
          updated_at = NOW()
    `,
    [subscriptionId, invoice.id, invoice.amount, status, paidAt, paymentMethod]
  );
};

export const getActiveSubscriptionForUser = async (userId) => {
  const result = await pool.query(
    `
      SELECT id, razorpay_subscription_id, status, total_count, paid_count, current_start, current_end
      FROM subscription
      WHERE user_id = $1 AND status IN ('created', 'authenticated', 'active')
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] ?? null;
};

export const cancelSubscription = async ({ userId, razorpaySubscriptionId }) => {
  const ownerCheck = await pool.query(
    "SELECT id FROM subscription WHERE razorpay_subscription_id = $1 AND user_id = $2",
    [razorpaySubscriptionId, userId]
  );
  if (ownerCheck.rows.length === 0) {
    throw new PaymentError("Subscription not found for this user.", 404);
  }

  const razorpay = getRazorpayClient();
  try {
    // cancelAtCycleEnd=false -- access is revoked immediately, not at the
    // end of the already-paid cycle (see PRD's lapse-behavior decision).
    await razorpay.subscriptions.cancel(razorpaySubscriptionId, false);
  } catch (error) {
    const statusCode = error?.statusCode === 401 ? 401 : 500;
    throw new PaymentError(error?.error?.description || "Failed to cancel Razorpay subscription.", statusCode);
  }

  await pool.query(
    "UPDATE subscription SET status = 'cancelled', updated_at = NOW() WHERE razorpay_subscription_id = $1",
    [razorpaySubscriptionId]
  );

  const userResult = await pool.query(
    "UPDATE users SET is_premium = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *",
    [userId]
  );

  return { user: toPublicUser(userResult.rows[0]) };
};
