import crypto from "node:crypto";
import Razorpay from "razorpay";
import { pool } from "../db/pool.js";
import { env } from "../config/env.js";
import { toPublicUser } from "./userService.js";

// STEMLab Premium is a fixed one-time purchase for now (not wired to
// AdminSettingsPage.jsx's currently-unused premiumPrice field -- that would
// need its own persistence layer, a separate change from this integration).
// "monthly" vs "yearly" only changes the charged amount -- there is no
// recurring billing, "is_premium" is a one-way flag set on any successful
// purchase, EXCEPT the "trial" plan below, which self-expires after
// TRIAL_DURATION_MS (see markOrderPaidAndActivatePremium).
const PLAN_AMOUNTS_PAISE = {
  monthly: 19900,
  yearly: 199900,
  // Testing-only plan: ₹9 for 1 hour of premium access, then auto-expires
  // (see markOrderPaidAndActivatePremium's premiumExpiresAt below) -- never
  // a recurring subscription, always the one-time order path.
  trial: 900,
};
const CURRENCY = "INR";
const TRIAL_DURATION_MS = 60 * 60 * 1000;

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

export const createPremiumOrder = async ({ userId, plan = "yearly" }) => {
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
