const MAX_ISSUES = 20;
const MAX_CONTENT_POINTS = 8;

// Shared by gradeFreeTextAnswerWithAi (studentPracticeService.js, Story
// Anchor Questions), buildReflectionFeedback (studentPreWarmupService.js,
// Sensory/Experiential Warm-Up), and writingPracticeService.js (Tests >
// Write) -- all need identical AI-flagged issue prompting and post-processing.

export const ISSUES_SCHEMA_FRAGMENT = `,
  "issues": [
    { "type": "spelling" | "grammar", "original": "exact wrong word/phrase copied verbatim from the student's answer", "suggestion": "corrected version", "note": "very short explanation, under 12 words" }
  ]`;

export const ISSUES_PROMPT_INSTRUCTION =
  "Also identify any real spelling or grammar mistakes in the student's answer, quoting each mistake exactly " +
  "as written so it can be located in the original text. The answer may be a speech-to-text transcript -- don't " +
  "flag missing capitalization or terminal punctuation from that, only genuine misspelled words and grammatical " +
  "errors. Return an empty issues array if there are none.";

// Superset of ISSUES_SCHEMA_FRAGMENT/ISSUES_PROMPT_INSTRUCTION adding a third
// "phrasing" type for sentence-improvement suggestions (writingPracticeService.js
// only -- the other two callers keep the 2-way spelling/grammar schema above).
export const ISSUES_WITH_PHRASING_SCHEMA_FRAGMENT = `,
  "issues": [
    { "type": "spelling" | "grammar" | "phrasing", "original": "exact wrong or clunky word/phrase/sentence copied verbatim from the student's answer", "suggestion": "corrected or better-phrased version", "note": "very short explanation, under 12 words" }
  ]`;

export const ISSUES_WITH_PHRASING_PROMPT_INSTRUCTION =
  "Also identify any real spelling or grammar mistakes in the student's answer, and separately suggest better " +
  "phrasing for any clunky, awkward, or overly simple sentences -- for each, quote the exact original text (word, " +
  "phrase, or full sentence) verbatim so it can be located in the original, and mark spelling/grammar fixes with " +
  "type \"spelling\"/\"grammar\" and phrasing rewrites with type \"phrasing\". Return an empty issues array if there are none.";

export const CONTENT_FEEDBACK_SCHEMA_FRAGMENT = `,
  "contentFeedback": {
    "toAdd": ["a specific point missing from the answer that the question/format expects, in under 15 words"],
    "toOmit": ["a specific point in the answer that is irrelevant or shouldn't be there, in under 15 words"]
  }`;

export const CONTENT_FEEDBACK_PROMPT_INSTRUCTION =
  "Also compare the student's answer against the question's scenario and the expected format structure provided " +
  "below. List any specific, concrete points the answer is missing that the scenario or format expects (toAdd), " +
  "and any specific content in the answer that is irrelevant, incorrect, or shouldn't be there (toOmit). Keep each " +
  "point short and specific to this answer -- do not restate generic format advice. Return empty arrays if there " +
  "is nothing to add or omit.";

// The AI is asked to quote each mistake verbatim rather than compute
// character offsets itself (LLMs are unreliable at precise offset
// counting) -- this locates the quoted text back inside the actual answer
// after the fact instead of trusting AI-reported positions. Type-agnostic
// (pure substring search), so it re-anchors longer phrasing-quoted spans
// exactly as safely as single-word spelling quotes.
const locateSpan = (sourceText, original) => {
  if (!original) return null;
  let index = sourceText.indexOf(original);
  if (index === -1) {
    index = sourceText.toLowerCase().indexOf(original.toLowerCase());
  }
  return index === -1 ? null : { start: index, end: index + original.length };
};

const VALID_ISSUE_TYPES = ["spelling", "grammar", "phrasing"];

export const normalizeAiTextIssues = (rawIssues, sourceText, allowedTypes = ["spelling", "grammar"]) => {
  if (!Array.isArray(rawIssues) || !sourceText) {
    return [];
  }

  const resolvedAllowedTypes = allowedTypes.filter((type) => VALID_ISSUE_TYPES.includes(type));
  const fallbackType = resolvedAllowedTypes[0] || "spelling";

  return rawIssues
    .filter(
      (issue) =>
        issue &&
        typeof issue.original === "string" &&
        issue.original.trim() &&
        typeof issue.suggestion === "string" &&
        issue.suggestion.trim()
    )
    .slice(0, MAX_ISSUES)
    .map((issue) => {
      const span = locateSpan(sourceText, issue.original.trim());
      return {
        type: resolvedAllowedTypes.includes(issue.type) ? issue.type : fallbackType,
        original: issue.original.trim(),
        suggestion: issue.suggestion.trim(),
        note: typeof issue.note === "string" ? issue.note.trim() : "",
        start: span?.start ?? null,
        end: span?.end ?? null,
      };
    });
};

const normalizePointList = (rawList) => {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .filter((point) => typeof point === "string" && point.trim())
    .slice(0, MAX_CONTENT_POINTS)
    .map((point) => point.trim());
};

// Not span-based (no locateSpan re-anchoring) -- these are whole-answer
// observations ("you forgot to mention the deadline"), not quotes located
// inside the student's text.
export const normalizeContentFeedback = (raw) => ({
  toAdd: normalizePointList(raw?.toAdd),
  toOmit: normalizePointList(raw?.toOmit),
});
