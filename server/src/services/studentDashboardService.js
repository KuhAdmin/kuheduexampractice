import { pool } from "../db/pool.js";
import {
  getDashboardCatalogForUser,
  resolveDashboardAcademicFilters,
} from "./catalogService.js";

const MASTERY_COMPLETE_THRESHOLD = 0.8;

const emptyReturningDashboard = {
  subheading: "Keep learning, keep growing!",
  continueCard: {
    eyebrow: "Continue Learning",
    title: "No chapter started yet",
    section: "Start your first practice set",
    concept: "Your live learning progress will appear here",
    progress: 0,
  },
  chapters: [],
  todayGoal: {
    title: "Today's Goal",
    value: "No concepts available yet",
  },
  weakConcepts: [],
  streak: {
    label: "Study Streak",
    value: "0 Days",
    last7Days: [],
  },
};

const pluralize = (count, singular, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

const formatRelativePracticeLabel = (dateValue) => {
  if (!dateValue) {
    return "Practice history will appear here";
  }

  const practicedAt = new Date(dateValue);
  const today = new Date();
  practicedAt.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.round((today.getTime() - practicedAt.getTime()) / 86400000);
  if (diffDays <= 0) {
    return "Last practiced today";
  }
  if (diffDays === 1) {
    return "Last practiced 1 day ago";
  }

  return `Last practiced ${diffDays} days ago`;
};

const calculateStudyStreakDays = (activityDates) => {
  if (!activityDates.length) {
    return 0;
  }

  let streak = 1;
  let previous = new Date(activityDates[0]);
  previous.setHours(0, 0, 0, 0);

  for (let index = 1; index < activityDates.length; index += 1) {
    const current = new Date(activityDates[index]);
    current.setHours(0, 0, 0, 0);
    const diffDays = Math.round((previous.getTime() - current.getTime()) / 86400000);

    if (diffDays !== 1) {
      break;
    }

    streak += 1;
    previous = current;
  }

  return streak;
};

const buildTodayGoal = (totalUnits, masteredUnits) => {
  if (!totalUnits) {
    return emptyReturningDashboard.todayGoal;
  }

  const remainingUnits = Math.max(totalUnits - masteredUnits, 0);
  if (remainingUnits === 0) {
    return {
      title: "Today's Goal",
      value: "All concepts completed",
    };
  }

  return {
    title: "Today's Goal",
    value: `${pluralize(remainingUnits, "Concept")} Remaining`,
  };
};

const WEAK_CONCEPTS_LIMIT = 3;

const buildWeakConcepts = (syllabusRows, limit = WEAK_CONCEPTS_LIMIT) => {
  const attemptedRows = syllabusRows.filter(
    (row) => row.lastActivityAt || row.masteryProbability > 0
  );

  if (!attemptedRows.length) {
    return [];
  }

  return [...attemptedRows]
    .sort((left, right) => {
      const masteryDelta = Number(left.masteryProbability) - Number(right.masteryProbability);
      if (masteryDelta !== 0) {
        return masteryDelta;
      }

      const leftActivity = left.lastActivityAt ? new Date(left.lastActivityAt).getTime() : 0;
      const rightActivity = right.lastActivityAt ? new Date(right.lastActivityAt).getTime() : 0;
      return rightActivity - leftActivity;
    })
    .slice(0, limit)
    .map((row) => ({
      title: row.primaryConcept || row.topicName || row.chapterName,
      lastPracticed: formatRelativePracticeLabel(row.lastActivityAt),
      chapterNumber: row.chapterNumber,
      sourceSectionId: row.sourceSectionId,
      assessmentUnitId: row.assessmentUnitId,
    }));
};

const buildContinueCard = (syllabusRows, chapterProgressByKey, catalogFallback) => {
  if (!syllabusRows.length) {
    return catalogFallback.continueCard || emptyReturningDashboard.continueCard;
  }

  const activeRows = [...syllabusRows].sort((left, right) => {
    const leftActivity = left.lastActivityAt ? new Date(left.lastActivityAt).getTime() : 0;
    const rightActivity = right.lastActivityAt ? new Date(right.lastActivityAt).getTime() : 0;

    if (leftActivity !== rightActivity) {
      return rightActivity - leftActivity;
    }

    const leftDisplayOrder = Number(left.displayOrder) || 0;
    const rightDisplayOrder = Number(right.displayOrder) || 0;
    return leftDisplayOrder - rightDisplayOrder;
  });

  const selectedRow =
    activeRows.find((row) => row.lastActivityAt) ||
    activeRows.find((row) => Number(row.masteryProbability) > 0) ||
    activeRows[0];

  const chapterKey = `${selectedRow.chapterId}`;
  const progress = chapterProgressByKey.get(chapterKey)?.progress ?? 0;

  return {
    eyebrow: "Continue Learning",
    title: selectedRow.chapterName,
    section: selectedRow.sectionNumber || `Chapter ${selectedRow.chapterNumber}`,
    concept:
      selectedRow.topicName || selectedRow.primaryConcept || selectedRow.chapterName,
    progress,
    chapterNumber: selectedRow.chapterNumber,
    sourceSectionId: selectedRow.sourceSectionId,
    assessmentUnitId: selectedRow.assessmentUnitId,
  };
};

const buildChapterProgress = (syllabusRows, catalogChapters) => {
  // Keyed directly by chapterNumber (not chapterId, which is section-grained
  // in mst_chapter/mv_chapter_catalog) so every section belonging to the same
  // chapter accumulates into one true chapter-wide total instead of being
  // collapsed per-section first and then overwritten on re-key.
  const statsByChapterNumber = new Map();

  syllabusRows.forEach((row) => {
    const chapterNumberKey = String(row.chapterNumber);
    const current = statsByChapterNumber.get(chapterNumberKey) || {
      totalUnits: 0,
      masteredUnits: 0,
    };

    current.totalUnits += 1;
    if (Number(row.masteryProbability) >= MASTERY_COMPLETE_THRESHOLD) {
      current.masteredUnits += 1;
    }

    statsByChapterNumber.set(chapterNumberKey, current);
  });

  const progressForChapterNumber = (chapterNumber) => {
    const stats = statsByChapterNumber.get(String(chapterNumber));
    return stats && stats.totalUnits
      ? Math.round((stats.masteredUnits / stats.totalUnits) * 100)
      : 0;
  };

  const chapters = catalogChapters.map((chapter) => ({
    ...chapter,
    progress: progressForChapterNumber(chapter.chapterNumber),
  }));

  const chapterProgressByKey = new Map();
  syllabusRows.forEach((row) => {
    chapterProgressByKey.set(`${row.chapterId}`, {
      progress: progressForChapterNumber(row.chapterNumber),
    });
  });

  return {
    chapters,
    chapterProgressByKey,
  };
};

const getSyllabusRowsForUser = async ({ examGoalCode, levelCode, subjectCode, userId }) => {
  const result = await pool.query(
    `
      WITH latest_responses AS (
        SELECT
          sr.assessment_unit_id,
          MAX(sr.created_at) AS last_response_at
        FROM student_response AS sr
        JOIN student_attempt AS sa
          ON sa.id = sr.student_attempt_id
        WHERE sa.user_id = $4
        GROUP BY sr.assessment_unit_id
      )
      SELECT
        au.assessment_unit_id AS "assessmentUnitId",
        au.primary_concept AS "primaryConcept",
        au.source_section_id AS "sourceSectionId",
        chapter.chapter_id AS "chapterId",
        chapter.chapter_number AS "chapterNumber",
        chapter.chapter_name AS "chapterName",
        chapter.section_number AS "sectionNumber",
        chapter.topic_name AS "topicName",
        chapter.chapter_display_order AS "displayOrder",
        COALESCE(sm.mastery_probability, 0) AS "masteryProbability",
        NULLIF(
          GREATEST(
            COALESCE(sm.updated_at, TO_TIMESTAMP(0)),
            COALESCE(latest_responses.last_response_at, TO_TIMESTAMP(0))
          ),
          TO_TIMESTAMP(0)
        ) AS "lastActivityAt"
      FROM assessment_unit AS au
      JOIN mv_chapter_catalog AS chapter
        ON chapter.chapter_id = au.fk_mst_chapter_id
      LEFT JOIN student_mastery AS sm
        ON sm.assessment_unit_id = au.assessment_unit_id
       AND sm.user_id = $4
      LEFT JOIN latest_responses
        ON latest_responses.assessment_unit_id = au.assessment_unit_id
      WHERE chapter.exam_goal_code = $1
        AND chapter.level_code = $2
        AND chapter.subject_code = $3
        AND chapter.book_is_active = TRUE
        AND chapter.chapter_is_active = TRUE
        AND au.is_active = TRUE
      ORDER BY chapter.chapter_display_order ASC, chapter.chapter_number ASC, chapter.section_number ASC
    `,
    [examGoalCode, levelCode, subjectCode, userId]
  );

  return result.rows.map((row) => ({
    ...row,
    masteryProbability: Number(row.masteryProbability || 0),
  }));
};

const toLocalDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const buildLast7DaysActivityStrip = (activityDates) => {
  const activeDateSet = new Set(
    activityDates.map((dateValue) => new Date(dateValue).toDateString())
  );

  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - offset);
    days.push({
      date: toLocalDateKey(day),
      active: activeDateSet.has(day.toDateString()),
    });
  }

  return days;
};

