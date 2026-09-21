import { pool } from "../db/pool.js";
import { getMasterLessonPlanByChapter } from "./masterLessonPlanService.js";

const getPlanOrThrow = async (planId, teacherUserId) => {
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

const mapPlanRow = (row) => ({
  id: row.id,
  title: row.title,
  batchId: row.fk_batch_id,
  mstChapterId: row.fk_mst_chapter_id,
  startDate: row.start_date,
  endDate: row.end_date,
  status: row.status,
  aiGenerated: row.ai_generated,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const listLessonPlans = async ({ teacherUserId, batchId }) => {
  const values = [teacherUserId];
  let batchClause = "";
  if (batchId) {
    values.push(batchId);
    batchClause = "AND lp.fk_batch_id = $2";
  }

  const result = await pool.query(
    `
      SELECT
        lp.*,
        inst.name AS "institutionName", lvl.name AS "className", sec.name AS "sectionName", subj.name AS "subjectName",
        (SELECT COUNT(*) FROM lesson_plan_entry e WHERE e.fk_lesson_plan_id = lp.id) AS entry_count
      FROM lesson_plan lp
      JOIN batches b ON b.id = lp.fk_batch_id
      JOIN teacher_class_assignment ta ON ta.id = b.fk_teacher_class_assignment_id
      JOIN institution_teacher it ON it.id = ta.fk_institution_teacher_id
      JOIN institutions inst ON inst.id = it.fk_institution_id
      JOIN institution_section sec ON sec.id = ta.fk_institution_section_id
      JOIN institution_class ic ON ic.id = sec.fk_institution_class_id
      JOIN mst_level lvl ON lvl.id = ic.fk_mst_level_id
      JOIN mst_subject subj ON subj.id = ta.fk_mst_subject_id
      WHERE lp.fk_teacher_id = $1 ${batchClause}
      ORDER BY lp.created_at DESC
    `,
    values
  );

  return result.rows.map((row) => ({
    ...mapPlanRow(row),
    institutionName: row.institutionName,
    className: row.className,
    sectionName: row.sectionName,
    subjectName: row.subjectName,
    entryCount: Number(row.entry_count),
  }));
};

export const createLessonPlan = async ({ teacherUserId, batchId, title, mstChapterId, startDate, endDate, aiGenerated }) => {
  if (!batchId || !String(title || "").trim()) {
    const error = new Error("batchId and title are required.");
    error.statusCode = 400;
    throw error;
  }
  // A Daily Lesson Plan is meant to flow from its chapter's Master Lesson
  // Plan (see lessonPlanAiService.js's use of the master plan's Assessment/
  // Extra Questions) -- so it can't be created for a chapter that doesn't
  // have one yet. Skipped only if no chapter was resolved at all (nothing
  // to check against), which the create UI never actually allows.
  if (mstChapterId) {
    const masterPlan = await getMasterLessonPlanByChapter({ teacherUserId, batchId, mstChapterId });
    if (!masterPlan) {
      const error = new Error("Create a Master Lesson Plan for this chapter first.");
      error.statusCode = 400;
      throw error;
    }
  }
  const result = await pool.query(
    `
      INSERT INTO lesson_plan (fk_teacher_id, fk_batch_id, title, fk_mst_chapter_id, start_date, end_date, ai_generated)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [teacherUserId, batchId, title.trim(), mstChapterId || null, startDate || null, endDate || null, Boolean(aiGenerated)]
  );
  return mapPlanRow(result.rows[0]);
};

export const updateLessonPlan = async (planId, teacherUserId, { title, startDate, endDate, status }) => {
  await getPlanOrThrow(planId, teacherUserId);
  const result = await pool.query(
    `
      UPDATE lesson_plan
      SET title = COALESCE($3, title), start_date = $4, end_date = $5, status = COALESCE($6, status), updated_at = NOW()
      WHERE id = $1 AND fk_teacher_id = $2
      RETURNING *
    `,
    [planId, teacherUserId, title?.trim() || null, startDate || null, endDate || null, status || null]
  );
  return mapPlanRow(result.rows[0]);
};

export const deleteLessonPlan = async (planId, teacherUserId) => {
  const result = await pool.query("DELETE FROM lesson_plan WHERE id = $1 AND fk_teacher_id = $2 RETURNING id", [
    planId,
    teacherUserId,
  ]);
  return Boolean(result.rows[0]);
};

export const publishLessonPlan = async (planId, teacherUserId) => {
  await getPlanOrThrow(planId, teacherUserId);
  const result = await pool.query(
    "UPDATE lesson_plan SET status = 'published', updated_at = NOW() WHERE id = $1 AND fk_teacher_id = $2 RETURNING *",
    [planId, teacherUserId]
  );
  return mapPlanRow(result.rows[0]);
};

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

export const getLessonPlanDetail = async (planId, teacherUserId) => {
  const plan = await getPlanOrThrow(planId, teacherUserId);
  const entriesResult = await pool.query(
    "SELECT * FROM lesson_plan_entry WHERE fk_lesson_plan_id = $1 ORDER BY display_order ASC",
    [planId]
  );
  return { ...mapPlanRow(plan), entries: entriesResult.rows.map(mapEntryRow) };
};

export const addLessonPlanEntry = async (planId, teacherUserId, entry) => {
  await getPlanOrThrow(planId, teacherUserId);
  if (!String(entry?.topic || "").trim()) {
    const error = new Error("topic is required.");
    error.statusCode = 400;
    throw error;
  }

  const orderResult = await pool.query(
    "SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order FROM lesson_plan_entry WHERE fk_lesson_plan_id = $1",
    [planId]
  );
  const nextOrder = orderResult.rows[0].next_order;

  const result = await pool.query(
    `
      INSERT INTO lesson_plan_entry
        (fk_lesson_plan_id, display_order, entry_date, topic, learning_objectives, activities, resources, homework, assessment_notes,
         chapter_label, pre_concept, subtopic, teaching_approach, teaching_method, learning_aid, learning_outcome)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `,
    [
      planId,
      nextOrder,
      entry.entryDate || null,
      entry.topic.trim(),
      entry.learningObjectives || null,
      entry.activities || null,
      entry.resources || null,
      entry.homework || null,
      entry.assessmentNotes || null,
      entry.chapterLabel || null,
      entry.preConcept || null,
      entry.subtopic || null,
      entry.teachingApproach || null,
      entry.teachingMethod ? JSON.stringify(entry.teachingMethod) : null,
      entry.learningAid || null,
      entry.learningOutcome || null,
    ]
  );
  return mapEntryRow(result.rows[0]);
};

export const updateLessonPlanEntry = async (planId, entryId, teacherUserId, entry) => {
  await getPlanOrThrow(planId, teacherUserId);
  const result = await pool.query(
    `
      UPDATE lesson_plan_entry
      SET entry_date = $3, topic = $4, learning_objectives = $5, activities = $6, resources = $7, homework = $8, assessment_notes = $9,
          chapter_label = $10, pre_concept = $11, subtopic = $12, teaching_approach = $13, teaching_method = $14, learning_aid = $15, learning_outcome = $16
      WHERE id = $1 AND fk_lesson_plan_id = $2
      RETURNING *
    `,
    [
      entryId,
      planId,
      entry.entryDate || null,
      entry.topic?.trim() || "",
      entry.learningObjectives || null,
      entry.activities || null,
      entry.resources || null,
      entry.homework || null,
      entry.assessmentNotes || null,
      entry.chapterLabel || null,
      entry.preConcept || null,
      entry.subtopic || null,
      entry.teachingApproach || null,
      entry.teachingMethod ? JSON.stringify(entry.teachingMethod) : null,
      entry.learningAid || null,
      entry.learningOutcome || null,
    ]
  );
  if (!result.rows[0]) {
    const error = new Error("Lesson plan entry not found.");
    error.statusCode = 404;
    throw error;
  }
  return mapEntryRow(result.rows[0]);
};

export const deleteLessonPlanEntry = async (planId, entryId, teacherUserId) => {
  await getPlanOrThrow(planId, teacherUserId);
  const result = await pool.query(
    "DELETE FROM lesson_plan_entry WHERE id = $1 AND fk_lesson_plan_id = $2 RETURNING id",
    [entryId, planId]
  );
  return Boolean(result.rows[0]);
};

// Re-numbers every entry's display_order to match orderedEntryIds (1-based,
// matching how "Day N" is already just index+1 on read). Two passes -- first
// to distinct negative placeholders, then to the final positions -- so
// reassigning positions that overlap with each other never collides with
// the (fk_lesson_plan_id, display_order) unique constraint mid-transaction.
export const reorderLessonPlanEntries = async (planId, teacherUserId, orderedEntryIds) => {
  await getPlanOrThrow(planId, teacherUserId);
  if (!Array.isArray(orderedEntryIds) || orderedEntryIds.length === 0) {
    const error = new Error("orderedEntryIds must be a non-empty array.");
    error.statusCode = 400;
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < orderedEntryIds.length; i += 1) {
      await client.query("UPDATE lesson_plan_entry SET display_order = $1 WHERE id = $2 AND fk_lesson_plan_id = $3", [
        -(i + 1),
        orderedEntryIds[i],
        planId,
      ]);
    }
    for (let i = 0; i < orderedEntryIds.length; i += 1) {
      await client.query("UPDATE lesson_plan_entry SET display_order = $1 WHERE id = $2 AND fk_lesson_plan_id = $3", [
        i + 1,
        orderedEntryIds[i],
        planId,
      ]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const entriesResult = await pool.query(
    "SELECT * FROM lesson_plan_entry WHERE fk_lesson_plan_id = $1 ORDER BY display_order ASC",
    [planId]
  );
  return entriesResult.rows.map(mapEntryRow);
};

export const duplicateLessonPlanEntry = async (planId, entryId, teacherUserId) => {
  await getPlanOrThrow(planId, teacherUserId);
  const sourceResult = await pool.query(
    "SELECT * FROM lesson_plan_entry WHERE id = $1 AND fk_lesson_plan_id = $2",
    [entryId, planId]
  );
  const source = sourceResult.rows[0];
  if (!source) {
    const error = new Error("Lesson plan entry not found.");
    error.statusCode = 404;
    throw error;
  }

  const orderResult = await pool.query(
    "SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order FROM lesson_plan_entry WHERE fk_lesson_plan_id = $1",
    [planId]
  );
  const nextOrder = orderResult.rows[0].next_order;

  const result = await pool.query(
    `
      INSERT INTO lesson_plan_entry
        (fk_lesson_plan_id, display_order, entry_date, topic, learning_objectives, activities, resources, homework, assessment_notes,
         chapter_label, pre_concept, subtopic, teaching_approach, teaching_method, learning_aid, learning_outcome)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `,
    [
      planId,
      nextOrder,
      source.entry_date,
      `${source.topic} (Copy)`,
      source.learning_objectives,
      source.activities,
      source.resources,
      source.homework,
      source.assessment_notes,
      source.chapter_label,
      source.pre_concept,
      source.subtopic,
      source.teaching_approach,
      source.teaching_method ? JSON.stringify(source.teaching_method) : null,
      source.learning_aid,
      source.learning_outcome,
    ]
  );
  return mapEntryRow(result.rows[0]);
};

export const addLessonPlanEntriesBulk = async (planId, teacherUserId, entries) => {
  await getPlanOrThrow(planId, teacherUserId);
  if (!Array.isArray(entries) || entries.length === 0) {
    const error = new Error("entries must be a non-empty array.");
    error.statusCode = 400;
    throw error;
  }

  const orderResult = await pool.query(
    "SELECT COALESCE(MAX(display_order), 0) AS max_order FROM lesson_plan_entry WHERE fk_lesson_plan_id = $1",
    [planId]
  );
  let nextOrder = Number(orderResult.rows[0].max_order) + 1;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = [];
    for (const entry of entries) {
      if (!String(entry?.topic || "").trim()) continue;
      const result = await client.query(
        `
          INSERT INTO lesson_plan_entry
            (fk_lesson_plan_id, display_order, entry_date, topic, learning_objectives, activities, resources, homework, assessment_notes,
             chapter_label, pre_concept, subtopic, teaching_approach, teaching_method, learning_aid, learning_outcome)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          RETURNING *
        `,
        [
          planId,
          nextOrder,
          entry.entryDate || null,
          entry.topic.trim(),
          entry.learningObjectives || null,
          entry.activities || null,
          entry.resources || null,
          entry.homework || null,
          entry.assessmentNotes || null,
          entry.chapterLabel || null,
          entry.preConcept || null,
          entry.subtopic || null,
          entry.teachingApproach || null,
          entry.teachingMethod ? JSON.stringify(entry.teachingMethod) : null,
          entry.learningAid || null,
          entry.learningOutcome || null,
        ]
      );
      inserted.push(mapEntryRow(result.rows[0]));
      nextOrder += 1;
    }
    await client.query("COMMIT");
    return inserted;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
