import { createStructuredCompletion } from "./openAiService.js";
import { getConceptCard } from "./studentContentService.js";

// Viva -- bottom-most section on the concept Explore tab, beneath Einstein
// Mode. A spoken 5-question round scoped strictly to the concept the
// student is currently studying: questions are generated fresh per session
// (never the same set twice), the client speaks each one via TTS and
// listens for a spoken/typed reply, and this service grades whichever
// replies actually came in.
const DEEPSEEK_PRO_MODEL_ID = "deepseek-v4-pro";
const QUESTION_COUNT = 5;

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
  if (card.misconceptions) lines.push(`Common misconceptions: ${JSON.stringify(card.misconceptions)}`);
  return lines.join("\n");
};

const QUESTIONS_SYSTEM =
  "You write short, spoken-aloud viva (oral exam) questions for a student, strictly scoped to a " +
  "single concept they are currently studying -- never a different concept, a different chapter, or " +
  "general trivia. Each question must be answerable in one or two spoken sentences (this is a timed " +
  "oral round, not a written exam) and phrased the way a teacher would actually SAY it out loud, not " +
  "written notation. Return only valid JSON matching the schema.";

export const generateVivaQuestions = async ({ assessmentUnitId }) => {
  const card = await loadCardOrThrow(assessmentUnitId);

  // A random nonce nudges the model to generate a different set of
  // questions on every call -- the same concept must never produce the
  // same viva twice.
  const nonce = Math.random().toString(36).slice(2, 10);

  const instructionText =
    `The student is currently studying this concept:\n${describeConceptForPrompt(card)}\n\n` +
    `Write exactly ${QUESTION_COUNT} short oral viva questions, strictly about this concept, of ` +
    "varying difficulty (start easier, get slightly harder). Each must be answerable out loud in " +
    "one or two sentences. Do not number them or add any prefix -- just the question text itself.\n\n" +
    `Generate a fresh, different set each time -- do not reuse the same questions across sessions. ` +
    `(random seed: ${nonce})\n\n` +
    'Schema:\n{\n  "questions": ["", "", "", "", ""]\n}';

  const { parsed } = await createStructuredCompletion({
    systemPrompt: QUESTIONS_SYSTEM,
    userPrompt: instructionText,
    responseFormatName: "viva_questions",
  });

  const questions = Array.isArray(parsed?.questions)
    ? parsed.questions.map((q) => (typeof q === "string" ? q.trim() : "")).filter(Boolean).slice(0, QUESTION_COUNT)
    : [];

  if (questions.length < QUESTION_COUNT) {
    const error = new Error("Couldn't prepare viva questions right now. Please try again.");
    error.statusCode = 502;
    throw error;
  }

  return { questions };
};

const FEEDBACK_SYSTEM =
  "You are a warm, encouraging examiner giving quick spoken feedback on ONE viva answer, grounded in " +
  "the concept the student is studying. Judge by substance, not exact wording -- accept correct " +
  "paraphrases and partially-worded-but-substantively-correct answers. Keep it to 1-2 short sentences " +
  "-- this will be read aloud immediately, not displayed as a long written critique. Return only " +
  "valid JSON matching the schema.";

export const gradeVivaAnswer = async ({ assessmentUnitId, question, answerText }) => {
  if (!question?.trim()) {
    const error = new Error("A question is required.");
    error.statusCode = 422;
    throw error;
  }
  if (!answerText?.trim()) {
    const error = new Error("An answer is required.");
    error.statusCode = 422;
    throw error;
  }

  const card = await loadCardOrThrow(assessmentUnitId);

  const instructionText =
    `The student is currently studying this concept:\n${describeConceptForPrompt(card)}\n\n` +
    `Viva question asked: ${question.trim()}\n` +
    `Student's spoken answer (transcribed): ${answerText.trim()}\n\n` +
    "Give brief spoken feedback on this one answer -- 1-2 short sentences, addressed directly to the " +
    "student, saying whether they got it right and why (or gently correcting them if not).\n\n" +
    'Schema:\n{\n  "feedback": ""\n}';

  const { parsed } = await createStructuredCompletion({
    systemPrompt: FEEDBACK_SYSTEM,
    userPrompt: instructionText,
    responseFormatName: "viva_feedback",
    modelId: DEEPSEEK_PRO_MODEL_ID,
  });

  const feedback = typeof parsed?.feedback === "string" ? parsed.feedback.trim() : "";
  if (!feedback) {
    const error = new Error("The AI feedback response was malformed. Please try again.");
    error.statusCode = 502;
    throw error;
  }

  return { feedback };
};
