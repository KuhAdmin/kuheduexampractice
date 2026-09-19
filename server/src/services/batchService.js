import crypto from "node:crypto";
import { pool } from "../db/pool.js";

// Excludes visually ambiguous characters (0/O, 1/I) since a join code is
// read off a teacher's screen and typed in by a student.
const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const generateJoinCodeSuffix = (length = 6) => {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += JOIN_CODE_ALPHABET[crypto.randomInt(JOIN_CODE_ALPHABET.length)];
  }
  return code;
};

// Accepts either the pool or a transaction client (see saveTeacherAssignments
// in institutionService.js, which generates a batch's join code inside the
// same transaction that upserts its teacher_class_assignment row).
export const generateJoinCode = async (institutionCode, runner = pool) => {
  const prefix = String(institutionCode || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "BATCH";

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `${prefix}-${generateJoinCodeSuffix()}`;
    const existing = await runner.query("SELECT id FROM batches WHERE join_code = $1", [candidate]);
    if (!existing.rows[0]) {
      return candidate;
    }
  }

  throw new Error("Failed to generate a unique join code. Please try again.");
};

const mapBatch = (row) => ({
  id: row.id,
  teacherClassAssignmentId: row.fk_teacher_class_assignment_id,
  joinCode: row.join_code,
  isActive: row.is_active,
  createdAt: row.created_at,
});

// Called the moment admin checks a cell in the teacher assignment grid --
// there is no separate "create batch" admin action (Decision #2).
export const ensureBatchForAssignment = async ({ teacherClassAssignmentId, institutionCode }, runner = pool) => {
  const existing = await runner.query("SELECT * FROM batches WHERE fk_teacher_class_assignment_id = $1", [
    teacherClassAssignmentId,
  ]);

  if (existing.rows[0]) {
    if (!existing.rows[0].is_active) {
      const reactivated = await runner.query("UPDATE batches SET is_active = TRUE WHERE id = $1 RETURNING *", [
        existing.rows[0].id,
      ]);
      return mapBatch(reactivated.rows[0]);
    }
    return mapBatch(existing.rows[0]);
  }

  const joinCode = await generateJoinCode(institutionCode, runner);
  const created = await runner.query(
    "INSERT INTO batches (fk_teacher_class_assignment_id, join_code) VALUES ($1, $2) RETURNING *",
    [teacherClassAssignmentId, joinCode]
  );
  return mapBatch(created.rows[0]);
};

export const deactivateBatchForAssignment = async (teacherClassAssignmentId, runner = pool) => {
  await runner.query("UPDATE batches SET is_active = FALSE WHERE fk_teacher_class_assignment_id = $1", [
    teacherClassAssignmentId,
  ]);
};

// Verifies the batch belongs to this teacher before any roster/ownership
// action -- every teacher-facing batch endpoint runs this first.
const getOwnedBatchOrThrow = async (batchId, teacherUserId) => {
  const result = await pool.query(
    `
      SELECT b.*, it.fk_user_id AS teacher_user_id
      FROM batches b
      JOIN teacher_class_assignment ta ON ta.id = b.fk_teacher_class_assignment_id
      JOIN institution_teacher it ON it.id = ta.fk_institution_teacher_id
      WHERE b.id = $1
    `,
    [batchId]
  );

  const batch = result.rows[0];
  if (!batch || batch.teacher_user_id !== teacherUserId) {
    const error = new Error("Batch not found.");
    error.statusCode = 404;
    throw error;
  }
  return batch;
};

export const listBatchesForTeacher = async (teacherUserId) => {
  const result = await pool.query(
    `
      SELECT
        b.id,
        b.join_code AS "joinCode",
        b.is_active AS "isActive",
        inst.id AS "institutionId",
        inst.name AS "institutionName",
        sec.id AS "institutionSectionId",
        sec.name AS "sectionName",
        lvl.name AS "className",
        subj.id AS "subjectId",
        subj.name AS "subjectName",
        (
          SELECT COUNT(*) FROM batch_student bs
          WHERE bs.fk_batch_id = b.id AND bs.status = 'active'
        ) AS "studentCount"
      FROM batches b
      JOIN teacher_class_assignment ta ON ta.id = b.fk_teacher_class_assignment_id
      JOIN institution_teacher it ON it.id = ta.fk_institution_teacher_id
      JOIN institutions inst ON inst.id = it.fk_institution_id
      JOIN institution_section sec ON sec.id = ta.fk_institution_section_id
      JOIN institution_class ic ON ic.id = sec.fk_institution_class_id
      JOIN mst_level lvl ON lvl.id = ic.fk_mst_level_id
      JOIN mst_subject subj ON subj.id = ta.fk_mst_subject_id
      WHERE it.fk_user_id = $1 AND b.is_active = TRUE
      ORDER BY inst.name ASC, lvl.display_order ASC, sec.display_order ASC, subj.name ASC
    `,
    [teacherUserId]
  );

  return result.rows.map((row) => ({ ...row, studentCount: Number(row.studentCount) }));
};

