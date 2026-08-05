import { pool } from "../db/pool.js";

// Powers AdminOverviewPage.jsx's 4 stat tiles -- was previously a hardcoded
// { value: 128 } etc. array with no backend at all.
export const getOverviewStats = async () => {
  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM practice_set WHERE status = 'active') AS active_test_suites,
      (SELECT COUNT(*) FROM practice_set WHERE created_at >= NOW() - INTERVAL '7 days') AS papers_drafted_this_week,
      (
        SELECT COUNT(DISTINCT user_id) FROM student_attempt
        WHERE DATE(started_at AT TIME ZONE 'Asia/Kolkata') = DATE(NOW() AT TIME ZONE 'Asia/Kolkata')
      ) AS students_practicing_today,
      (SELECT COUNT(*) FROM student_mastery WHERE mastery_level = 'Needs Practice') AS weak_topic_alerts
  `);

  const row = result.rows[0];
  return {
    activeTestSuites: Number(row.active_test_suites),
    papersDraftedThisWeek: Number(row.papers_drafted_this_week),
    studentsPracticingToday: Number(row.students_practicing_today),
    weakTopicAlerts: Number(row.weak_topic_alerts),
  };
};
