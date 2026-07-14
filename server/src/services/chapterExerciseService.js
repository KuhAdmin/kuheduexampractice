import { pool } from "../db/pool.js";
import { createStructuredCompletion } from "./openAiService.js";
import { resolveDashboardAcademicFilters } from "./catalogService.js";

// Mirrors ocrService.js's own size cap -- there's no shared/central image
// size guard beyond Express's body-size limit, so every vision-input caller
// enforces this itself.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const VALID_INTERACTION_TYPES = new Set(["single_select", "free_text", "matching"]);

const normalizeAnswer = (value) => String(value ?? "").trim().toLowerCase();

// Duplicated from studentPracticeService.js's isSingleSelectOrFreeTextCorrect/
// isMatchingCorrect deliberately -- both are small, pure functions with no
// Layer-6-specific dependency, and keeping this feature self-contained avoids
// coupling it to an unrelated service's internals.
const isSingleSelectCorrect = ({ correctAnswer, studentAnswer }) =>
  normalizeAnswer(correctAnswer) === normalizeAnswer(studentAnswer);

const isMatchingCorrect = ({ interactionData, studentAnswer }) => {
  const expectedPairs = Array.isArray(interactionData?.pairs) ? interactionData.pairs : [];
  if (!expectedPairs.length) {
    return false;
  }

  let submittedPairs;
  try {
    submittedPairs = JSON.parse(studentAnswer);
  } catch {
    return false;
  }

  if (!Array.isArray(submittedPairs) || submittedPairs.length !== expectedPairs.length) {
    return false;
  }

  const expectedByLeft = new Map(
    expectedPairs.map((pair) => [normalizeAnswer(pair?.left), normalizeAnswer(pair?.right)])
  );

  return submittedPairs.every(
    (pair) => expectedByLeft.get(normalizeAnswer(pair?.left)) === normalizeAnswer(pair?.right)
  );
};

const EXTRACTION_INSTRUCTION =
  "This photo shows a textbook's chapter-end exercise/question page. Read every numbered " +
  "question on the page and extract it as structured data. For each question:\n" +
  "- Preserve the textbook's own question numbering exactly as printed (e.g. '1', '2(a)', 'Q5').\n" +
  "- Classify interactionType as 'single_select' if it offers lettered/numbered options to " +
  "choose from, 'matching' if it's a match-the-following two-column question, or 'free_text' " +
  "for any other short-answer/descriptive question.\n" +
  "- For single_select: extract every option verbatim in 'options', and since no answer key " +
  "is shown on this page, determine which option is correct yourself using your own subject " +
  "knowledge, and put its exact text in 'correctAnswer'.\n" +
  "- For matching: extract both columns as 'pairs' (each {left, right}), determining the " +
  "correct pairing yourself since no answer key is shown.\n" +
  "- For free_text: write a concise, correct model answer yourself in 'correctAnswer'.\n" +
  "If the photo contains no legible questions, return an empty questions array.\n\n" +
  'Schema:\n{\n  "questions": [\n    {\n      "questionNumber": "",\n      "questionText": "",\n      ' +
  '"interactionType": "single_select" | "free_text" | "matching",\n      "options": [],\n      ' +
  '"correctAnswer": "",\n      "pairs": [{ "left": "", "right": "" }]\n    }\n  ]\n}';

