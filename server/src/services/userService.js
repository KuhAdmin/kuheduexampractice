import bcrypt from "bcryptjs";
import { pool } from "../db/pool.js";
import { listClassSubjectOptionsWithContent } from "./catalogService.js";

const ALLOWED_ROLES = ["student", "moderator", "admin", "superstudent"];

// The seed admin account is exempt from the superstudent-access toggle --
// it's the fallback login used to recover the admin panel, so it must never
// be left in a state where flipping a checkbox could lock it out or leave it
// ambiguous whether it has full access.
const PROTECTED_ADMIN_EMAIL = "admin@example.com";

const mapUser = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  provider: row.provider,
  avatarUrl: row.avatar_url,
  role: row.role,
  board: row.board,
  studentClass: row.student_class,
  subject: row.subject,
  onboardingCompletedAt: row.onboarding_completed_at,
  theme: row.theme,
  isPremium: row.is_premium,
  premiumExpiresAt: row.premium_expires_at,
  superstudentAccessEnabled: row.superstudent_access_enabled,
  superstudentRemarks: row.superstudent_remarks,
  superstudentGrantedBy: row.superstudent_granted_by,
  superstudentGrantedAt: row.superstudent_granted_at,
  superstudentAccessUpdatedBy: row.superstudent_access_updated_by,
  superstudentAccessUpdatedAt: row.superstudent_access_updated_at,
  superstudentScopeType: row.superstudent_scope_type,
  superstudentScopeClasses: row.superstudent_scope_classes || [],
  superstudentScopeSubjects: row.superstudent_scope_subjects || [],
  createdAt: row.created_at,
});

// Trial premium (paymentService.js PLAN_AMOUNTS_PAISE.trial) is
// self-expiring rather than webhook/cron-revoked -- cheapest correct option
// for a ₹9/1-hour testing plan. Checked wherever a user row is loaded for
// auth (requireAuth calls findUserById on every request), so a lapsed trial
// never reads as premium for more than one request past its expiry.
const expirePremiumIfLapsed = async (row) => {
  if (!row || !row.is_premium || !row.premium_expires_at) {
    return row;
  }
  if (new Date(row.premium_expires_at) > new Date()) {
    return row;
  }

  // premium_expires_at is deliberately left as-is (not nulled) -- it's the
  // only record of when a lapsed trial actually ended, which the admin
  // Orders dashboard reads (ordersService.js's access_ends_at). It gets
  // overwritten naturally on the user's next purchase either way
  // (markOrderPaidAndActivatePremium always sets a fresh value or NULL), so
  // leaving the stale timestamp here never causes a future "still active"
  // misread.
  const result = await pool.query(
    "UPDATE users SET is_premium = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *",
    [row.id]
  );
  return result.rows[0] || row;
};

export const findUserByEmail = async (email) => {
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  return result.rows[0] || null;
};

export const findUserById = async (id) => {
  const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return (await expirePremiumIfLapsed(result.rows[0])) || null;
};

export const findUserByGoogleId = async (googleId) => {
  const result = await pool.query("SELECT * FROM users WHERE google_id = $1", [
    googleId,
  ]);
  return result.rows[0] || null;
};

export const createLocalUser = async ({ name, email, passwordHash }) => {
  const result = await pool.query(
    `
      INSERT INTO users (name, email, password_hash, provider)
      VALUES ($1, $2, $3, 'local')
      RETURNING *
    `,
    [name, email, passwordHash]
  );

  return mapUser(result.rows[0]);
};

export const createGoogleUser = async ({
  name,
  email,
  googleId,
  avatarUrl,
}) => {
  const result = await pool.query(
    `
      INSERT INTO users (name, email, google_id, avatar_url, provider)
      VALUES ($1, $2, $3, $4, 'google')
      RETURNING *
    `,
    [name, email, googleId, avatarUrl]
  );

  return mapUser(result.rows[0]);
};

export const linkGoogleAccount = async ({
  id,
  googleId,
  avatarUrl,
  name,
}) => {
  const result = await pool.query(
    `
      UPDATE users
      SET google_id = $2,
          avatar_url = COALESCE($3, avatar_url),
          name = COALESCE($4, name),
          provider = CASE WHEN provider = 'local' THEN 'local+google' ELSE provider END,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, googleId, avatarUrl, name]
  );

  return mapUser(result.rows[0]);
};

export const updateUserOnboarding = async ({
  id,
  board,
  studentClass,
  subject,
}) => {
  const result = await pool.query(
    `
      UPDATE users
      SET board = $2,
          student_class = $3,
          subject = $4,
          onboarding_completed_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, board, studentClass, subject]
  );

  return mapUser(result.rows[0]);
};

export const updateUserProfile = async ({ id, name, avatarUrl }) => {
  const result = await pool.query(
    `
      UPDATE users
      SET name = $2,
          avatar_url = COALESCE($3, avatar_url),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, name, avatarUrl || null]
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
};

export const updateUserTheme = async ({ id, theme }) => {
  const result = await pool.query(
    `UPDATE users SET theme = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, theme]
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
};

export const updateUserPassword = async ({ id, passwordHash }) => {
  await pool.query(
    `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`,
    [id, passwordHash]
  );
};

export const listUsers = async () => {
  const result = await pool.query("SELECT * FROM users ORDER BY created_at DESC");
  return result.rows.map(mapUser);
};

const SCOPE_TYPES = ["all", "class", "class_subject"];

