export const currentPackage = {
  name: "CBSE 11 & 12 — Biology Mastery",
  description: [
    "Master every Biology concept across Class 11 and 12 CBSE, from cell structure to human physiology and genetics.",
  ],
};

export const plans = {
  monthly: {
    id: "monthly",
    label: "Monthly",
    price: 199,
    period: "month",
    billingNote: "Billed monthly, auto-renews for 12 months",
  },
  yearly: {
    id: "yearly",
    label: "Yearly",
    price: 1999,
    period: "year",
    badge: "Save 16%",
  },
  // Testing-only plan (see server/src/services/paymentService.js's
  // PLAN_AMOUNTS_PAISE.trial) -- a one-time ₹9 charge, premium auto-expires
  // 1 hour after purchase instead of renewing.
  trial: {
    id: "trial",
    label: "Trial",
    price: 9,
    billingNote: "One-time · 1 hour access, then auto-expires",
  },
};

export const features = [
  "AI-powered Smart Tutor for instant doubt-solving",
  "Concept-wise learning modules mapped to your CBSE syllabus",
  "Unlimited practice questions with instant explanations",
  "Full-length mock tests and assessments with performance analysis",
  "Visual learning aids, diagrams, and mind maps for every chapter",
  "Flashcards and Memory Booster for faster recall",
  "Daily Study Streak and progress tracking on your dashboard",
  "Personalized weak-concept identification and revision plans",
  "STEMLab interactive practice tools for Biology diagrams and processes",
  "Downloadable study materials and chapter-wise revision notes",
];
