import { pool } from "../db/pool.js";

const mapExamGoal = (row) => ({
  id: row.id,
  goalId: row.goal_id,
  name: row.name,
  examTypeId: row.fk_mst_exam_type_id,
  examTypeCode: row.exam_type_code,
  examTypeName: row.exam_type_name,
  stateId: row.fk_state_id,
  stateName: row.state_name,
  isActive: row.is_active,
});

export const listExamGoals = async () => {
  const result = await pool.query(`
    SELECT
      eg.id,
      eg.goal_id,
      eg.name,
      eg.fk_mst_exam_type_id,
      et.type_id AS exam_type_code,
      et.name AS exam_type_name,
      eg.fk_state_id,
      st.name AS state_name,
      eg.is_active
    FROM mst_exam_goal AS eg
    JOIN mst_exam_type AS et ON et.id = eg.fk_mst_exam_type_id
    JOIN mst_state AS st ON st.id = eg.fk_state_id
    ORDER BY eg.name ASC
  `);
  return result.rows.map(mapExamGoal);
};

// Lookup lists for the create/edit form's two FK dropdowns (exam type,
// state) -- kept here rather than reusing examTypeService.listExamTypes so
// this service doesn't take on a cross-service dependency for what's just
// a couple of small SELECTs.
export const listExamGoalFormOptions = async () => {
  const [examTypesResult, statesResult] = await Promise.all([
    pool.query("SELECT id, type_id, name FROM mst_exam_type ORDER BY name ASC"),
    pool.query("SELECT id, state_id, name FROM mst_state ORDER BY name ASC"),
  ]);

  return {
    examTypes: examTypesResult.rows.map((row) => ({ id: row.id, typeId: row.type_id, name: row.name })),
    states: statesResult.rows.map((row) => ({ id: row.id, stateId: row.state_id, name: row.name })),
  };
};

export const createExamGoal = async ({ goalId, name, examTypeId, stateId, isActive }) => {
  try {
    const result = await pool.query(
      `
        INSERT INTO mst_exam_goal (goal_id, name, fk_mst_exam_type_id, fk_state_id, is_active)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, goal_id, name, fk_mst_exam_type_id, fk_state_id, is_active
      `,
      [goalId, name, examTypeId, stateId, isActive]
    );
    return mapExamGoal(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      const duplicateError = new Error(`An exam goal with code "${goalId}" already exists.`);
      duplicateError.statusCode = 409;
      throw duplicateError;
    }
    if (error.code === "23503") {
      const fkError = new Error("Selected exam type or state no longer exists.");
      fkError.statusCode = 400;
      throw fkError;
    }
    throw error;
  }
};

export const updateExamGoal = async (id, { goalId, name, examTypeId, stateId, isActive }) => {
  try {
    const result = await pool.query(
      `
        UPDATE mst_exam_goal
        SET goal_id = $2, name = $3, fk_mst_exam_type_id = $4, fk_state_id = $5, is_active = $6
        WHERE id = $1
        RETURNING id, goal_id, name, fk_mst_exam_type_id, fk_state_id, is_active
      `,
      [id, goalId, name, examTypeId, stateId, isActive]
    );
    if (!result.rows[0]) {
      return null;
    }
    return mapExamGoal(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      const duplicateError = new Error(`An exam goal with code "${goalId}" already exists.`);
      duplicateError.statusCode = 409;
      throw duplicateError;
    }
    if (error.code === "23503") {
      const fkError = new Error("Selected exam type or state no longer exists.");
      fkError.statusCode = 400;
      throw fkError;
    }
    throw error;
  }
};

export const deleteExamGoal = async (id) => {
  try {
    const result = await pool.query(
      "DELETE FROM mst_exam_goal WHERE id = $1 RETURNING id",
      [id]
    );
    return Boolean(result.rows[0]);
  } catch (error) {
    // mst_book.fk_mst_exam_goal_id (NOT NULL) and practice_set.fk_mst_exam_goal_id
    // both reference this table with no ON DELETE clause -- surface the
    // constraint violation as a clear, actionable message.
    if (error.code === "23503") {
      const referencedError = new Error(
        "This exam goal is still referenced by one or more books or practice sets and can't be deleted."
      );
      referencedError.statusCode = 409;
      throw referencedError;
    }
    throw error;
  }
};
