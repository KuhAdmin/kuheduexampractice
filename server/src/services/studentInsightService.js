// Surfaces the mastery data this app already computes for a student's own
// dashboard (student_mastery, via studentPracticeService.js's mastery-level
// thresholds) to the teacher who owns that student's batch, instead of
// inventing a parallel analytics pipeline. Scoped by the batch's subject so
// a teacher only sees mastery for the subject they actually teach that
// batch.
import { pool } from "../db/pool.js";
import { assertTeacherOwnsBatch } from "./teacherContentContext.js";
import { getBatchRosterForTeacher } from "./batchService.js";

const toDisplayStatus = (masteryLevel) => {
  if (masteryLevel === "Mastered") return "Secure";
  if (masteryLevel === "Developing") return "Developing";
  return "Needs support";
};

const getBatchSubjectId = async (batchId) => {
  const result = await pool.query(
    `
      SELECT ta.fk_mst_subject_id AS id
      FROM batches b
      JOIN teacher_class_assignment ta ON ta.id = b.fk_teacher_class_assignment_id
      WHERE b.id = $1
    `,
    [batchId]
  );
  return result.rows[0]?.id || null;
};

const getMasteryRowsForUsers = async (userIds, subjectId) => {
  if (!userIds.length || !subjectId) return [];
  const result = await pool.query(
    `
      SELECT sm.user_id AS "userId", sm.mastery_level AS "masteryLevel", sm.mastery_probability AS "masteryProbability",
             au.primary_concept AS "primaryConcept"
      FROM student_mastery sm
      JOIN assessment_unit au ON au.assessment_unit_id = sm.assessment_unit_id
      JOIN mst_chapter mc ON mc.id = au.fk_mst_chapter_id
      JOIN mst_book mb ON mb.id = mc.fk_mst_book_id
      WHERE mb.fk_mst_subject_id = $1 AND sm.user_id = ANY($2::bigint[])
      ORDER BY sm.mastery_probability ASC
    `,
    [subjectId, userIds]
  );
  return result.rows;
};

export const getStudentInsight = async ({ batchId, studentUserId, teacherUserId }) => {
  await assertTeacherOwnsBatch(batchId, teacherUserId);

  const memberResult = await pool.query(
    `
      SELECT u.id, u.name, u.email
      FROM batch_student bs
      JOIN users u ON u.id = bs.fk_user_id
      WHERE bs.fk_batch_id = $1 AND bs.fk_user_id = $2 AND bs.status = 'active'
    `,
    [batchId, studentUserId]
  );
  const student = memberResult.rows[0];
  if (!student) {
    const error = new Error("Student not found in this batch.");
    error.statusCode = 404;
    throw error;
  }

  const subjectId = await getBatchSubjectId(batchId);
  const rows = await getMasteryRowsForUsers([studentUserId], subjectId);

  const conceptCount = rows.length;
  const avgMastery = conceptCount ? rows.reduce((sum, row) => sum + Number(row.masteryProbability), 0) / conceptCount : 0;
  // "Practice consistency" here means: of the concepts this student has
  // actually engaged with, what share are past the "Needs Practice" stage --
  // a real, derived signal, not a separately tracked metric (this app
  // doesn't track session frequency/streaks per concept).
  const notWeakCount = rows.filter((row) => row.masteryLevel !== "Needs Practice").length;
  const practiceConsistency = conceptCount ? Math.round((notWeakCount / conceptCount) * 100) : 0;

  return {
    student,
    conceptsTracked: conceptCount,
    overallProgress: Math.round(avgMastery * 100),
    conceptUnderstanding: Math.round(avgMastery * 100),
    practiceConsistency,
    learningGaps: rows.slice(0, 6).map((row) => ({
      concept: row.primaryConcept,
      status: toDisplayStatus(row.masteryLevel),
    })),
  };
};

// One-query summary (overall progress + students-needing-support) per batch,
// for a teacher's Home/My Classes cards -- avoids an N+1 of per-batch
// getBatchLearningInsights calls when rendering a list of many batches.
export const getBatchInsightSummariesForTeacher = async (teacherUserId) => {
  const result = await pool.query(
    `
      SELECT
        b.id AS "batchId", bs.fk_user_id AS "userId",
        sm.mastery_level AS "masteryLevel", sm.mastery_probability AS "masteryProbability"
      FROM batches b
      JOIN teacher_class_assignment ta ON ta.id = b.fk_teacher_class_assignment_id
      JOIN institution_teacher it ON it.id = ta.fk_institution_teacher_id
      JOIN batch_student bs ON bs.fk_batch_id = b.id AND bs.status = 'active'
      JOIN student_mastery sm ON sm.user_id = bs.fk_user_id
      JOIN assessment_unit au ON au.assessment_unit_id = sm.assessment_unit_id
      JOIN mst_chapter mc ON mc.id = au.fk_mst_chapter_id
      JOIN mst_book mb ON mb.id = mc.fk_mst_book_id AND mb.fk_mst_subject_id = ta.fk_mst_subject_id
      WHERE it.fk_user_id = $1 AND b.is_active = TRUE
    `,
    [teacherUserId]
  );

  const byBatch = new Map();
  result.rows.forEach((row) => {
    if (!byBatch.has(row.batchId)) byBatch.set(row.batchId, []);
    byBatch.get(row.batchId).push(row);
  });

  const summaries = {};
  byBatch.forEach((rows, batchId) => {
    const avgMastery = rows.reduce((sum, row) => sum + Number(row.masteryProbability), 0) / rows.length;
    const weakUserIds = new Set(rows.filter((row) => row.masteryLevel === "Needs Practice").map((row) => row.userId));
    summaries[batchId] = { overallProgress: Math.round(avgMastery * 100), studentsNeedingSupport: weakUserIds.size };
  });
  return summaries;
};