export const getReturningDashboardForUser = async ({
  userId,
  board,
  studentClass,
  subject,
}) => {
  const { examGoalCode, levelCode, subjectCode, isValid } = resolveDashboardAcademicFilters({
    board,
    studentClass,
    subject,
  });

  const catalogFallback = await getDashboardCatalogForUser({
    board,
    studentClass,
    subject,
  });

  if (!isValid) {
    return {
      ...emptyReturningDashboard,
      chapters: catalogFallback.chapters,
      continueCard: catalogFallback.continueCard || emptyReturningDashboard.continueCard,
    };
  }

  const [syllabusRows, activityResult] = await Promise.all([
    getSyllabusRowsForUser({ examGoalCode, levelCode, subjectCode, userId }),
    pool.query(
      `
        SELECT DISTINCT activity_date AS "activityDate"
        FROM (
          SELECT DATE(sa.started_at AT TIME ZONE 'Asia/Kolkata') AS activity_date
          FROM student_attempt AS sa
          WHERE sa.user_id = $1

          UNION

          SELECT DATE(sr.created_at AT TIME ZONE 'Asia/Kolkata') AS activity_date
          FROM student_response AS sr
          JOIN student_attempt AS sa
            ON sa.id = sr.student_attempt_id
          WHERE sa.user_id = $1
        ) AS activity_days
        WHERE activity_date IS NOT NULL
        ORDER BY "activityDate" DESC
      `,
      [userId]
    ),
  ]);

  const masteredUnits = syllabusRows.filter(
    (row) => row.masteryProbability >= MASTERY_COMPLETE_THRESHOLD
  ).length;

  const { chapters, chapterProgressByKey } = buildChapterProgress(
    syllabusRows,
    catalogFallback.chapters
  );
  const activityDates = activityResult.rows.map((row) => row.activityDate);
  const streakDays = calculateStudyStreakDays(activityDates);

  return {
    ...emptyReturningDashboard,
    continueCard: buildContinueCard(syllabusRows, chapterProgressByKey, catalogFallback),
    chapters,
    todayGoal: buildTodayGoal(syllabusRows.length, masteredUnits),
    weakConcepts: buildWeakConcepts(syllabusRows),
    streak: {
      label: "Study Streak",
      value: pluralize(streakDays, "Day"),
      last7Days: buildLast7DaysActivityStrip(activityDates),
    },
  };
};

