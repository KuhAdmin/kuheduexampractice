import { env } from "../config/env.js";
import { createStructuredCompletion } from "./openAiService.js";
import { extractTextFromHandwrittenImage } from "./ocrService.js";
import { getConceptCard } from "./studentContentService.js";

// Student concept-practice capture (camera -> crop -> OCR -> grade, embedded
// beneath AI Tutor on the concept Explore tab). Pinned to specific models
// regardless of admin per-subject overrides (those govern the separate
// Admin > AI Assessment Demo feature only): question/answer capture always
// uses Gemini Vision, grading always uses DeepSeek Pro.
const GEMINI_VISION_MODEL_ID = "gemini-vision";
const DEEPSEEK_PRO_MODEL_ID = "deepseek-v4-pro";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const assertImage = (imageDataUrl, label = "photo") => {
  if (typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
    const error = new Error(`A valid ${label} is required.`);
    error.statusCode = 400;
    throw error;
  }

  const approxBytes = Math.ceil((imageDataUrl.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    const error = new Error(`That ${label} is too large. Please retake it with a tighter crop.`);
    error.statusCode = 400;
    throw error;
  }
};

const assertVisionModelConfigured = () => {
  if (!env.geminiApiKey || !env.geminiVisionModel) {
    const error = new Error("This feature isn't available right now. Please contact support.");
    error.statusCode = 503;
    throw error;
  }
};

const assertGradingModelConfigured = () => {
  if (!env.deepseekApiKey || !env.deepseekModelPro) {
    const error = new Error("This feature isn't available right now. Please contact support.");
    error.statusCode = 503;
    throw error;
  }
};

const loadCardOrThrow = async (assessmentUnitId) => {
  const card = await getConceptCard({ assessmentUnitId });
  if (!card) {
    const error = new Error("This concept has not been generated yet.");
    error.statusCode = 404;
    throw error;
  }
  return card;
};

const describeConceptForPrompt = (card) => {
  const lines = [`Concept: ${card.primaryConcept}`];
  if (card.learningObjective) lines.push(`Learning objective: ${card.learningObjective}`);
  if (card.contextSummary) lines.push(`Summary: ${card.contextSummary}`);
  return lines.join("\n");
};

const QUESTION_CAPTURE_SYSTEM =
  "You are an OCR + relevance-classification engine for a student practice tool. You transcribe " +
  "pixels into text literally -- you never correct spelling, grammar, wording, or notation choices " +
  "made by whoever wrote/printed the question -- and you separately judge whether the transcribed " +
  "question belongs to a specific concept the student is currently studying. Return only valid JSON " +
  "matching the requested schema.";

// One Gemini Vision call does both the OCR transcription and the
// relevance/relatedness check together (same image, same pass) -- cheaper
// and faster than two separate vision calls, and the model needs to have
// already read the question to judge relatedness anyway.
export const captureQuestionForConcept = async ({ assessmentUnitId, imageDataUrl }) => {
  assertImage(imageDataUrl, "question photo");
  assertVisionModelConfigured();
  const card = await loadCardOrThrow(assessmentUnitId);

  const instructionText =
    `The student is currently studying this concept:\n${describeConceptForPrompt(card)}\n\n` +
    "The attached photo is a question they captured to practice with. First, transcribe every " +
    "word/symbol on the page exactly as written -- do not correct, paraphrase, or tidy up the " +
    "wording, and do not invent text that is not visibly present. If the page has no legible text, " +
    "return an empty string for extractedText.\n\n" +
    "If the page contains mathematical equations, physics formulas, chemical formulas/equations, or " +
    "other scientific notation, transcribe them as LaTeX instead of plain characters -- wrap inline " +
    "math in single dollar signs ($...$) and standalone/display equations in double dollar signs " +
    "($$...$$).\n\n" +
    "Then decide whether the transcribed question is actually about the concept above (the same " +
    "specific topic, not merely the same broad subject) -- a question from a different chapter or a " +
    "different concept within the same subject counts as NOT related. If extractedText is empty, " +
    "treat that as not related, since there is nothing to check.\n\n" +
    "Schema:\n{\n" +
    '  "extractedText": "",\n' +
    '  "isRelated": true or false,\n' +
    '  "reason": "one short sentence explaining the isRelated verdict, addressed directly to the student"\n' +
    "}";

  const { parsed } = await createStructuredCompletion({
    systemPrompt: QUESTION_CAPTURE_SYSTEM,
    userPrompt: instructionText,
    userContent: [
      { type: "text", text: instructionText },
      { type: "image_url", image_url: { url: imageDataUrl } },
    ],
    responseFormatName: "concept_practice_question_capture",
    modelId: GEMINI_VISION_MODEL_ID,
  });

  const extractedText = typeof parsed?.extractedText === "string" ? parsed.extractedText.trim() : "";
  const isRelated = Boolean(extractedText) && parsed?.isRelated === true;
  const reason =
    typeof parsed?.reason === "string" && parsed.reason.trim()
      ? parsed.reason.trim()
      : extractedText
        ? "Couldn't confirm this question matches the concept -- please retake the photo."
        : "We couldn't find any legible text in that photo.";

  return { text: extractedText, isRelated, reason };
};

export const captureAnswerForConcept = async ({ imageDataUrl }) => {
  assertImage(imageDataUrl, "answer photo");
  assertVisionModelConfigured();

  return extractTextFromHandwrittenImage({ imageDataUrl, modelId: GEMINI_VISION_MODEL_ID });
};

const GRADING_SYSTEM =
  "You are a world-class subject-matter expert and examiner grading a single student-submitted " +
  "practice question and answer, both transcribed from photos, with no pre-authored answer key. Use " +
  "your own subject expertise to work out the correct answer first, grounded in the concept the " +
  "student is studying, then judge the student's answer against it. Judge by substance and " +
  "reasoning, not exact wording -- accept correct paraphrases, equivalent working, and partially-" +
  "worded-but-substantively-correct answers as correct. " +
  "In idealAnswerSummary and feedback, write any mathematical equations, physics formulas, chemical " +
  "formulas/equations, or other scientific notation as LaTeX -- wrap inline math in $...$ and " +
  "standalone/display equations in $$...$$. Return only valid JSON matching the schema.";

// Text-only: question/answer images were already transcribed by Gemini
// Vision during capture, and DeepSeek's chat models aren't vision-capable --
// grading works from the transcribed text plus the concept context.
export const gradeConceptPracticeSubmission = async ({
  assessmentUnitId,
  questionText,
  answerText,
}) => {
  assertGradingModelConfigured();

  if (!questionText?.trim()) {
    const error = new Error("No question text was captured -- please retake the question photo.");
    error.statusCode = 422;
    throw error;
  }
  if (!answerText?.trim()) {
    const error = new Error("No answer text was captured -- please retake the answer photo.");
    error.statusCode = 422;
    throw error;
  }

  const card = await loadCardOrThrow(assessmentUnitId);

  const instructionText =
    `The student is currently studying this concept:\n${describeConceptForPrompt(card)}\n\n` +
    `Question (transcribed): ${questionText}\n` +
    `Student's answer (transcribed): ${answerText}\n\n` +
    "Work out the correct answer yourself, grounded in the concept above, then grade the student's " +
    "answer against it.\n\n" +
    "If either field needs a mathematical equation, physics formula, or chemical equation/formula, " +
    "write that notation in LaTeX -- wrap inline notation in $...$ and standalone/display equations " +
    'in $$...$$ (e.g. "$F = ma$", "$$2H_2 + O_2 \\rightarrow 2H_2O$$"). Do not LaTeX-wrap plain prose.\n\n' +
    "Schema:\n{\n" +
    '  "isCorrect": true or false,\n' +
    '  "idealAnswerSummary": "the correct answer/solution, 1-4 sentences",\n' +
    '  "feedback": "2-3 sentences, addressed directly to the student, explaining why their specific answer is right or wrong"\n' +
    "}";

  const { parsed, model } = await createStructuredCompletion({
    systemPrompt: GRADING_SYSTEM,
    userPrompt: instructionText,
    responseFormatName: "concept_practice_grading",
    modelId: DEEPSEEK_PRO_MODEL_ID,
  });

  if (typeof parsed?.isCorrect !== "boolean") {
    const error = new Error("The AI grading response was malformed. Please try again.");
    error.statusCode = 502;
    throw error;
  }

  return {
    isCorrect: parsed.isCorrect,
    idealAnswerSummary: typeof parsed.idealAnswerSummary === "string" ? parsed.idealAnswerSummary.trim() : "",
    feedback: typeof parsed.feedback === "string" ? parsed.feedback.trim() : "",
    modelName: model || null,
  };
};
