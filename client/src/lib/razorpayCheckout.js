const CHECKOUT_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

let loadPromise = null;

// Injects Razorpay's hosted checkout script once and caches the loading
// promise, so repeat purchase attempts (e.g. after a dismiss/retry) don't
// re-fetch or duplicate the <script> tag.
const loadRazorpayScript = () => {
  if (window.Razorpay) {
    return Promise.resolve();
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT_URL;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load Razorpay checkout script."));
    };
    document.body.appendChild(script);
  });

  return loadPromise;
};

// order: { orderId, amount, currency } from POST /user/payments/create-order.
// onSuccess receives the raw Razorpay handler response
// ({ razorpay_order_id, razorpay_payment_id, razorpay_signature }).
export const openRazorpayCheckout = async ({ order, user, onSuccess, onFailure, onDismiss }) => {
  await loadRazorpayScript();

  const razorpay = new window.Razorpay({
    key: import.meta.env.VITE_RAZORPAY_KEY_ID,
    order_id: order.orderId,
    amount: order.amount,
    currency: order.currency,
    name: "KUHEDU STUDY BUDDY",
    description: "STEMLab Premium",
    prefill: {
      name: user?.name || "",
      email: user?.email || "",
    },
    theme: { color: "#2f9e44" },
    handler: (response) => onSuccess(response),
    modal: {
      ondismiss: () => onDismiss?.(),
    },
  });

  razorpay.on("payment.failed", (response) => onFailure?.(response?.error));
  razorpay.open();
};
