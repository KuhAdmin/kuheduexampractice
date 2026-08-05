import { pool } from "../db/pool.js";

// "1,000,000 tokens = 30 hours" -- text (Ask/Coach) usage is measured in
// real input/output tokens (see openAiService.js's createStructuredCompletion),
// converted to hours via this ratio. Voice/avatar usage has no token count
// (Gemini Live connects browser-to-Google directly -- see
// StudentVoiceSessionPanel.jsx), so its elapsed seconds are added to the
// same hours figure directly instead.
const HOURS_BUDGET = 30;
const TOKENS_PER_HOUR = 1_000_000 / HOURS_BUDGET;

const round2 = (value) => Math.round(value * 100) / 100;

const toSummary = (row) => {
  const inputTokens = Number(row?.input_tokens || 0);
  const outputTokens = Number(row?.output_tokens || 0);
  const voiceSeconds = Number(row?.voice_seconds || 0);

  const hoursUsed = (inputTokens + outputTokens) / TOKENS_PER_HOUR + voiceSeconds / 3600;
  const hoursRemaining = Math.max(0, HOURS_BUDGET - hoursUsed);
  const percentUsed = Math.min(100, (hoursUsed / HOURS_BUDGET) * 100);

  return {
    periodMonth: row?.period_month || null,
    inputTokens,
    outputTokens,
    voiceSeconds,
    hoursUsed: round2(hoursUsed),
    hoursBudget: HOURS_BUDGET,
    hoursRemaining: round2(hoursRemaining),
    percentUsed: round2(percentUsed),
  };
};

export const getMonthlyUsageSummary = async (userId) => {
  const result = await pool.query(
    `
      SELECT period_month, input_tokens, output_tokens, voice_seconds
      FROM tutor_usage_period
      WHERE user_id = $1 AND period_month = date_trunc('month', NOW())::date
    `,
    [userId]
  );

  return toSummary(result.rows[0]);
};

export const recordTextUsage = async ({ userId, inputTokens, outputTokens }) => {
  const result = await pool.query(
    `
      INSERT INTO tutor_usage_period (user_id, period_month, input_tokens, output_tokens)
      VALUES ($1, date_trunc('month', NOW())::date, $2, $3)
      ON CONFLICT (user_id, period_month) DO UPDATE
      SET input_tokens = tutor_usage_period.input_tokens + EXCLUDED.input_tokens,
          output_tokens = tutor_usage_period.output_tokens + EXCLUDED.output_tokens,
          updated_at = NOW()
      RETURNING period_month, input_tokens, output_tokens, voice_seconds
    `,
    [userId, Number(inputTokens) || 0, Number(outputTokens) || 0]
  );

  return toSummary(result.rows[0]);
};

export const recordVoiceUsage = async ({ userId, seconds }) => {
  const safeSeconds = Number(seconds) || 0;
  if (safeSeconds <= 0) {
    return getMonthlyUsageSummary(userId);
  }

  const result = await pool.query(
    `
      INSERT INTO tutor_usage_period (user_id, period_month, voice_seconds)
      VALUES ($1, date_trunc('month', NOW())::date, $2)
      ON CONFLICT (user_id, period_month) DO UPDATE
      SET voice_seconds = tutor_usage_period.voice_seconds + EXCLUDED.voice_seconds,
          updated_at = NOW()
      RETURNING period_month, input_tokens, output_tokens, voice_seconds
    `,
    [userId, safeSeconds]
  );

  return toSummary(result.rows[0]);
};