// Validates admin-submitted scope selections against the real catalog
// (never trust client-supplied names) and resolves them to the canonical
// {examGoalCode, levelCode, examGoalName, levelName} / {subjectCode,
// subjectName} shape stored in the JSONB scope columns.
const resolveSuperstudentScope = async ({ scopeType, scopeClasses, scopeSubjects }) => {
  if (scopeType === "all") {
    return { scopeType: "all", scopeClassesJson: null, scopeSubjectsJson: null };
  }

  if (!SCOPE_TYPES.includes(scopeType)) {
    const error = new Error(`scopeType must be one of: ${SCOPE_TYPES.join(", ")}.`);
    error.statusCode = 400;
    throw error;
  }

  if (!Array.isArray(scopeClasses) || scopeClasses.length === 0) {
    const error = new Error("Select at least one class for this scope.");
    error.statusCode = 400;
    throw error;
  }

  if (scopeType === "class_subject" && (!Array.isArray(scopeSubjects) || scopeSubjects.length === 0)) {
    const error = new Error("Select at least one subject for this scope.");
    error.statusCode = 400;
    throw error;
  }

  const catalog = await listClassSubjectOptionsWithContent();

  const seenClassKeys = new Set();
  const resolvedClasses = [];
  for (const { examGoalCode, levelCode } of scopeClasses) {
    const match = catalog.find((row) => row.examGoalCode === examGoalCode && row.levelCode === levelCode);
    if (!match) {
      const error = new Error("One of the selected classes is not valid.");
      error.statusCode = 400;
      throw error;
    }
    const key = `${match.examGoalCode}|${match.levelCode}`;
    if (!seenClassKeys.has(key)) {
      seenClassKeys.add(key);
      resolvedClasses.push({
        examGoalCode: match.examGoalCode,
        levelCode: match.levelCode,
        examGoalName: match.examGoalName,
        levelName: match.levelName,
      });
    }
  }

  let resolvedSubjects = null;
  if (scopeType === "class_subject") {
    const seenSubjectCodes = new Set();
    resolvedSubjects = [];
    for (const subjectCode of scopeSubjects) {
      const match = catalog.find((row) => row.subjectCode === subjectCode);
      if (!match) {
        const error = new Error("One of the selected subjects is not valid.");
        error.statusCode = 400;
        throw error;
      }
      if (!seenSubjectCodes.has(subjectCode)) {
        seenSubjectCodes.add(subjectCode);
        resolvedSubjects.push({ subjectCode: match.subjectCode, subjectName: match.subjectName });
      }
    }
  }

  return {
    scopeType,
    scopeClassesJson: JSON.stringify(resolvedClasses),
    scopeSubjectsJson: resolvedSubjects ? JSON.stringify(resolvedSubjects) : null,
  };
};

export const createUserByAdmin = async ({
  name,
  email,
  password,
  role,
  remarks,
  grantedByUserId,
  scopeType = "all",
  scopeClasses = [],
  scopeSubjects = [],
}) => {
  if (!ALLOWED_ROLES.includes(role)) {
    const error = new Error(`role must be one of: ${ALLOWED_ROLES.join(", ")}.`);
    error.statusCode = 400;
    throw error;
  }

  if (role === "superstudent" && !remarks?.trim()) {
    const error = new Error("remarks are required for a superstudent account.");
    error.statusCode = 400;
    throw error;
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    const error = new Error("A user with this email already exists.");
    error.statusCode = 409;
    throw error;
  }

  const isSuperstudent = role === "superstudent";
  const scope = isSuperstudent
    ? await resolveSuperstudentScope({ scopeType, scopeClasses, scopeSubjects })
    : { scopeType: "all", scopeClassesJson: null, scopeSubjectsJson: null };

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `
      INSERT INTO users (
        name, email, password_hash, provider, role,
        superstudent_access_enabled, superstudent_remarks,
        superstudent_granted_by, superstudent_granted_at,
        superstudent_scope_type, superstudent_scope_classes, superstudent_scope_subjects
      )
      VALUES ($1, $2, $3, 'local', $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `,
    [
      name,
      email,
      passwordHash,
      role,
      isSuperstudent,
      isSuperstudent ? remarks.trim() : null,
      isSuperstudent ? grantedByUserId : null,
      isSuperstudent ? new Date() : null,
      scope.scopeType,
      scope.scopeClassesJson,
      scope.scopeSubjectsJson,
    ]
  );

  return mapUser(result.rows[0]);
};

export const updateUserRole = async (userId, role) => {
  if (!ALLOWED_ROLES.includes(role)) {
    const error = new Error(`role must be one of: ${ALLOWED_ROLES.join(", ")}.`);
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    "UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1 RETURNING *",
    [userId, role]
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
};

export const setSuperstudentAccess = async (userId, { isEnabled, remarks, updatedByUserId }) => {
  const result = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
  const existing = result.rows[0];
  if (!existing) {
    return null;
  }

  if (existing.email === PROTECTED_ADMIN_EMAIL) {
    const error = new Error("This account's access cannot be changed.");
    error.statusCode = 403;
    throw error;
  }

  const updated = await pool.query(
    `
      UPDATE users
      SET superstudent_access_enabled = $2,
          superstudent_remarks = COALESCE($3, superstudent_remarks),
          superstudent_access_updated_by = $4,
          superstudent_access_updated_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [userId, Boolean(isEnabled), remarks?.trim() || null, updatedByUserId]
  );

  return mapUser(updated.rows[0]);
};

export const resetUserPassword = async (userId, newPassword) => {
  if (!newPassword || newPassword.length < 8) {
    const error = new Error("Password must be at least 8 characters long.");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query("SELECT id FROM users WHERE id = $1", [userId]);
  if (!result.rows[0]) {
    return null;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await updateUserPassword({ id: userId, passwordHash });
  return true;
};

export const toPublicUser = mapUser;
