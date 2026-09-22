import { pool } from "../db/pool.js";
import { createStructuredCompletion } from "./openAiService.js";
import { getTeacherTestPaper } from "./teacherTestService.js";

const AI_GRADING_MODEL_ID = "deepseek-v4-flash";

const getExamOrThrow = async (examId, teacherUserId) => {
  const result = await pool.query("SELECT * FROM gradebook_exam WHERE id = $1 AND fk_teacher_id = $2", [
    examId,
    teacherUserId,
  ]);
  if (!result.rows[0]) {
    const error = new Error("Exam not found.");
    error.statusCode = 404;
    throw error;
  }
  return result.rows[0];
};

const seedGradebookMarks = async (client, examId) => {
  await client.query(
    `
      INSERT INTO gradebook_mark (fk_gradebook_exam_question_id, fk_user_id)
      SELECT geq.id, bs.fk_user_id
      FROM gradebook_exam_question geq
      JOIN gradebook_exam ge ON ge.id = geq.fk_gradebook_exam_id
      JOIN batch_student bs ON bs.fk_batch_id = ge.fk_batch_id AND bs.status = 'active'
      WHERE ge.id = $1
      ON CONFLICT (fk_gradebook_exam_question_id, fk_user_id) DO NOTHING
    `,
    [examId]
  );
};

