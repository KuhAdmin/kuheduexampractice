// Teacher-to-teacher sharing for the chapter-level Master Lesson Plan --
// mirrors lessonPlanShareService.js's exact share/list/detail shape, just
// scoped to master_lesson_plan/master_lesson_plan_share instead of
// lesson_plan/lesson_plan_share. Colleague lookup is identical (same
// institution-membership rule), so it's reused rather than duplicated.
import { pool } from "../db/pool.js";
import { listMyInstitutionColleagues } from "./lessonPlanShareService.js";

const getOwnedMasterPlanOrThrow = async (planId, teacherUserId) => {
  const result = await pool.query("SELECT * FROM master_lesson_plan WHERE id = $1 AND fk_teacher_id = $2", [
    planId,
    teacherUserId,
  ]);
  if (!result.rows[0]) {
    const error = new Error("Master lesson plan not found.");
    error.statusCode = 404;
    throw error;
  }
  return result.rows[0];
};

export const shareMasterLessonPlan = async ({ planId, teacherUserId, shareWithUserIds }) => {
  await getOwnedMasterPlanOrThrow(planId, teacherUserId);
  const targetIds = Array.from(new Set((shareWithUserIds || []).map(Number).filter(Boolean)));
  if (!targetIds.length) {
    const error = new Error("shareWithUserIds is required.");
    error.statusCode = 400;
    throw error;
  }

  const colleagues = await listMyInstitutionColleagues(teacherUserId);
  const colleagueIds = new Set(colleagues.map((colleague) => colleague.userId));
  const validTargetIds = targetIds.filter((id) => colleagueIds.has(id));
  if (!validTargetIds.length) {
    const error = new Error("None of the selected teachers are colleagues at your institution.");
    error.statusCode = 400;
    throw error;
  }

  for (const targetId of validTargetIds) {
    await pool.query(
      `
        INSERT INTO master_lesson_plan_share (fk_master_lesson_plan_id, shared_by_teacher_id, shared_with_teacher_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (fk_master_lesson_plan_id, shared_with_teacher_id) DO NOTHING
      `,
      [planId, teacherUserId, targetId]
    );
  }

  return { sharedWith: validTargetIds };
};

export const listSharedMasterLessonPlansWithMe = async (teacherUserId) => {
  const result = await pool.query(
    `
      SELECT
        s.id AS "shareId", s.created_at AS "sharedAt",
        mlp.id AS "planId", mlp.chapter_label AS "chapterLabel", mlp.status, mlp.class_transaction_time AS "classTransactionTime",
        sharer.name AS "sharedByName"
      FROM master_lesson_plan_share s
      JOIN master_lesson_plan mlp ON mlp.id = s.fk_master_lesson_plan_id
      JOIN users sharer ON sharer.id = s.shared_by_teacher_id
      WHERE s.shared_with_teacher_id = $1
      ORDER BY s.created_at DESC
    `,
    [teacherUserId]
  );
  return result.rows;
};

const getMasterShareOrThrow = async (shareId, teacherUserId) => {
  const result = await pool.query(
    "SELECT * FROM master_lesson_plan_share WHERE id = $1 AND shared_with_teacher_id = $2",
    [shareId, teacherUserId]
  );
  if (!result.rows[0]) {
    const error = new Error("Shared master lesson plan not found.");
    error.statusCode = 404;
    throw error;
  }
  return result.rows[0];
};

export const getSharedMasterLessonPlanDetail = async ({ shareId, teacherUserId }) => {
  const share = await getMasterShareOrThrow(shareId, teacherUserId);
  const planResult = await pool.query("SELECT * FROM master_lesson_plan WHERE id = $1", [share.fk_master_lesson_plan_id]);
  const plan = planResult.rows[0];
  if (!plan) {
    const error = new Error("Shared master lesson plan not found.");
    error.statusCode = 404;
    throw error;
  }
  const sharerResult = await pool.query("SELECT name FROM users WHERE id = $1", [share.shared_by_teacher_id]);

  return {
    shareId: share.id,
    planId: plan.id,
    batchId: plan.fk_batch_id,
    chapterLabel: plan.chapter_label,
    classTransactionTime: plan.class_transaction_time,
    previousKnowledge: plan.previous_knowledge,
    teachingAids: plan.teaching_aids,
    objectives: plan.objectives,
    skillsCompetencies: plan.skills_competencies,
    transactionMethodology: plan.transaction_methodology,
    interDisciplinaryLinkage: plan.inter_disciplinary_linkage,
    assessmentQuestions: plan.assessment_questions,
    extraQuestions: plan.extra_questions,
    subjectTeacherName: plan.subject_teacher_name,
    hodName: plan.hod_name,
    principalName: plan.principal_name,
    status: plan.status,
    sharedByName: sharerResult.rows[0]?.name || null,
  };
};
