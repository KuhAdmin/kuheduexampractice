// One universal plan -- no more per-subject cards, no recurring billing.
// Every feature applies to every purchaser regardless of which one-time
// tier they pick.
const BASE_FEATURES = [
  "AI-powered Smart Tutor for instant doubt-solving",
  "Concept-wise learning modules mapped to your CBSE syllabus",
  "Unlimited practice questions with instant explanations",
  "Full-length mock tests and assessments with performance analysis",
  "Visual learning aids, diagrams, and mind maps for every chapter",
  "Flashcards and Memory Booster for faster recall",
  "Daily Study Streak and progress tracking on your dashboard",
  "Personalized weak-concept identification and revision plans",
  "Downloadable study materials and chapter-wise revision notes",
  "Access to Virtual Labs",
];

const CBSE_SUBTITLE = "CBSE Board | Class 6, 7 & 8";

// Both options are one-time, fixed payments -- no auto-renewal, nothing
// recurring. planId matches server/src/services/paymentService.js's
// PLAN_AMOUNTS_PAISE/PLAN_EXPIRY keys exactly.
export const pricingCards = [
  {
    id: "premium",
    name: "STEMLab Premium",
    subtitle: CBSE_SUBTITLE,
    options: [
      {
        key: "2weeks",
        planId: "premium-2weeks",
        label: "2 Weeks",
        price: 49,
        billingNote: "One-time · access for 14 days",
      },
      {
        key: "full",
        planId: "premium-12months",
        label: "Full Access",
        price: 999,
        billingNote: "One-time · 12 months of access",
      },
    ],
    features: BASE_FEATURES,
  },
];

// Testing-only plan (see server/src/services/paymentService.js's
// PLAN_AMOUNTS_PAISE.trial) -- a one-time ₹9 charge, premium auto-expires 1
// hour after purchase instead of renewing. Not rendered as a pricing card;
// kept here for any other admin/testing consumer of a "trial" plan shape.
export const trial = {
  id: "trial",
  label: "Trial",
  price: 9,
  billingNote: "One-time · 1 hour access, then auto-expires",
};
