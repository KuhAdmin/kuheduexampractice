// Single source of truth for the Pre-Lesson Warm-Up / Post-Lesson Follow-Up
// sub-section list -- shared by StudentSectionDetailPage.jsx's accordion (the
// static row list) and StudentPreLessonWarmupPage.jsx/StudentPostLessonPage.jsx
// (the page header, once per visit instead of once per item). `key` must
// match the `subsectionKey` the server tags each item with in
// buildPhaseItems() (studentPreWarmupService.js). Order here is the display
// order in both the accordion and the admin Content Editor's own accordion
// (PreWarmupContentPreview.jsx) that this mirrors.
export const PRE_LESSON_SUBSECTIONS = [
  {
    key: "avs",
    title: "Vocabulary Warm-Up — Anchor Set",
    caption: "Meet the key words before you meet the story.",
  },
  {
    key: "avsVisual",
    title: "Vocabulary Warm-Up — Visual",
    caption: "One picture. The whole story's shape — before you read a line.",
  },
  // "avsAssessment" (Vocabulary Warm-Up — Assessment) is hidden from
  // students: removed from this list rather than the underlying content, so
  // it disappears from both accordions (StudentSectionDetailPage.jsx) and
  // the page header (getSubsectionMeta) without touching any authored data.
  {
    key: "sensoryWarmup",
    title: "Sensory Warm-Up",
    caption: "Look first. Guess later. Read to find out.",
  },
  {
    key: "experientialWarmup",
    title: "Experiential Warm-Up",
    caption: "Before the story begins — has anything like this ever happened to you?",
  },
];

export const POST_LESSON_SUBSECTIONS = [
  {
    key: "transferablePatterns",
    title: "Transferable Patterns",
    caption: "Phrases from this story you'll actually use again.",
  },
  {
    key: "storyAnchorQuestions",
    title: "Story Anchor Questions",
    caption: "Let's see what stuck.",
  },
];

export const getSubsectionMeta = (phase, key) =>
  (phase === "preLessonWarmup" ? PRE_LESSON_SUBSECTIONS : POST_LESSON_SUBSECTIONS).find(
    (subsection) => subsection.key === key
  ) || null;
