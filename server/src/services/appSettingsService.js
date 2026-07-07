import { pool } from "../db/pool.js";

const cache = new Map();

export const getSetting = async (key, fallbackValue = null) => {
  if (cache.has(key)) {
    return cache.get(key);
  }

  const result = await pool.query(
    "SELECT setting_value FROM app_settings WHERE setting_key = $1",
    [key]
  );

  const value = result.rows[0]?.setting_value ?? fallbackValue;
  cache.set(key, value);
  return value;
};

export const setSetting = async (key, value, { updatedBy = null } = {}) => {
  await pool.query(
    `
      INSERT INTO app_settings (setting_key, setting_value, updated_by, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (setting_key) DO UPDATE
      SET setting_value = EXCLUDED.setting_value,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
    `,
    [key, JSON.stringify(value), updatedBy]
  );

  cache.set(key, value);
  return value;
};