export const listRemainingConceptsForUser = async ({ userId, board, studentClass, subject }) => {
  const { examGoalCode, levelCode, subjectCode, isValid } = resolveDashboardAcademicFilters({
    board,
    studentClass,
    subject,
  });

  if (!isValid) {
    return { concepts: [] };
  }

  const syllabusRows = await getSyllabusRowsForUser({ examGoalCode, levelCode, subjectCode, userId });

  const concepts = syllabusRows
    .filter((row) => row.masteryProbability < MASTERY_COMPLETE_THRESHOLD)
    .sort((left, right) => {
      const displayOrderDelta = (Number(left.displayOrder) || 0) - (Number(right.displayOrder) || 0);
      if (displayOrderDelta !== 0) {
        return displayOrderDelta;
      }
      return String(left.sectionNumber || "").localeCompare(String(right.sectionNumber || ""));
    })
    .map((row) => ({
      assessmentUnitId: row.assessmentUnitId,
      chapterNumber: row.chapterNumber,
      sourceSectionId: row.sourceSectionId,
      chapterName: row.chapterName,
      sectionNumber: row.sectionNumber,
      topicName: row.topicName,
      primaryConcept: row.primaryConcept,
    }));

  return { concepts };
};

const NOTIFICATION_LIST_LIMIT = 20;

export const getNotificationsForUser = async ({ userId, board, studentClass, subject }) => {
  const { examGoalCode, levelCode, subjectCode, isValid } = resolveDashboardAcademicFilters({
    board,
    studentClass,
    subject,
  });

  if (!isValid) {
    return { unreadCount: 0, notifications: [] };
  }

  const [userResult, eventsResult] = await Promise.all([
    pool.query(`SELECT last_notifications_seen_at FROM users WHERE id = $1`, [userId]),
    pool.query(
      `
        SELECT
          id,
          chapter_number AS "chapterNumber",
          chapter_name AS "chapterName",
          section_number AS "sectionNumber",
          topic_name AS "topicName",
          source_section_id AS "sourceSectionId",
          created_at AS "createdAt"
        FROM content_update_event
        WHERE exam_goal_code = $1 AND level_code = $2 AND subject_code = $3
        ORDER BY created_at DESC
        LIMIT $4
      `,
      [examGoalCode, levelCode, subjectCode, NOTIFICATION_LIST_LIMIT]
    ),
  ]);

  const lastSeenAt = userResult.rows[0]?.last_notifications_seen_at || null;
  const lastSeenTime = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;

  const notifications = eventsResult.rows.map((row) => ({
    id: row.id,
    title: row.topicName || row.chapterName,
    subtitle: `${row.chapterName}${row.sectionNumber ? ` · Section ${row.sectionNumber}` : ""} is now available`,
    chapterNumber: row.chapterNumber,
    sourceSectionId: row.sourceSectionId,
    createdAt: row.createdAt,
    isUnread: new Date(row.createdAt).getTime() > lastSeenTime,
  }));

  const unreadCount = notifications.filter((item) => item.isUnread).length;

  return { unreadCount, notifications };
};

export const markNotificationsSeen = async ({ userId }) => {
  await pool.query(`UPDATE users SET last_notifications_seen_at = NOW() WHERE id = $1`, [userId]);
};
