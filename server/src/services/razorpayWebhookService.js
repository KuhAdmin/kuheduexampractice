import crypto from "node:crypto";
import { pool } from "../db/pool.js";
import { env } from "../config/env.js";
import { markOrderPaidAndActivatePremium } from "./paymentService.js";

// rawBody must be the exact bytes Razorpay signed (a Buffer from
// express.raw(), not a re-serialized JSON.stringify of the parsed body --
// key order/whitespace differences would break the HMAC comparison).
export const verifyWebhookSignature = (rawBody, signature) => {
  if (!env.razorpayWebhookSecret || !signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", env.razorpayWebhookSecret)
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const actualBuffer = Buffer.from(String(signature), "utf8");

  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
};

// Razorpay doesn't guarantee a stable top-level event id on every payload,
// so the dedup key is event_type + the id of whichever entity the event is
// actually about.
const ENTITY_PRIORITY = ["payment", "order", "refund", "dispute"];
const entityIdForEvent = (payload) => {
  const contained = payload.payload ?? {};
  for (const key of ENTITY_PRIORITY) {
    const id = contained[key]?.entity?.id;
    if (id) return id;
  }
  return "unknown";
};

// Returns true if this delivery was newly recorded (should be processed),
// false if event_key already exists (a Razorpay retry/redelivery of a
// delivery we already handled) -- caller should skip reprocessing.
const recordWebhookEvent = async ({ eventType, entityId, payload }) => {
  const eventKey = `${eventType}:${entityId}`;
  const result = await pool.query(
    `
      INSERT INTO webhook_event (event_type, event_key, payload)
      VALUES ($1, $2, $3)
      ON CONFLICT (event_key) DO NOTHING
      RETURNING id
    `,
    [eventType, eventKey, payload]
  );
  return result.rows.length > 0;
};

const handlePaymentCaptured = async (payload) => {
  const payment = payload.payload.payment.entity;
  await markOrderPaidAndActivatePremium({
    razorpayOrderId: payment.order_id,
    razorpayPaymentId: payment.id,
    razorpayPaymentMethod: payment.method ?? null,
  });
};

const handleOrderPaid = async (payload) => {
  const order = payload.payload.order.entity;
  const payment = payload.payload.payment?.entity;
  await markOrderPaidAndActivatePremium({
    razorpayOrderId: order.id,
    razorpayPaymentId: payment?.id ?? null,
    razorpayPaymentMethod: payment?.method ?? null,
  });
};

const handlePaymentFailed = async (payload) => {
  const payment = payload.payload.payment.entity;
  // Never downgrade an order a payment.captured/order.paid delivery (or the
  // client-driven verify call) already marked paid -- a failed event can
  // arrive out of order relative to a successful one.
  await pool.query(
    `
      UPDATE payment_order
      SET status = 'failed', razorpay_payment_id = $2, updated_at = NOW()
      WHERE razorpay_order_id = $1 AND status <> 'paid'
    `,
    [payment.order_id, payment.id]
  );
};

const findPaymentOrderIdByPaymentId = async (razorpayPaymentId) => {
  const result = await pool.query("SELECT id FROM payment_order WHERE razorpay_payment_id = $1", [
    razorpayPaymentId,
  ]);
  return result.rows[0]?.id ?? null;
};

const upsertRefund = async (refund, status) => {
  const paymentOrderId = await findPaymentOrderIdByPaymentId(refund.payment_id);
  if (!paymentOrderId) return null;

  await pool.query(
    `
      INSERT INTO payment_refund (payment_order_id, razorpay_refund_id, amount, status)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (razorpay_refund_id) DO UPDATE
      SET status = EXCLUDED.status, updated_at = NOW()
    `,
    [paymentOrderId, refund.id, refund.amount, status]
  );

  return paymentOrderId;
};

const handleRefundCreated = async (payload) => {
  const refund = payload.payload.refund.entity;
  await upsertRefund(refund, "pending");
};

const handleRefundProcessed = async (payload) => {
  const refund = payload.payload.refund.entity;
  const paymentOrderId = await upsertRefund(refund, "processed");
  if (!paymentOrderId) return;

  const orderResult = await pool.query(
    `
      UPDATE payment_order
      SET refunded_amount = refunded_amount + $2, updated_at = NOW()
      WHERE id = $1
      RETURNING user_id, amount, refunded_amount
    `,
    [paymentOrderId, refund.amount]
  );

  const order = orderResult.rows[0];
  if (order && order.refunded_amount >= order.amount) {
    await pool.query("UPDATE users SET is_premium = FALSE, updated_at = NOW() WHERE id = $1", [order.user_id]);
  }
};

const handleDispute = async (payload) => {
  const dispute = payload.payload.dispute.entity;
  const paymentOrderId = await findPaymentOrderIdByPaymentId(dispute.payment_id);
  if (!paymentOrderId) return;

  await pool.query(
    `
      INSERT INTO payment_dispute (payment_order_id, razorpay_dispute_id, status, amount, reason_code)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (razorpay_dispute_id) DO UPDATE
      SET status = EXCLUDED.status, amount = EXCLUDED.amount, updated_at = NOW()
    `,
    [paymentOrderId, dispute.id, dispute.status, dispute.amount ?? null, dispute.reason_code ?? null]
  );
};

const noop = async () => {};

const EVENT_HANDLERS = {
  "payment.captured": handlePaymentCaptured,
  "order.paid": handleOrderPaid,
  // payment.captured is what actually settles funds for Standard Checkout;
  // authorized-only is informational (already logged to webhook_event below).
  "payment.authorized": noop,
  "payment.failed": handlePaymentFailed,
  "refund.created": handleRefundCreated,
  "refund.processed": handleRefundProcessed,
  "payment.dispute.created": handleDispute,
  "payment.dispute.won": handleDispute,
  "payment.dispute.lost": handleDispute,
};

export const processWebhookEvent = async (payload) => {
  const eventType = payload.event;
  const entityId = entityIdForEvent(payload);

  const isNewDelivery = await recordWebhookEvent({ eventType, entityId, payload });
  if (!isNewDelivery) {
    return { processed: false, reason: "duplicate" };
  }

  const handler = EVENT_HANDLERS[eventType];
  if (!handler) {
    return { processed: true, unhandled: true };
  }

  await handler(payload);
  return { processed: true };
};
