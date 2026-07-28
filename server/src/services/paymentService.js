import crypto from "node:crypto";
import Razorpay from "razorpay";
import { pool } from "../db/pool.js";
import { env } from "../config/env.js";
import { toPublicUser } from "./userService.js";

// STEMLab Premium is a fixed one-time purchase for now (not wired to
// AdminSettingsPage.jsx's currently-unused premiumPrice field -- that would
// need its own persistence layer, a separate change from this integration).
const PREMIUM_AMOUNT_PAISE = 199900;
const CURRENCY = "INR";

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

export const createPremiumOrder = async ({ userId }) => {
  const razorpay = getRazorpayClient();
  const receipt = `premium_${userId}_${Date.now()}`.slice(0, 40);

  let order;
  try {
    order = await razorpay.orders.create({
      amount: PREMIUM_AMOUNT_PAISE,
      currency: CURRENCY,
      receipt,
    });
  } catch (error) {
    const statusCode = error?.statusCode === 401 ? 401 : 500;
    throw new PaymentError(error?.error?.description || "Failed to create Razorpay order.", statusCode);
  }

  await pool.query(
    `
      INSERT INTO payment_order (user_id, razorpay_order_id, amount, currency, status, receipt)
      VALUES ($1, $2, $3, $4, 'created', $5)
    `,
    [userId, order.id, PREMIUM_AMOUNT_PAISE, CURRENCY, receipt]
  );

  return { orderId: order.id, amount: PREMIUM_AMOUNT_PAISE, currency: CURRENCY };
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

  const updateResult = await pool.query(
    `
      UPDATE payment_order
      SET status = 'paid', razorpay_payment_id = $2, updated_at = NOW()
      WHERE razorpay_order_id = $1 AND user_id = $3
      RETURNING id
    `,
    [razorpayOrderId, razorpayPaymentId, userId]
  );

  if (updateResult.rows.length === 0) {
    throw new PaymentError("Order not found for this user.", 400);
  }

  const userResult = await pool.query(
    "UPDATE users SET is_premium = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *",
    [userId]
  );

  return { user: toPublicUser(userResult.rows[0]) };
};
