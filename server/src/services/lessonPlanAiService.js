// Generates a day-by-day Daily Lesson Plan preview for one chapter --
// stateless, mirrors nothing to the DB (see lessonPlanService.js's
// addLessonPlanEntriesBulk for the explicit "Save Plan" persistence step
// that follows a teacher's review of this preview). Distinct from
// masterLessonPlanAiService.js, which generates the chapter-level Master
// Lesson Plan (Previous Knowledge, Teaching Aids, Objectives, etc.).
import { assertTeacherOwnsBatch, resolveChapterId } from "./teacherContentContext.js";
import { getChaptersForClassSubjectSelection } from "./studentDashboardService.js";
import { createStructuredCompletion } from "./openAiService.js";
import { getMasterLessonPlanByChapter } from "./masterLessonPlanService.js";
import { BLOOM_LEVELS } from "../constants/bloomLevels.js";

const AI_LESSON_PLAN_MODEL_ID = "deepseek-v4-flash";
const MAX_DAYS = 30;
const DEFAULT_DAY_COUNT = 6;

const TONE_DESCRIPTIONS = {
  standard: "Standard, balanced coverage of theory and practice.",
  activityRich: "Activity-rich -- emphasize hands-on activities and student participation over lecture.",
  conceptFocused: "Concept-focused -- emphasize deeper theoretical explanation and conceptual clarity.",
  examOriented: "Exam-oriented -- emphasize exam-style questions, practice, and revision techniques.",
};