// A real, merged activity timeline for a batch -- batch joins, completed
// chapter/section practice sessions (student_attempt -> practice_set for a
// human topic name), and completed TestLab attempts. No invented event
// types (e.g. a tracked "time spent" session) are included since nothing in
// this app currently measures that.
export const getBatchActivityFeed = async ({ batchId, teacherUserId, limit = 20 }) => {
  await assertTeacherOwnsBatch(batchId, teacherUserId);

  const result = await pool.query(
    `
      SELECT * FROM (
        SELECT bs.fk_user_id AS "userId", u.name AS "studentName", 'joined' AS "eventType",
               bs.joined_at AS "eventTime", NULL::text AS topic, NULL::numeric AS score, NULL::numeric AS "maxScore"
        FROM batch_student bs
        JOIN users u ON u.id = bs.fk_user_id
        WHERE bs.fk_batch_id = $1 AND bs.status = 'active'

        UNION ALL

        SELECT sa.user_id, u.name, 'practice_completed',
               sa.submitted_at, ps.name, sa.score, NULL
        FROM student_attempt sa
        JOIN users u ON u.id = sa.user_id
        JOIN batch_student bs ON bs.fk_user_id = sa.user_id AND bs.fk_batch_id = $1 AND bs.status = 'active'
        JOIN practice_set ps ON ps.id = sa.practice_set_id
        WHERE sa.status = 'completed' AND sa.submitted_at IS NOT NULL

        UNION ALL

        SELECT tla.user_id, u.name, 'testlab_completed',
               tla.submitted_at, NULL,
               tla.correct_count, (COALESCE(tla.correct_count, 0) + COALESCE(tla.incorrect_count, 0) + COALESCE(tla.unattempted_count, 0))
        FROM test_lab_attempt tla
        JOIN users u ON u.id = tla.user_id
        JOIN batch_student bs ON bs.fk_user_id = tla.user_id AND bs.fk_batch_id = $1 AND bs.status = 'active'
        WHERE tla.status = 'completed' AND tla.submitted_at IS NOT NULL
      ) feed
      WHERE "eventTime" IS NOT NULL
      ORDER BY "eventTime" DESC
      LIMIT $2
    `,
    [batchId, limit]
  );

  return result.rows;
};

export const getBatchLearningInsights = async ({ batchId, teacherUserId }) => {
  await assertTeacherOwnsBatch(batchId, teacherUserId);
  const roster = await getBatchRosterForTeacher(batchId, teacherUserId);
  const subjectId = await getBatchSubjectId(batchId);
  const rows = await getMasteryRowsForUsers(roster.map((student) => student.id), subjectId);

  if (!rows.length) {
    return { overallProgress: 0, conceptMastery: 0, practiceConsistency: 0, studentsNeedingSupport: 0, needsAttention: [] };
  }

  const byStudent = new Map();
  rows.forEach((row) => {
    if (!byStudent.has(row.userId)) byStudent.set(row.userId, []);
    byStudent.get(row.userId).push(row);
  });

  const avgMastery = rows.reduce((sum, row) => sum + Number(row.masteryProbability), 0) / rows.length;
  const notWeakCount = rows.filter((row) => row.masteryLevel !== "Needs Practice").length;

  const needsAttention = [];
  roster.forEach((student) => {
    const studentRows = byStudent.get(student.id) || [];
    const weakRows = studentRows.filter((row) => row.masteryLevel === "Needs Practice");
    if (weakRows.length) {
      needsAttention.push({
        studentId: student.id,
        studentName: student.name,
        topic: weakRows[0].primaryConcept,
        weakConceptCount: weakRows.length,
      });
    }
  });

  return {
    overallProgress: Math.round(avgMastery * 100),
    conceptMastery: Math.round(avgMastery * 100),
    practiceConsistency: Math.round((notWeakCount / rows.length) * 100),
    studentsNeedingSupport: needsAttention.length,
    needsAttention: needsAttention.sort((a, b) => b.weakConceptCount - a.weakConceptCount).slice(0, 8),
  };
};
