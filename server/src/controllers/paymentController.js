import { createPremiumOrder, verifyPremiumPayment } from "../services/paymentService.js";

export const createOrder = async (req, res, next) => {
  try {
    const order = await createPremiumOrder({ userId: req.user.id });
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
