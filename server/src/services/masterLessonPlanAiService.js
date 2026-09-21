// Generates a chapter-level Master Lesson Plan preview -- stateless, mirrors
// nothing to the DB (see masterLessonPlanService.js's createMasterLessonPlan
// for the explicit "Save" step that follows a teacher's review of this
// preview). Distinct from lessonPlanAiService.js, which generates the
// day-by-day Daily Lesson Plan breakdown *within* a chapter.
import { assertTeacherOwnsBatch, resolveChapterId } from "./teacherContentContext.js";
import { getChaptersForClassSubjectSelection } from "./studentDashboardService.js";
import { createStructuredCompletion } from "./openAiService.js";
import { BLOOM_LEVELS } from "../constants/bloomLevels.js";

const AI_MASTER_LESSON_PLAN_MODEL_ID = "deepseek-v4-flash";
const DEFAULT_CLASS_TRANSACTION_TIME = 10;

export const generateMasterLessonPlanWithAI = async ({ teacherUserId, batchId, chapterNumber, classTransactionTime }) => {
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

  const resolvedClassTransactionTime = Math.max(1, Math.min(60, Number(classTransactionTime) || DEFAULT_CLASS_TRANSACTION_TIME));

  let parsed;
  try {
    ({ parsed } = await createStructuredCompletion({
      systemPrompt:
        "You are an expert curriculum planner helping a school teacher build a chapter-level Master Lesson Plan " +
        "(previous knowledge, teaching aids, Bloom's-taxonomy objectives, skills & competencies, transaction " +
        "methodology, inter-disciplinary linkage, and assessment questions covering the whole chapter). Return " +
        "only valid JSON that exactly matches the requested schema. Plain text only, no markdown formatting.",
      userPrompt: `Board: ${context.board}
Class: ${context.className}
Subject: ${context.subjectName}
Chapter: ${chapter.title}
Class Transaction Time: ${resolvedClassTransactionTime} classes

Write chapter-level content for every section below, grounded in this specific chapter's real content -- not generic filler.

Schema:
{
  "previousKnowledge": "string -- narrative prerequisite knowledge students likely already have before this chapter, in 3-6 sentences or bullet-style lines separated by newlines",
  "teachingAids": {
    "boardChalk": "string, e.g. Board, Chalk/Marker, Textbook",
    "concreteObjects": "string -- real/concrete objects relevant to this chapter",
    "visualAids": "string -- charts, diagrams, images, videos relevant to this chapter",
    "laboratoryAids": "string -- lab equipment/specimens relevant to this chapter, or empty string if not applicable",
    "digitalAiAids": "string -- smartboard/AI-assisted tools relevant to this chapter"
  },
  "objectives": {
    "remember": "string -- paragraph: what students will be able to recall after this chapter",
    "understand": "string -- paragraph: what students will be able to explain",
    "apply": "string -- paragraph: what students will be able to apply/identify",
    "analyse": "string -- paragraph: what students will be able to compare/analyse",
    "evaluate": "string -- paragraph: what students will be able to evaluate/justify",
    "create": "string -- paragraph: what students will be able to construct/create"
  },
  "skillsCompetencies": [
    { "title": "string, e.g. Observation and Critical Thinking Skill", "description": "string paragraph" },
    { "title": "string, e.g. Practical and Technological Skills", "description": "string paragraph" }
  ],
  "transactionMethodology": "string -- paragraph describing how the whole chapter will be taught (approach, integration of AI/experiential learning/etc.)",
  "interDisciplinaryLinkage": [
    { "subjectPair": "string, e.g. Science and Mathematics", "description": "string -- the specific connection for this chapter" }
  ],
  "assessmentQuestions": ["string", "string", "..."],
  "extraQuestions": ["string -- higher-order/application questions", "..."]
}`,
      responseFormatName: "master_lesson_plan_generation",
      modelId: AI_MASTER_LESSON_PLAN_MODEL_ID,
    }));
  } catch {
    parsed = null;
  }

  if (!parsed || typeof parsed !== "object") {
    const error = new Error("AI master lesson plan generation is unavailable right now -- try again or build the plan manually.");
    error.statusCode = 502;
    throw error;
  }

  const cleanedObjectives = parsed.objectives && typeof parsed.objectives === "object"
    ? Object.fromEntries(
        BLOOM_LEVELS.filter((stage) => typeof parsed.objectives[stage] === "string" && parsed.objectives[stage].trim()).map((stage) => [
          stage,
          parsed.objectives[stage].trim(),
        ])
      )
    : {};

  const cleanedList = (value) => (Array.isArray(value) ? value.filter((item) => String(item || "").trim()) : []);

  return {
    mstChapterId,
    chapterTitle: chapter.title,
    board: context.board,
    className: context.className,
    subjectName: context.subjectName,
    classTransactionTime: resolvedClassTransactionTime,
    previousKnowledge: parsed.previousKnowledge || "",
    teachingAids: {
      boardChalk: parsed.teachingAids?.boardChalk || "",
      concreteObjects: parsed.teachingAids?.concreteObjects || "",
      visualAids: parsed.teachingAids?.visualAids || "",
      laboratoryAids: parsed.teachingAids?.laboratoryAids || "",
      digitalAiAids: parsed.teachingAids?.digitalAiAids || "",
    },
    objectives: cleanedObjectives,
    skillsCompetencies: cleanedList(parsed.skillsCompetencies).map((item) => ({
      title: item?.title || "",
      description: item?.description || "",
    })),
    transactionMethodology: parsed.transactionMethodology || "",
    interDisciplinaryLinkage: cleanedList(parsed.interDisciplinaryLinkage).map((item) => ({
      subjectPair: item?.subjectPair || "",
      description: item?.description || "",
    })),
    assessmentQuestions: cleanedList(parsed.assessmentQuestions),
    extraQuestions: cleanedList(parsed.extraQuestions),
  };
};