export const getTeacherHomeSummary = async (teacherUserId) => {
  const batches = await listBatchesForTeacher(teacherUserId);
  const institutionCount = new Set(batches.map((batch) => batch.institutionId)).size;
  const studentCount = batches.reduce((sum, batch) => sum + batch.studentCount, 0);

  return {
    institutionCount,
    batchCount: batches.length,
    studentCount,
    batches,
  };
};

export const getBatchRosterForTeacher = async (batchId, teacherUserId) => {
  await getOwnedBatchOrThrow(batchId, teacherUserId);

  const result = await pool.query(
    `
      SELECT u.id, u.name, u.email, bs.joined_at AS "joinedAt"
      FROM batch_student bs
      JOIN users u ON u.id = bs.fk_user_id
      WHERE bs.fk_batch_id = $1 AND bs.status = 'active'
      ORDER BY u.name ASC
    `,
    [batchId]
  );

  return result.rows;
};

export const removeStudentFromBatchForTeacher = async (batchId, studentUserId, teacherUserId) => {
  await getOwnedBatchOrThrow(batchId, teacherUserId);

  await pool.query(
    `
      UPDATE batch_student
      SET status = 'removed', removed_at = NOW()
      WHERE fk_batch_id = $1 AND fk_user_id = $2 AND status = 'active'
    `,
    [batchId, studentUserId]
  );
};

export const regenerateJoinCodeForTeacher = async (batchId, teacherUserId) => {
  const batch = await getOwnedBatchOrThrow(batchId, teacherUserId);

  const institutionResult = await pool.query(
    `
      SELECT inst.code
      FROM institution_teacher it
      JOIN institutions inst ON inst.id = it.fk_institution_id
      JOIN teacher_class_assignment ta ON ta.fk_institution_teacher_id = it.id
      WHERE ta.id = $1
    `,
    [batch.fk_teacher_class_assignment_id]
  );

  const joinCode = await generateJoinCode(institutionResult.rows[0]?.code);
  const updated = await pool.query("UPDATE batches SET join_code = $2 WHERE id = $1 RETURNING *", [
    batchId,
    joinCode,
  ]);

  return mapBatch(updated.rows[0]);
};

const isLicenseCurrentlyValid = (institution) => {
  if (institution.license_status !== "licensed") {
    return false;
  }
  if (institution.license_valid_until && new Date(institution.license_valid_until) < new Date()) {
    return false;
  }
  return true;
};

const countActiveInstitutionSeats = async (institutionId) => {
  const result = await pool.query(
    `
      SELECT COUNT(DISTINCT bs.fk_user_id) AS count
      FROM batch_student bs
      JOIN batches b ON b.id = bs.fk_batch_id
      JOIN teacher_class_assignment ta ON ta.id = b.fk_teacher_class_assignment_id
      JOIN institution_teacher it ON it.id = ta.fk_institution_teacher_id
      WHERE it.fk_institution_id = $1 AND bs.status = 'active'
    `,
    [institutionId]
  );
  return Number(result.rows[0]?.count || 0);
};

// Runs right after a student joins a batch (Decision #6/#7). Never touches a
// premium row that wasn't itself institution-granted, so a separately
// purchased plan is never clobbered by a seat-cap miss or an unlicensed
// institution.
const applyInstitutionPremiumGrant = async (userId, institutionId) => {
  const institutionResult = await pool.query("SELECT * FROM institutions WHERE id = $1", [institutionId]);
  const institution = institutionResult.rows[0];
  if (!institution || !isLicenseCurrentlyValid(institution)) {
    return;
  }

  if (institution.license_seat_cap != null) {
    const seatsUsed = await countActiveInstitutionSeats(institutionId);
    if (seatsUsed > institution.license_seat_cap) {
      return;
    }
  }

  const userResult = await pool.query("SELECT is_premium, premium_source FROM users WHERE id = $1", [userId]);
  const user = userResult.rows[0];
  if (user?.is_premium && user.premium_source !== "institution") {
    return;
  }

  await pool.query(
    `
      UPDATE users
      SET is_premium = TRUE,
          premium_expires_at = $2,
          premium_source = 'institution',
          updated_at = NOW()
      WHERE id = $1
    `,
    [userId, institution.license_valid_until]
  );
};

