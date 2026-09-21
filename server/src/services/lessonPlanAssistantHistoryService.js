// Archive of resolved/superseded AI Teaching Assistant exchanges -- written
// only when a teacher Accepts or Retries an answer (see
// TeacherLessonPlanAssistantPanel.jsx), never on a plain Ask. Scoped to
// (teacher, batch) rather than a lesson_plan row, since the Create page has
// no lesson_plan yet until "Save Plan" -- history accumulated while
// drafting still carries over once the plan is saved and reopened.
import { pool } from "../db/pool.js";
import { assertTeacherOwnsBatch } from "./teacherContentContext.js";

const mapHistoryRow = (row) => ({
  id: row.id,
  question: row.question,
  answer: row.answer,
  items: row.items,
  status: row.status,
  acceptedDayNumber: row.accepted_day_number,
  createdAt: row.created_at,
});

export const recordAssistantHistory = async ({
  teacherUserId,
  batchId,
  question,
  answer,
  items,
  status,
  acceptedDayNumber,
}) => {
  await assertTeacherOwnsBatch(batchId, teacherUserId);
  if (!question?.trim() || !answer?.trim()) {
    const error = new Error("question and answer are required.");
    error.statusCode = 400;
    throw error;
  }
  if (status !== "accepted" && status !== "retried") {
    const error = new Error('status must be "accepted" or "retried".');
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
      INSERT INTO lesson_plan_assistant_history
        (fk_teacher_id, fk_batch_id, question, answer, items, status, accepted_day_number)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [
      teacherUserId,
      batchId,
      question.trim(),
      answer.trim(),
      Array.isArray(items) ? JSON.stringify(items) : null,
      status,
      status === "accepted" ? acceptedDayNumber || null : null,
    ]
  );
  return mapHistoryRow(result.rows[0]);
};

export const listAssistantHistory = async ({ teacherUserId, batchId }) => {
  await assertTeacherOwnsBatch(batchId, teacherUserId);
  const result = await pool.query(
    "SELECT * FROM lesson_plan_assistant_history WHERE fk_teacher_id = $1 AND fk_batch_id = $2 ORDER BY created_at DESC",
    [teacherUserId, batchId]
  );
  return result.rows.map(mapHistoryRow);
};