export const extractChapterExerciseQuestions = async ({
  fkMstBookId,
  chapterNumber,
  chapterName,
  imageDataUrl,
  mimeType,
  pipelineJobId,
  userId,
}) => {
  if (typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
    const error = new Error("A valid image is required.");
    error.statusCode = 400;
    throw error;
  }

  const approxBytes = Math.ceil((imageDataUrl.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    const error = new Error("Image is too large. Please upload a smaller or more compressed photo.");
    error.statusCode = 400;
    throw error;
  }

  const uploadResult = await pool.query(
    `INSERT INTO chapter_exercise_upload (
       fk_mst_book_id, chapter_number, chapter_name, image_data, mime_type, pipeline_job_id, created_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [fkMstBookId, chapterNumber, chapterName || null, imageDataUrl, mimeType || "image/jpeg", pipelineJobId || null, userId || null]
  );
  const uploadId = uploadResult.rows[0].id;

  try {
    const { parsed } = await createStructuredCompletion({
      systemPrompt:
        "You are an exam-content extraction engine for a school assessment app. Return only " +
        "valid JSON that exactly matches the requested schema.",
      userPrompt: EXTRACTION_INSTRUCTION,
      userContent: [
        { type: "text", text: EXTRACTION_INSTRUCTION },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ],
      responseFormatName: "chapter_exercise_extraction",
    });

    const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];

    let insertedCount = 0;
    for (const [index, question] of questions.entries()) {
      const interactionType = VALID_INTERACTION_TYPES.has(question?.interactionType)
        ? question.interactionType
        : "free_text";
      const questionText = typeof question?.questionText === "string" ? question.questionText.trim() : "";
      if (!questionText) {
        continue;
      }

      const options = interactionType === "single_select" && Array.isArray(question?.options)
        ? question.options.filter((option) => typeof option === "string" && option.trim())
        : [];
      const interactionData = interactionType === "matching" && Array.isArray(question?.pairs)
        ? {
            pairs: question.pairs
              .filter((pair) => pair?.left && pair?.right)
              .map((pair) => ({ left: String(pair.left), right: String(pair.right) })),
          }
        : {};
      const correctAnswer = typeof question?.correctAnswer === "string" ? question.correctAnswer.trim() : null;

      await pool.query(
        `INSERT INTO chapter_exercise_question (
           chapter_exercise_upload_id, fk_mst_book_id, chapter_number, question_number, question_text,
           interaction_type, options, correct_answer, interaction_data, display_order
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          uploadId,
          fkMstBookId,
          chapterNumber,
          typeof question?.questionNumber === "string" ? question.questionNumber : null,
          questionText,
          interactionType,
          JSON.stringify(options),
          correctAnswer,
          JSON.stringify(interactionData),
          index,
        ]
      );
      insertedCount += 1;
    }

    await pool.query(
      `UPDATE chapter_exercise_upload SET extraction_status = 'completed' WHERE id = $1`,
      [uploadId]
    );

    return { uploadId, questionCount: insertedCount };
  } catch (error) {
    await pool.query(
      `UPDATE chapter_exercise_upload SET extraction_status = 'failed', error_message = $2 WHERE id = $1`,
      [uploadId, error.message || "Extraction failed."]
    );
    throw error;
  }
};

export const listPendingChapterExerciseQuestions = async ({ fkMstBookId, chapterNumber }) => {
  const result = await pool.query(
    `SELECT id, question_number, question_text, interaction_type, options, correct_answer,
            interaction_data, created_at
     FROM chapter_exercise_question
     WHERE fk_mst_book_id = $1 AND chapter_number = $2 AND approval_status = 'pending'
     ORDER BY display_order ASC, id ASC`,
    [fkMstBookId, chapterNumber]
  );

  return result.rows.map((row) => ({
    id: row.id,
    questionNumber: row.question_number,
    questionText: row.question_text,
    interactionType: row.interaction_type,
    options: row.options,
    correctAnswer: row.correct_answer,
    interactionData: row.interaction_data,
    createdAt: row.created_at,
  }));
};

export const reviewChapterExerciseQuestion = async ({ questionId, decision, reviewerId }) => {
  if (decision !== "approved" && decision !== "rejected") {
    const error = new Error("decision must be 'approved' or 'rejected'.");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `UPDATE chapter_exercise_question
     SET approval_status = $2, reviewed_by = $3, reviewed_at = NOW()
     WHERE id = $1
     RETURNING id, approval_status`,
    [questionId, decision, reviewerId || null]
  );

  if (!result.rows.length) {
    const error = new Error("Question not found.");
    error.statusCode = 404;
    throw error;
  }

  return { id: result.rows[0].id, approvalStatus: result.rows[0].approval_status };
};

