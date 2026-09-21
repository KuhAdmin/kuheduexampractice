import { pool } from "../db/pool.js";
import { ensureBatchForAssignment, deactivateBatchForAssignment } from "./batchService.js";

const mapInstitution = (row) => ({
  id: row.id,
  name: row.name,
  code: row.code,
  address: row.address,
  contactName: row.contact_name,
  contactEmail: row.contact_email,
  contactPhone: row.contact_phone,
  isActive: row.is_active,
  mstExamGoalId: row.fk_mst_exam_goal_id,
  licenseStatus: row.license_status,
  licenseSeatCap: row.license_seat_cap,
  licenseValidFrom: row.license_valid_from,
  licenseValidUntil: row.license_valid_until,
  licensedAt: row.licensed_at,
  seatsUsed: row.seats_used != null ? Number(row.seats_used) : undefined,
  createdAt: row.created_at,
});

export const listInstitutions = async () => {
  const result = await pool.query(
    `
      SELECT
        inst.*,
        (
          SELECT COUNT(DISTINCT bs.fk_user_id)
          FROM batch_student bs
          JOIN batches b ON b.id = bs.fk_batch_id
          JOIN teacher_class_assignment ta ON ta.id = b.fk_teacher_class_assignment_id
          JOIN institution_teacher it ON it.id = ta.fk_institution_teacher_id
          WHERE it.fk_institution_id = inst.id AND bs.status = 'active'
        ) AS seats_used
      FROM institutions inst
      ORDER BY inst.name ASC
    `
  );
  return result.rows.map(mapInstitution);
};

export const getInstitution = async (id) => {
  const result = await pool.query("SELECT * FROM institutions WHERE id = $1", [id]);
  return result.rows[0] ? mapInstitution(result.rows[0]) : null;
};

const parseInstitutionBody = (body) => {
  const name = String(body?.name || "").trim();
  const code = String(body?.code || "").trim().toUpperCase();
  if (!name || !code) {
    return null;
  }
  return {
    name,
    code,
    address: body?.address?.trim() || null,
    contactName: body?.contactName?.trim() || null,
    contactEmail: body?.contactEmail?.trim() || null,
    contactPhone: body?.contactPhone?.trim() || null,
    mstExamGoalId: body?.mstExamGoalId || null,
  };
};

export const createInstitution = async (body) => {
  const payload = parseInstitutionBody(body);
  if (!payload) {
    const error = new Error("name and code are required.");
    error.statusCode = 400;
    throw error;
  }

  try {
    const result = await pool.query(
      `
        INSERT INTO institutions (name, code, address, contact_name, contact_email, contact_phone, fk_mst_exam_goal_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [
        payload.name,
        payload.code,
        payload.address,
        payload.contactName,
        payload.contactEmail,
        payload.contactPhone,
        payload.mstExamGoalId,
      ]
    );
    return mapInstitution(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      const duplicateError = new Error(`An institution with code "${payload.code}" already exists.`);
      duplicateError.statusCode = 409;
      throw duplicateError;
    }
    throw error;
  }
};

export const updateInstitution = async (id, body) => {
  const payload = parseInstitutionBody(body);
  if (!payload) {
    const error = new Error("name and code are required.");
    error.statusCode = 400;
    throw error;
  }
  const isActive = body?.isActive !== false;

  try {
    const result = await pool.query(
      `
        UPDATE institutions
        SET name = $2, code = $3, address = $4, contact_name = $5, contact_email = $6,
            contact_phone = $7, is_active = $8, fk_mst_exam_goal_id = $9, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        payload.name,
        payload.code,
        payload.address,
        payload.contactName,
        payload.contactEmail,
        payload.contactPhone,
        isActive,
        payload.mstExamGoalId,
      ]
    );
    return result.rows[0] ? mapInstitution(result.rows[0]) : null;
  } catch (error) {
    if (error.code === "23505") {
      const duplicateError = new Error(`An institution with code "${payload.code}" already exists.`);
      duplicateError.statusCode = 409;
      throw duplicateError;
    }
    throw error;
  }
};

const LICENSE_STATUSES = ["unlicensed", "licensed", "suspended"];

export const updateInstitutionLicense = async (
  id,
  { licenseStatus, licenseSeatCap, licenseValidFrom, licenseValidUntil, updatedByUserId }
) => {
  if (!LICENSE_STATUSES.includes(licenseStatus)) {
    const error = new Error(`licenseStatus must be one of: ${LICENSE_STATUSES.join(", ")}.`);
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
      UPDATE institutions
      SET license_status = $2,
          license_seat_cap = $3,
          license_valid_from = $4,
          license_valid_until = $5,
          licensed_by = $6,
          licensed_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      licenseStatus,
      licenseSeatCap === "" || licenseSeatCap == null ? null : Number(licenseSeatCap),
      licenseValidFrom || null,
      licenseValidUntil || null,
      updatedByUserId,
    ]
  );

  return result.rows[0] ? mapInstitution(result.rows[0]) : null;
};

