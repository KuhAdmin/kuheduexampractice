import crypto from "node:crypto";
import { pool } from "../db/pool.js";
import { env } from "../config/env.js";
import { markOrderPaidAndActivatePremium } from "./paymentService.js";
import {
  markSubscriptionActiveAndActivatePremium,
  updateSubscriptionStatus,
  updateSubscriptionStatusAndRevokePremium,
  recordSubscriptionCharge,
  upsertSubscriptionInvoice,
} from "./subscriptionService.js";

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
const ENTITY_PRIORITY = ["payment", "order", "refund", "dispute", "subscription", "invoice"];
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

// Mandate verified, first charge hasn't necessarily happened yet -- status
// only, no premium change (subscription.activated grants premium once the
// first charge actually clears).
const handleSubscriptionAuthenticated = async (payload) => {
  const subscription = payload.payload.subscription.entity;
  await updateSubscriptionStatus(subscription.id, "authenticated");
};

const handleSubscriptionActivated = async (payload) => {
  const subscription = payload.payload.subscription.entity;
  await markSubscriptionActiveAndActivatePremium({ razorpaySubscriptionId: subscription.id });
};

// Each successful recurring charge -- keep paid_count/current_start/
// current_end in sync and treat it as a renewal safety net (idempotent) in
// case the activated event was ever missed.
const handleSubscriptionCharged = async (payload) => {
  const subscription = payload.payload.subscription.entity;
  await recordSubscriptionCharge({
    razorpaySubscriptionId: subscription.id,
    paidCount: subscription.paid_count,
    currentStart: subscription.current_start ? new Date(subscription.current_start * 1000) : null,
    currentEnd: subscription.current_end ? new Date(subscription.current_end * 1000) : null,
  });
  await markSubscriptionActiveAndActivatePremium({ razorpaySubscriptionId: subscription.id });
};

// All 12 charges completed -- no further auto-charging, so unlike the
// one-time Yearly purchase this access ends here (see PRD completion
// decision) rather than staying on permanently.
const handleSubscriptionCompleted = async (payload) => {
  const subscription = payload.payload.subscription.entity;
  await updateSubscriptionStatusAndRevokePremium(subscription.id, "completed");
};

const handleSubscriptionCancelled = async (payload) => {
  const subscription = payload.payload.subscription.entity;
  await updateSubscriptionStatusAndRevokePremium(subscription.id, "cancelled");
};

const handleSubscriptionPaused = async (payload) => {
  const subscription = payload.payload.subscription.entity;
  await updateSubscriptionStatusAndRevokePremium(subscription.id, "paused");
};

const handleSubscriptionResumed = async (payload) => {
  const subscription = payload.payload.subscription.entity;
  await markSubscriptionActiveAndActivatePremium({ razorpaySubscriptionId: subscription.id });
};

// A charge attempt (cycle 1 or any renewal) failed and Razorpay is
// auto-retrying -- status only, no premium change. Mirrors how most
// subscription products handle a single failed attempt: don't yank access
// mid-retry, only subscription.halted below (retries exhausted) does that.
const handleSubscriptionPending = async (payload) => {
  const subscription = payload.payload.subscription.entity;
  await updateSubscriptionStatus(subscription.id, "pending");
};

// Razorpay has exhausted its retry schedule (4 consecutive failed attempts)
// and given up on this subscription -- the definitive "this charge is never
// going through" signal, so revoke immediately, same as
// cancelled/paused/completed above.
const handleSubscriptionHalted = async (payload) => {
  const subscription = payload.payload.subscription.entity;
  await updateSubscriptionStatusAndRevokePremium(subscription.id, "halted");
};

// Razorpay's invoice.paid/invoice.partially_paid deliveries carry a sibling
// payment entity alongside invoice.entity (the charge that paid this
// invoice) -- accessed defensively since that's inferred from Razorpay's
// general webhook shape, not confirmed against a live delivery for this
// specific event; a missing entity just leaves payment_method null rather
// than throwing.
const handleInvoicePaid = async (payload) => {
  const invoice = payload.payload.invoice.entity;
  const paymentMethod = payload.payload.payment?.entity?.method ?? null;
  await upsertSubscriptionInvoice(invoice, "paid", paymentMethod);
};

const handleInvoicePartiallyPaid = async (payload) => {
  const invoice = payload.payload.invoice.entity;
  const paymentMethod = payload.payload.payment?.entity?.method ?? null;
  await upsertSubscriptionInvoice(invoice, "partially_paid", paymentMethod);
};

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
  "subscription.authenticated": handleSubscriptionAuthenticated,
  "subscription.activated": handleSubscriptionActivated,
  "subscription.charged": handleSubscriptionCharged,
  "subscription.completed": handleSubscriptionCompleted,
  "subscription.cancelled": handleSubscriptionCancelled,
  "subscription.paused": handleSubscriptionPaused,
  "subscription.resumed": handleSubscriptionResumed,
  "subscription.pending": handleSubscriptionPending,
  "subscription.halted": handleSubscriptionHalted,
  "invoice.paid": handleInvoicePaid,
  "invoice.partially_paid": handleInvoicePartiallyPaid,
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