export const getApprovedChapterExerciseQuestions = async ({ fkMstBookId, chapterNumber, userId }) => {
  const result = await pool.query(
    `SELECT
       q.id, q.question_number, q.question_text, q.interaction_type, q.options, q.interaction_data,
       r.student_answer, r.is_correct, r.feedback_text
     FROM chapter_exercise_question q
     LEFT JOIN chapter_exercise_response r
       ON r.chapter_exercise_question_id = q.id AND r.user_id = $3
     WHERE q.fk_mst_book_id = $1 AND q.chapter_number = $2 AND q.approval_status = 'approved'
     ORDER BY q.display_order ASC, q.id ASC`,
    [fkMstBookId, chapterNumber, userId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    questionNumber: row.question_number,
    questionText: row.question_text,
    interactionType: row.interaction_type,
    options: row.options,
    interactionData: row.interaction_data,
    // correct_answer deliberately excluded -- server-side only, matches the
    // Layer 6 practice-set convention of never sending answers to the client.
    studentAnswer: row.student_answer,
    isCorrect: row.is_correct,
    feedback: row.feedback_text,
  }));
};

const buildFreeTextFeedback = async ({ questionText, correctAnswer, studentAnswer }) => {
  try {
    const { parsed } = await createStructuredCompletion({
      systemPrompt:
        "You are a fair, encouraging exam grader for a school assessment. Return only valid " +
        "JSON that exactly matches the requested schema.",
      userPrompt:
        `Question: ${questionText}\nExpected answer: ${correctAnswer || "(not specified)"}\n` +
        `Student's answer: ${studentAnswer}\n\n` +
        "Grade the student's answer against the expected answer. Judge by meaning, not exact " +
        "wording -- accept correct paraphrases and partially-worded-but-substantively-correct " +
        "answers as correct.\n\n" +
        'Schema:\n{\n  "isCorrect": true or false,\n  "feedback": "1-2 sentences, addressed ' +
        'directly to the student, explaining why their specific answer is right or wrong"\n}',
      responseFormatName: "chapter_exercise_free_text_grading",
    });

    if (typeof parsed?.isCorrect !== "boolean") {
      return null;
    }
    return {
      isCorrect: parsed.isCorrect,
      feedback: typeof parsed.feedback === "string" && parsed.feedback.trim() ? parsed.feedback.trim() : null,
    };
  } catch {
    return null;
  }
};

export const submitChapterExerciseResponse = async ({ questionId, userId, studentAnswer, sourcePageImages }) => {
  if (!studentAnswer || !String(studentAnswer).trim()) {
    const error = new Error("Please provide an answer first.");
    error.statusCode = 422;
    throw error;
  }

  const questionResult = await pool.query(
    `SELECT interaction_type, correct_answer, interaction_data, question_text
     FROM chapter_exercise_question
     WHERE id = $1 AND approval_status = 'approved'`,
    [questionId]
  );
  const question = questionResult.rows[0];
  if (!question) {
    const error = new Error("Question not found or not yet approved.");
    error.statusCode = 404;
    throw error;
  }

  let isCorrect;
  let feedback = null;

  if (question.interaction_type === "single_select") {
    isCorrect = isSingleSelectCorrect({ correctAnswer: question.correct_answer, studentAnswer });
  } else if (question.interaction_type === "matching") {
    isCorrect = isMatchingCorrect({ interactionData: question.interaction_data, studentAnswer });
  } else {
    const graded = await buildFreeTextFeedback({
      questionText: question.question_text,
      correctAnswer: question.correct_answer,
      studentAnswer,
    });
    if (graded) {
      isCorrect = graded.isCorrect;
      feedback = graded.feedback;
    } else {
      isCorrect = isSingleSelectCorrect({ correctAnswer: question.correct_answer, studentAnswer });
    }
  }

  const sourcePageImagesJson =
    Array.isArray(sourcePageImages) && sourcePageImages.length > 0
      ? JSON.stringify(sourcePageImages)
      : null;

  await pool.query(
    `INSERT INTO chapter_exercise_response (user_id, chapter_exercise_question_id, student_answer, is_correct, feedback_text, source_page_images)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, chapter_exercise_question_id) DO UPDATE
     SET student_answer = EXCLUDED.student_answer,
         is_correct = EXCLUDED.is_correct,
         feedback_text = EXCLUDED.feedback_text,
         source_page_images = EXCLUDED.source_page_images,
         created_at = NOW()`,
    [userId, questionId, studentAnswer, isCorrect, feedback, sourcePageImagesJson]
  );

  return { isCorrect, feedback, correctAnswer: question.correct_answer };
};