export const createGradebookExam = async ({
  teacherUserId,
  batchId,
  title,
  examTypeId,
  examDate,
  sourceType,
  teacherTestPaperId,
  manualQuestions,
}) => {
  if (!batchId || !title || !examDate) {
    const error = new Error("batchId, title, and examDate are required.");
    error.statusCode = 400;
    throw error;
  }

  let questions = [];
  let totalMarks = 0;

  if (sourceType === "test_paper") {
    const paper = await getTeacherTestPaper(teacherTestPaperId, teacherUserId);
    questions = paper.items.map((item, index) => ({
      displayOrder: index + 1,
      questionLabel: `Q${index + 1}`,
      maxMarks: item.marks,
      snapshot: item,
    }));
    totalMarks = paper.totalMarks;
  } else {
    const provided = Array.isArray(manualQuestions) ? manualQuestions : [];
    if (!provided.length) {
      const error = new Error("Provide at least one question for a manual exam.");
      error.statusCode = 400;
      throw error;
    }
    questions = provided.map((q, index) => ({
      displayOrder: index + 1,
      questionLabel: q.questionLabel || `Q${index + 1}`,
      maxMarks: Number(q.maxMarks) || 1,
      snapshot: null,
    }));
    totalMarks = questions.reduce((sum, q) => sum + q.maxMarks, 0);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const examResult = await client.query(
      `
        INSERT INTO gradebook_exam (fk_batch_id, fk_teacher_id, title, fk_mst_exam_type_id, exam_date, total_marks, source_type, fk_teacher_test_paper_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [batchId, teacherUserId, title, examTypeId || null, examDate, totalMarks, sourceType, teacherTestPaperId || null]
    );
    const exam = examResult.rows[0];

    for (const question of questions) {
      await client.query(
        `
          INSERT INTO gradebook_exam_question (fk_gradebook_exam_id, display_order, question_label, max_marks, question_snapshot)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [exam.id, question.displayOrder, question.questionLabel, question.maxMarks, question.snapshot ? JSON.stringify(question.snapshot) : null]
      );
    }

    await seedGradebookMarks(client, exam.id);

    // Pre-fill from any completed digital attempts of the source paper --
    // objective items become final marks immediately (there's a definite
    // correct answer); free_text items only pre-fill the answer text + AI
    // suggestion, exactly what the AI-assist modal would otherwise ask the
    // teacher to type in by hand -- marks_awarded stays NULL until the
    // teacher clicks Accept there, same review discipline as manual entry.
    // display_order lines up 1:1 between the two tables because both are
    // built by iterating the paper's items in the same order.
    if (sourceType === "test_paper" && teacherTestPaperId) {
      await client.query(
        `
          UPDATE gradebook_mark gm
          SET marks_awarded = CASE WHEN tpai.question_snapshot->>'interactionType' != 'free_text' THEN tpai.marks_awarded ELSE gm.marks_awarded END,
              student_answer_text = CASE WHEN tpai.question_snapshot->>'interactionType' = 'free_text' THEN tpai.student_answer ELSE gm.student_answer_text END,
              ai_suggested_marks = CASE WHEN tpai.question_snapshot->>'interactionType' = 'free_text' THEN tpai.ai_suggested_marks ELSE gm.ai_suggested_marks END,
              ai_suggested_feedback = CASE WHEN tpai.question_snapshot->>'interactionType' = 'free_text' THEN tpai.ai_feedback ELSE gm.ai_suggested_feedback END,
              graded_at = CASE WHEN tpai.question_snapshot->>'interactionType' != 'free_text' THEN NOW() ELSE gm.graded_at END
          FROM teacher_test_paper_attempt tpa
          JOIN teacher_test_paper_attempt_item tpai ON tpai.fk_teacher_test_paper_attempt_id = tpa.id
          JOIN gradebook_exam_question geq ON geq.display_order = tpai.display_order AND geq.fk_gradebook_exam_id = $1
          WHERE tpa.fk_teacher_test_paper_id = $2
            AND tpa.status = 'completed'
            AND gm.fk_gradebook_exam_question_id = geq.id
            AND gm.fk_user_id = tpa.fk_user_id
        `,
        [exam.id, teacherTestPaperId]
      );
    }

    await client.query("COMMIT");
    return getGradebookExam(exam.id, teacherUserId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const countPendingGradingForTeacher = async (teacherUserId) => {
  const result = await pool.query(
    `
      SELECT COUNT(*) AS count
      FROM gradebook_mark gm
      JOIN gradebook_exam_question geq ON geq.id = gm.fk_gradebook_exam_question_id
      JOIN gradebook_exam ge ON ge.id = geq.fk_gradebook_exam_id
      WHERE ge.fk_teacher_id = $1 AND gm.marks_awarded IS NULL
    `,
    [teacherUserId]
  );
  return Number(result.rows[0]?.count || 0);
};

export const listGradebookExams = async ({ teacherUserId, batchId }) => {
  const values = [teacherUserId];
  let batchClause = "";
  if (batchId) {
    values.push(batchId);
    batchClause = "AND ge.fk_batch_id = $2";
  }

  const result = await pool.query(
    `
      SELECT
        ge.*,
        inst.name AS "institutionName", lvl.name AS "className", sec.name AS "sectionName", subj.name AS "subjectName",
        (SELECT COUNT(*) FROM batch_student bs WHERE bs.fk_batch_id = ge.fk_batch_id AND bs.status = 'active') AS student_count,
        (
          SELECT COUNT(DISTINCT gm.fk_user_id) FROM gradebook_mark gm
          JOIN gradebook_exam_question geq ON geq.id = gm.fk_gradebook_exam_question_id
          WHERE geq.fk_gradebook_exam_id = ge.id AND gm.marks_awarded IS NOT NULL
        ) AS graded_count
      FROM gradebook_exam ge
      JOIN batches b ON b.id = ge.fk_batch_id
      JOIN teacher_class_assignment ta ON ta.id = b.fk_teacher_class_assignment_id
      JOIN institution_teacher it ON it.id = ta.fk_institution_teacher_id
      JOIN institutions inst ON inst.id = it.fk_institution_id
      JOIN institution_section sec ON sec.id = ta.fk_institution_section_id
      JOIN institution_class ic ON ic.id = sec.fk_institution_class_id
      JOIN mst_level lvl ON lvl.id = ic.fk_mst_level_id
      JOIN mst_subject subj ON subj.id = ta.fk_mst_subject_id
      WHERE ge.fk_teacher_id = $1 ${batchClause}
      ORDER BY ge.exam_date DESC, ge.created_at DESC
    `,
    values
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    examDate: row.exam_date,
    totalMarks: Number(row.total_marks),
    sourceType: row.source_type,
    institutionName: row.institutionName,
    className: row.className,
    sectionName: row.sectionName,
    subjectName: row.subjectName,
    studentCount: Number(row.student_count),
    gradedCount: Number(row.graded_count),
  }));
};

export const getGradebookExam = async (examId, teacherUserId) => {
  const exam = await getExamOrThrow(examId, teacherUserId);

  const [questionsResult, marksResult] = await Promise.all([
    pool.query(
      "SELECT * FROM gradebook_exam_question WHERE fk_gradebook_exam_id = $1 ORDER BY display_order ASC",
      [examId]
    ),
    pool.query(
      `
        SELECT gm.*, u.name AS "studentName", u.email AS "studentEmail"
        FROM gradebook_mark gm
        JOIN gradebook_exam_question geq ON geq.id = gm.fk_gradebook_exam_question_id
        JOIN users u ON u.id = gm.fk_user_id
        WHERE geq.fk_gradebook_exam_id = $1
        ORDER BY u.name ASC
      `,
      [examId]
    ),
  ]);

  const studentsById = new Map();
  marksResult.rows.forEach((row) => {
    if (!studentsById.has(row.fk_user_id)) {
      studentsById.set(row.fk_user_id, { id: row.fk_user_id, name: row.studentName, email: row.studentEmail, marks: {} });
    }
    studentsById.get(row.fk_user_id).marks[row.fk_gradebook_exam_question_id] = {
      markId: row.id,
      marksAwarded: row.marks_awarded,
      studentAnswerText: row.student_answer_text,
      aiSuggestedMarks: row.ai_suggested_marks,
      aiSuggestedFeedback: row.ai_suggested_feedback,
    };
  });

  return {
    id: exam.id,
    title: exam.title,
    batchId: exam.fk_batch_id,
    examDate: exam.exam_date,
    totalMarks: Number(exam.total_marks),
    sourceType: exam.source_type,
    questions: questionsResult.rows.map((row) => ({
      id: row.id,
      displayOrder: row.display_order,
      questionLabel: row.question_label,
      maxMarks: Number(row.max_marks),
      questionSnapshot: row.question_snapshot,
    })),
    students: Array.from(studentsById.values()).sort((a, b) => a.name.localeCompare(b.name)),
  };
};

