import crypto from "node:crypto";
import Razorpay from "razorpay";
import { pool } from "../db/pool.js";
import { env } from "../config/env.js";
import { toPublicUser } from "./userService.js";

// STEMLab Premium's one-time purchases: each pricing card's Yearly tier
// (its Monthly tier is a real recurring subscription instead -- see
// subscriptionService.js). "is_premium" is a one-way flag set on any
// successful purchase, EXCEPT the "trial" plan below, which self-expires
// after TRIAL_DURATION_MS (see markOrderPaidAndActivatePremium). Amounts
// must match client/src/content/pricingContent.js's pricingCards.
const PLAN_AMOUNTS_PAISE = {
  "english-yearly": 99900,
  "social-science-yearly": 199900,
  "science-yearly": 399900,
  "mathematics-yearly": 399900,
  // Testing-only plan: ₹9 for 1 hour of premium access, then auto-expires
  // (see markOrderPaidAndActivatePremium's premiumExpiresAt below) -- never
  // a recurring subscription, always the one-time order path.
  trial: 900,
};
const CURRENCY = "INR";
const TRIAL_DURATION_MS = 60 * 60 * 1000;

// Only English is on sale for now -- mirrors PricingPage.jsx's TEMPORARY
// visiblePricingCards filter and subscriptionService.js's matching
// ENABLED_MONTHLY_CARDS gate, enforced here too so a direct API call can't
// buy Yearly for a subject that isn't actually launched yet. "trial" is
// unrelated to any pricing card and stays exempt.
const ENABLED_YEARLY_PLANS = new Set(["english-yearly", "trial"]);

export class PaymentError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

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

// Most recent one-time order attempt (Yearly/Trial), regardless of outcome --
// lets the profile page tell a student "your last attempt failed" instead of
// silently showing the generic "Subscribe" state with no explanation. Only
// covers payment_order (not the subscription table): a Monthly signup either
// reaches 'active' or just never completes, there's no equivalent "failed"
// status to surface the same way.
export const getLastPaymentAttempt = async (userId) => {
  const result = await pool.query(
    `
      SELECT status, plan, created_at
      FROM payment_order
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [userId]
  );
  return result.rows[0] || null;
};

export const createPremiumOrder = async ({ userId, plan = "yearly" }) => {
  const amount = PLAN_AMOUNTS_PAISE[plan];
  if (!amount) {
    throw new PaymentError("Invalid plan.", 400);
  }
  if (!ENABLED_YEARLY_PLANS.has(plan)) {
    throw new PaymentError("This subject isn't available for purchase yet.", 403);
  }

  const razorpay = getRazorpayClient();
  const receipt = `premium_${userId}_${Date.now()}`.slice(0, 40);

  let order;
  try {
    order = await razorpay.orders.create({
      amount,
      currency: CURRENCY,
      receipt,
    });
  } catch (error) {
    const statusCode = error?.statusCode === 401 ? 401 : 500;
    throw new PaymentError(error?.error?.description || "Failed to create Razorpay order.", statusCode);
  }

  await pool.query(
    `
      INSERT INTO payment_order (user_id, razorpay_order_id, amount, currency, status, receipt, plan)
      VALUES ($1, $2, $3, $4, 'created', $5, $6)
    `,
    [userId, order.id, amount, CURRENCY, receipt, plan]
  );

  return { mode: "order", orderId: order.id, amount, currency: CURRENCY, plan };
};

// Shared by the client-driven verify flow below and by
// razorpayWebhookService.js (payment.captured/order.paid), so there is one
// code path for "order paid -> premium on," not two that can drift.
// Naturally idempotent: re-running with the same order/payment ids is a
// harmless no-op re-write of the same status/flag.
export const markOrderPaidAndActivatePremium = async ({
  razorpayOrderId,
  razorpayPaymentId,
  expectedUserId = null,
  razorpayPaymentMethod = null,
}) => {
  const updateResult =
    expectedUserId != null
      ? await pool.query(
          `
            UPDATE payment_order
            SET status = 'paid', razorpay_payment_id = $2,
                payment_method = COALESCE($4, payment_method), updated_at = NOW()
            WHERE razorpay_order_id = $1 AND user_id = $3
            RETURNING id, user_id, plan
          `,
          [razorpayOrderId, razorpayPaymentId, expectedUserId, razorpayPaymentMethod]
        )
      : await pool.query(
          `
            UPDATE payment_order
            SET status = 'paid', razorpay_payment_id = $2,
                payment_method = COALESCE($3, payment_method), updated_at = NOW()
            WHERE razorpay_order_id = $1
            RETURNING id, user_id, plan
          `,
          [razorpayOrderId, razorpayPaymentId, razorpayPaymentMethod]
        );

  if (updateResult.rows.length === 0) {
    return null;
  }

  const premiumExpiresAt =
    updateResult.rows[0].plan === "trial" ? new Date(Date.now() + TRIAL_DURATION_MS) : null;

  const userResult = await pool.query(
    "UPDATE users SET is_premium = TRUE, premium_expires_at = $2, updated_at = NOW() WHERE id = $1 RETURNING *",
    [updateResult.rows[0].user_id, premiumExpiresAt]
  );

  return { user: toPublicUser(userResult.rows[0]) };
};

export const verifyPremiumPayment = async ({
  userId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) => {
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new PaymentError("Missing payment verification fields.", 400);
  }
  if (!isRazorpayConfigured()) {
    throw new PaymentError("Razorpay is not configured on this server.", 401);
  }

  const expectedSignature = crypto
    .createHmac("sha256", env.razorpayKeySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const actualBuffer = Buffer.from(String(razorpaySignature), "utf8");
  const signaturesMatch =
    expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);

  if (!signaturesMatch) {
    await pool.query(
      `
        UPDATE payment_order
        SET status = 'failed', razorpay_payment_id = $2, updated_at = NOW()
        WHERE razorpay_order_id = $1 AND user_id = $3
      `,
      [razorpayOrderId, razorpayPaymentId, userId]
    );
    throw new PaymentError("Payment verification failed.", 400);
  }

  // Best-effort -- the payment_method column is a nice-to-have for the admin
  // Orders dashboard, not required for verification itself. Fetching it here
  // (rather than waiting on the payment.captured webhook alone) means it's
  // populated immediately even when webhook delivery is slow, misconfigured,
  // or (as in local/dev testing) simply not reachable.
  let razorpayPaymentMethod = null;
  try {
    const razorpay = getRazorpayClient();
    const payment = await razorpay.payments.fetch(razorpayPaymentId);
    razorpayPaymentMethod = payment?.method || null;
  } catch (_error) {
    // Swallow -- the webhook (if/when it arrives) can still fill this in via
    // markOrderPaidAndActivatePremium's COALESCE update.
  }

  const result = await markOrderPaidAndActivatePremium({
    razorpayOrderId,
    razorpayPaymentId,
    expectedUserId: userId,
    razorpayPaymentMethod,
  });

  if (!result) {
    throw new PaymentError("Order not found for this user.", 400);
  }

  return result;
};
