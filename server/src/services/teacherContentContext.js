import { pool } from "../db/pool.js";

// Resolves the (board, studentClass, subject, examGoalCode, levelCode,
// subjectCode) sextuple the existing student content/TestLab pipeline needs,
// starting from a batch instead of a student profile. institution_class only
// carries a level and teacher_class_assignment only carries a subject --
// institutions.fk_mst_exam_goal_id is what supplies the missing board, since
// nothing else in the institution model does.
export const getBatchContentContext = async (batchId) => {
  const result = await pool.query(
    `
      SELECT
        eg.goal_id AS "examGoalCode",
        eg.board_code AS "board",
        lvl.name_code AS "levelCode",
        subj.name_code AS "subjectCode",
        subj.name AS "subjectName",
        it.fk_user_id AS "teacherUserId",
        inst.id AS "institutionId",
        inst.name AS "institutionName",
        lvl.name AS "className",
        sec.name AS "sectionName"
      FROM batches b
      JOIN teacher_class_assignment ta ON ta.id = b.fk_teacher_class_assignment_id
      JOIN institution_teacher it ON it.id = ta.fk_institution_teacher_id
      JOIN institutions inst ON inst.id = it.fk_institution_id
      JOIN institution_section sec ON sec.id = ta.fk_institution_section_id
      JOIN institution_class ic ON ic.id = sec.fk_institution_class_id
      JOIN mst_level lvl ON lvl.id = ic.fk_mst_level_id
      JOIN mst_subject subj ON subj.id = ta.fk_mst_subject_id
      LEFT JOIN mst_exam_goal eg ON eg.id = inst.fk_mst_exam_goal_id
      WHERE b.id = $1
    `,
    [batchId]
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    ...row,
    studentClass: row.levelCode,
    subject: row.subjectName,
    isContentConfigured: Boolean(row.examGoalCode && row.levelCode && row.subjectCode),
  };
};

export const assertTeacherOwnsBatch = async (batchId, teacherUserId) => {
  const context = await getBatchContentContext(batchId);
  if (!context || context.teacherUserId !== teacherUserId) {
    const error = new Error("Batch not found.");
    error.statusCode = 404;
    throw error;
  }
  return context;
};

// Resolves a chapterNumber (a free-text value like TestLab uses) to its
// mst_chapter row, scoped to one board+class+subject -- used only for
// teacher-authored custom questions, which attach to a chapter rather than a
// specific concept/assessment_unit (see content_assessment_item's
// fk_mst_chapter_id column).
export const resolveChapterId = async ({ chapterNumber, examGoalCode, levelCode, subjectCode }) => {
  const result = await pool.query(
    `
      SELECT mc.id
      FROM mst_chapter mc
      JOIN mst_book mb ON mb.id = mc.fk_mst_book_id
      JOIN mst_level lvl ON lvl.id = mb.fk_mst_level_id
      JOIN mst_subject subj ON subj.id = mb.fk_mst_subject_id
      JOIN mst_exam_goal eg ON eg.id = mb.fk_mst_exam_goal_id
      WHERE mc.chapter_number = $1 AND lvl.name_code = $2 AND subj.name_code = $3 AND eg.goal_id = $4
      LIMIT 1
    `,
    [chapterNumber, levelCode, subjectCode, examGoalCode]
  );
  return result.rows[0]?.id || null;
};