// ---- Classes (which mst_level rows this institution runs) ----

export const listInstitutionClasses = async (institutionId) => {
  const result = await pool.query(
    `
      SELECT ic.id, ic.fk_mst_level_id AS "mstLevelId", ic.is_active AS "isActive",
             lvl.name AS "levelName", lvl.display_order AS "displayOrder"
      FROM institution_class ic
      JOIN mst_level lvl ON lvl.id = ic.fk_mst_level_id
      WHERE ic.fk_institution_id = $1
      ORDER BY lvl.display_order ASC, lvl.name ASC
    `,
    [institutionId]
  );
  return result.rows;
};

export const addInstitutionClass = async (institutionId, mstLevelId) => {
  const result = await pool.query(
    `
      INSERT INTO institution_class (fk_institution_id, fk_mst_level_id, is_active)
      VALUES ($1, $2, TRUE)
      ON CONFLICT (fk_institution_id, fk_mst_level_id)
      DO UPDATE SET is_active = TRUE
      RETURNING id
    `,
    [institutionId, mstLevelId]
  );
  return result.rows[0];
};

export const removeInstitutionClass = async (institutionClassId) => {
  // Soft-deactivate, never hard-delete -- a hard delete would cascade through
  // institution_section -> teacher_class_assignment -> batches -> batch_student
  // and destroy enrolment/grading history.
  const result = await pool.query(
    "UPDATE institution_class SET is_active = FALSE WHERE id = $1 RETURNING id",
    [institutionClassId]
  );
  return Boolean(result.rows[0]);
};

// ---- Sections (per-institution cohort, e.g. "8-A") ----

export const listInstitutionSections = async (institutionClassId) => {
  const result = await pool.query(
    `
      SELECT id, name, display_order AS "displayOrder", is_active AS "isActive"
      FROM institution_section
      WHERE fk_institution_class_id = $1
      ORDER BY display_order ASC, name ASC
    `,
    [institutionClassId]
  );
  return result.rows;
};

export const addInstitutionSection = async (institutionClassId, { name, displayOrder }) => {
  const trimmedName = String(name || "").trim();
  if (!trimmedName) {
    const error = new Error("name is required.");
    error.statusCode = 400;
    throw error;
  }

  try {
    const result = await pool.query(
      `
        INSERT INTO institution_section (fk_institution_class_id, name, display_order)
        VALUES ($1, $2, $3)
        RETURNING id, name, display_order AS "displayOrder", is_active AS "isActive"
      `,
      [institutionClassId, trimmedName, Number(displayOrder) || 0]
    );
    return result.rows[0];
  } catch (error) {
    if (error.code === "23505") {
      const duplicateError = new Error(`A section named "${trimmedName}" already exists for this class.`);
      duplicateError.statusCode = 409;
      throw duplicateError;
    }
    throw error;
  }
};

export const updateInstitutionSection = async (id, { name, displayOrder, isActive }) => {
  const trimmedName = String(name || "").trim();
  if (!trimmedName) {
    const error = new Error("name is required.");
    error.statusCode = 400;
    throw error;
  }

  try {
    const result = await pool.query(
      `
        UPDATE institution_section
        SET name = $2, display_order = $3, is_active = $4
        WHERE id = $1
        RETURNING id, name, display_order AS "displayOrder", is_active AS "isActive"
      `,
      [id, trimmedName, Number(displayOrder) || 0, isActive !== false]
    );
    return result.rows[0] || null;
  } catch (error) {
    if (error.code === "23505") {
      const duplicateError = new Error(`A section named "${trimmedName}" already exists for this class.`);
      duplicateError.statusCode = 409;
      throw duplicateError;
    }
    throw error;
  }
};

export const removeInstitutionSection = async (id) => {
  // Soft-deactivate -- see removeInstitutionClass's comment; the same
  // cascade-destruction risk applies one level down.
  const result = await pool.query(
    "UPDATE institution_section SET is_active = FALSE WHERE id = $1 RETURNING id",
    [id]
  );
  return Boolean(result.rows[0]);
};

// ---- Teachers linked to an institution ----

