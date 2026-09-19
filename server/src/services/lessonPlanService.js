import { pool } from "../db/pool.js";

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

export const createLessonPlan = async ({ teacherUserId, batchId, title, mstChapterId, startDate, endDate }) => {
  if (!batchId || !String(title || "").trim()) {
    const error = new Error("batchId and title are required.");
    error.statusCode = 400;
    throw error;
  }
  const result = await pool.query(
    `
      INSERT INTO lesson_plan (fk_teacher_id, fk_batch_id, title, fk_mst_chapter_id, start_date, end_date)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [teacherUserId, batchId, title.trim(), mstChapterId || null, startDate || null, endDate || null]
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
        (fk_lesson_plan_id, display_order, entry_date, topic, learning_objectives, activities, resources, homework, assessment_notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
    ]
  );
  return mapEntryRow(result.rows[0]);
};

export const updateLessonPlanEntry = async (planId, entryId, teacherUserId, entry) => {
  await getPlanOrThrow(planId, teacherUserId);
  const result = await pool.query(
    `
      UPDATE lesson_plan_entry
      SET entry_date = $3, topic = $4, learning_objectives = $5, activities = $6, resources = $7, homework = $8, assessment_notes = $9
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
