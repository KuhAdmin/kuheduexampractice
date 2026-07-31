import { pool } from "../db/pool.js";
import { createStructuredCompletion } from "./openAiService.js";

// Mirrors the client-side cap in StudentOpenResponsePanel.jsx -- enforced
// here too since a direct API call could bypass client-side truncation.
const MAX_RESPONSE_WORDS = 200;

const truncateToWordLimit = (text) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length <= MAX_RESPONSE_WORDS ? text : words.slice(0, MAX_RESPONSE_WORDS).join(" ");
};

// responseKey is "${assessmentUnitId}:${cardkey}" -- assessmentUnitId itself
// already contains a ":" (see contentReadService.js/conceptImportService.js:
// it's "${contentKey}:${conceptCardkey}"), so splitting must use the LAST
// ":", not the first, to recover both parts correctly.
const splitResponseKey = (responseKey) => {
  const separatorIndex = responseKey.lastIndexOf(":");
  if (separatorIndex === -1) return null;
  return {
    assessmentUnitId: responseKey.slice(0, separatorIndex),
    cardkey: responseKey.slice(separatorIndex + 1),
  };
};

const flattenCardToText = (card) => {
  const parts = [card.title, card.summary].filter(Boolean);
  (Array.isArray(card.details) ? card.details : []).forEach((detail) => {
    const value = Array.isArray(detail?.value) ? detail.value.join(". ") : detail?.value;
    if (detail?.label && value) parts.push(`${detail.label}. ${value}`);
  });
  return parts.join("\n");
};

// Case-study challenges are open-ended (a scenario + a question with no
// single correct wording) -- same as microActivityService.js/
// textbookActivityResponseService.js, feedback here is deliberately
// qualitative (no isCorrect field), not a right/wrong verdict. Deliberately
// family-agnostic wording (not "case-study scenario" specifically) -- this
// same function grades Object Hunt's free-text hunt summaries too, which
// have no scenario/question shape at all (just a themed object checklist).
const buildChallengeFeedback = async ({ cardText, responseText }) => {
  const { parsed } = await createStructuredCompletion({
    systemPrompt:
      "You are a precise, encouraging teacher giving feedback on a student's response to a self-directed " +
      "learning challenge (e.g. a case-study question grounded in a scenario, or a themed real-world object " +
      "hunt). There is no single correct wording to match verbatim, but the response must still genuinely " +
      "engage with what the challenge specifically asks for. Check the response against the challenge's own " +
      "content (its scenario/question, or its theme/focus) before writing feedback -- do NOT give generic " +
      "praise ('nice start', 'good job') if the response is off-topic, too vague, lists things that don't " +
      "genuinely fit the theme, or ignores part of what was asked. If it's genuinely good, say so " +
      "specifically, citing what makes it thoughtful or complete. Keep feedback to 2-3 sentences, direct and " +
      "specific -- never vague reassurance. Return only valid JSON matching the schema.",
    userPrompt:
      `Challenge content:\n${cardText}\n\nStudent's response: ${responseText}\n\n` +
      "Check the response against the challenge's own content (scenario/question, or theme/focus) before " +
      "writing feedback.\n\n" +
      `Schema:\n{ "feedback": "" }`,
    responseFormatName: "challenge_feedback",
  });

  const feedback = typeof parsed?.feedback === "string" ? parsed.feedback.trim() : "";
  return feedback || "Thanks for giving it a try!";
};

export const gradeChallengeResponse = async ({ responseKey, userId, responseText, sourcePageImages }) => {
  if (!responseText || !responseText.trim()) {
    const error = new Error("Please write or upload a response first.");
    error.statusCode = 422;
    throw error;
  }

  const keyParts = splitResponseKey(responseKey || "");
  if (!keyParts) {
    const error = new Error("Unrecognized challenge.");
    error.statusCode = 400;
    throw error;
  }

  const cardResult = await pool.query(
    `SELECT title, summary, details FROM content_card
     WHERE assessment_unit_id = $1 AND cardkey = $2 AND contentuitab = 'assessment'
     LIMIT 1`,
    [keyParts.assessmentUnitId, keyParts.cardkey]
  );
  const card = cardResult.rows[0];
  if (!card) {
    const error = new Error("This challenge could not be found.");
    error.statusCode = 404;
    throw error;
  }

  const truncatedResponseText = truncateToWordLimit(responseText);
  const feedback = await buildChallengeFeedback({
    cardText: flattenCardToText(card),
    responseText: truncatedResponseText,
  });

  const sourcePageImagesJson =
    Array.isArray(sourcePageImages) && sourcePageImages.length > 0 ? JSON.stringify(sourcePageImages) : null;

  const inserted = await pool.query(
    `INSERT INTO challenge_response (user_id, response_key, response_text, feedback_text, source_page_images)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING created_at`,
    [userId, responseKey, truncatedResponseText, feedback, sourcePageImagesJson]
  );

  return { feedback, createdAt: inserted.rows[0].created_at };
};

export const getMostRecentChallengeResponse = async ({ responseKey, userId }) => {
  const result = await pool.query(
    `SELECT response_text, feedback_text, created_at
     FROM challenge_response
     WHERE user_id = $1 AND response_key = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, responseKey]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    responseText: row.response_text,
    feedback: row.feedback_text,
    createdAt: row.created_at,
  };
};
