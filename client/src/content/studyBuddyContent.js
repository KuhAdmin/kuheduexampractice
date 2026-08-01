export const PEDAGOGY_PILLARS = [
  {
    id: "competency",
    title: "Competency-Based Learning",
    accent: "var(--green)",
    comparison: [
      {
        label: "Traditional Question",
        text: "“What is Photosynthesis?” — students memorize and recite (5/5 marks, focus: memorization).",
      },
      {
        label: "Competency-Based Question",
        text: "“A plant has been kept in a dark room for 5 days. Why are its leaves turning yellow?” — students understand, think, apply knowledge, and explain the reason (real understanding, focus: applying knowledge).",
      },
    ],
    tagline: "Measures how well students apply what they know — not just what they remember.",
  },
  {
    id: "inquiry",
    title: "Inquiry-Based Learning",
    accent: "var(--blue)",
    comparison: [
      {
        label: "Instead of saying",
        text: "“Today we will learn about Magnets.”",
      },
      {
        label: "Students are asked",
        text: "“Why do you think this spoon is sticking to the box but a pencil is not?” — they guess, then test a coin (doesn’t stick), a key (sticks), a paper clip (sticks), and a wooden block (doesn’t stick).",
      },
    ],
    tagline: "Instead of memorizing, they just find the answer — only some metals are attracted to a magnet.",
  },
  {
    id: "experiential",
    title: "Experiential Learning",
    accent: "var(--warning)",
    steps: ["Do", "Observe", "Reflect", "Apply"],
    comparison: [
      {
        label: "Science",
        text: "Grow two plants — water one daily, the other not — and observe after a week.",
      },
      {
        label: "Mathematics",
        text: "Measure the classroom floor in tiles instead of using a formula, then discover Area = 5 × 4 = 20.",
      },
    ],
    tagline: "Learning by doing — experience becomes learning.",
  },
];

export const AI_FEATURES = [
  {
    id: "smart-tutor",
    title: "Smart Tutor",
    description: "Ask any question, get step-by-step explanations, and talk using voice.",
    accent: "var(--blue)",
  },
  {
    id: "practice",
    title: "Practice with Real Question",
    description: "Photograph a textbook question, write your answer by hand, and get instant AI feedback.",
    accent: "var(--green)",
  },
  {
    id: "einstein",
    title: "Einstein Mode",
    description:
      "AI gives a real-world challenge — find and photograph a matching object, and AI checks and connects the concept to real life.",
    accent: "var(--warning)",
  },
  {
    id: "viva",
    title: "Viva Mode",
    description:
      "Speak and explain concepts out loud — AI listens, asks follow-up questions, evaluates understanding, and builds confidence.",
    accent: "var(--indigo)",
  },
];

export const ASSESSMENT_TYPES = [
  { id: "mcq", label: "MCQ", description: "Single-answer multiple choice" },
  { id: "fill-blank", label: "Fill in the Blank", description: "A sentence with one key term blanked" },
  {
    id: "assertion-reason",
    label: "Assertion-Reason",
    description: "Assertion (A) and Reason (R) evaluated together",
  },
  { id: "short-answer", label: "Short Answer", description: "Brief, direct-recall or explain response" },
  { id: "true-false", label: "True / False", description: "Evaluate the statement" },
  { id: "hots", label: "HOTS", description: "Apply the concept to a new scenario — Higher-Order Thinking" },
  { id: "hotspot", label: "Hotspot Diagram", description: "Tap the correctly labelled part of a diagram" },
  { id: "case-study", label: "Case Study", description: "Realistic scenario, apply knowledge in context" },
];

export const EXERCISE_ACTIVITY_REVISION_TYPES = [
  {
    id: "activities",
    label: "Activities",
    description: "Hands-on textbook tasks — type or photograph your work and get AI feedback",
  },
  {
    id: "exercises",
    label: "Exercises",
    description: "End-of-section reflection questions — write your answer and get AI feedback",
  },
  { id: "cheatsheet", label: "Cheat Sheet", description: "Compact, exam-ready key facts for every concept" },
  { id: "mnemonics", label: "Mnemonics", description: "Memory hooks that make facts stick" },
  { id: "examnotes", label: "Exam Notes", description: "What examiners actually check for, concept by concept" },
];
