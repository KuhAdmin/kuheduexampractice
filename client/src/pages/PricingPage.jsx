import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AuthModal } from "../components/AuthModal";
import { PaymentStatusModal } from "../components/PaymentStatusModal";
import { createPremiumOrder, verifyPremiumPayment, verifyPremiumSubscription } from "../api/client";
import { openRazorpayCheckout } from "../lib/razorpayCheckout";
import { pricingCards, smartTutorRecharge } from "../content/pricingContent";

// TEMPORARY: only English is on sale for now -- Social Science/Science/
// Mathematics stay defined in pricingContent.js (and still show up in the
// admin Orders plan filter/labels for past purchases), just not rendered
// here. Remove this filter to bring all 4 cards back.
const visiblePricingCards = pricingCards.filter((card) => card.id === "english");

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

// Each card owns its own Monthly/Yearly toggle -- independent from the other
// 3 cards, since a visitor might want to compare e.g. Science yearly against
// Mathematics monthly side by side.
const PricingCard = ({ card, onSubscribe, processing }) => {
  const [selectedCycle, setSelectedCycle] = useState("yearly");
  const price = selectedCycle === "yearly" ? card.yearlyPrice : card.monthlyPrice;

  return (
    <div className="pricing-card">
      <div className="pricing-card-copy">
        <strong className="pricing-card-name">{card.name}</strong>
        <span className="pricing-card-subtitle">{card.subtitle}</span>
      </div>

      <div className="pricing-toggle" role="tablist" aria-label={`${card.name} billing cycle`}>
        <button
          type="button"
          role="tab"
          aria-selected={selectedCycle === "monthly"}
          className={`pricing-toggle-option${selectedCycle === "monthly" ? " is-active" : ""}`}
          onClick={() => setSelectedCycle("monthly")}
        >
          Monthly
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={selectedCycle === "yearly"}
          className={`pricing-toggle-option${selectedCycle === "yearly" ? " is-active" : ""}`}
          onClick={() => setSelectedCycle("yearly")}
        >
          Yearly
        </button>
      </div>

      <div className="pricing-price">
        <span className="pricing-price-amount">₹{price}</span>
        <span className="pricing-price-period">/{selectedCycle === "yearly" ? "year" : "month"}</span>
        {selectedCycle === "yearly" && card.yearlyBadge ? (
          <span className="pricing-price-badge">{card.yearlyBadge}</span>
        ) : null}
      </div>
      {selectedCycle === "monthly" ? (
        <p className="pricing-billing-note">Billed monthly, auto-renews until cancelled</p>
      ) : null}

      <button
        type="button"
        className="pricing-cta"
        onClick={() => onSubscribe(card.id, selectedCycle)}
        disabled={processing}
      >
        {processing ? "Please wait..." : "Subscribe"}
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
// Subscribe while logged out opens AuthModal inline, then the purchase
// continues automatically once auth completes (see the useEffect below).
export const PricingPage = () => {
  const { user, isAuthenticated, login, register, persistUser } = useAuth();
  const location = useLocation();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  // { cardId, cycle } while a logged-out visitor's Subscribe click is
  // waiting on AuthModal to complete -- resumed by the effect below.
  const [pendingSubscribe, setPendingSubscribe] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [paymentError, setPaymentError] = useState("");
  // Remembers the last card/cycle a checkout was started for, so the
  // PaymentStatusModal's Retry button can re-run the same purchase without
  // needing to know which of the 4 cards it came from.
  const [lastAttempt, setLastAttempt] = useState(null);

  const startCheckout = async (cardId, cycle) => {
    setLastAttempt({ cardId, cycle });
    setPaymentError("");
    setPaymentStatus("processing");
    try {
      const order = await createPremiumOrder({ plan: `${cardId}-${cycle}` });
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

  const handleSubscribe = (cardId, cycle) => {
    if (!isAuthenticated) {
      setPendingSubscribe({ cardId, cycle });
      setAuthModalOpen(true);
      return;
    }
    startCheckout(cardId, cycle);
  };

  useEffect(() => {
    if (isAuthenticated && pendingSubscribe) {
      const { cardId, cycle } = pendingSubscribe;
      setPendingSubscribe(null);
      setAuthModalOpen(false);
      startCheckout(cardId, cycle);
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
          <p>Subject-wise CBSE plans for Class 6, 7 & 8 — pick exactly what you need.</p>
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
          <div className={`pricing-cards-grid${visiblePricingCards.length === 1 ? " pricing-cards-grid--single" : ""}`}>
            {visiblePricingCards.map((card) => (
              <PricingCard
                key={card.id}
                card={card}
                onSubscribe={handleSubscribe}
                processing={paymentStatus === "processing"}
              />
            ))}
          </div>
        )}

        <div className="pricing-recharge-strip">
          <span className="pricing-recharge-price">₹{smartTutorRecharge.price}</span>
          <div className="pricing-recharge-copy">
            <strong>{smartTutorRecharge.label}</strong>
            <p>{smartTutorRecharge.description}</p>
          </div>
        </div>
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
          if (lastAttempt) startCheckout(lastAttempt.cardId, lastAttempt.cycle);
        }}
      />
    </div>
  );
};
