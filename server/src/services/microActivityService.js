import { pool } from "../db/pool.js";
import { createStructuredCompletion } from "./openAiService.js";
import { getLayer2Memory } from "./assessmentStudioContextAssembler.js";

// Mirrors the client-side cap in StudentMicroActivityPanel.jsx -- enforced
// here too since a direct API call could bypass client-side truncation.
const MAX_RESPONSE_WORDS = 200;

const truncateToWordLimit = (text) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length <= MAX_RESPONSE_WORDS ? text : words.slice(0, MAX_RESPONSE_WORDS).join(" ");
};

// Micro-activities are open-ended ("list five species you find nearby") --
// there's no single correct answer to grade against, unlike an assessment
// question. Feedback here is deliberately qualitative/formative (no
// isCorrect field at all), distinct from gradeFreeTextAnswerWithAi in
// studentPracticeService.js, which grades against a known expected answer.
const buildMicroActivityFeedback = async ({ primaryConcept, prompt, responseText }) => {
  const { parsed } = await createStructuredCompletion({
    systemPrompt:
      "You are a precise, honest teacher giving feedback on a hands-on activity response. " +
      "There is no single correct answer to match verbatim, but the response must still " +
      "genuinely satisfy what the activity instructions ask for. Before writing feedback, " +
      "check the response against the activity's actual requirements: the required count " +
      "of items (if any), the required category or type of thing being asked for, and " +
      "whether each individual item genuinely qualifies (e.g. is it a real, relevant example " +
      "of what was asked -- not an unrelated object, a repeated item, or something that " +
      "doesn't fit the category). Do NOT give generic praise ('nice start', 'good job') if " +
      "the response does not actually meet these requirements -- instead, name specifically " +
      "which items are wrong, irrelevant, or missing, and why. If the response is genuinely " +
      "good, say so specifically, citing what makes it correct. Keep feedback to 2-3 " +
      "sentences, direct and specific -- never vague reassurance. Return only valid JSON " +
      "matching the schema.",
    userPrompt:
      `Concept: ${primaryConcept}\nActivity instructions: ${prompt}\nStudent's response: ${responseText}\n\n` +
      "Check the response against the activity's specific requirements (count, category, " +
      "relevance of each item) before writing feedback.\n\n" +
      `Schema:\n{ "feedback": "" }`,
    responseFormatName: "micro_activity_feedback",
  });

  const feedback = typeof parsed?.feedback === "string" ? parsed.feedback.trim() : "";
  return feedback || "Thanks for giving it a try!";
};

export const gradeMicroActivityResponse = async ({
  assessmentUnitId,
  userId,
  responseText,
  sourcePageImages,
}) => {
  if (!responseText || !responseText.trim()) {
    const error = new Error("Please write or upload a response first.");
    error.statusCode = 422;
    throw error;
  }

  const truncatedResponseText = truncateToWordLimit(responseText);

  const memory = await getLayer2Memory(assessmentUnitId);
  if (!memory) {
    const error = new Error(
      "Layer 2 (Concept Memory) has not been generated for this concept yet."
    );
    error.statusCode = 404;
    throw error;
  }

  const prompt = memory.micro_activity;
  if (!prompt || !prompt.trim()) {
    const error = new Error("This concept has no micro-activity prompt yet.");
    error.statusCode = 422;
    throw error;
  }

  const feedback = await buildMicroActivityFeedback({
    primaryConcept: memory.primary_concept,
    prompt,
    responseText: truncatedResponseText,
  });

  const sourcePageImagesJson =
    Array.isArray(sourcePageImages) && sourcePageImages.length > 0
      ? JSON.stringify(sourcePageImages)
      : null;

  const inserted = await pool.query(
    `INSERT INTO micro_activity_response (user_id, assessment_unit_id, response_text, feedback_text, source_page_images)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING created_at`,
    [userId, assessmentUnitId, truncatedResponseText, feedback, sourcePageImagesJson]
  );

  return { feedback, createdAt: inserted.rows[0].created_at };
};

export const getMostRecentMicroActivityResponse = async ({ assessmentUnitId, userId }) => {
  const result = await pool.query(
    `SELECT response_text, feedback_text, created_at
     FROM micro_activity_response
     WHERE user_id = $1 AND assessment_unit_id = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, assessmentUnitId]
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
