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

// order: response from POST /user/payments/create-order -- either
// { mode: "order", orderId, amount, currency } for the one-time Yearly plan,
// or { mode: "subscription", subscriptionId, amount, currency } for the
// recurring Monthly plan (Razorpay Checkout takes subscription_id instead of
// order_id/amount in that mode -- the plan itself determines the charge).
// onSuccess receives the raw Razorpay handler response, which in
// subscription mode carries razorpay_subscription_id instead of
// razorpay_order_id.
export const openRazorpayCheckout = async ({ order, user, onSuccess, onFailure, onDismiss }) => {
  await loadRazorpayScript();

  const baseOptions = {
    key: import.meta.env.VITE_RAZORPAY_KEY_ID,
    name: "KUHEDU STUDY BUDDY",
    description: "Kuhedu Study Buddy Premium",
    prefill: {
      name: user?.name || "",
      email: user?.email || "",
    },
    theme: { color: "#2f9e44" },
    handler: (response) => onSuccess(response),
    modal: {
      ondismiss: () => onDismiss?.(),
    },
  };

  const razorpayOptions =
    order.mode === "subscription"
      ? { ...baseOptions, subscription_id: order.subscriptionId }
      : { ...baseOptions, order_id: order.orderId, amount: order.amount, currency: order.currency };

  const razorpay = new window.Razorpay(razorpayOptions);

  razorpay.on("payment.failed", (response) => onFailure?.(response?.error));
  razorpay.open();
};
