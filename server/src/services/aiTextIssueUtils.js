const MAX_ISSUES = 20;

// Shared by gradeFreeTextAnswerWithAi (studentPracticeService.js, Story
// Anchor Questions) and buildReflectionFeedback (studentPreWarmupService.js,
// Sensory/Experiential Warm-Up) -- both need identical AI-flagged
// spelling/grammar issue prompting and post-processing.

export const ISSUES_SCHEMA_FRAGMENT = `,
  "issues": [
    { "type": "spelling" | "grammar", "original": "exact wrong word/phrase copied verbatim from the student's answer", "suggestion": "corrected version", "note": "very short explanation, under 12 words" }
  ]`;

export const ISSUES_PROMPT_INSTRUCTION =
  "Also identify any real spelling or grammar mistakes in the student's answer, quoting each mistake exactly " +
  "as written so it can be located in the original text. The answer may be a speech-to-text transcript -- don't " +
  "flag missing capitalization or terminal punctuation from that, only genuine misspelled words and grammatical " +
  "errors. Return an empty issues array if there are none.";

// The AI is asked to quote each mistake verbatim rather than compute
// character offsets itself (LLMs are unreliable at precise offset
// counting) -- this locates the quoted text back inside the actual answer
// after the fact instead of trusting AI-reported positions.
const locateSpan = (sourceText, original) => {
  if (!original) return null;
  let index = sourceText.indexOf(original);
  if (index === -1) {
    index = sourceText.toLowerCase().indexOf(original.toLowerCase());
  }
  return index === -1 ? null : { start: index, end: index + original.length };
};

export const normalizeAiTextIssues = (rawIssues, sourceText) => {
  if (!Array.isArray(rawIssues) || !sourceText) {
    return [];
  }

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
        type: issue.type === "grammar" ? "grammar" : "spelling",
        original: issue.original.trim(),
        suggestion: issue.suggestion.trim(),
        note: typeof issue.note === "string" ? issue.note.trim() : "",
        start: span?.start ?? null,
        end: span?.end ?? null,
      };
    });
};
