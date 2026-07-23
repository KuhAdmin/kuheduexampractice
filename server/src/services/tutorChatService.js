import { getConceptCard } from "./studentContentService.js";
import { createStructuredCompletion } from "./openAiService.js";

// AI Tutor (Explore tab). Scoped to two modes only:
//   "ask"   -- the student's own free-form question about this concept.
//   "coach" -- an encouraging walkthrough of the concept's own Explore
//              content (analogy/story/curiosity hook/misconceptions), no
//              question needed.
// Interview/Viva/Debate (which reframe assessment questions) are
// deliberately out of scope here -- that content lives behind Practice's
// own attempt lifecycle (studentPracticeService.js), not a stateless card
// fetch, and doesn't fit Explore's own "conceptual understanding" content.

const describeCard = (card) => {
  const lines = [`Concept: ${card.primaryConcept}`];
  if (card.learningObjective) lines.push(`Learning objective: ${card.learningObjective}`);
  if (card.contextSummary) lines.push(`Summary: ${card.contextSummary}`);
  if (card.analogy) lines.push(`Analogy: ${card.analogy}`);
  if (card.story) lines.push(`Story: ${card.story}`);
  if (card.realWorldConnection) lines.push(`Real-world connection: ${card.realWorldConnection}`);
  if (card.curiosityHook) lines.push(`Curiosity hook: ${card.curiosityHook}`);
  if (card.memoryTrick) lines.push(`Memory trick: ${card.memoryTrick}`);
  if (card.misconceptionAlert) lines.push(`Common misconception: ${card.misconceptionAlert}`);
  return lines.join("\n");
};

const buildAskPrompt = (card, question) => ({
  systemPrompt:
    "You are a friendly AI tutor answering a student's own question about a concept they're " +
    "exploring. Ground your answer in the concept context given below -- don't dodge into a " +
    "generic non-answer. Keep it concise (2-4 sentences unless the question needs more). " +
    'Return only valid JSON matching the schema: { "answer": "" }',
  userPrompt: `${describeCard(card)}\n\nStudent's question: ${question}`,
});

const buildCoachPrompt = (card) => ({
  systemPrompt:
    "You are an encouraging AI tutor coaching a student through a concept they're exploring. " +
    "Walk them through the concept conversationally, starting from whatever analogy/story/" +
    "real-world content is available below -- don't just repeat it verbatim, build on it and " +
    "check that it makes sense. Keep it warm and concise (3-5 sentences). " +
    'Return only valid JSON matching the schema: { "answer": "" }',
  userPrompt: describeCard(card),
});

export const answerTutorQuestion = async ({ assessmentUnitId, mode, question }) => {
  if (mode !== "ask" && mode !== "coach") {
    const error = new Error('mode must be "ask" or "coach".');
    error.statusCode = 422;
    throw error;
  }
  if (mode === "ask" && !question?.trim()) {
    const error = new Error("Please ask a question first.");
    error.statusCode = 422;
    throw error;
  }

  const card = await getConceptCard({ assessmentUnitId });
  if (!card) {
    const error = new Error("This concept has not been generated yet.");
    error.statusCode = 404;
    throw error;
  }

  const { systemPrompt, userPrompt } = mode === "ask" ? buildAskPrompt(card, question.trim()) : buildCoachPrompt(card);

  const { parsed, usage } = await createStructuredCompletion({
    systemPrompt,
    userPrompt,
    responseFormatName: "tutor_answer",
  });

  const answer = typeof parsed?.answer === "string" ? parsed.answer.trim() : "";
  if (!answer) {
    const error = new Error("The tutor didn't return an answer. Please try again.");
    error.statusCode = 502;
    throw error;
  }

  return { answer, tokens: usage };
};
