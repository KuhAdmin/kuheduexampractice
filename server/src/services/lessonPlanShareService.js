// Real teacher-to-teacher lesson plan sharing. teacher_class_assignment's
// 1:1 constraint means two teachers never co-own a batch, so "colleagues at
// the same institution(s)" is the only share-target scope this schema
// supports -- there is no narrower "other teachers of my class" concept to
// draw on (see institution_teacher, the institution-membership table this
// reuses).
import { pool } from "../db/pool.js";

const mapEntryRow = (row) => ({
  id: row.id,
  displayOrder: row.display_order,
  entryDate: row.entry_date,
  topic: row.topic,
  learningObjectives: row.learning_objectives,
  activities: row.activities,
  resources: row.resources,
  homework: row.homework,
  assessmentNotes: row.assessment_notes,
  chapterLabel: row.chapter_label,
  preConcept: row.pre_concept,
  subtopic: row.subtopic,
  teachingApproach: row.teaching_approach,
  teachingMethod: row.teaching_method,
  learningAid: row.learning_aid,
  learningOutcome: row.learning_outcome,
});

export const listMyInstitutionColleagues = async (teacherUserId) => {
  const result = await pool.query(
    `
      SELECT DISTINCT u.id AS "userId", u.name, u.email, inst.name AS "institutionName"
      FROM institution_teacher me
      JOIN institution_teacher colleague ON colleague.fk_institution_id = me.fk_institution_id
      JOIN institutions inst ON inst.id = me.fk_institution_id
      JOIN users u ON u.id = colleague.fk_user_id
      WHERE me.fk_user_id = $1 AND me.is_active = TRUE
        AND colleague.is_active = TRUE AND colleague.fk_user_id != $1
      ORDER BY u.name ASC
    `,
    [teacherUserId]
  );
  return result.rows;
};

const getOwnedPlanOrThrow = async (planId, teacherUserId) => {
  const result = await pool.query("SELECT * FROM lesson_plan WHERE id = $1 AND fk_teacher_id = $2", [
    planId,
    teacherUserId,
  ]);
  if (!result.rows[0]) {
    const error = new Error("Lesson plan not found.");
    error.statusCode = 404;
    throw error;
  }
  return result.rows[0];
};

