import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/authHooks";
import { AuthModal } from "../components/AuthModal";
import { PaymentStatusModal } from "../components/PaymentStatusModal";
import { createPremiumOrder, verifyPremiumPayment } from "../api/client";
import { openRazorpayCheckout } from "../lib/razorpayCheckout";
import { pricingCards } from "../content/pricingContent";

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

// Two one-time options per card (currently just the one universal card) --
// no recurring cycle anymore, just which duration to buy.
const PricingCard = ({ card, onSubscribe, processing }) => {
  const [selectedOptionKey, setSelectedOptionKey] = useState("full");
  const selectedOption = card.options.find((option) => option.key === selectedOptionKey) || card.options[0];

  return (
    <div className="pricing-card">
      <div className="pricing-card-copy">
        <strong className="pricing-card-name">{card.name}</strong>
        <span className="pricing-card-subtitle">{card.subtitle}</span>
      </div>

      <div className="pricing-toggle" role="tablist" aria-label={`${card.name} access duration`}>
        {card.options.map((option) => (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={selectedOptionKey === option.key}
            className={`pricing-toggle-option${selectedOptionKey === option.key ? " is-active" : ""}`}
            onClick={() => setSelectedOptionKey(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="pricing-price">
        <span className="pricing-price-amount">₹{selectedOption.price}</span>
      </div>
      <p className="pricing-billing-note">{selectedOption.billingNote}</p>

      <button
        type="button"
        className="pricing-cta"
        onClick={() => onSubscribe(selectedOption.planId)}
        disabled={processing}
      >
        {processing ? "Please wait..." : "Get Premium"}
      </button>

      <div className="pricing-card-features">
        {card.features.map((feature) => (
          <div className="pricing-feature" key={feature}>
            <CheckBadge />
            <span>{feature}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Public page (no login required to view) -- payment gateway/marketing needs
// a stable URL prospective students can land on before registering. Clicking
// the CTA while logged out opens AuthModal inline, then the purchase
// continues automatically once auth completes (see the useEffect below).
export const PricingPage = () => {
  const { user, isAuthenticated, login, register, persistUser } = useAuth();
  const location = useLocation();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  // planId while a logged-out visitor's CTA click is waiting on AuthModal to
  // complete -- resumed by the effect below.
  const [pendingSubscribe, setPendingSubscribe] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [paymentError, setPaymentError] = useState("");
  // Remembers the last planId a checkout was started for, so the
  // PaymentStatusModal's Retry button can re-run the same purchase.
  const [lastAttempt, setLastAttempt] = useState(null);

  const startCheckout = async (planId) => {
    setLastAttempt(planId);
    setPaymentError("");
    setPaymentStatus("processing");
    try {
      const order = await createPremiumOrder({ plan: planId });
      await openRazorpayCheckout({
        order,
        user,
        onSuccess: async (response) => {
          try {
            const result = await verifyPremiumPayment({
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

  const handleSubscribe = (planId) => {
    if (!isAuthenticated) {
      setPendingSubscribe(planId);
      setAuthModalOpen(true);
      return;
    }
    startCheckout(planId);
  };

  useEffect(() => {
    if (isAuthenticated && pendingSubscribe) {
      const planId = pendingSubscribe;
      setPendingSubscribe(null);
      setAuthModalOpen(false);
      startCheckout(planId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, pendingSubscribe]);

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
          <h1>Choose your plan</h1>
          <p>One-time payment, full access — pick the duration that works for you.</p>
        </div>

        {user?.isPremium ? (
          <div className="pricing-card pricing-card-active">
            <div className="pricing-card-mark">
              <img src="/crown.png" alt="" className="pricing-card-mark-image" aria-hidden="true" />
            </div>
            <strong>You&apos;re already Premium</strong>
            <p>Enjoy full access to Kuhedu Study Buddy Premium.</p>
          </div>
        ) : (
          <div className={`pricing-cards-grid${pricingCards.length === 1 ? " pricing-cards-grid--single" : ""}`}>
            {pricingCards.map((card) => (
              <PricingCard
                key={card.id}
                card={card}
                onSubscribe={handleSubscribe}
                processing={paymentStatus === "processing"}
              />
            ))}
          </div>
        )}
      </div>

      <AuthModal
        open={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          setPendingSubscribe(null);
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
          if (lastAttempt) startCheckout(lastAttempt);
        }}
      />
    </div>
  );
};
