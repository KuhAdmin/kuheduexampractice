import { pool } from "../db/pool.js";

const mapLevel = (row) => ({
  id: row.id,
  nameCode: row.name_code,
  name: row.name,
  displayOrder: row.display_order,
});

export const listLevels = async () => {
  const result = await pool.query(
    "SELECT id, name_code, name, display_order FROM mst_level ORDER BY display_order ASC, name ASC"
  );
  return result.rows.map(mapLevel);
};

export const createLevel = async ({ nameCode, name, displayOrder }) => {
  try {
    const result = await pool.query(
      `
        INSERT INTO mst_level (name_code, name, display_order)
        VALUES ($1, $2, $3)
        RETURNING id, name_code, name, display_order
      `,
      [nameCode, name, displayOrder]
    );
    return mapLevel(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      const duplicateError = new Error(`A level with code "${nameCode}" already exists.`);
      duplicateError.statusCode = 409;
      throw duplicateError;
    }
    throw error;
  }
};

export const updateLevel = async (id, { nameCode, name, displayOrder }) => {
  try {
    const result = await pool.query(
      `
        UPDATE mst_level
        SET name_code = $2, name = $3, display_order = $4
        WHERE id = $1
        RETURNING id, name_code, name, display_order
      `,
      [id, nameCode, name, displayOrder]
    );
    return result.rows[0] ? mapLevel(result.rows[0]) : null;
  } catch (error) {
    if (error.code === "23505") {
      const duplicateError = new Error(`A level with code "${nameCode}" already exists.`);
      duplicateError.statusCode = 409;
      throw duplicateError;
    }
    throw error;
  }
};

export const deleteLevel = async (id) => {
  try {
    const result = await pool.query(
      "DELETE FROM mst_level WHERE id = $1 RETURNING id",
      [id]
    );
    return Boolean(result.rows[0]);
  } catch (error) {
    // mst_book.fk_mst_level_id (NOT NULL) and practice_set.fk_mst_level_id
    // both reference this table with no ON DELETE clause.
    if (error.code === "23503") {
      const referencedError = new Error(
        "This level is still referenced by one or more books or practice sets and can't be deleted."
      );
      referencedError.statusCode = 409;
      throw referencedError;
    }
    throw error;
  }
};
