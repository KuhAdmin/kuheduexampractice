// Digital test-taking for teacher-created Test Papers -- mirrors TestLab's
// attempt model (testLabService.js) almost 1:1, but scoped to one specific
// finalized paper instead of a free practice draw: one attempt per student
// per paper (a real exam sitting, not repeatable practice), and items keep
// the paper's own printed display_order rather than being shuffled.
import { pool } from "../db/pool.js";
import { isAnswerCorrect } from "./studentPracticeService.js";
import { gradeScoredItem } from "./studentPreWarmupService.js";
import { gradeFreeTextForMarks } from "./gradebookService.js";
import { buildStudentSafeTestPaperItem } from "./teacherTestService.js";

export const listAssignedTestPapers = async ({ userId }) => {
  const result = await pool.query(
    `
      SELECT
        p.id, p.title, p.due_at, p.opened_at,
        lvl.name AS "className", sec.name AS "sectionName", subj.name AS "subjectName",
        (SELECT COUNT(*) FROM teacher_test_paper_item i WHERE i.fk_teacher_test_paper_id = p.id) AS question_count,
        (SELECT COALESCE(SUM(i.marks), 0) FROM teacher_test_paper_item i WHERE i.fk_teacher_test_paper_id = p.id) AS total_marks,
        a.id AS attempt_id, a.status AS attempt_status, a.score AS attempt_score
      FROM teacher_test_paper p
      JOIN batches b ON b.id = p.fk_batch_id
      JOIN batch_student bs ON bs.fk_batch_id = b.id AND bs.fk_user_id = $1 AND bs.status = 'active'
      JOIN teacher_class_assignment ta ON ta.id = b.fk_teacher_class_assignment_id
      JOIN institution_section sec ON sec.id = ta.fk_institution_section_id
      JOIN institution_class ic ON ic.id = sec.fk_institution_class_id
      JOIN mst_level lvl ON lvl.id = ic.fk_mst_level_id
      JOIN mst_subject subj ON subj.id = ta.fk_mst_subject_id
      LEFT JOIN teacher_test_paper_attempt a ON a.fk_teacher_test_paper_id = p.id AND a.fk_user_id = $1
      WHERE p.status = 'finalized' AND p.is_open_for_students = TRUE
      ORDER BY p.due_at ASC NULLS LAST, p.opened_at DESC
    `,
    [userId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    className: row.className,
    sectionName: row.sectionName,
    subjectName: row.subjectName,
    questionCount: Number(row.question_count),
    totalMarks: Number(row.total_marks),
    dueAt: row.due_at,
    attemptId: row.attempt_id,
    attemptStatus: row.attempt_status || "not_started",
    score: row.attempt_score,
  }));
};

export const getTestPaperAttempt = async ({ attemptId, userId }) => {
  const attemptResult = await pool.query(
    "SELECT id, fk_teacher_test_paper_id, status, started_at, submitted_at, score FROM teacher_test_paper_attempt WHERE id = $1 AND fk_user_id = $2",
    [attemptId, userId]
  );
  const attempt = attemptResult.rows[0];
  if (!attempt) {
    const error = new Error("Attempt not found.");
    error.statusCode = 404;
    throw error;
  }

  const itemsResult = await pool.query(
    `
      SELECT display_order, question_snapshot, student_answer, is_correct
      FROM teacher_test_paper_attempt_item
      WHERE fk_teacher_test_paper_attempt_id = $1
      ORDER BY display_order ASC
    `,
    [attemptId]
  );

  return {
    attemptId: attempt.id,
    teacherTestPaperId: attempt.fk_teacher_test_paper_id,
    status: attempt.status,
    startedAt: attempt.started_at,
    submittedAt: attempt.submitted_at,
    score: attempt.score,
    totalCount: itemsResult.rows.length,
    items: itemsResult.rows.map(buildStudentSafeTestPaperItem),
  };
};

