import { pool } from "../db/pool.js";
import { createStructuredCompletion } from "./openAiService.js";
import {
  CONTENT_FEEDBACK_PROMPT_INSTRUCTION,
  CONTENT_FEEDBACK_SCHEMA_FRAGMENT,
  ISSUES_WITH_PHRASING_PROMPT_INSTRUCTION,
  ISSUES_WITH_PHRASING_SCHEMA_FRAGMENT,
  normalizeAiTextIssues,
  normalizeContentFeedback,
} from "./aiTextIssueUtils.js";

// Generous ceiling, not the question's actual word_limit -- truncating at
// the real limit would silently hide "your answer is too long" as
// something the AI could otherwise comment on. Only guards against a
// direct-API bypass of the client's own truncation.
const MAX_RESPONSE_WORDS = 400;

const truncateToWordLimit = (text) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length <= MAX_RESPONSE_WORDS ? text : words.slice(0, MAX_RESPONSE_WORDS).join(" ");
};

const flattenFormatTemplate = (formatTemplate) =>
  (Array.isArray(formatTemplate) ? formatTemplate : [])
    .map((step) => (step?.label ? `${step.label}: ${step.guidance || ""}`.trim() : null))
    .filter(Boolean)
    .join("\n");

const notFoundError = (message) => {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
};

export const listWritingPracticeCategories = async () => {
  const result = await pool.query(
    `SELECT slug, title, subtitle, description
     FROM writing_practice_category
     ORDER BY display_order`
  );

  return {
    categories: result.rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      subtitle: row.subtitle,
      description: row.description,
    })),
  };
};

export const getWritingPracticeCategoryWithSubcategories = async (categorySlug) => {
  const categoryResult = await pool.query(
    `SELECT id, slug, title, subtitle, description, format_template, word_limit, marks
     FROM writing_practice_category
     WHERE slug = $1`,
    [categorySlug]
  );
  const category = categoryResult.rows[0];
  if (!category) {
    throw notFoundError("That writing category could not be found.");
  }

  const subcategoriesResult = await pool.query(
    `SELECT slug, title
     FROM writing_practice_subcategory
     WHERE fk_category_id = $1
     ORDER BY display_order`,
    [category.id]
  );

  return {
    slug: category.slug,
    title: category.title,
    subtitle: category.subtitle,
    description: category.description,
    wordLimit: category.word_limit,
    marks: category.marks,
    formatTemplate: category.format_template || [],
    subcategories: subcategoriesResult.rows.map((row) => ({ slug: row.slug, title: row.title })),
  };
};

export const listWritingPracticeQuestions = async (categorySlug, subCategorySlug) => {
  const result = await pool.query(
    `SELECT q.id, q.question_number, q.title, q.word_limit, q.marks
     FROM writing_practice_question q
     JOIN writing_practice_subcategory sc ON sc.id = q.fk_subcategory_id
     JOIN writing_practice_category c ON c.id = sc.fk_category_id
     WHERE c.slug = $1 AND sc.slug = $2
     ORDER BY q.display_order`,
    [categorySlug, subCategorySlug]
  );

  return {
    questions: result.rows.map((row) => ({
      id: row.id,
      questionNumber: row.question_number,
      title: row.title,
      wordLimit: row.word_limit,
      marks: row.marks,
    })),
  };
};

export const getWritingPracticeQuestionDetail = async (questionId) => {
  const result = await pool.query(
    `SELECT
       q.id, q.question_number, q.title, q.description, q.word_limit AS question_word_limit, q.marks AS question_marks,
       sc.slug AS subcategory_slug, sc.title AS subcategory_title,
       c.slug AS category_slug, c.title AS category_title, c.subtitle AS category_subtitle,
       c.format_template
     FROM writing_practice_question q
     JOIN writing_practice_subcategory sc ON sc.id = q.fk_subcategory_id
     JOIN writing_practice_category c ON c.id = sc.fk_category_id
     WHERE q.id = $1`,
    [questionId]
  );
  const row = result.rows[0];
  if (!row) {
    throw notFoundError("That writing question could not be found.");
  }

  return {
    id: row.id,
    questionNumber: row.question_number,
    title: row.title,
    description: row.description,
    wordLimit: row.question_word_limit,
    marks: row.question_marks,
    subcategory: { slug: row.subcategory_slug, title: row.subcategory_title },
    category: { slug: row.category_slug, title: row.category_title, subtitle: row.category_subtitle },
    formatTemplate: row.format_template || [],
  };
};