// Read by userService.js's expirePremiumIfLapsed on every request from a
// student whose premium_source = 'institution'. Only re-checks licence
// status/validity, not seat cap -- seat cap is enforced at join time only,
// so an institution going over cap later doesn't need to pick which
// already-enrolled student loses access.
export const isInstitutionGrantStillValid = async (userId) => {
  const result = await pool.query(
    `
      SELECT inst.license_status, inst.license_valid_until
      FROM batch_student bs
      JOIN batches b ON b.id = bs.fk_batch_id AND b.is_active = TRUE
      JOIN teacher_class_assignment ta ON ta.id = b.fk_teacher_class_assignment_id AND ta.is_active = TRUE
      JOIN institution_teacher it ON it.id = ta.fk_institution_teacher_id AND it.is_active = TRUE
      JOIN institutions inst ON inst.id = it.fk_institution_id
      WHERE bs.fk_user_id = $1 AND bs.status = 'active'
    `,
    [userId]
  );

  return result.rows.some(
    (row) =>
      row.license_status === "licensed" &&
      (!row.license_valid_until || new Date(row.license_valid_until) >= new Date())
  );
};

export const joinBatchByCode = async ({ userId, joinCode }) => {
  const trimmedCode = String(joinCode || "").trim().toUpperCase();
  if (!trimmedCode) {
    const error = new Error("Enter a batch code.");
    error.statusCode = 400;
    throw error;
  }

  const batchResult = await pool.query(
    `
      SELECT
        b.id,
        it.fk_institution_id AS "institutionId",
        inst.name AS "institutionName",
        lvl.name AS "className",
        sec.name AS "sectionName",
        subj.name AS "subjectName"
      FROM batches b
      JOIN teacher_class_assignment ta ON ta.id = b.fk_teacher_class_assignment_id AND ta.is_active = TRUE
      JOIN institution_teacher it ON it.id = ta.fk_institution_teacher_id AND it.is_active = TRUE
      JOIN institutions inst ON inst.id = it.fk_institution_id
      JOIN institution_section sec ON sec.id = ta.fk_institution_section_id
      JOIN institution_class ic ON ic.id = sec.fk_institution_class_id
      JOIN mst_level lvl ON lvl.id = ic.fk_mst_level_id
      JOIN mst_subject subj ON subj.id = ta.fk_mst_subject_id
      WHERE b.join_code = $1 AND b.is_active = TRUE
    `,
    [trimmedCode]
  );

  const batch = batchResult.rows[0];
  if (!batch) {
    const error = new Error("That batch code isn't valid. Check it with your teacher and try again.");
    error.statusCode = 404;
    throw error;
  }

  try {
    await pool.query("INSERT INTO batch_student (fk_batch_id, fk_user_id) VALUES ($1, $2)", [batch.id, userId]);
  } catch (error) {
    if (error.code === "23505") {
      const duplicateError = new Error("You've already joined this batch.");
      duplicateError.statusCode = 409;
      throw duplicateError;
    }
    throw error;
  }

  await applyInstitutionPremiumGrant(userId, batch.institutionId);

  return {
    batch: {
      institutionName: batch.institutionName,
      className: batch.className,
      sectionName: batch.sectionName,
      subjectName: batch.subjectName,
    },
  };
};

export const listBatchesForStudent = async (userId) => {
  const result = await pool.query(
    `
      SELECT
        b.id,
        inst.name AS "institutionName",
        lvl.name AS "className",
        sec.name AS "sectionName",
        subj.name AS "subjectName",
        bs.joined_at AS "joinedAt"
      FROM batch_student bs
      JOIN batches b ON b.id = bs.fk_batch_id
      JOIN teacher_class_assignment ta ON ta.id = b.fk_teacher_class_assignment_id
      JOIN institution_teacher it ON it.id = ta.fk_institution_teacher_id
      JOIN institutions inst ON inst.id = it.fk_institution_id
      JOIN institution_section sec ON sec.id = ta.fk_institution_section_id
      JOIN institution_class ic ON ic.id = sec.fk_institution_class_id
      JOIN mst_level lvl ON lvl.id = ic.fk_mst_level_id
      JOIN mst_subject subj ON subj.id = ta.fk_mst_subject_id
      WHERE bs.fk_user_id = $1 AND bs.status = 'active'
      ORDER BY bs.joined_at DESC
    `,
    [userId]
  );

  return result.rows;
};

export const leaveBatch = async ({ userId, batchId }) => {
  const result = await pool.query(
    `
      UPDATE batch_student
      SET status = 'removed', removed_at = NOW()
      WHERE fk_batch_id = $1 AND fk_user_id = $2 AND status = 'active'
      RETURNING id
    `,
    [batchId, userId]
  );

  if (!result.rows[0]) {
    const error = new Error("You're not enrolled in that batch.");
    error.statusCode = 404;
    throw error;
  }
};