export const bulkSaveGradebookMarks = async (examId, teacherUserId, marks, graderUserId) => {
  await getExamOrThrow(examId, teacherUserId);
  const entries = Array.isArray(marks) ? marks : [];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const entry of entries) {
      const { gradebookExamQuestionId, userId, marksAwarded } = entry;
      await client.query(
        `
          UPDATE gradebook_mark
          SET marks_awarded = $3, graded_by = $4, graded_at = NOW()
          WHERE fk_gradebook_exam_question_id = $1 AND fk_user_id = $2
        `,
        [gradebookExamQuestionId, userId, marksAwarded === "" || marksAwarded == null ? null : Number(marksAwarded), graderUserId]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return getGradebookExam(examId, teacherUserId);
};

// Null-safe: returns null on any failure so the caller just falls back to
// manual grading -- same discipline as gradeFreeTextAnswerWithAi in
// studentPracticeService.js. Shared by the teacher-facing AI-assist button
// (suggestAiGrade, below) and digital test-taking's automatic per-answer
// grading (studentTestPaperService.js), so there's exactly one
// "partial credit out of N marks" implementation.
export const gradeFreeTextForMarks = async ({ question, maxMarks, correctAnswer, studentAnswerText }) => {
  try {
    const { parsed } = await createStructuredCompletion({
      systemPrompt:
        "You are a fair, encouraging school exam grader. Return only valid JSON that exactly matches the requested schema.",
      userPrompt: `Question: ${question || "(question text unavailable)"}
Maximum marks: ${maxMarks}
Expected/model answer: ${correctAnswer || "(not specified -- use your own subject judgement)"}
Student's written answer: ${studentAnswerText}

Grade the student's answer out of the maximum marks, giving partial credit where reasoning is partially correct.

Schema:
{
  "suggestedMarks": a number between 0 and ${maxMarks},
  "feedback": "1-2 sentences, addressed directly to the student, explaining the score"
}`,
      responseFormatName: "gradebook_ai_assist",
      modelId: AI_GRADING_MODEL_ID,
    });

    if (typeof parsed?.suggestedMarks !== "number") return null;
    return {
      suggestedMarks: Math.max(0, Math.min(maxMarks, parsed.suggestedMarks)),
      feedback: typeof parsed.feedback === "string" ? parsed.feedback.trim() : null,
    };
  } catch {
    return null;
  }
};

export const suggestAiGrade = async ({ examId, questionId, userId, teacherUserId, studentAnswerText }) => {
  await getExamOrThrow(examId, teacherUserId);
  const questionResult = await pool.query("SELECT * FROM gradebook_exam_question WHERE id = $1 AND fk_gradebook_exam_id = $2", [
    questionId,
    examId,
  ]);
  const question = questionResult.rows[0];
  if (!question) {
    const error = new Error("Question not found on this exam.");
    error.statusCode = 404;
    throw error;
  }

  const questionText = question.question_snapshot?.question || question.question_label;
  const correctAnswer = question.question_snapshot?.correctAnswer || null;

  const suggestion = await gradeFreeTextForMarks({
    question: questionText,
    maxMarks: question.max_marks,
    correctAnswer,
    studentAnswerText,
  });

  if (!suggestion) {
    const error = new Error("AI grading is unavailable right now -- enter the mark manually.");
    error.statusCode = 502;
    throw error;
  }

  await pool.query(
    `
      UPDATE gradebook_mark
      SET student_answer_text = $3, ai_suggested_marks = $4, ai_suggested_feedback = $5
      WHERE fk_gradebook_exam_question_id = $1 AND fk_user_id = $2
    `,
    [questionId, userId, studentAnswerText, suggestion.suggestedMarks, suggestion.feedback]
  );

  return suggestion;
};
