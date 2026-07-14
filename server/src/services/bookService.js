import { pool } from "../db/pool.js";

const mapBook = (row) => ({
  id: row.id,
  nameCode: row.name_code,
  name: row.name,
  subjectId: row.fk_mst_subject_id,
  subjectCode: row.subject_code,
  subjectName: row.subject_name,
  levelId: row.fk_mst_level_id,
  levelCode: row.level_code,
  levelName: row.level_name,
  examGoalId: row.fk_mst_exam_goal_id,
  examGoalCode: row.exam_goal_code,
  examGoalName: row.exam_goal_name,
  displayOrder: row.display_order,
  isActive: row.is_active,
});

export const listBooks = async () => {
  const result = await pool.query(`
    SELECT
      b.id,
      b.name_code,
      b.name,
      b.fk_mst_subject_id,
      s.name_code AS subject_code,
      s.name AS subject_name,
      b.fk_mst_level_id,
      l.name_code AS level_code,
      l.name AS level_name,
      b.fk_mst_exam_goal_id,
      eg.goal_id AS exam_goal_code,
      eg.name AS exam_goal_name,
      b.display_order,
      b.is_active
    FROM mst_book AS b
    JOIN mst_subject AS s ON s.id = b.fk_mst_subject_id
    JOIN mst_level AS l ON l.id = b.fk_mst_level_id
    JOIN mst_exam_goal AS eg ON eg.id = b.fk_mst_exam_goal_id
    ORDER BY b.display_order ASC, b.name ASC
  `);
  return result.rows.map(mapBook);
};

// Lookup lists for the create/edit form's three FK dropdowns (subject,
// level, exam goal) -- kept here rather than reusing the other services so
// this service doesn't take on cross-service dependencies for what's just a
// few small SELECTs.
export const listBookFormOptions = async () => {
  const [subjectsResult, levelsResult, examGoalsResult] = await Promise.all([
    pool.query("SELECT id, name_code, name FROM mst_subject ORDER BY display_order ASC, name ASC"),
    pool.query("SELECT id, name_code, name FROM mst_level ORDER BY display_order ASC, name ASC"),
    pool.query("SELECT id, goal_id, name FROM mst_exam_goal ORDER BY name ASC"),
  ]);

  return {
    subjects: subjectsResult.rows.map((row) => ({ id: row.id, nameCode: row.name_code, name: row.name })),
    levels: levelsResult.rows.map((row) => ({ id: row.id, nameCode: row.name_code, name: row.name })),
    examGoals: examGoalsResult.rows.map((row) => ({ id: row.id, goalId: row.goal_id, name: row.name })),
  };
};

// Columns the bulk-upload template exposes and the bulk-upload parser reads
// by exact header name -- keep in sync with AdminBooksPage.jsx's template
// download.
export const BOOK_BULK_UPLOAD_HEADERS = [
  "nameCode",
  "name",
  "subjectCode",
  "levelCode",
  "examGoalCode",
  "displayOrder",
  "isActive",
];

const parseBulkBoolean = (value) => {
  if (value === undefined || value === null || value === "") {
    return true;
  }
  const normalized = String(value).trim().toLowerCase();
  return !["false", "0", "no", "n", "inactive"].includes(normalized);
};

// Upserts a batch of books parsed from an uploaded spreadsheet, matched
// against existing rows by the same composite key the DB enforces
// (name_code, level, exam goal). Every row is processed independently so one
// bad row doesn't abort the rest of the batch -- the caller gets a per-row
// status/message list back to show the admin exactly what happened.
export const bulkUpsertBooks = async (rows) => {
  const [subjectsResult, levelsResult, examGoalsResult] = await Promise.all([
    pool.query("SELECT id, name_code FROM mst_subject"),
    pool.query("SELECT id, name_code FROM mst_level"),
    pool.query("SELECT id, goal_id FROM mst_exam_goal"),
  ]);
  const subjectByCode = new Map(subjectsResult.rows.map((row) => [row.name_code.toUpperCase(), row.id]));
  const levelByCode = new Map(levelsResult.rows.map((row) => [row.name_code.toUpperCase(), row.id]));
  const examGoalByCode = new Map(examGoalsResult.rows.map((row) => [row.goal_id.toUpperCase(), row.id]));

  const results = [];

  for (let index = 0; index < rows.length; index += 1) {
    const rowNumber = index + 2; // row 1 is the header
    const raw = rows[index];
    const nameCode = String(raw.nameCode || "").trim();
    const name = String(raw.name || "").trim();
    const subjectCode = String(raw.subjectCode || "").trim().toUpperCase();
    const levelCode = String(raw.levelCode || "").trim().toUpperCase();
    const examGoalCode = String(raw.examGoalCode || "").trim().toUpperCase();
    const displayOrder = raw.displayOrder !== "" && Number.isFinite(Number(raw.displayOrder))
      ? Number(raw.displayOrder)
      : 0;
    const isActive = parseBulkBoolean(raw.isActive);

    if (!nameCode || !name || !subjectCode || !levelCode || !examGoalCode) {
      results.push({
        row: rowNumber,
        nameCode: nameCode || null,
        status: "error",
        message: "nameCode, name, subjectCode, levelCode, and examGoalCode are all required.",
      });
      continue;
    }

    const subjectId = subjectByCode.get(subjectCode);
    const levelId = levelByCode.get(levelCode);
    const examGoalId = examGoalByCode.get(examGoalCode);

    if (!subjectId || !levelId || !examGoalId) {
      const unknown = [];
      if (!subjectId) unknown.push(`subject "${subjectCode}"`);
      if (!levelId) unknown.push(`level "${levelCode}"`);
      if (!examGoalId) unknown.push(`exam goal "${examGoalCode}"`);
      results.push({ row: rowNumber, nameCode, status: "error", message: `Unknown ${unknown.join(", ")}.` });
      continue;
    }

    try {
      const existing = await pool.query(
        "SELECT id FROM mst_book WHERE name_code = $1 AND fk_mst_level_id = $2 AND fk_mst_exam_goal_id = $3",
        [nameCode, levelId, examGoalId]
      );
      const payload = { nameCode, name, subjectId, levelId, examGoalId, displayOrder, isActive };
      if (existing.rows[0]) {
        await updateBook(existing.rows[0].id, payload);
        results.push({ row: rowNumber, nameCode, status: "updated" });
      } else {
        await createBook(payload);
        results.push({ row: rowNumber, nameCode, status: "created" });
      }
    } catch (error) {
      results.push({ row: rowNumber, nameCode, status: "error", message: error.message || "Failed to save row." });
    }
  }

  return results;
};