export const generateLessonPlanWithAI = async ({
  teacherUserId,
  batchId,
  chapterNumber,
  additionalInstructions,
  dayCount,
  topics,
  bloomFocus,
  includeSections,
  tone,
}) => {
  const context = await assertTeacherOwnsBatch(batchId, teacherUserId);
  if (!context.isContentConfigured) {
    const error = new Error("This batch's board/class/subject isn't fully configured yet.");
    error.statusCode = 400;
    throw error;
  }
  if (!chapterNumber) {
    const error = new Error("chapterNumber is required.");
    error.statusCode = 400;
    throw error;
  }

  const { chapters } = await getChaptersForClassSubjectSelection({
    userId: teacherUserId,
    examGoalCode: context.examGoalCode,
    levelCode: context.levelCode,
    subjectCode: context.subjectCode,
  });
  const chapter = chapters.find((item) => String(item.chapterNumber) === String(chapterNumber));
  if (!chapter) {
    const error = new Error("Chapter not found for this batch's subject.");
    error.statusCode = 404;
    throw error;
  }

  const mstChapterId = await resolveChapterId({
    chapterNumber,
    examGoalCode: context.examGoalCode,
    levelCode: context.levelCode,
    subjectCode: context.subjectCode,
  });

  // Optional enhancement, never blocking: if this chapter already has a
  // Master Lesson Plan, its real Assessment/Extra Questions get offered to
  // the model as material to draw each day's Bloom's-level Target Question
  // from, instead of it inventing unrelated ones -- see the prompt block
  // below. No master plan (or a lookup failure) just means generation
  // proceeds exactly as before.
  let masterQuestions = [];
  if (mstChapterId) {
    try {
      const masterPlan = await getMasterLessonPlanByChapter({ teacherUserId, batchId, mstChapterId });
      masterQuestions = [...(masterPlan?.assessmentQuestions || []), ...(masterPlan?.extraQuestions || [])];
    } catch {
      masterQuestions = [];
    }
  }

  const resolvedDayCount = Math.max(1, Math.min(MAX_DAYS, Number(dayCount) || DEFAULT_DAY_COUNT));

  const validTopics = Array.isArray(topics) ? topics.filter((topic) => String(topic || "").trim()) : [];
  const validBloomFocus = Array.isArray(bloomFocus) ? bloomFocus.filter((stage) => BLOOM_LEVELS.includes(stage)) : [];
  const validIncludeSections = Array.isArray(includeSections) ? includeSections.filter((section) => String(section || "").trim()) : [];
  const toneLine = TONE_DESCRIPTIONS[tone] || null;

  let parsed;
  try {
    ({ parsed } = await createStructuredCompletion({
      systemPrompt:
        "You are an expert curriculum planner helping a school teacher build a day-by-day daily lesson plan for one chapter. Return only valid JSON that exactly matches the requested schema.",
      userPrompt: `Board: ${context.board}
Class: ${context.className}
Subject: ${context.subjectName}
Chapter: ${chapter.title}
Number of teaching days to plan: ${resolvedDayCount}
${validTopics.length ? `Focus topics to include: ${validTopics.join(", ")}` : ""}
${validBloomFocus.length ? `Emphasize these Bloom's-taxonomy levels across the plan: ${validBloomFocus.join(", ")}. Only mark other levels true where they genuinely apply.` : ""}
${toneLine ? `Tone & style: ${toneLine}` : ""}
${validIncludeSections.length ? `Make sure the plan clearly addresses: ${validIncludeSections.join(", ")}.` : ""}
${additionalInstructions ? `Additional instructions from the teacher: ${additionalInstructions}` : ""}
${
  masterQuestions.length
    ? `\nThis chapter's Master Lesson Plan already defines these real assessment/extra questions for the whole chapter:\n${masterQuestions
        .map((question, index) => `${index + 1}. ${question}`)
        .join("\n")}\nWhen choosing each day's per-Bloom's-level Target Question, prefer reusing or closely adapting one of these questions where it genuinely fits that day's topic and that cognitive level, instead of inventing an unrelated one -- this keeps daily practice aligned with the chapter's real assessment intent. Not every question needs to be used, and not every day/stage needs one; use judgment, and still write a fresh Teaching Approach either way.`
    : ""
}

For each day, for each Bloom's-taxonomy stage (${BLOOM_LEVELS.join(", ")}) that genuinely applies to that day's activities${validBloomFocus.length ? ` (prioritize: ${validBloomFocus.join(", ")})` : ""}, write a value with exactly two lines: a specific target question that probes that cognitive level, and a concrete teaching approach/activity that develops it. Omit the key entirely for any stage that doesn't apply -- do not include empty strings.

Schema:
{
  "days": [
    {
      "topic": "string, required",
      "preConcept": "string, prerequisite concept students should already know",
      "subtopic": "string",
      "teachingApproach": "string, e.g. Lecture + Demonstration",
      "teachingMethod": {
        "remember": "Target Question: <question>\\nTeaching Approach: <approach>   -- omit this key if Remember doesn't apply to this day",
        "understand": "same two-line format, omit if not applicable",
        "apply": "same two-line format, omit if not applicable",
        "analyse": "same two-line format, omit if not applicable",
        "evaluate": "same two-line format, omit if not applicable",
        "create": "same two-line format, omit if not applicable"
      },
      "learningAid": "string, e.g. Charts, Models, Lab equipment",
      "learningOutcome": "string, what students should be able to do after this day"
    }
  ]
}`,
      responseFormatName: "lesson_plan_generation",
      modelId: AI_LESSON_PLAN_MODEL_ID,
    }));
  } catch {
    parsed = null;
  }

  const days = Array.isArray(parsed?.days) ? parsed.days : [];
  const cleanedDays = days
    .filter((day) => String(day?.topic || "").trim())
    .slice(0, MAX_DAYS)
    .map((day) => ({
      chapterLabel: chapter.title,
      topic: String(day.topic).trim(),
      preConcept: day.preConcept || null,
      subtopic: day.subtopic || null,
      teachingApproach: day.teachingApproach || null,
      teachingMethod:
        day.teachingMethod && typeof day.teachingMethod === "object"
          ? Object.fromEntries(
              BLOOM_LEVELS.filter((stage) => typeof day.teachingMethod[stage] === "string" && day.teachingMethod[stage].trim()).map(
                (stage) => [stage, day.teachingMethod[stage].trim()]
              )
            )
          : null,
      learningAid: day.learningAid || null,
      learningOutcome: day.learningOutcome || null,
    }));

  if (!cleanedDays.length) {
    const error = new Error("AI lesson plan generation is unavailable right now -- try again or build the plan manually.");
    error.statusCode = 502;
    throw error;
  }

  return {
    mstChapterId,
    chapterTitle: chapter.title,
    board: context.board,
    className: context.className,
    subjectName: context.subjectName,
    days: cleanedDays,
  };
};
