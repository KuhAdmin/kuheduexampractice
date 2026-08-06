import crypto from "node:crypto";
import Razorpay from "razorpay";
import { pool } from "../db/pool.js";
import { env } from "../config/env.js";
import { toPublicUser } from "./userService.js";

// STEMLab Premium's one-time purchases -- the ONLY purchase path now
// (recurring subscriptions removed entirely, see subscriptionService.js's
// deletion). "is_premium" is a one-way flag set on any successful purchase;
// every plan below has a real expiry via PLAN_EXPIRY (no permanent-access
// plan exists anymore). Amounts must match
// client/src/content/pricingContent.js's pricingCards.
const PLAN_AMOUNTS_PAISE = {
  "premium-2weeks": 4900, // ₹49, 14 days
  "premium-12months": 99900, // ₹999, 12 months
  // Testing-only plan: ₹9 for 1 hour of premium access, then auto-expires
  // (see PLAN_EXPIRY below).
  trial: 900,
};
const CURRENCY = "INR";
const TRIAL_DURATION_MS = 60 * 60 * 1000;

// Every plan's expiry, computed at the moment it's granted (see
// markOrderPaidAndActivatePremium below). Both real plans are relative to
// the purchase date, not a fixed calendar date -- premium-12months uses
// calendar-month arithmetic (Date.setMonth) rather than a fixed day-count
// add, so it correctly lands on "the same date 12 months later" across
// leap years/differing month lengths.
const PLAN_EXPIRY = {
  trial: () => new Date(Date.now() + TRIAL_DURATION_MS),
  "premium-2weeks": () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  "premium-12months": () => {
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 12);
    return expiry;
  },
};

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

// Most recent purchase attempt, regardless of outcome -- lets the profile
// page tell a student "your last attempt failed" instead of silently
// showing the generic "Subscribe" state with no explanation.
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

export const createPremiumOrder = async ({ userId, plan }) => {
  const amount = PLAN_AMOUNTS_PAISE[plan];
  if (!amount) {
    throw new PaymentError("Invalid plan.", 400);
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

  const premiumExpiresAt = PLAN_EXPIRY[updateResult.rows[0].plan]?.() ?? null;

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
