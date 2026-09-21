// Stateless single-shot "Ask AI Anything" assistant for the lesson plan
// builder -- same shape as tutorChatService.js's "ask" mode (one question,
// one grounded answer, nothing persisted server-side; the client keeps its
// own ephemeral history, lost on refresh). Optionally grounded in the
// teacher's batch context, but unlike tutorChatService this never requires
// it -- a teacher can ask a general lesson-planning question with no batch
// selected yet.
import { getBatchContentContext } from "./teacherContentContext.js";
import { createStructuredCompletion } from "./openAiService.js";

export const answerLessonPlanQuestion = async ({ teacherUserId, batchId, chapterTitle, question, planContext }) => {
  if (!question?.trim()) {
    const error = new Error("Please ask a question first.");
    error.statusCode = 422;
    throw error;
  }

  let contextLines = [];
  if (batchId) {
    const context = await getBatchContentContext(batchId);
    if (context && context.teacherUserId === teacherUserId) {
      contextLines.push(`Board: ${context.board || "unspecified"}`);
      contextLines.push(`Class: ${context.className || "unspecified"}`);
      contextLines.push(`Subject: ${context.subjectName || "unspecified"}`);
    }
  }
  if (chapterTitle?.trim()) {
    contextLines.push(`Chapter: ${chapterTitle.trim()}`);
  }
  if (planContext?.trim()) {
    contextLines.push(`Current draft plan so far: ${planContext.trim()}`);
  }

  const { parsed } = await createStructuredCompletion({
    systemPrompt:
      "You are an AI teaching assistant helping a teacher plan lessons. Answer practically and " +
      "specifically to their curriculum context when given, otherwise answer generally. Keep it " +
      "concise (2-5 sentences unless the question needs more). " +
      "If your answer includes two or more distinct suggestions, activities, or ideas (e.g. one " +
      "activity per day, or several alternative options), NEVER combine them into one paragraph -- " +
      'format each as its own numbered list item on its own line: "1. First idea in full. 2. Second ' +
      'idea in full. 3. Third idea in full." Each numbered item must stand alone and make complete ' +
      "sense if the others were deleted. Each numbered item must reference exactly one specific day " +
      "(e.g. 'Day 3') -- never a range or alternative like 'Day 3 or 5' or 'Days 3-5'; if an idea " +
      "could suit either day, pick one and commit to it. If the teacher's question doesn't name " +
      "specific days and a current day-by-day plan is given in context, cover every day in that plan " +
      "once, in order, with no gaps -- one idea per day. If the question does name a day or range, " +
      "cover exactly those days, one idea per day, still with no gaps. " +
      "SPECIAL CASE -- if the teacher is specifically asking for classroom ACTIVITY suggestions/ideas " +
      "(not some other kind of question), the one-idea-per-day rule above does not apply -- instead, " +
      "for EACH day being addressed, give at least 5 numbered items of distinct activity ideas for the " +
      "general/mainstream group of learners, PLUS at least 1 additional numbered item explicitly " +
      'labeled for "Learners Needing Additional Support" whose activity is primarily VISUAL in nature ' +
      "(e.g. picture cards, diagrams, visual sequencing, hands-on visual aids) rather than text- or " +
      "reading-heavy. Every item, in both groups, still stands alone and still names its one specific " +
      "day exactly as above (e.g. '4. (Day 3 -- Learners Needing Additional Support, Visual): ...'). " +
      "Plain text only: no markdown, " +
      'no asterisks, no bold/italic formatting. Return only valid JSON matching the schema: ' +
      '{ "answer": "" }',
    userPrompt: `${contextLines.join("\n")}\n\nTeacher's question: ${question.trim()}`.trim(),
    responseFormatName: "lesson_plan_assistant",
  });

  const answer = typeof parsed?.answer === "string" ? parsed.answer.trim() : "";
  if (!answer) {
    const error = new Error("The assistant didn't return an answer. Please try again.");
    error.statusCode = 502;
    throw error;
  }

  return { answer };
};
