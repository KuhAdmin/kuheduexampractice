import bcrypt from "bcryptjs";
import { pool } from "../db/pool.js";

const ALLOWED_ROLES = ["student", "moderator", "admin"];

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
  createdAt: row.created_at,
});

export const findUserByEmail = async (email) => {
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  return result.rows[0] || null;
};

export const findUserById = async (id) => {
  const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0] || null;
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

export const createUserByAdmin = async ({ name, email, password, role }) => {
  if (!ALLOWED_ROLES.includes(role)) {
    const error = new Error(`role must be one of: ${ALLOWED_ROLES.join(", ")}.`);
    error.statusCode = 400;
    throw error;
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    const error = new Error("A user with this email already exists.");
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `
      INSERT INTO users (name, email, password_hash, provider, role)
      VALUES ($1, $2, $3, 'local', $4)
      RETURNING *
    `,
    [name, email, passwordHash, role]
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

export const toPublicUser = mapUser;