export const shareLessonPlan = async ({ planId, teacherUserId, shareWithUserIds }) => {
  await getOwnedPlanOrThrow(planId, teacherUserId);
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
        INSERT INTO lesson_plan_share (fk_lesson_plan_id, shared_by_teacher_id, shared_with_teacher_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (fk_lesson_plan_id, shared_with_teacher_id) DO NOTHING
      `,
      [planId, teacherUserId, targetId]
    );
  }

  return { sharedWith: validTargetIds };
};

export const listSharedWithMe = async (teacherUserId) => {
  const result = await pool.query(
    `
      SELECT
        s.id AS "shareId", s.created_at AS "sharedAt",
        lp.id AS "planId", lp.title, lp.status,
        sharer.name AS "sharedByName",
        (SELECT COUNT(*) FROM lesson_plan_entry e WHERE e.fk_lesson_plan_id = lp.id) AS entry_count
      FROM lesson_plan_share s
      JOIN lesson_plan lp ON lp.id = s.fk_lesson_plan_id
      JOIN users sharer ON sharer.id = s.shared_by_teacher_id
      WHERE s.shared_with_teacher_id = $1
      ORDER BY s.created_at DESC
    `,
    [teacherUserId]
  );
  return result.rows.map((row) => ({ ...row, entryCount: Number(row.entry_count) }));
};

const getShareOrThrow = async (shareId, teacherUserId) => {
  const result = await pool.query(
    "SELECT * FROM lesson_plan_share WHERE id = $1 AND shared_with_teacher_id = $2",
    [shareId, teacherUserId]
  );
  if (!result.rows[0]) {
    const error = new Error("Shared lesson plan not found.");
    error.statusCode = 404;
    throw error;
  }
  return result.rows[0];
};

export const getSharedLessonPlanDetail = async ({ shareId, teacherUserId }) => {
  const share = await getShareOrThrow(shareId, teacherUserId);
  const planResult = await pool.query("SELECT * FROM lesson_plan WHERE id = $1", [share.fk_lesson_plan_id]);
  const plan = planResult.rows[0];
  if (!plan) {
    const error = new Error("Shared lesson plan not found.");
    error.statusCode = 404;
    throw error;
  }
  const sharerResult = await pool.query("SELECT name FROM users WHERE id = $1", [share.shared_by_teacher_id]);
  const entriesResult = await pool.query(
    "SELECT * FROM lesson_plan_entry WHERE fk_lesson_plan_id = $1 ORDER BY display_order ASC",
    [plan.id]
  );

  return {
    shareId: share.id,
    planId: plan.id,
    title: plan.title,
    status: plan.status,
    sharedByName: sharerResult.rows[0]?.name || null,
    rating: share.rating,
    entries: entriesResult.rows.map(mapEntryRow),
  };
};

export const rateSharedLessonPlan = async ({ shareId, teacherUserId, rating }) => {
  await getShareOrThrow(shareId, teacherUserId);
  const numericRating = Number(rating);
  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    const error = new Error("rating must be an integer between 1 and 5.");
    error.statusCode = 400;
    throw error;
  }
  const result = await pool.query(
    "UPDATE lesson_plan_share SET rating = $1 WHERE id = $2 AND shared_with_teacher_id = $3 RETURNING rating",
    [numericRating, shareId, teacherUserId]
  );
  return { rating: result.rows[0].rating };
};

export const cloneSharedLessonPlan = async ({ shareId, teacherUserId, targetBatchId, title }) => {
  const share = await getShareOrThrow(shareId, teacherUserId);
  if (!targetBatchId) {
    const error = new Error("targetBatchId is required.");
    error.statusCode = 400;
    throw error;
  }

  const sourcePlanResult = await pool.query("SELECT * FROM lesson_plan WHERE id = $1", [share.fk_lesson_plan_id]);
  const sourcePlan = sourcePlanResult.rows[0];
  if (!sourcePlan) {
    const error = new Error("Shared lesson plan not found.");
    error.statusCode = 404;
    throw error;
  }
  const sourceEntriesResult = await pool.query(
    "SELECT * FROM lesson_plan_entry WHERE fk_lesson_plan_id = $1 ORDER BY display_order ASC",
    [sourcePlan.id]
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const newPlanResult = await client.query(
      `
        INSERT INTO lesson_plan (fk_teacher_id, fk_batch_id, title, fk_mst_chapter_id, start_date, end_date)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        teacherUserId,
        targetBatchId,
        (title || sourcePlan.title).trim(),
        sourcePlan.fk_mst_chapter_id,
        sourcePlan.start_date,
        sourcePlan.end_date,
      ]
    );
    const newPlan = newPlanResult.rows[0];

    for (const entry of sourceEntriesResult.rows) {
      await client.query(
        `
          INSERT INTO lesson_plan_entry
            (fk_lesson_plan_id, display_order, entry_date, topic, learning_objectives, activities, resources, homework, assessment_notes,
             chapter_label, pre_concept, subtopic, teaching_approach, teaching_method, learning_aid, learning_outcome)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `,
        [
          newPlan.id,
          entry.display_order,
          entry.entry_date,
          entry.topic,
          entry.learning_objectives,
          entry.activities,
          entry.resources,
          entry.homework,
          entry.assessment_notes,
          entry.chapter_label,
          entry.pre_concept,
          entry.subtopic,
          entry.teaching_approach,
          entry.teaching_method ? JSON.stringify(entry.teaching_method) : null,
          entry.learning_aid,
          entry.learning_outcome,
        ]
      );
    }

    await client.query("COMMIT");
    return newPlan.id;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
