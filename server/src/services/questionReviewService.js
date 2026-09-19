import { pool } from "../db/pool.js";

// Decision #3: teacher-authored questions join the shared bank only after
// admin/moderator approval. Reuses the existing moderator role -- no new
// role for this.
export const listPendingQuestions = async () => {
  const result = await pool.query(
    `
      SELECT
        cai.id, cai.item_id, cai.question, cai.question_family, cai.difficulty, cai.marks,
        cai.created_at, cai.review_status,
        u.name AS "teacherName", u.email AS "teacherEmail",
        mc.chapter_name AS "chapterName", mc.chapter_number AS "chapterNumber"
      FROM content_assessment_item cai
      JOIN users u ON u.id = cai.created_by_teacher_id
      LEFT JOIN mst_chapter mc ON mc.id = cai.fk_mst_chapter_id
      WHERE cai.review_status = 'pending'
      ORDER BY cai.created_at ASC
    `
  );
  return result.rows;
};

export const reviewQuestion = async (itemId, { decision, notes, reviewerUserId }) => {
  if (!["approved", "rejected"].includes(decision)) {
    const error = new Error("decision must be 'approved' or 'rejected'.");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
      UPDATE content_assessment_item
      SET review_status = $2, reviewed_by = $3, reviewed_at = NOW(), review_notes = $4
      WHERE id = $1 AND created_by_teacher_id IS NOT NULL
      RETURNING id
    `,
    [itemId, decision, reviewerUserId, notes || null]
  );

  if (!result.rows[0]) {
    const error = new Error("Question not found.");
    error.statusCode = 404;
    throw error;
  }
  return true;
};
