import { pool } from "../db/pool.js";
import { createStructuredCompletion } from "./openAiService.js";

const GRADING_INSTRUCTION_SYSTEM =
  "You are a world-class subject-matter expert and examiner, grading a single photographed " +
  "question and a photographed/typed handwritten answer with no pre-authored answer key. Use " +
  "your own subject expertise to work out the correct answer first, then judge the student's " +
  "answer against it. Judge by substance and reasoning, not exact wording or handwriting " +
  "neatness -- accept correct paraphrases, equivalent working, and partially-worded-but-" +
  "substantively-correct answers as correct. If the question includes a diagram or graph, " +
  "reason about it visually from the image. Return only valid JSON matching the schema.";

// One fast multimodal call: the question image, every answer-page image, and
// both OCR'd texts (kept as reference text alongside the images, same as
// gradeFreeTextAnswerWithAi/buildMicroActivityFeedback elsewhere in this
// codebase, but with images attached since there's no stored correct answer
// to grade against -- the model must derive it from the actual photos).
const gradeDemoSubmission = async ({
  subjectName,
  questionText,
  questionImageDataUrl,
  answerText,
  answerImages,
}) => {
  const instructionText =
    `Subject: ${subjectName}\n` +
    `Question (transcribed): ${questionText || "(see attached question image)"}\n` +
    `Student's answer (transcribed): ${answerText || "(see attached answer image(s))"}\n\n` +
    "The first attached image is the question. Any further attached images are the student's " +
    "answer pages, in order. Work out the correct answer yourself, then grade the student's " +
    "answer against it.\n\n" +
    "Schema:\n{\n" +
    '  "isCorrect": true or false,\n' +
    '  "idealAnswerSummary": "the correct answer/solution, 1-4 sentences",\n' +
    '  "feedback": "2-3 sentences, addressed directly to the student, explaining why their specific answer is right or wrong"\n' +
    "}";

  const userContent = [
    { type: "text", text: instructionText },
    { type: "image_url", image_url: { url: questionImageDataUrl } },
  ];

  for (const image of answerImages) {
    userContent.push({ type: "image_url", image_url: { url: image.imageData } });
  }

  const { parsed, model } = await createStructuredCompletion({
    systemPrompt: GRADING_INSTRUCTION_SYSTEM,
    userPrompt: instructionText,
    userContent,
    responseFormatName: "admin_demo_grading",
  });

  if (typeof parsed?.isCorrect !== "boolean") {
    const error = new Error("The AI grading response was malformed. Please try again.");
    error.statusCode = 502;
    throw error;
  }

  return {
    isCorrect: parsed.isCorrect,
    idealAnswerSummary:
      typeof parsed.idealAnswerSummary === "string" ? parsed.idealAnswerSummary.trim() : "",
    feedback: typeof parsed.feedback === "string" ? parsed.feedback.trim() : "",
    modelName: model || null,
  };
};

const mapSubmissionRow = (row) => ({
  id: row.id,
  subjectId: row.fk_mst_subject_id,
  subjectName: row.subject_name,
  captureMethod: row.capture_method,
  questionImageData: row.question_image_data,
  questionText: row.question_text,
  answerText: row.answer_text,
  answerSourceImages: row.answer_source_images || [],
  aiIsCorrect: row.ai_is_correct,
  aiIdealAnswer: row.ai_ideal_answer,
  aiFeedback: row.ai_feedback,
  modelName: row.model_name,
  createdAt: row.created_at,
});

const SUBMISSION_COLUMNS = `
  s.id, s.fk_mst_subject_id, subj.name AS subject_name, s.capture_method,
  s.question_image_data, s.question_text, s.answer_text, s.answer_source_images,
  s.ai_is_correct, s.ai_ideal_answer, s.ai_feedback, s.model_name, s.created_at
`;

export const submitDemoAssessment = async ({
  subjectId,
  captureMethod,
  questionImageDataUrl,
  questionText,
  answerText,
  answerSourceImages,
  userId,
}) => {
  if (!Number.isInteger(subjectId)) {
    const error = new Error("A subject is required.");
    error.statusCode = 422;
    throw error;
  }
  if (!["pdf_page", "camera_photo"].includes(captureMethod)) {
    const error = new Error("captureMethod must be pdf_page or camera_photo.");
    error.statusCode = 422;
    throw error;
  }
  if (typeof questionImageDataUrl !== "string" || !questionImageDataUrl.startsWith("data:image/")) {
    const error = new Error("A captured question image is required.");
    error.statusCode = 422;
    throw error;
  }

  const answerImages = Array.isArray(answerSourceImages) ? answerSourceImages : [];
  if (!answerText?.trim() && answerImages.length === 0) {
    const error = new Error("Please capture or write an answer first.");
    error.statusCode = 422;
    throw error;
  }

  const subjectResult = await pool.query("SELECT name FROM mst_subject WHERE id = $1", [subjectId]);
  const subjectName = subjectResult.rows[0]?.name;
  if (!subjectName) {
    const error = new Error("Subject not found.");
    error.statusCode = 404;
    throw error;
  }

  const grading = await gradeDemoSubmission({
    subjectName,
    questionText,
    questionImageDataUrl,
    answerText,
    answerImages,
  });

  const inserted = await pool.query(
    `
      INSERT INTO admin_demo_submission (
        fk_mst_subject_id, capture_method, question_image_data, question_text,
        answer_text, answer_source_images, ai_is_correct, ai_ideal_answer,
        ai_feedback, model_name, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, created_at
    `,
    [
      subjectId,
      captureMethod,
      questionImageDataUrl,
      questionText || null,
      answerText || null,
      answerImages.length > 0 ? JSON.stringify(answerImages) : null,
      grading.isCorrect,
      grading.idealAnswerSummary || null,
      grading.feedback || null,
      grading.modelName,
      userId,
    ]
  );

  return {
    id: inserted.rows[0].id,
    subjectId,
    subjectName,
    captureMethod,
    questionImageData: questionImageDataUrl,
    questionText: questionText || null,
    answerText: answerText || null,
    answerSourceImages: answerImages,
    aiIsCorrect: grading.isCorrect,
    aiIdealAnswer: grading.idealAnswerSummary || null,
    aiFeedback: grading.feedback || null,
    modelName: grading.modelName,
    createdAt: inserted.rows[0].created_at,
  };
};

export const listDemoSubmissions = async () => {
  const result = await pool.query(
    `
      SELECT ${SUBMISSION_COLUMNS}
      FROM admin_demo_submission s
      JOIN mst_subject subj ON subj.id = s.fk_mst_subject_id
      ORDER BY s.created_at DESC
    `
  );
  return result.rows.map(mapSubmissionRow);
};

export const getDemoSubmission = async (id) => {
  const result = await pool.query(
    `
      SELECT ${SUBMISSION_COLUMNS}
      FROM admin_demo_submission s
      JOIN mst_subject subj ON subj.id = s.fk_mst_subject_id
      WHERE s.id = $1
    `,
    [id]
  );
  return result.rows[0] ? mapSubmissionRow(result.rows[0]) : null;
};

export const deleteDemoSubmission = async (id) => {
  const result = await pool.query("DELETE FROM admin_demo_submission WHERE id = $1 RETURNING id", [id]);
  return Boolean(result.rows[0]);
};
