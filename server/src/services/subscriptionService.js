import crypto from "node:crypto";
import Razorpay from "razorpay";
import { pool } from "../db/pool.js";
import { env } from "../config/env.js";
import { toPublicUser } from "./userService.js";
import { getSetting, setSetting } from "./appSettingsService.js";
import { PaymentError } from "./paymentService.js";

// STEMLab Premium Monthly: a real recurring subscription (unlike the
// one-time Yearly purchase in paymentService.js) -- 12 monthly charges of
// ₹199, then no further auto-charging.
const MONTHLY_AMOUNT_PAISE = 19900;
const MONTHLY_TOTAL_COUNT = 12;
const CURRENCY = "INR";

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

// Plan ids are scoped per Razorpay key-mode (test vs live) -- caching under
// a mode-suffixed app_settings key means a prod cutover to live keys
// provisions its own plan automatically instead of reusing a stale test-mode
// plan id.
const planCacheKey = () =>
  `razorpay_monthly_plan_id_${env.razorpayKeyId.startsWith("rzp_live_") ? "live" : "test"}`;

const getOrCreateMonthlyPlanId = async () => {
  const cached = await getSetting(planCacheKey());
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
        name: "STEMLab Premium Monthly",
        amount: MONTHLY_AMOUNT_PAISE,
        currency: CURRENCY,
      },
    });
  } catch (error) {
    const statusCode = error?.statusCode === 401 ? 401 : 500;
    throw new PaymentError(error?.error?.description || "Failed to create Razorpay plan.", statusCode);
  }

  await setSetting(planCacheKey(), plan.id);
  return plan.id;
};

export const createPremiumSubscription = async ({ userId }) => {
  const razorpay = getRazorpayClient();
  const planId = await getOrCreateMonthlyPlanId();

  let subscription;
  try {
    subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      total_count: MONTHLY_TOTAL_COUNT,
      customer_notify: 1,
      notes: { user_id: String(userId) },
    });
  } catch (error) {
    const statusCode = error?.statusCode === 401 ? 401 : 500;
    throw new PaymentError(error?.error?.description || "Failed to create Razorpay subscription.", statusCode);
  }

  await pool.query(
    `
      INSERT INTO subscription (user_id, razorpay_subscription_id, razorpay_plan_id, status, total_count)
      VALUES ($1, $2, $3, 'created', $4)
    `,
    [userId, subscription.id, planId, MONTHLY_TOTAL_COUNT]
  );

  return {
    mode: "subscription",
    subscriptionId: subscription.id,
    amount: MONTHLY_AMOUNT_PAISE,
    currency: CURRENCY,
    plan: "monthly",
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