export const startOrResumeTestPaperAttempt = async ({ paperId, userId }) => {
  const paperResult = await pool.query(
    "SELECT id, fk_batch_id, due_at FROM teacher_test_paper WHERE id = $1 AND status = 'finalized' AND is_open_for_students = TRUE",
    [paperId]
  );
  const paper = paperResult.rows[0];
  if (!paper) {
    const error = new Error("This test is not available.");
    error.statusCode = 404;
    throw error;
  }
  if (paper.due_at && new Date(paper.due_at) < new Date()) {
    const error = new Error("This test's due date has passed.");
    error.statusCode = 403;
    throw error;
  }

  const membership = await pool.query(
    "SELECT 1 FROM batch_student WHERE fk_batch_id = $1 AND fk_user_id = $2 AND status = 'active'",
    [paper.fk_batch_id, userId]
  );
  if (!membership.rows[0]) {
    const error = new Error("This test is not assigned to you.");
    error.statusCode = 403;
    throw error;
  }

  const existing = await pool.query(
    "SELECT id FROM teacher_test_paper_attempt WHERE fk_teacher_test_paper_id = $1 AND fk_user_id = $2",
    [paperId, userId]
  );
  if (existing.rows[0]) {
    return getTestPaperAttempt({ attemptId: existing.rows[0].id, userId });
  }

  const itemsResult = await pool.query(
    "SELECT display_order, question_snapshot FROM teacher_test_paper_item WHERE fk_teacher_test_paper_id = $1 ORDER BY display_order ASC",
    [paperId]
  );
  if (!itemsResult.rows.length) {
    const error = new Error("This test has no questions.");
    error.statusCode = 400;
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const attemptInsert = await client.query(
      "INSERT INTO teacher_test_paper_attempt (fk_teacher_test_paper_id, fk_user_id) VALUES ($1, $2) RETURNING id",
      [paperId, userId]
    );
    const attemptId = attemptInsert.rows[0].id;

    for (const row of itemsResult.rows) {
      await client.query(
        `
          INSERT INTO teacher_test_paper_attempt_item (fk_teacher_test_paper_attempt_id, display_order, question_snapshot)
          VALUES ($1, $2, $3)
        `,
        [attemptId, row.display_order, JSON.stringify(row.question_snapshot)]
      );
    }

    await client.query("COMMIT");
    return getTestPaperAttempt({ attemptId, userId });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// Objective items have a definite correct answer, so they're graded fully
// and finally here. free_text items get an AI-suggested partial-credit score
// (gradeFreeTextForMarks, shared with the Gradebook's manual AI-assist) but
// marks_awarded stays null -- a teacher must accept it, same review
// discipline as hand-typed grading.
const gradeTestPaperItem = async ({ sourceType, question, correctAnswer, interactionType, interactionData, acceptableAnswers, format, marks }, studentAnswer) => {
  if (sourceType === "hots") {
    const graded = await gradeScoredItem({ format, correctAnswer, content: { question } }, studentAnswer);
    return { isCorrect: graded.isCorrect, marksAwarded: graded.isCorrect ? Number(marks || 0) : 0, aiSuggestedMarks: null, aiFeedback: graded.aiFeedback || null };
  }

  if (interactionType === "free_text") {
    const suggestion = await gradeFreeTextForMarks({
      question,
      maxMarks: Number(marks || 0),
      correctAnswer,
      studentAnswerText: studentAnswer,
    });
    return { isCorrect: null, marksAwarded: null, aiSuggestedMarks: suggestion?.suggestedMarks ?? null, aiFeedback: suggestion?.feedback ?? null };
  }

  const isCorrect = isAnswerCorrect({
    interactionType,
    correctAnswer,
    interactionData: interactionData || {},
    acceptableAnswers: acceptableAnswers || [],
    studentAnswer,
  });
  return { isCorrect, marksAwarded: isCorrect ? Number(marks || 0) : 0, aiSuggestedMarks: null, aiFeedback: null };
};

// Deliberately does NOT reveal isCorrect/correctAnswer back to the student --
// unlike TestLab's per-answer reveal (fine for solo low-stakes practice),
// this is a real graded exam shared across a whole class with one attempt
// each, so leaking correctness mid-exam would let a fast finisher tip off
// classmates still taking it. Results only surface via finishTestPaperAttempt
// (a score) and, for free-text, via the teacher's Gradebook review.
export const submitTestPaperAnswer = async ({ attemptId, displayOrder, studentAnswer, userId }) => {
  const attemptResult = await pool.query(
    "SELECT id, fk_user_id, status FROM teacher_test_paper_attempt WHERE id = $1",
    [attemptId]
  );
  const attempt = attemptResult.rows[0];
  if (!attempt || String(attempt.fk_user_id) !== String(userId)) {
    const error = new Error("Attempt not found.");
    error.statusCode = 404;
    throw error;
  }
  if (attempt.status !== "in_progress") {
    const error = new Error("This test has already been submitted.");
    error.statusCode = 409;
    throw error;
  }

  const itemResult = await pool.query(
    "SELECT id, question_snapshot FROM teacher_test_paper_attempt_item WHERE fk_teacher_test_paper_attempt_id = $1 AND display_order = $2",
    [attemptId, displayOrder]
  );
  const item = itemResult.rows[0];
  if (!item) {
    const error = new Error("Question not found in this attempt.");
    error.statusCode = 404;
    throw error;
  }

  const snapshot = item.question_snapshot;
  const graded = await gradeTestPaperItem(snapshot, studentAnswer);

  await pool.query(
    `
      UPDATE teacher_test_paper_attempt_item
      SET student_answer = $1, is_correct = $2, marks_awarded = $3, ai_suggested_marks = $4, ai_feedback = $5
      WHERE id = $6
    `,
    [studentAnswer, graded.isCorrect, graded.marksAwarded, graded.aiSuggestedMarks, graded.aiFeedback, item.id]
  );

  return { saved: true };
};

export const finishTestPaperAttempt = async ({ attemptId, userId }) => {
  const attemptResult = await pool.query(
    "SELECT id, fk_user_id, status, score FROM teacher_test_paper_attempt WHERE id = $1",
    [attemptId]
  );
  const attempt = attemptResult.rows[0];
  if (!attempt || String(attempt.fk_user_id) !== String(userId)) {
    const error = new Error("Attempt not found.");
    error.statusCode = 404;
    throw error;
  }
  if (attempt.status === "completed") {
    return { attemptId: attempt.id, status: "completed", score: attempt.score };
  }

  const itemsResult = await pool.query(
    "SELECT question_snapshot, marks_awarded FROM teacher_test_paper_attempt_item WHERE fk_teacher_test_paper_attempt_id = $1",
    [attemptId]
  );
  const items = itemsResult.rows;
  const totalMarks = items.reduce((sum, row) => sum + Number(row.question_snapshot?.marks || 0), 0);
  const earnedMarks = items.reduce((sum, row) => sum + Number(row.marks_awarded || 0), 0);
  const score = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 100) : 0;
  const isProvisional = items.some((row) => row.question_snapshot?.interactionType === "free_text");

  await pool.query(
    "UPDATE teacher_test_paper_attempt SET status = 'completed', submitted_at = NOW(), score = $1 WHERE id = $2",
    [score, attemptId]
  );

  return { attemptId, status: "completed", score, isProvisional };
};
