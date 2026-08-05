import { pool } from "../db/pool.js";
import { createStructuredCompletion } from "./openAiService.js";

// Mirrors the client-side cap in StudentTextbookActivityPanel.jsx -- enforced
// here too since a direct API call could bypass client-side truncation.
const MAX_RESPONSE_WORDS = 200;

const truncateToWordLimit = (text) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length <= MAX_RESPONSE_WORDS ? text : words.slice(0, MAX_RESPONSE_WORDS).join(" ");
};

// activityKey is "${contentKey}:${cardkey}" (see contentReadService.js's
// getTextbookContentForSection) -- contentKey never contains ":" (it's a
// slugify()'d join, see conceptImportService.js), so splitting on the first
// ":" cleanly recovers both parts even though cardkey itself may contain "-".
const splitActivityKey = (activityKey) => {
  const separatorIndex = activityKey.indexOf(":");
  if (separatorIndex === -1) return null;
  return { contentKey: activityKey.slice(0, separatorIndex), cardkey: activityKey.slice(separatorIndex + 1) };
};

const flattenCardToText = (card) => {
  const parts = [card.title, card.summary].filter(Boolean);
  (Array.isArray(card.details) ? card.details : []).forEach((detail) => {
    const value = Array.isArray(detail?.value) ? detail.value.join(". ") : detail?.value;
    if (detail?.label && value) parts.push(`${detail.label}. ${value}`);
  });
  return parts.join("\n");
};

// Textbook activities/exercises are open-ended (a reflection question or a
// hands-on activity like "walk around your school and draw a map") -- same
// as microActivityService.js's Layer 2 prompts, there's no single correct
// answer to grade against, so feedback here is deliberately qualitative (no
// isCorrect field), not a right/wrong verdict.
const buildTextbookActivityFeedback = async ({ cardText, responseText }) => {
  const { parsed } = await createStructuredCompletion({
    systemPrompt:
      "You are a precise, encouraging teacher giving feedback on a student's response to a textbook activity " +
      "or reflection question. There is no single correct answer to match verbatim, but the response must still " +
      "genuinely engage with what was asked. Check the response against the activity/question's actual " +
      "requirements before writing feedback -- do NOT give generic praise ('nice start', 'good job') if the " +
      "response is off-topic, too vague, or skips part of what was asked. If it's genuinely good, say so " +
      "specifically, citing what makes it thoughtful or complete. Keep feedback to 2-3 sentences, direct and " +
      "specific -- never vague reassurance. Return only valid JSON matching the schema.",
    userPrompt:
      `Activity/exercise content:\n${cardText}\n\nStudent's response: ${responseText}\n\n` +
      "Check the response against what the activity/question specifically asks for before writing feedback.\n\n" +
      `Schema:\n{ "feedback": "" }`,
    responseFormatName: "textbook_activity_feedback",
  });

  const feedback = typeof parsed?.feedback === "string" ? parsed.feedback.trim() : "";
  return feedback || "Thanks for giving it a try!";
};

export const gradeTextbookActivityResponse = async ({ activityKey, userId, responseText, sourcePageImages }) => {
  if (!responseText || !responseText.trim()) {
    const error = new Error("Please write or upload a response first.");
    error.statusCode = 422;
    throw error;
  }

  const keyParts = splitActivityKey(activityKey || "");
  if (!keyParts) {
    const error = new Error("Unrecognized activity.");
    error.statusCode = 400;
    throw error;
  }

  const cardResult = await pool.query(
    `SELECT title, summary, details FROM content_card
     WHERE content_key = $1 AND cardkey = $2 AND contentuitab = 'textbook' AND is_hidden = FALSE
     LIMIT 1`,
    [keyParts.contentKey, keyParts.cardkey]
  );
  const card = cardResult.rows[0];
  if (!card) {
    const error = new Error("This activity could not be found.");
    error.statusCode = 404;
    throw error;
  }

  const truncatedResponseText = truncateToWordLimit(responseText);
  const feedback = await buildTextbookActivityFeedback({
    cardText: flattenCardToText(card),
    responseText: truncatedResponseText,
  });

  const sourcePageImagesJson =
    Array.isArray(sourcePageImages) && sourcePageImages.length > 0 ? JSON.stringify(sourcePageImages) : null;

  const inserted = await pool.query(
    `INSERT INTO textbook_content_response (user_id, activity_key, response_text, feedback_text, source_page_images)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING created_at`,
    [userId, activityKey, truncatedResponseText, feedback, sourcePageImagesJson]
  );

  return { feedback, createdAt: inserted.rows[0].created_at };
};

export const getMostRecentTextbookActivityResponse = async ({ activityKey, userId }) => {
  const result = await pool.query(
    `SELECT response_text, feedback_text, created_at
     FROM textbook_content_response
     WHERE user_id = $1 AND activity_key = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, activityKey]
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