// Qualitative, like buildTextbookActivityFeedback (textbookActivityResponseService.js)
// -- no isCorrect verdict, since writing practice isn't right/wrong. Mechanically
// modeled on gradeFreeTextAnswerWithAi (studentPracticeService.js): quote-verbatim
// issues, re-anchored server-side via normalizeAiTextIssues/locateSpan. Returns
// null on any failure (no fallback exists for open-ended writing, unlike MCQ
// grading) so the caller can surface a clear error instead of a fabricated grade.
const gradeWritingPracticeAnswer = async ({ questionDescription, wordLimit, formatTemplateText, responseText }) => {
  try {
    const wordCount = responseText.trim().split(/\s+/).filter(Boolean).length;
    const wordLimitText = wordLimit
      ? `\nWord limit: ${wordLimit} words (the student's answer is ${wordCount} words).`
      : "";
    const formatTemplateSection = formatTemplateText
      ? `\n\nExpected format structure for this type of writing:\n${formatTemplateText}`
      : "";

    const userPrompt = `Writing task: ${questionDescription}${wordLimitText}${formatTemplateSection}

Student's answer: ${responseText}

Evaluate the student's answer as a writing teacher would. ${ISSUES_WITH_PHRASING_PROMPT_INSTRUCTION} ${CONTENT_FEEDBACK_PROMPT_INSTRUCTION}

Schema:
{
  "feedback": "2-3 sentences of direct, specific overall feedback addressed to the student"${ISSUES_WITH_PHRASING_SCHEMA_FRAGMENT}${CONTENT_FEEDBACK_SCHEMA_FRAGMENT}
}`;

    const { parsed } = await createStructuredCompletion({
      systemPrompt:
        "You are a fair, encouraging CBSE English writing-skills teacher grading a Class 6-8 student's answer. " +
        "Return only valid JSON that exactly matches the requested schema.",
      userPrompt,
      responseFormatName: "writing_practice_grading",
    });

    const feedback = typeof parsed?.feedback === "string" && parsed.feedback.trim() ? parsed.feedback.trim() : null;
    if (!feedback) {
      return null;
    }

    return {
      feedback,
      issues: normalizeAiTextIssues(parsed.issues, responseText, ["spelling", "grammar", "phrasing"]),
      contentFeedback: normalizeContentFeedback(parsed.contentFeedback),
    };
  } catch {
    return null;
  }
};

export const gradeAndPersistWritingPracticeResponse = async ({ questionId, userId, responseText, sourcePageImages }) => {
  if (!responseText || !responseText.trim()) {
    const error = new Error("Please write or upload a response first.");
    error.statusCode = 422;
    throw error;
  }

  const question = await getWritingPracticeQuestionDetail(questionId);
  const truncatedResponseText = truncateToWordLimit(responseText);

  const grading = await gradeWritingPracticeAnswer({
    questionDescription: question.description,
    wordLimit: question.wordLimit,
    formatTemplateText: flattenFormatTemplate(question.formatTemplate),
    responseText: truncatedResponseText,
  });

  if (!grading) {
    const error = new Error("We couldn't get feedback on your answer right now. Please try again in a moment.");
    error.statusCode = 502;
    throw error;
  }

  const sourcePageImagesJson =
    Array.isArray(sourcePageImages) && sourcePageImages.length > 0 ? JSON.stringify(sourcePageImages) : null;
  const aiFeedbackJson = JSON.stringify(grading);

  await pool.query(
    `INSERT INTO writing_practice_response (user_id, fk_question_id, source_page_images, response_text, ai_feedback, status)
     VALUES ($1, $2, $3, $4, $5, 'graded')`,
    [userId, questionId, sourcePageImagesJson, truncatedResponseText, aiFeedbackJson]
  );

  return {
    responseText: truncatedResponseText,
    feedback: grading.feedback,
    issues: grading.issues,
    contentFeedback: grading.contentFeedback,
  };
};

export const getMostRecentWritingPracticeResponse = async ({ questionId, userId }) => {
  const result = await pool.query(
    `SELECT response_text, ai_feedback, created_at
     FROM writing_practice_response
     WHERE user_id = $1 AND fk_question_id = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, questionId]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  const feedback = row.ai_feedback || {};
  return {
    responseText: row.response_text,
    feedback: feedback.feedback || null,
    issues: feedback.issues || [],
    contentFeedback: feedback.contentFeedback || { toAdd: [], toOmit: [] },
    createdAt: row.created_at,
  };
};
