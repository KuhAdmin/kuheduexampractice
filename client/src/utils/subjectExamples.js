// Subject-aware placeholder copy for the lesson plan AI prompts -- a
// teacher planning English shouldn't see a Science example (photosynthesis)
// staring back at them in the placeholder text. Matched by keyword against
// the free-text subject name (mst_subject.name), most-specific compound
// subjects checked before their broader/overlapping single-word cousins
// (e.g. "Social Science" before plain "Science", so it doesn't match on the
// shared substring).
const SUBJECT_ACTIVITY_EXAMPLES = [
  { keywords: ["social", "history", "geography", "civics", "economics", "political"], example: "an engaging way to teach the causes of a historical event" },
  { keywords: ["environmental", "evs"], example: "an outdoor observation activity for plants" },
  { keywords: ["computer", "ict", "coding", "informatics"], example: "a simple coding exercise for loops" },
  { keywords: ["physical education", "sports", " pe "], example: "a fun physical activity for this topic" },
  { keywords: ["biology"], example: "a hands-on activity for photosynthesis" },
  { keywords: ["physics"], example: "a simple experiment to demonstrate Newton's laws" },
  { keywords: ["chemistry"], example: "a simple experiment to demonstrate a chemical reaction" },
  { keywords: ["math"], example: "a fun way to teach fractions" },
  { keywords: ["english", "language"], example: "a creative writing exercise for a short poem" },
  { keywords: ["hindi"], example: "an interesting activity to teach Hindi grammar" },
  { keywords: ["art"], example: "a hands-on craft activity for this chapter" },
  { keywords: ["science"], example: "a hands-on activity for photosynthesis" },
];

const DEFAULT_ACTIVITY_EXAMPLE = "a hands-on activity for this topic";

export const getSubjectActivityExample = (subjectName) => {
  if (!subjectName) return DEFAULT_ACTIVITY_EXAMPLE;
  const lower = ` ${subjectName.toLowerCase()} `;
  const match = SUBJECT_ACTIVITY_EXAMPLES.find(({ keywords }) => keywords.some((keyword) => lower.includes(keyword)));
  return match ? match.example : DEFAULT_ACTIVITY_EXAMPLE;
};