// Mirrors studentContentService.js's listSectionsForChapter resolution
// exactly (board/class/subject -> examGoalCode/levelCode/subjectCode against
// mv_chapter_catalog) so student-facing book-question routes never take a raw
// bookId param, matching every other /user/... route's convention.
export const resolveBookIdForChapter = async ({ board, studentClass, subject, chapterNumber }) => {
  const { examGoalCode, levelCode, subjectCode, isValid } = resolveDashboardAcademicFilters({
    board,
    studentClass,
    subject,
  });

  if (!isValid || !chapterNumber) {
    return null;
  }

  const result = await pool.query(
    `SELECT DISTINCT book_id
     FROM mv_chapter_catalog
     WHERE exam_goal_code = $1
       AND level_code = $2
       AND subject_code = $3
       AND chapter_number = $4
       AND book_is_active = TRUE
       AND chapter_is_active = TRUE
     LIMIT 1`,
    [examGoalCode, levelCode, subjectCode, chapterNumber]
  );

  return result.rows[0]?.book_id || null;
};

export const getBookQuestionsForStudent = async ({ board, studentClass, subject, chapterNumber, userId }) => {
  const fkMstBookId = await resolveBookIdForChapter({ board, studentClass, subject, chapterNumber });
  if (!fkMstBookId) {
    return { chapterNumber: chapterNumber || null, questions: [] };
  }

  const questions = await getApprovedChapterExerciseQuestions({ fkMstBookId, chapterNumber, userId });
  return { chapterNumber, questions };
};

export const submitBookQuestionResponseForStudent = async ({
  board,
  studentClass,
  subject,
  chapterNumber,
  questionId,
  userId,
  studentAnswer,
  sourcePageImages,
}) => {
  const fkMstBookId = await resolveBookIdForChapter({ board, studentClass, subject, chapterNumber });
  if (!fkMstBookId) {
    const error = new Error("This chapter could not be resolved for your profile.");
    error.statusCode = 404;
    throw error;
  }

  return submitChapterExerciseResponse({ questionId, userId, studentAnswer, sourcePageImages });
};

export const getChapterExerciseProgressForUser = async ({ userId, fkMstBookId, chapterNumber }) => {
  const result = await pool.query(
    `SELECT
       COUNT(q.id)::int AS total_questions,
       COUNT(r.id)::int AS answered_count,
       COUNT(r.id) FILTER (WHERE r.is_correct)::int AS correct_count
     FROM chapter_exercise_question q
     LEFT JOIN chapter_exercise_response r
       ON r.chapter_exercise_question_id = q.id AND r.user_id = $3
     WHERE q.fk_mst_book_id = $1 AND q.chapter_number = $2 AND q.approval_status = 'approved'`,
    [fkMstBookId, chapterNumber, userId]
  );

  const row = result.rows[0];
  return {
    totalQuestions: row.total_questions,
    answeredCount: row.answered_count,
    correctCount: row.correct_count,
  };
};

export const getChapterExerciseProgressForStudent = async ({
  board,
  studentClass,
  subject,
  chapterNumber,
  userId,
}) => {
  const fkMstBookId = await resolveBookIdForChapter({ board, studentClass, subject, chapterNumber });
  if (!fkMstBookId) {
    return { totalQuestions: 0, answeredCount: 0, correctCount: 0 };
  }

  return getChapterExerciseProgressForUser({ userId, fkMstBookId, chapterNumber });
};
