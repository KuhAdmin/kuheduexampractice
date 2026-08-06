import { createPremiumOrder, verifyPremiumPayment, getLastPaymentAttempt } from "../services/paymentService.js";

// One-time purchases only -- no recurring subscriptions.
export const createOrder = async (req, res, next) => {
  try {
    const order = await createPremiumOrder({ userId: req.user.id, plan: req.body?.plan });
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
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body || {};
    const result = await verifyPremiumPayment({
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

export const getLastPaymentAttemptHandler = async (req, res, next) => {
  try {
    const lastAttempt = await getLastPaymentAttempt(req.user.id);
    return res.json({ lastAttempt });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};
