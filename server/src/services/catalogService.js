import { pool } from "../db/pool.js";

// A couple of user-facing subject spellings that don't literally match any
// mst_subject.name ("Math" vs. "Mathematics") -- everything else is resolved
// straight off master data, so a new subject or board becomes usable here as
// soon as it exists in mst_subject/mst_exam_goal, no code change required.
const subjectNameAliases = {
  math: "mathematics",
};

// Resolves a student's free-text board/class/subject (users.board/
// student_class/subject) against master data: board -> mst_exam_goal.board_code,
// subject -> mst_subject.name (case-insensitive). studentClass is used as-is
// since mst_level.name_code is already the plain class number/string. Returns
// isValid: false (and no query results used) when board/subject don't match
// any master-data row, so callers can render an honest empty state instead of
// guessing.
export const resolveDashboardAcademicFilters = async ({ board, studentClass, subject }) => {
  const boardText = String(board || "").trim();
  const levelCode = String(studentClass || "").trim();
  const subjectText = String(subject || "").trim().toLowerCase();
  const subjectLookupText = subjectNameAliases[subjectText] || subjectText;

  const [examGoalResult, subjectResult] = await Promise.all([
    boardText
      ? pool.query(
          "SELECT goal_id FROM mst_exam_goal WHERE lower(board_code) = lower($1) AND is_active = TRUE LIMIT 1",
          [boardText]
        )
      : Promise.resolve({ rows: [] }),
    subjectLookupText
      ? pool.query(
          "SELECT name_code FROM mst_subject WHERE lower(name) = $1 AND is_active = TRUE LIMIT 1",
          [subjectLookupText]
        )
      : Promise.resolve({ rows: [] }),
  ]);

  const examGoalCode = examGoalResult.rows[0]?.goal_id || undefined;
  const subjectCode = subjectResult.rows[0]?.name_code || undefined;

  return {
    examGoalCode,
    levelCode,
    subjectCode,
    isValid: Boolean(examGoalCode && levelCode && subjectCode),
  };
};

export const listChapters = async ({
  bookId,
  chapterNumber,
  sectionPrefix,
  isActive,
}) => {
  const conditions = [];
  const values = [];

  if (bookId) {
    values.push(bookId);
    conditions.push(`fk_mst_book_id = $${values.length}`);
  }

  if (chapterNumber) {
    values.push(chapterNumber);
    conditions.push(`chapter_number = $${values.length}`);
  }

  if (sectionPrefix) {
    values.push(sectionPrefix);
    conditions.push(
      `(section_number = $${values.length} OR section_number LIKE $${values.length} || '.%')`
    );
  }

  if (typeof isActive === "boolean") {
    values.push(isActive);
    conditions.push(`is_active = $${values.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `
      SELECT
        id,
        chapter_number AS "chapterNumber",
        chapter_name AS "chapterName",
        section_number AS "sectionNumber",
        topic_name AS "topicName",
        display_order AS "displayOrder",
        fk_mst_book_id AS "bookId",
        is_active AS "isActive"
      FROM mst_chapter
      ${whereClause}
      ORDER BY display_order ASC, chapter_number ASC, section_number ASC, id ASC
    `,
    values
  );

  return result.rows;
};

// Split out from getDashboardCatalogForUser so a caller that already has
// exam_goal_code/level_code/subject_code (e.g. picked directly off an
// mv_chapter_catalog row, like the class/subject switcher on
// StudentChaptersPage.jsx) can skip the board/class/subject-text ->
// codes translation entirely, instead of forcing everything through
// resolveDashboardAcademicFilters's free-text matching.
export const getDashboardCatalogForCodes = async ({ examGoalCode, levelCode, subjectCode }) => {
  const [chapterRowsResult, continueCardResult] = await Promise.all([
    pool.query(
      `
        SELECT *
        FROM (
          SELECT DISTINCT ON (chapter_number)
            chapter_number AS "chapterNumber",
            chapter_name AS "chapterName",
            chapter_display_order AS "displayOrder"
          FROM mv_chapter_catalog
          WHERE exam_goal_code = $1
            AND level_code = $2
            AND subject_code = $3
            AND book_is_active = TRUE
            AND chapter_is_active = TRUE
          ORDER BY chapter_number, chapter_display_order ASC
        ) AS chapter_rows
        ORDER BY "displayOrder" ASC, "chapterNumber" ASC
        LIMIT 12
      `,
      [examGoalCode, levelCode, subjectCode]
    ),
    pool.query(
      `
        SELECT
          chapter_name AS "chapterName",
          chapter_number AS "chapterNumber",
          section_number AS "sectionNumber",
          topic_name AS "topicName",
          chapter_display_order AS "displayOrder"
        FROM mv_chapter_catalog
        WHERE exam_goal_code = $1
          AND level_code = $2
          AND subject_code = $3
          AND book_is_active = TRUE
          AND chapter_is_active = TRUE
        ORDER BY chapter_display_order ASC, chapter_number ASC, section_number ASC, chapter_id ASC
        LIMIT 1
      `,
      [examGoalCode, levelCode, subjectCode]
    ),
  ]);

  const chapters = chapterRowsResult.rows.map((row, index) => ({
    id: index + 1,
    title: row.chapterName,
    progress: 0,
    chapterNumber: row.chapterNumber,
  }));

  const firstRow = continueCardResult.rows[0];
  const continueCard = firstRow
    ? {
        eyebrow: "Continue Learning",
        title: firstRow.chapterName,
        section: firstRow.sectionNumber || `Chapter ${firstRow.chapterNumber}`,
        concept: firstRow.topicName || firstRow.chapterName,
        progress: 0,
      }
    : null;

  return {
    continueCard,
    chapters,
  };
};

export const getDashboardCatalogForUser = async ({ board, studentClass, subject }) => {
  const { examGoalCode, levelCode, subjectCode, isValid } = await resolveDashboardAcademicFilters({
    board,
    studentClass,
    subject,
  });

  if (!isValid) {
    return {
      continueCard: null,
      chapters: [],
    };
  }

  return getDashboardCatalogForCodes({ examGoalCode, levelCode, subjectCode });
};

// Powers the class/subject switcher on StudentClassSubjectSwitcher.jsx /
// StudentChaptersPage.jsx -- every (exam goal, level, subject) combination
// that has at least one active chapter. Callers pass the requesting
// student's own resolved examGoalCode/levelCode/subjectCode (see
// resolveDashboardAcademicFilters below) to scope the list to just their
// registration; omitting the filter returns every combo, which
// userRoutes.js only does for callers with no resolvable profile of their
// own (e.g. moderators), who need cross-class visibility.
export const listClassSubjectOptionsWithContent = async ({ examGoalCode, levelCode, subjectCode } = {}) => {
  const values = [];
  let scopeClause = "";
  if (examGoalCode && levelCode && subjectCode) {
    values.push(examGoalCode, levelCode, subjectCode);
    scopeClause = "AND exam_goal_code = $1 AND level_code = $2 AND subject_code = $3";
  }

  const result = await pool.query(
    `SELECT DISTINCT
      exam_goal_code AS "examGoalCode",
      exam_goal_name AS "examGoalName",
      level_code AS "levelCode",
      level_name AS "levelName",
      subject_code AS "subjectCode",
      subject_name AS "subjectName"
    FROM mv_chapter_catalog
    WHERE book_is_active = TRUE AND chapter_is_active = TRUE ${scopeClause}
    ORDER BY level_name ASC, subject_name ASC`,
    values
  );
  return result.rows;
};
