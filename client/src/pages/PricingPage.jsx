import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AuthModal } from "../components/AuthModal";
import { PaymentStatusModal } from "../components/PaymentStatusModal";
import { createPremiumOrder, verifyPremiumPayment, verifyPremiumSubscription } from "../api/client";
import { openRazorpayCheckout } from "../lib/razorpayCheckout";
import { currentPackage, plans, features } from "../content/pricingContent";

const CheckBadge = () => (
  <span className="pricing-feature-check" aria-hidden="true">
    <svg viewBox="0 0 24 24">
      <path
        d="m5 12.5 4.5 4.5L19 7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  </span>
);

// Public page (no login required to view) -- payment gateway/marketing needs
// a stable URL prospective students can land on before registering. Clicking
// Subscribe while logged out opens AuthModal inline, then the purchase
// continues automatically once auth completes (see the useEffect below).
export const PricingPage = () => {
  const { user, isAuthenticated, login, register, persistUser } = useAuth();
  const location = useLocation();
  const [selectedPlan, setSelectedPlan] = useState("yearly");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingSubscribe, setPendingSubscribe] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [paymentError, setPaymentError] = useState("");

  const startCheckout = async () => {
    setPaymentError("");
    setPaymentStatus("processing");
    try {
      const order = await createPremiumOrder({ plan: selectedPlan });
      await openRazorpayCheckout({
        order,
        user,
        onSuccess: async (response) => {
          try {
            const result =
              order.mode === "subscription"
                ? await verifyPremiumSubscription({
                    razorpaySubscriptionId: response.razorpay_subscription_id,
                    razorpayPaymentId: response.razorpay_payment_id,
                    razorpaySignature: response.razorpay_signature,
                  })
                : await verifyPremiumPayment({
                    razorpayOrderId: response.razorpay_order_id,
                    razorpayPaymentId: response.razorpay_payment_id,
                    razorpaySignature: response.razorpay_signature,
                  });
            persistUser(result.user);
            setPaymentStatus("success");
          } catch (error) {
            setPaymentError(error?.message || "We couldn't verify your payment.");
            setPaymentStatus("error");
          }
        },
        onFailure: (error) => {
          setPaymentError(error?.description || "Your payment failed.");
          setPaymentStatus("error");
        },
        onDismiss: () => setPaymentStatus(null),
      });
    } catch (error) {
      setPaymentError(error?.message || "We couldn't start the checkout.");
      setPaymentStatus("error");
    }
  };

  const handleSubscribe = () => {
    if (!isAuthenticated) {
      setPendingSubscribe(true);
      setAuthModalOpen(true);
      return;
    }
    startCheckout();
  };

  useEffect(() => {
    if (isAuthenticated && pendingSubscribe) {
      setPendingSubscribe(false);
      setAuthModalOpen(false);
      startCheckout();
    }
  }, [isAuthenticated, pendingSubscribe]);

  const activePlan = plans[selectedPlan];

  // Logged-in visitors always go to /dashboard (the app's own route guard
  // there already bounces an onboarding-incomplete user back into resume
  // mode, so this is correct regardless of onboarding status). Logged-out
  // visitors return to the exact onboarding screen on "/" they left from --
  // see the Pricing nav links in HomePage.jsx, which stamp
  // pricingEntryScreenId into this navigation's location.state.
  const backTo = isAuthenticated ? "/dashboard" : "/";
  const backState =
    !isAuthenticated && location.state?.pricingEntryScreenId
      ? { resumeScreenId: location.state.pricingEntryScreenId }
      : undefined;

  return (
    <div className="legal-page pricing-page">
      <header className="legal-page-header">
        <img src="/kuhedu-logo.png" alt="" />
        <span>KUHEDU STUDY BUDDY</span>
        <Link className="legal-page-back" to={backTo} state={backState}>
          Back to KUHEDU STUDY BUDDY
        </Link>
      </header>

      <div className="legal-page-content pricing-page-content">
        <div className="pricing-hero">
          <h1>{currentPackage.name}</h1>
          {currentPackage.description.map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>

        <div className="pricing-card">
          <div className="pricing-card-mark">
            <img src="/crown.png" alt="" className="pricing-card-mark-image" aria-hidden="true" />
          </div>

          {user?.isPremium ? (
            <div className="pricing-card-active">
              <strong>You&apos;re already Premium</strong>
              <p>Enjoy full access to Kuhedu Study Buddy Premium.</p>
            </div>
          ) : (
            <>
              <div className="pricing-toggle" role="tablist" aria-label="Billing cycle">
                {Object.values(plans).map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    role="tab"
                    aria-selected={selectedPlan === plan.id}
                    className={`pricing-toggle-option${selectedPlan === plan.id ? " is-active" : ""}`}
                    onClick={() => setSelectedPlan(plan.id)}
                  >
                    {plan.label}
                  </button>
                ))}
              </div>

              <div className="pricing-price">
                <span className="pricing-price-amount">₹{activePlan.price}</span>
                {activePlan.period ? (
                  <span className="pricing-price-period">/{activePlan.period}</span>
                ) : null}
                {activePlan.badge ? <span className="pricing-price-badge">{activePlan.badge}</span> : null}
              </div>
              {activePlan.billingNote ? <p className="pricing-billing-note">{activePlan.billingNote}</p> : null}

              <button
                type="button"
                className="pricing-cta"
                onClick={handleSubscribe}
                disabled={paymentStatus === "processing"}
              >
                {paymentStatus === "processing" ? "Please wait..." : "Subscribe"}
              </button>
            </>
          )}
        </div>

        <div className="pricing-features">
          <h2>What&apos;s included</h2>
          <div className="pricing-features-grid">
            {features.map((feature) => (
              <div className="pricing-feature" key={feature}>
                <CheckBadge />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AuthModal
        open={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          setPendingSubscribe(false);
        }}
        onLogin={login}
        onRegister={register}
      />

      <PaymentStatusModal
        open={Boolean(paymentStatus)}
        status={paymentStatus}
        errorMessage={paymentError}
        onClose={() => setPaymentStatus(null)}
        onRetry={() => {
          setPaymentStatus(null);
          startCheckout();
        }}
      />
    </div>
  );
};
