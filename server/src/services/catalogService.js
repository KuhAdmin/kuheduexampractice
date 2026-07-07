import { pool } from "../db/pool.js";

const examGoalCodeByBoard = {
  cbse: "AISSCE",
};

const subjectCodeByUserSubject = {
  biology: "BIO",
  physics: "PHY",
  chemistry: "CHM",
  mathematics: "MAT",
  math: "MAT",
};

export const resolveDashboardAcademicFilters = ({ board, studentClass, subject }) => {
  const examGoalCode = examGoalCodeByBoard[String(board || "").trim().toLowerCase()];
  const levelCode = String(studentClass || "").trim();
  const subjectCode = subjectCodeByUserSubject[String(subject || "").trim().toLowerCase()];

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

const buildAssessmentStudioFilters = ({ levelCode, subjectCode, chapterKey }) => {
  const conditions = [`exam_goal_code = 'AISSCE'`, `book_is_active = TRUE`, `chapter_is_active = TRUE`];
  const values = [];

  if (levelCode) {
    values.push(levelCode);
    conditions.push(`level_code = $${values.length}`);
  }

  if (subjectCode) {
    values.push(subjectCode);
    conditions.push(`subject_code = $${values.length}`);
  }

  let selectedBookId;
  let selectedChapterNumber;

  if (chapterKey) {
    [selectedBookId, selectedChapterNumber] = chapterKey.split(":");
    if (selectedBookId) {
      values.push(selectedBookId);
      conditions.push(`book_id = $${values.length}`);
    }
    if (selectedChapterNumber) {
      values.push(selectedChapterNumber);
      conditions.push(`chapter_number = $${values.length}`);
    }
  }

  return {
    whereClause: `WHERE ${conditions.join(" AND ")}`,
    values,
  };
};

export const getAssessmentStudioBootstrap = async ({ levelCode }) => {
  const [levelsResult, subjectsResult, practiceTypesResult] = await Promise.all([
    pool.query(
      `
        SELECT DISTINCT level_code AS code, level_name AS name, level_id AS id
        FROM mv_chapter_catalog
        WHERE exam_goal_code = 'AISSCE' AND book_is_active = TRUE AND chapter_is_active = TRUE
        ORDER BY level_code ASC
      `
    ),
    pool.query(
      `
        SELECT DISTINCT subject_code AS code, subject_name AS name, subject_id AS id
        FROM mv_chapter_catalog
        WHERE exam_goal_code = 'AISSCE'
          AND book_is_active = TRUE
          AND chapter_is_active = TRUE
          ${levelCode ? "AND level_code = $1" : ""}
        ORDER BY subject_name ASC
      `,
      levelCode ? [levelCode] : []
    ),
    pool.query(
      `
        SELECT id, name_code AS code, name, display_order AS "displayOrder"
        FROM mst_practice_type
        WHERE is_active = TRUE
        ORDER BY display_order ASC, name ASC
      `
    ),
  ]);

  return {
    boards: [{ code: "CBSE", name: "CBSE" }],
    levels: levelsResult.rows,
    subjects: subjectsResult.rows,
    practiceTypes: practiceTypesResult.rows,
  };
};

const DEFAULT_COMPLETION_LAYER_NUMBER = 7;

const getCompletedSectionKeySet = async (targetLayerNumber = DEFAULT_COMPLETION_LAYER_NUMBER) => {
  const result = await pool.query(
    `
      SELECT DISTINCT
        apr.request_payload->>'chapterKey' AS chapter_key,
        apr.request_payload->>'sectionNumber' AS section_number
      FROM assessment_pipeline_run apr
      JOIN assessment_pipeline_run_layer aprl ON aprl.job_id = apr.job_id
      WHERE apr.status = 'completed'
        AND aprl.layer_number = $1
        AND aprl.status = 'completed'
    `,
    [targetLayerNumber]
  );

  return new Set(
    result.rows
      .filter((row) => row.chapter_key && row.section_number)
      .map((row) => `${row.chapter_key}|${row.section_number}`)
  );
};

export const getAssessmentStudioChapters = async ({
  levelCode,
  subjectCode,
  excludeCompleted,
  targetLayerNumber,
}) => {
  const chapterFilters = buildAssessmentStudioFilters({ levelCode, subjectCode });
  const result = await pool.query(
    `
      SELECT *
      FROM (
        SELECT DISTINCT ON (book_id, chapter_number)
          CONCAT(book_id::text, ':', chapter_number) AS key,
          book_id AS "bookId",
          book_code AS "bookCode",
          book_name AS "bookName",
          chapter_number AS "chapterNumber",
          chapter_name AS "chapterName",
          chapter_display_order AS "displayOrder"
        FROM mv_chapter_catalog
        ${chapterFilters.whereClause}
        ORDER BY book_id, chapter_number, chapter_display_order ASC
      ) AS chapter_options
      ORDER BY "displayOrder" ASC, "chapterNumber" ASC
    `,
    chapterFilters.values
  );

  let chapters = result.rows;

  if (chapters.length > 0) {
    const completedSectionKeys = await getCompletedSectionKeySet(targetLayerNumber);
    const chapterSectionLists = await Promise.all(
      chapters.map((chapter) =>
        getAssessmentStudioSections({ levelCode, subjectCode, chapterKey: chapter.key })
      )
    );

    chapters = chapters.map((chapter, index) => {
      const sections = chapterSectionLists[index]?.sections || [];
      const totalSections = sections.length;
      const completedSections = sections.filter((section) =>
        completedSectionKeys.has(`${chapter.key}|${section.sectionNumber}`)
      ).length;

      return {
        ...chapter,
        totalSections,
        completedSections,
        isFullyGenerated: totalSections > 0 && completedSections === totalSections,
      };
    });

    if (excludeCompleted) {
      chapters = chapters.filter((chapter) => !chapter.isFullyGenerated);
    }
  }

  return {
    chapters,
    resolvedChapterKey: chapters[0]?.key || "",
  };
};

export const getAssessmentStudioSections = async ({
  levelCode,
  subjectCode,
  chapterKey,
  targetLayerNumber,
}) => {
  if (!chapterKey) {
    return { sections: [] };
  }

  const sectionFilters = buildAssessmentStudioFilters({
    levelCode,
    subjectCode,
    chapterKey,
  });

  const result = await pool.query(
    `
      SELECT *
      FROM (
        SELECT DISTINCT ON (section_number)
          section_number AS "sectionNumber",
          topic_name AS "topicName",
          chapter_display_order AS "displayOrder"
        FROM mv_chapter_catalog
        ${sectionFilters.whereClause}
        ORDER BY section_number, chapter_display_order ASC
      ) AS section_options
      ORDER BY "displayOrder" ASC, "sectionNumber" ASC
    `,
    sectionFilters.values
  );

  if (targetLayerNumber === undefined) {
    return { sections: result.rows };
  }

  const completedSectionKeys = await getCompletedSectionKeySet(targetLayerNumber);

  return {
    sections: result.rows.map((section) => ({
      ...section,
      completed: completedSectionKeys.has(`${chapterKey}|${section.sectionNumber}`),
    })),
  };
};

export const getDashboardCatalogForUser = async ({ board, studentClass, subject }) => {
  const { examGoalCode, levelCode, subjectCode, isValid } = resolveDashboardAcademicFilters({
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
