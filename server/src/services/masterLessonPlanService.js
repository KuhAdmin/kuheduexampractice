// CRUD for the chapter-level "Master Lesson Plan" -- mirrors
// lessonPlanService.js's exact ownership-check/mapping conventions, but for
// a single record per batch+chapter rather than a plan-with-many-entries.
import { pool } from "../db/pool.js";

const getMasterPlanOrThrow = async (planId, teacherUserId) => {
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

const mapMasterPlanRow = (row) => ({
  id: row.id,
  batchId: row.fk_batch_id,
  mstChapterId: row.fk_mst_chapter_id,
  chapterLabel: row.chapter_label,
  classTransactionTime: row.class_transaction_time,
  previousKnowledge: row.previous_knowledge,
  teachingAids: row.teaching_aids,
  objectives: row.objectives,
  skillsCompetencies: row.skills_competencies,
  transactionMethodology: row.transaction_methodology,
  interDisciplinaryLinkage: row.inter_disciplinary_linkage,
  assessmentQuestions: row.assessment_questions,
  extraQuestions: row.extra_questions,
  subjectTeacherName: row.subject_teacher_name,
  hodName: row.hod_name,
  principalName: row.principal_name,
  status: row.status,
  aiGenerated: row.ai_generated,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const paramsFromPayload = (payload) => [
  payload.chapterLabel?.trim() || "Untitled Chapter",
  payload.classTransactionTime || null,
  payload.previousKnowledge || null,
  payload.teachingAids ? JSON.stringify(payload.teachingAids) : null,
  payload.objectives ? JSON.stringify(payload.objectives) : null,
  payload.skillsCompetencies ? JSON.stringify(payload.skillsCompetencies) : null,
  payload.transactionMethodology || null,
  payload.interDisciplinaryLinkage ? JSON.stringify(payload.interDisciplinaryLinkage) : null,
  payload.assessmentQuestions ? JSON.stringify(payload.assessmentQuestions) : null,
  payload.extraQuestions ? JSON.stringify(payload.extraQuestions) : null,
  payload.subjectTeacherName || null,
  payload.hodName || null,
  payload.principalName || null,
];

// Joins in the same batch/chapter display info as listLessonPlans (the
// Daily plan's list) so both plan types can render side by side in the
// "My Lesson Plans" inventory with matching class/subject captions.
export const listMasterLessonPlans = async ({ teacherUserId, batchId }) => {
  const values = [teacherUserId];
  let batchClause = "";
  if (batchId) {
    values.push(batchId);
    batchClause = "AND mlp.fk_batch_id = $2";
  }
  const result = await pool.query(
    `
      SELECT
        mlp.*,
        lvl.name AS "className", sec.name AS "sectionName", subj.name AS "subjectName", mc.chapter_number AS "chapterNumber"
      FROM master_lesson_plan mlp
      JOIN batches b ON b.id = mlp.fk_batch_id
      JOIN teacher_class_assignment ta ON ta.id = b.fk_teacher_class_assignment_id
      JOIN institution_section sec ON sec.id = ta.fk_institution_section_id
      JOIN institution_class ic ON ic.id = sec.fk_institution_class_id
      JOIN mst_level lvl ON lvl.id = ic.fk_mst_level_id
      JOIN mst_subject subj ON subj.id = ta.fk_mst_subject_id
      LEFT JOIN mst_chapter mc ON mc.id = mlp.fk_mst_chapter_id
      WHERE mlp.fk_teacher_id = $1 ${batchClause}
      ORDER BY mlp.created_at DESC
    `,
    values
  );
  return result.rows.map((row) => ({
    ...mapMasterPlanRow(row),
    className: row.className,
    sectionName: row.sectionName,
    subjectName: row.subjectName,
    chapterNumber: row.chapterNumber,
  }));
};

export const getMasterLessonPlanByChapter = async ({ teacherUserId, batchId, mstChapterId }) => {
  const result = await pool.query(
    "SELECT * FROM master_lesson_plan WHERE fk_teacher_id = $1 AND fk_batch_id = $2 AND fk_mst_chapter_id = $3",
    [teacherUserId, batchId, mstChapterId]
  );
  return result.rows[0] ? mapMasterPlanRow(result.rows[0]) : null;
};

export const createMasterLessonPlan = async ({ teacherUserId, batchId, mstChapterId, ...payload }) => {
  if (!batchId || !mstChapterId) {
    const error = new Error("batchId and mstChapterId are required.");
    error.statusCode = 400;
    throw error;
  }
  const existing = await pool.query(
    "SELECT id FROM master_lesson_plan WHERE fk_batch_id = $1 AND fk_mst_chapter_id = $2",
    [batchId, mstChapterId]
  );
  if (existing.rows[0]) {
    const error = new Error("A master lesson plan already exists for this chapter -- edit it instead of creating another.");
    error.statusCode = 409;
    throw error;
  }

  const result = await pool.query(
    `
      INSERT INTO master_lesson_plan
        (fk_teacher_id, fk_batch_id, fk_mst_chapter_id, chapter_label, class_transaction_time, previous_knowledge,
         teaching_aids, objectives, skills_competencies, transaction_methodology, inter_disciplinary_linkage,
         assessment_questions, extra_questions, subject_teacher_name, hod_name, principal_name, ai_generated)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `,
    [teacherUserId, batchId, mstChapterId, ...paramsFromPayload(payload), Boolean(payload.aiGenerated)]
  );
  return mapMasterPlanRow(result.rows[0]);
};

export const getMasterLessonPlanDetail = async (planId, teacherUserId) => mapMasterPlanRow(await getMasterPlanOrThrow(planId, teacherUserId));

export const updateMasterLessonPlan = async (planId, teacherUserId, payload) => {
  await getMasterPlanOrThrow(planId, teacherUserId);
  const result = await pool.query(
    `
      UPDATE master_lesson_plan
      SET chapter_label = $3, class_transaction_time = $4, previous_knowledge = $5, teaching_aids = $6, objectives = $7,
          skills_competencies = $8, transaction_methodology = $9, inter_disciplinary_linkage = $10, assessment_questions = $11,
          extra_questions = $12, subject_teacher_name = $13, hod_name = $14, principal_name = $15, updated_at = NOW()
      WHERE id = $1 AND fk_teacher_id = $2
      RETURNING *
    `,
    [planId, teacherUserId, ...paramsFromPayload(payload)]
  );
  return mapMasterPlanRow(result.rows[0]);
};

export const publishMasterLessonPlan = async (planId, teacherUserId) => {
  await getMasterPlanOrThrow(planId, teacherUserId);
  const result = await pool.query(
    "UPDATE master_lesson_plan SET status = 'published', updated_at = NOW() WHERE id = $1 AND fk_teacher_id = $2 RETURNING *",
    [planId, teacherUserId]
  );
  return mapMasterPlanRow(result.rows[0]);
};

export const deleteMasterLessonPlan = async (planId, teacherUserId) => {
  const result = await pool.query("DELETE FROM master_lesson_plan WHERE id = $1 AND fk_teacher_id = $2 RETURNING id", [
    planId,
    teacherUserId,
  ]);
  return Boolean(result.rows[0]);
};