export const createBook = async ({ nameCode, name, subjectId, levelId, examGoalId, displayOrder, isActive }) => {
  try {
    const result = await pool.query(
      `
        INSERT INTO mst_book (name_code, name, fk_mst_subject_id, fk_mst_level_id, fk_mst_exam_goal_id, display_order, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, name_code, name, fk_mst_subject_id, fk_mst_level_id, fk_mst_exam_goal_id, display_order, is_active
      `,
      [nameCode, name, subjectId, levelId, examGoalId, displayOrder, isActive]
    );
    return await hydrateBook(result.rows[0].id);
  } catch (error) {
    if (error.code === "23505") {
      const duplicateError = new Error(
        `A book with code "${nameCode}" already exists for the selected level and exam goal.`
      );
      duplicateError.statusCode = 409;
      throw duplicateError;
    }
    if (error.code === "23503") {
      const fkError = new Error("Selected subject, level, or exam goal no longer exists.");
      fkError.statusCode = 400;
      throw fkError;
    }
    throw error;
  }
};

export const updateBook = async (id, { nameCode, name, subjectId, levelId, examGoalId, displayOrder, isActive }) => {
  try {
    const result = await pool.query(
      `
        UPDATE mst_book
        SET name_code = $2, name = $3, fk_mst_subject_id = $4, fk_mst_level_id = $5,
            fk_mst_exam_goal_id = $6, display_order = $7, is_active = $8
        WHERE id = $1
        RETURNING id
      `,
      [id, nameCode, name, subjectId, levelId, examGoalId, displayOrder, isActive]
    );
    if (!result.rows[0]) {
      return null;
    }
    return await hydrateBook(id);
  } catch (error) {
    if (error.code === "23505") {
      const duplicateError = new Error(
        `A book with code "${nameCode}" already exists for the selected level and exam goal.`
      );
      duplicateError.statusCode = 409;
      throw duplicateError;
    }
    if (error.code === "23503") {
      const fkError = new Error("Selected subject, level, or exam goal no longer exists.");
      fkError.statusCode = 400;
      throw fkError;
    }
    throw error;
  }
};

const hydrateBook = async (id) => {
  const result = await pool.query(
    `
      SELECT
        b.id,
        b.name_code,
        b.name,
        b.fk_mst_subject_id,
        s.name_code AS subject_code,
        s.name AS subject_name,
        b.fk_mst_level_id,
        l.name_code AS level_code,
        l.name AS level_name,
        b.fk_mst_exam_goal_id,
        eg.goal_id AS exam_goal_code,
        eg.name AS exam_goal_name,
        b.display_order,
        b.is_active
      FROM mst_book AS b
      JOIN mst_subject AS s ON s.id = b.fk_mst_subject_id
      JOIN mst_level AS l ON l.id = b.fk_mst_level_id
      JOIN mst_exam_goal AS eg ON eg.id = b.fk_mst_exam_goal_id
      WHERE b.id = $1
    `,
    [id]
  );
  return mapBook(result.rows[0]);
};

export const deleteBook = async (id) => {
  try {
    const result = await pool.query("DELETE FROM mst_book WHERE id = $1 RETURNING id", [id]);
    return Boolean(result.rows[0]);
  } catch (error) {
    // mst_chapter, chapter_exercise_upload, and chapter_exercise_question
    // all reference this table with a NOT NULL FK and no ON DELETE clause.
    if (error.code === "23503") {
      const referencedError = new Error(
        "This book is still referenced by one or more chapters or exercises and can't be deleted."
      );
      referencedError.statusCode = 409;
      throw referencedError;
    }
    throw error;
  }
};
