import { createPremiumOrder, verifyPremiumPayment, getLastPaymentAttempt } from "../services/paymentService.js";
import {
  createPremiumSubscription,
  verifyPremiumSubscription,
  getActiveSubscriptionForUser,
  cancelSubscription,
} from "../services/subscriptionService.js";

// Monthly is a real 12-cycle recurring subscription (one per pricing card,
// e.g. "science-monthly"); Yearly stays a one-time order (e.g.
// "science-yearly"). Both go through the same create-order/verify endpoints
// so the frontend keeps a single checkout entry point regardless of which
// card/cycle the learner picked.
const MONTHLY_SUFFIX = "-monthly";

export const createOrder = async (req, res, next) => {
  try {
    const plan = req.body?.plan;
    const order = plan?.endsWith(MONTHLY_SUFFIX)
      ? await createPremiumSubscription({ userId: req.user.id, cardId: plan.slice(0, -MONTHLY_SUFFIX.length) })
      : await createPremiumOrder({ userId: req.user.id, plan });
    return res.json(order);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const verifyPayment = async (req, res, next) => {
  try {
    const { razorpayOrderId, razorpaySubscriptionId, razorpayPaymentId, razorpaySignature } = req.body || {};
    const result = razorpaySubscriptionId
      ? await verifyPremiumSubscription({
          userId: req.user.id,
          razorpaySubscriptionId,
          razorpayPaymentId,
          razorpaySignature,
        })
      : await verifyPremiumPayment({
          userId: req.user.id,
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature,
        });
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const getSubscription = async (req, res, next) => {
  try {
    const [subscription, lastAttempt] = await Promise.all([
      getActiveSubscriptionForUser(req.user.id),
      getLastPaymentAttempt(req.user.id),
    ]);
    return res.json({ subscription, lastAttempt });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const cancelMySubscription = async (req, res, next) => {
  try {
    const { razorpaySubscriptionId } = req.body || {};
    const result = await cancelSubscription({ userId: req.user.id, razorpaySubscriptionId });
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};
