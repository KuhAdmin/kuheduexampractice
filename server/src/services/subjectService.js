import { pool } from "../db/pool.js";

const mapSubject = (row) => ({
  id: row.id,
  nameCode: row.name_code,
  name: row.name,
  displayOrder: row.display_order,
  isActive: row.is_active,
});

export const listSubjects = async () => {
  const result = await pool.query(
    "SELECT id, name_code, name, display_order, is_active FROM mst_subject ORDER BY display_order ASC, name ASC"
  );
  return result.rows.map(mapSubject);
};

export const createSubject = async ({ nameCode, name, displayOrder, isActive }) => {
  try {
    const result = await pool.query(
      `
        INSERT INTO mst_subject (name_code, name, display_order, is_active)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name_code, name, display_order, is_active
      `,
      [nameCode, name, displayOrder, isActive]
    );
    return mapSubject(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      const duplicateError = new Error(`A subject with code "${nameCode}" already exists.`);
      duplicateError.statusCode = 409;
      throw duplicateError;
    }
    throw error;
  }
};

export const updateSubject = async (id, { nameCode, name, displayOrder, isActive }) => {
  try {
    const result = await pool.query(
      `
        UPDATE mst_subject
        SET name_code = $2, name = $3, display_order = $4, is_active = $5
        WHERE id = $1
        RETURNING id, name_code, name, display_order, is_active
      `,
      [id, nameCode, name, displayOrder, isActive]
    );
    return result.rows[0] ? mapSubject(result.rows[0]) : null;
  } catch (error) {
    if (error.code === "23505") {
      const duplicateError = new Error(`A subject with code "${nameCode}" already exists.`);
      duplicateError.statusCode = 409;
      throw duplicateError;
    }
    throw error;
  }
};

export const deleteSubject = async (id) => {
  try {
    const result = await pool.query(
      "DELETE FROM mst_subject WHERE id = $1 RETURNING id",
      [id]
    );
    return Boolean(result.rows[0]);
  } catch (error) {
    // mst_book.fk_mst_subject_id (NOT NULL) and practice_set.fk_mst_subject_id
    // both reference this table with no ON DELETE clause.
    if (error.code === "23503") {
      const referencedError = new Error(
        "This subject is still referenced by one or more books or practice sets and can't be deleted."
      );
      referencedError.statusCode = 409;
      throw referencedError;
    }
    throw error;
  }
};
