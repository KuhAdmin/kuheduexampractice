// Shared across every card below -- Smart Tutor usage and every other core
// study tool are common to all 4 subjects, not subject-specific.
const BASE_FEATURES = [
  "AI-powered Smart Tutor for instant doubt-solving",
  "30 hours Smart Tutor usage/month",
  "Concept-wise learning modules mapped to your CBSE syllabus",
  "Unlimited practice questions with instant explanations",
  "Full-length mock tests and assessments with performance analysis",
  "Visual learning aids, diagrams, and mind maps for every chapter",
  "Flashcards and Memory Booster for faster recall",
  "Daily Study Streak and progress tracking on your dashboard",
  "Personalized weak-concept identification and revision plans",
  "Downloadable study materials and chapter-wise revision notes",
];

// "Save X%" badge for the Yearly tab -- yearly price vs. what 12 months at
// the monthly price would cost, rounded to the nearest whole percent.
const yearlySavingsBadge = (monthlyPrice, yearlyPrice) => {
  const fullYearAtMonthlyRate = monthlyPrice * 12;
  const savingsPercent = Math.round((1 - yearlyPrice / fullYearAtMonthlyRate) * 100);
  return savingsPercent > 0 ? `Save ${savingsPercent}%` : null;
};

const CBSE_SUBTITLE = "CBSE Board | Class 6, 7 & 8";

export const pricingCards = [
  {
    id: "english",
    name: "English",
    subtitle: CBSE_SUBTITLE,
    monthlyPrice: 99,
    yearlyPrice: 999,
    features: BASE_FEATURES,
  },
  {
    id: "social-science",
    name: "Social Science",
    subtitle: CBSE_SUBTITLE,
    monthlyPrice: 199,
    yearlyPrice: 1999,
    features: BASE_FEATURES,
  },
  {
    id: "science",
    name: "Science",
    subtitle: CBSE_SUBTITLE,
    monthlyPrice: 399,
    yearlyPrice: 3999,
    features: [...BASE_FEATURES, "Access to Virtual Labs"],
  },
  {
    id: "mathematics",
    name: "Mathematics",
    subtitle: CBSE_SUBTITLE,
    monthlyPrice: 399,
    yearlyPrice: 3999,
    features: [...BASE_FEATURES, "Access to Virtual Labs"],
  },
].map((card) => ({
  ...card,
  yearlyBadge: yearlySavingsBadge(card.monthlyPrice, card.yearlyPrice),
}));

// Informational only -- there's no Smart Tutor hours-usage-tracking backend
// yet to apply a top-up to, so this isn't wired to a purchase flow.
export const smartTutorRecharge = {
  label: "Extra 30 hrs Smart Tutor recharge",
  price: 49,
  description: "Run out of monthly Smart Tutor hours? Top up with 30 more, anytime.",
};

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
