import { pool } from "../db/pool.js";

const mapExamType = (row) => ({
  id: row.id,
  typeId: row.type_id,
  name: row.name,
});

export const listExamTypes = async () => {
  const result = await pool.query(
    "SELECT id, type_id, name FROM mst_exam_type ORDER BY name ASC"
  );
  return result.rows.map(mapExamType);
};

export const createExamType = async ({ typeId, name }) => {
  try {
    const result = await pool.query(
      `
        INSERT INTO mst_exam_type (type_id, name)
        VALUES ($1, $2)
        RETURNING id, type_id, name
      `,
      [typeId, name]
    );
    return mapExamType(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      const duplicateError = new Error(`An exam type with code "${typeId}" already exists.`);
      duplicateError.statusCode = 409;
      throw duplicateError;
    }
    throw error;
  }
};

export const updateExamType = async (id, { typeId, name }) => {
  try {
    const result = await pool.query(
      `
        UPDATE mst_exam_type
        SET type_id = $2, name = $3
        WHERE id = $1
        RETURNING id, type_id, name
      `,
      [id, typeId, name]
    );
    return result.rows[0] ? mapExamType(result.rows[0]) : null;
  } catch (error) {
    if (error.code === "23505") {
      const duplicateError = new Error(`An exam type with code "${typeId}" already exists.`);
      duplicateError.statusCode = 409;
      throw duplicateError;
    }
    throw error;
  }
};

export const deleteExamType = async (id) => {
  try {
    const result = await pool.query(
      "DELETE FROM mst_exam_type WHERE id = $1 RETURNING id",
      [id]
    );
    return Boolean(result.rows[0]);
  } catch (error) {
    // mst_exam_goal.fk_mst_exam_type_id has no ON DELETE clause, so Postgres
    // rejects deleting a row still referenced by an exam goal -- surface
    // that as a clear, actionable message instead of a raw DB error.
    if (error.code === "23503") {
      const referencedError = new Error(
        "This exam type is still assigned to one or more exam goals and can't be deleted."
      );
      referencedError.statusCode = 409;
      throw referencedError;
    }
    throw error;
  }
};
