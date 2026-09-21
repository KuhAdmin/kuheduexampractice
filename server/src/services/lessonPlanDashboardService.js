// Real, data-backed stats for the Lesson Planner dashboard -- every number
// here is computed from actual rows, nothing fabricated. Two stats are
// explicit estimates rather than measured facts (see hoursSavedWithAi's
// comment below); everything else is a plain count/average.
import { pool } from "../db/pool.js";
import { listBatchesForTeacher } from "./batchService.js";
import { assertTeacherOwnsBatch } from "./teacherContentContext.js";
import { getChaptersForClassSubjectSelection } from "./studentDashboardService.js";

// A deliberately simple, clearly-labeled estimate -- there's no actual
// timer around lesson-plan creation to measure this precisely. This is the
// same "state the assumption plainly" approach as any estimated-savings
// stat: count of AI-generated plans x an assumed hours-saved-per-plan
// constant, not a per-teacher fabricated number.
const ESTIMATED_HOURS_SAVED_PER_AI_PLAN = 1.5;

export const getTeacherLessonPlanImpactStats = async (teacherUserId) => {
  const [plansResult, ratingResult, batches] = await Promise.all([
    pool.query(
      "SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE ai_generated) AS ai_generated_count FROM lesson_plan WHERE fk_teacher_id = $1",
      [teacherUserId]
    ),
    pool.query(
      `
        SELECT AVG(s.rating) AS avg_rating, COUNT(s.rating) AS rating_count
        FROM lesson_plan_share s
        JOIN lesson_plan lp ON lp.id = s.fk_lesson_plan_id
        WHERE lp.fk_teacher_id = $1 AND s.rating IS NOT NULL
      `,
      [teacherUserId]
    ),
    listBatchesForTeacher(teacherUserId),
  ]);

  const aiGeneratedCount = Number(plansResult.rows[0]?.ai_generated_count || 0);
  const avgRating = ratingResult.rows[0]?.avg_rating;
  const ratingCount = Number(ratingResult.rows[0]?.rating_count || 0);

  return {
    lessonPlansCreated: Number(plansResult.rows[0]?.total || 0),
    classesTaught: batches.length,
    hoursSavedWithAi: Math.round(aiGeneratedCount * ESTIMATED_HOURS_SAVED_PER_AI_PLAN * 10) / 10,
    avgPlanRating: ratingCount > 0 ? Math.round(Number(avgRating) * 10) / 10 : null,
    ratingCount,
  };
};

// Per-chapter status for one batch's board/class/subject, derived entirely
// from this teacher's own lesson_plan rows for that batch -- NOT student
// mastery (that's a different, already-existing concept on the student
// side). A chapter is "completed" once a published plan exists for it,
// "in progress" if only a draft exists, "not started" if neither does.
export const getTeacherCurriculumProgress = async ({ teacherUserId, batchId }) => {
  const context = await assertTeacherOwnsBatch(batchId, teacherUserId);
  if (!context.isContentConfigured) {
    return { totalChapters: 0, completed: 0, inProgress: 0, notStarted: 0, className: context.className, subjectName: context.subjectName };
  }

  const { chapters } = await getChaptersForClassSubjectSelection({
    userId: teacherUserId,
    examGoalCode: context.examGoalCode,
    levelCode: context.levelCode,
    subjectCode: context.subjectCode,
  });

  const statusResult = await pool.query(
    `
      SELECT lpc.chapter_number AS "chapterNumber",
             MAX(CASE WHEN lp.status = 'published' THEN 2 ELSE 1 END) AS level
      FROM lesson_plan lp
      JOIN mst_chapter lpc ON lpc.id = lp.fk_mst_chapter_id
      WHERE lp.fk_teacher_id = $1 AND lp.fk_batch_id = $2
      GROUP BY lpc.chapter_number
    `,
    [teacherUserId, batchId]
  );
  const levelByChapterNumber = new Map(statusResult.rows.map((row) => [String(row.chapterNumber), Number(row.level)]));

  let completed = 0;
  let inProgress = 0;
  chapters.forEach((chapter) => {
    const level = levelByChapterNumber.get(String(chapter.chapterNumber)) || 0;
    if (level === 2) completed += 1;
    else if (level === 1) inProgress += 1;
  });

  return {
    totalChapters: chapters.length,
    completed,
    inProgress,
    notStarted: chapters.length - completed - inProgress,
    className: context.className,
    subjectName: context.subjectName,
  };
};