export const listInstitutionTeachers = async (institutionId) => {
  const result = await pool.query(
    `
      SELECT it.id, it.is_active AS "isActive", it.added_at AS "addedAt",
             u.id AS "userId", u.name, u.email,
             (
               SELECT COUNT(*) FROM teacher_class_assignment ta
               WHERE ta.fk_institution_teacher_id = it.id AND ta.is_active = TRUE
             ) AS "assignmentCount"
      FROM institution_teacher it
      JOIN users u ON u.id = it.fk_user_id
      WHERE it.fk_institution_id = $1
      ORDER BY u.name ASC
    `,
    [institutionId]
  );
  return result.rows.map((row) => ({ ...row, assignmentCount: Number(row.assignmentCount) }));
};

export const linkTeacherToInstitution = async (institutionId, userId, addedByUserId) => {
  const userResult = await pool.query("SELECT id, role FROM users WHERE id = $1", [userId]);
  const user = userResult.rows[0];
  if (!user) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }
  if (user.role !== "teacher") {
    const error = new Error("Only accounts with the teacher role can be linked to an institution.");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
      INSERT INTO institution_teacher (fk_institution_id, fk_user_id, is_active, added_by)
      VALUES ($1, $2, TRUE, $3)
      ON CONFLICT (fk_institution_id, fk_user_id)
      DO UPDATE SET is_active = TRUE
      RETURNING id
    `,
    [institutionId, userId, addedByUserId]
  );
  return result.rows[0];
};

// Unlinking a teacher must also close out the classroom setup they had --
// otherwise re-linking the same account (or the admin re-checking cells in
// the assignment grid) silently inherits stale section/subject assignments
// and their still-open batches from before the unlink, making the unlink
// look like it had no effect. Mirrors saveTeacherAssignments' own
// assignment-off branch: deactivate each batch, then its assignment.
export const unlinkTeacherFromInstitution = async (institutionTeacherId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const assignmentsResult = await client.query(
      "SELECT id FROM teacher_class_assignment WHERE fk_institution_teacher_id = $1 AND is_active = TRUE",
      [institutionTeacherId]
    );
    for (const assignment of assignmentsResult.rows) {
      await deactivateBatchForAssignment(assignment.id, client);
    }
    await client.query(
      "UPDATE teacher_class_assignment SET is_active = FALSE WHERE fk_institution_teacher_id = $1 AND is_active = TRUE",
      [institutionTeacherId]
    );

    const result = await client.query(
      "UPDATE institution_teacher SET is_active = FALSE WHERE id = $1 RETURNING id",
      [institutionTeacherId]
    );

    await client.query("COMMIT");
    return Boolean(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// ---- Assignment grid (section x subject checkboxes for one teacher) ----

export const getAssignmentGrid = async (institutionTeacherId) => {
  const teacherResult = await pool.query(
    `
      SELECT it.id, it.fk_institution_id AS "institutionId"
      FROM institution_teacher it
      WHERE it.id = $1
    `,
    [institutionTeacherId]
  );
  const institutionTeacher = teacherResult.rows[0];
  if (!institutionTeacher) {
    const error = new Error("Teacher link not found.");
    error.statusCode = 404;
    throw error;
  }

  const [sectionsResult, subjectsResult, assignmentsResult, takenByOthersResult] = await Promise.all([
    pool.query(
      `
        SELECT sec.id, sec.name, lvl.name AS "className", ic.id AS "institutionClassId"
        FROM institution_section sec
        JOIN institution_class ic ON ic.id = sec.fk_institution_class_id
        JOIN mst_level lvl ON lvl.id = ic.fk_mst_level_id
        WHERE ic.fk_institution_id = $1 AND sec.is_active = TRUE AND ic.is_active = TRUE
        ORDER BY lvl.display_order ASC, sec.display_order ASC
      `,
      [institutionTeacher.institutionId]
    ),
    pool.query("SELECT id, name FROM mst_subject WHERE is_active = TRUE ORDER BY display_order ASC, name ASC"),
    pool.query(
      `
        SELECT ta.id AS "teacherClassAssignmentId", ta.fk_institution_section_id AS "institutionSectionId",
               ta.fk_mst_subject_id AS "mstSubjectId", ta.is_active AS "isActive",
               b.join_code AS "joinCode"
        FROM teacher_class_assignment ta
        LEFT JOIN batches b ON b.fk_teacher_class_assignment_id = ta.id
        WHERE ta.fk_institution_teacher_id = $1
      `,
      [institutionTeacherId]
    ),
    // Every (section, subject) cell already claimed by a DIFFERENT active
    // teacher at this institution -- the client greys these out so a class
    // can never be double-booked to two teachers, like an already-taken
    // airline seat.
    pool.query(
      `
        SELECT ta.fk_institution_section_id AS "institutionSectionId", ta.fk_mst_subject_id AS "mstSubjectId",
               u.name AS "teacherName"
        FROM teacher_class_assignment ta
        JOIN institution_teacher it ON it.id = ta.fk_institution_teacher_id
        JOIN users u ON u.id = it.fk_user_id
        JOIN institution_section sec ON sec.id = ta.fk_institution_section_id
        JOIN institution_class ic ON ic.id = sec.fk_institution_class_id
        WHERE ic.fk_institution_id = $1 AND ta.fk_institution_teacher_id != $2
          AND ta.is_active = TRUE AND it.is_active = TRUE
      `,
      [institutionTeacher.institutionId, institutionTeacherId]
    ),
  ]);

  return {
    sections: sectionsResult.rows,
    subjects: subjectsResult.rows,
    assignments: assignmentsResult.rows,
    takenByOthers: takenByOthersResult.rows,
  };
};

export const saveTeacherAssignments = async ({ institutionTeacherId, assignments, assignedByUserId }) => {
  const teacherResult = await pool.query(
    `
      SELECT it.id, inst.code AS "institutionCode"
      FROM institution_teacher it
      JOIN institutions inst ON inst.id = it.fk_institution_id
      WHERE it.id = $1
    `,
    [institutionTeacherId]
  );
  const institutionTeacher = teacherResult.rows[0];
  if (!institutionTeacher) {
    const error = new Error("Teacher link not found.");
    error.statusCode = 404;
    throw error;
  }

  // A class section + subject can only ever belong to one active teacher at
  // a time -- reject the whole save if any cell being turned on here is
  // already claimed by someone else, rather than silently overwriting or
  // double-booking it. The client is expected to grey these out already
  // (getAssignmentGrid's takenByOthers); this is the server-side guarantee.
  const incomingActive = (assignments || [])
    .map((entry) => ({ institutionSectionId: Number(entry?.institutionSectionId), mstSubjectId: Number(entry?.mstSubjectId), isActive: Boolean(entry?.isActive) }))
    .filter((entry) => entry.isActive && entry.institutionSectionId && entry.mstSubjectId);

  if (incomingActive.length) {
    const conflictsResult = await pool.query(
      `
        SELECT ta.fk_institution_section_id AS "institutionSectionId", ta.fk_mst_subject_id AS "mstSubjectId",
               sec.name AS "sectionName", lvl.name AS "className", subj.name AS "subjectName", u.name AS "teacherName"
        FROM teacher_class_assignment ta
        JOIN institution_teacher it ON it.id = ta.fk_institution_teacher_id
        JOIN users u ON u.id = it.fk_user_id
        JOIN institution_section sec ON sec.id = ta.fk_institution_section_id
        JOIN institution_class ic ON ic.id = sec.fk_institution_class_id
        JOIN mst_level lvl ON lvl.id = ic.fk_mst_level_id
        JOIN mst_subject subj ON subj.id = ta.fk_mst_subject_id
        WHERE ta.fk_institution_teacher_id != $1 AND ta.is_active = TRUE AND it.is_active = TRUE
          AND (ta.fk_institution_section_id, ta.fk_mst_subject_id) IN (
            SELECT * FROM UNNEST($2::bigint[], $3::bigint[])
          )
      `,
      [institutionTeacherId, incomingActive.map((entry) => entry.institutionSectionId), incomingActive.map((entry) => entry.mstSubjectId)]
    );
    if (conflictsResult.rows[0]) {
      const conflict = conflictsResult.rows[0];
      const error = new Error(
        `${conflict.className} - ${conflict.sectionName} / ${conflict.subjectName} is already assigned to ${conflict.teacherName}.`
      );
      error.statusCode = 409;
      throw error;
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const entry of assignments || []) {
      const institutionSectionId = Number(entry?.institutionSectionId);
      const mstSubjectId = Number(entry?.mstSubjectId);
      const isActive = Boolean(entry?.isActive);
      if (!institutionSectionId || !mstSubjectId) {
        continue;
      }

      const upserted = await client.query(
        `
          INSERT INTO teacher_class_assignment
            (fk_institution_teacher_id, fk_institution_section_id, fk_mst_subject_id, is_active, assigned_by, assigned_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (fk_institution_teacher_id, fk_institution_section_id, fk_mst_subject_id)
          DO UPDATE SET is_active = EXCLUDED.is_active, assigned_by = EXCLUDED.assigned_by, assigned_at = NOW()
          RETURNING *
        `,
        [institutionTeacherId, institutionSectionId, mstSubjectId, isActive, assignedByUserId]
      );

      const assignmentRow = upserted.rows[0];
      if (assignmentRow.is_active) {
        await ensureBatchForAssignment(
          { teacherClassAssignmentId: assignmentRow.id, institutionCode: institutionTeacher.institutionCode },
          client
        );
      } else {
        await deactivateBatchForAssignment(assignmentRow.id, client);
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return getAssignmentGrid(institutionTeacherId);
};
