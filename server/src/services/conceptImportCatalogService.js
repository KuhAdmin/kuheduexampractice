// Resolves an admin JSON upload's root metadata (board/classNum/subject/book/
// chapterNum/chapterName/sectionNo/sectionName -- see AdminConceptImportPage.jsx
// and conceptImportService.js) into a real fk_mst_chapter_id/source_section_id,
// auto-creating whatever master-data rows (mst_exam_goal/mst_level/
// mst_subject/mst_book/mst_chapter) don't exist yet. This is what lets
// imported content land in the same mv_chapter_catalog-backed
// chapters->sections flow every student uses (studentContentService.js's
// listSectionsForChapter).
//
// Unlike the admin Books/Subjects/Levels/ExamGoals pages (bookService.js etc,
// which only ever create what an admin explicitly submits via a form), this
// auto-creates on a best-effort basis from upload metadata -- a typo'd
// chapterName or an unexpected board string will happily create a new row
// rather than fail the import. That trade-off (bulk-onboarding convenience
// over strict curation) was a deliberate choice for this import path; the
// admin master-data pages remain the place to fix anything it gets wrong.
import { pool } from "../db/pool.js";

const normalize = (value) => String(value ?? "").trim();

const slugCode = (value, maxLength) => {
  const cleaned = normalize(value).toUpperCase().replace(/[^A-Z0-9]+/g, "");
  return (cleaned || "X").slice(0, maxLength);
};

// Some source content tags its subject with a trailing grade-band range
// ("English 6-8", "Science 6-10") rather than a plain subject name -- that
// range describes which classes the material spans, not the subject itself,
// so it's dropped before matching/creating mst_subject. classNum already
// carries the specific class for mst_level, so no information is lost.
const stripTrailingGradeRange = (value) => normalize(value).replace(/\s+\d+\s*-\s*\d+\s*$/, "").trim();

const nextDisplayOrder = async (table, whereClause = "", params = []) => {
  const result = await pool.query(
    `SELECT COALESCE(MAX(display_order), -1) AS max_order FROM ${table} ${whereClause}`,
    params
  );
  return Number(result.rows[0].max_order) + 1;
};

// mst_exam_goal.board_code is what resolveDashboardAcademicFilters
// (catalogService.js) matches a student's board against -- an exam goal
// created any other way would be invisible to the student-facing flow no
// matter how correctly mst_book/mst_chapter are wired up.
const resolveOrCreateExamGoal = async (board) => {
  const existing = await pool.query(
    "SELECT id, goal_id FROM mst_exam_goal WHERE lower(board_code) = lower($1) LIMIT 1",
    [board]
  );
  if (existing.rows[0]) return existing.rows[0];

  const [examTypeResult, stateResult] = await Promise.all([
    pool.query("SELECT id FROM mst_exam_type WHERE type_id = 'BRD' LIMIT 1"),
    pool.query("SELECT id FROM mst_state ORDER BY id ASC LIMIT 1"),
  ]);
  if (!examTypeResult.rows[0] || !stateResult.rows[0]) {
    throw new Error("Cannot auto-create an exam goal: mst_exam_type/mst_state has no rows.");
  }

  const baseCode = slugCode(board, 40);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const goalId = attempt === 0 ? baseCode : `${baseCode}${attempt + 1}`.slice(0, 40);
    try {
      const result = await pool.query(
        `
          INSERT INTO mst_exam_goal (goal_id, name, board_code, fk_mst_exam_type_id, fk_state_id, is_active)
          VALUES ($1, $2, $3, $4, $5, TRUE)
          RETURNING id, goal_id
        `,
        [goalId, board, board, examTypeResult.rows[0].id, stateResult.rows[0].id]
      );
      return result.rows[0];
    } catch (error) {
      if (error.code !== "23505") throw error;
    }
  }
  throw new Error(`Could not generate a unique exam goal code for board "${board}".`);
};

const resolveOrCreateLevel = async (classNum) => {
  const nameCode = normalize(classNum);
  const existing = await pool.query("SELECT id FROM mst_level WHERE name_code = $1 LIMIT 1", [nameCode]);
  if (existing.rows[0]) return existing.rows[0].id;

  const displayOrder = await nextDisplayOrder("mst_level");
  const result = await pool.query(
    `INSERT INTO mst_level (name_code, name, display_order) VALUES ($1, $2, $3) RETURNING id`,
    [nameCode, `Class ${nameCode}`, displayOrder]
  );
  return result.rows[0].id;
};

const resolveOrCreateSubject = async (subjectName) => {
  const existing = await pool.query(
    "SELECT id, name_code FROM mst_subject WHERE lower(name) = lower($1) LIMIT 1",
    [subjectName]
  );
  if (existing.rows[0]) return existing.rows[0];

  const baseCode = slugCode(subjectName, 20);
  const displayOrder = await nextDisplayOrder("mst_subject");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const nameCode = attempt === 0 ? baseCode : `${baseCode}${attempt + 1}`.slice(0, 20);
    try {
      const result = await pool.query(
        `
          INSERT INTO mst_subject (name_code, name, display_order, is_active)
          VALUES ($1, $2, $3, TRUE)
          RETURNING id, name_code
        `,
        [nameCode, subjectName, displayOrder]
      );
      return result.rows[0];
    } catch (error) {
      if (error.code !== "23505") throw error;
    }
  }
  throw new Error(`Could not generate a unique subject code for "${subjectName}".`);
};

// mst_book's unique key is (name_code, level, exam_goal), not subject -- but
// this app's model is one book per subject+level+goal (see the seed data's
// Part-I/Part-II split, which differs by name_code, not subject), so lookup
// is by subject+level+goal even though the DB would technically allow more.
const resolveOrCreateBook = async ({ subjectId, levelId, examGoalId, subjectName, bookLabel }) => {
  const existing = await pool.query(
    `
      SELECT id FROM mst_book
      WHERE fk_mst_subject_id = $1 AND fk_mst_level_id = $2 AND fk_mst_exam_goal_id = $3
      LIMIT 1
    `,
    [subjectId, levelId, examGoalId]
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const name = `${bookLabel} ${subjectName}`.trim();
  const baseCode = slugCode(`${bookLabel}_${subjectName}`, 40);
  const displayOrder = await nextDisplayOrder("mst_book");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const nameCode = attempt === 0 ? baseCode : `${baseCode}${attempt + 1}`.slice(0, 40);
    try {
      const result = await pool.query(
        `
          INSERT INTO mst_book (name_code, name, fk_mst_subject_id, fk_mst_level_id, fk_mst_exam_goal_id, display_order, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, TRUE)
          RETURNING id
        `,
        [nameCode, name, subjectId, levelId, examGoalId, displayOrder]
      );
      return result.rows[0].id;
    } catch (error) {
      if (error.code !== "23505") throw error;
    }
  }
  throw new Error(`Could not generate a unique book code for "${name}".`);
};

// Matches mst_chapter's own unique constraint exactly (fk_mst_book_id,
// chapter_number, section_number, topic_name), so re-importing the same file
// resolves back to the same row instead of accumulating duplicates.
const resolveOrCreateChapter = async ({ bookId, chapterNum, chapterName, sectionNo, sectionName }) => {
  const existing = await pool.query(
    `
      SELECT id FROM mst_chapter
      WHERE fk_mst_book_id = $1 AND chapter_number = $2 AND section_number = $3 AND topic_name = $4
      LIMIT 1
    `,
    [bookId, chapterNum, sectionNo, sectionName]
  );
  if (existing.rows[0]) return { id: existing.rows[0].id, created: false };

  const displayOrder = await nextDisplayOrder("mst_chapter", "WHERE fk_mst_book_id = $1", [bookId]);
  const result = await pool.query(
    `
      INSERT INTO mst_chapter (chapter_number, chapter_name, section_number, topic_name, display_order, fk_mst_book_id, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE)
      RETURNING id
    `,
    [chapterNum, chapterName, sectionNo, sectionName, displayOrder, bookId]
  );
  return { id: result.rows[0].id, created: true };
};

// Mirrors assessmentStudioService.js's createSourceRecords: one source_document
// per (board/class/subject/book/chapter), upserted by document_code, with one
// source_section per section hanging off it. section_code follows the same
// "${bookId}:${chapterNumber}:${sectionNumber}" convention studentContentService.js's
// resolveMostRecentSourceSectionId depends on to find a chapter's sections.
const resolveOrCreateSourceSection = async ({
  bookId,
  chapterId,
  chapterNum,
  chapterName,
  sectionNo,
  sectionName,
  board,
  classNum,
  subjectName,
  bookLabel,
  userId,
}) => {
  const documentCode = [
    "IMPORT",
    slugCode(board, 20),
    slugCode(classNum, 10),
    slugCode(subjectName, 20),
    slugCode(bookLabel, 15),
    slugCode(chapterNum, 10),
  ]
    .join(":")
    .slice(0, 80);
  const documentTitle = `${subjectName} | Class ${classNum} | ${chapterName}`;

  const sourceDocumentResult = await pool.query(
    `
      INSERT INTO source_document (
        document_code, title, source_type, board_name, class_name, subject_name, chapter_name,
        owner_user_id, review_status
      )
      VALUES ($1, $2, 'admin_concept_import', $3, $4, $5, $6, $7, 'draft')
      ON CONFLICT (document_code) DO UPDATE
      SET title = EXCLUDED.title,
          board_name = EXCLUDED.board_name,
          class_name = EXCLUDED.class_name,
          subject_name = EXCLUDED.subject_name,
          chapter_name = EXCLUDED.chapter_name,
          updated_at = NOW()
      RETURNING id
    `,
    [documentCode, documentTitle, board, String(classNum), subjectName, chapterName, userId]
  );
  const sourceDocumentId = sourceDocumentResult.rows[0].id;
  const sectionCode = `${bookId}:${chapterNum}:${sectionNo}`;

  const sourceSectionResult = await pool.query(
    `
      INSERT INTO source_section (source_document_id, fk_mst_chapter_id, section_code, section_number, title, review_status)
      VALUES ($1, $2, $3, $4, $5, 'draft')
      ON CONFLICT (source_document_id, section_code) DO UPDATE
      SET fk_mst_chapter_id = EXCLUDED.fk_mst_chapter_id,
          section_number = EXCLUDED.section_number,
          title = EXCLUDED.title,
          updated_at = NOW()
      RETURNING id
    `,
    [sourceDocumentId, chapterId, sectionCode, sectionNo, sectionName]
  );

  return sourceSectionResult.rows[0].id;
};

// Returns null (rather than throwing) when the metadata is too incomplete to
// resolve confidently -- callers should fall back to the demo_*_label path in
// that case. Once resolution starts, missing seed data (mst_exam_type 'BRD',
// mst_state) is a real error and throws, since that indicates a broken
// database rather than a malformed upload.
export const resolveOrCreateCatalogTarget = async ({
  board,
  classNum,
  subject,
  book,
  chapterNum,
  chapterName,
  sectionNo,
  sectionName,
  userId,
}) => {
  const boardText = normalize(board);
  const classText = normalize(classNum);
  const subjectText = stripTrailingGradeRange(subject);
  const bookText = normalize(book) || "Book";
  const chapterNumText = normalize(chapterNum);
  const chapterNameText = normalize(chapterName);
  const sectionNoText = normalize(sectionNo);
  const sectionNameText = normalize(sectionName);

  if (
    !boardText ||
    !classText ||
    !subjectText ||
    !chapterNumText ||
    !chapterNameText ||
    !sectionNoText ||
    !sectionNameText
  ) {
    return null;
  }

  const examGoal = await resolveOrCreateExamGoal(boardText);
  const levelId = await resolveOrCreateLevel(classText);
  const subjectRow = await resolveOrCreateSubject(subjectText);
  const bookId = await resolveOrCreateBook({
    subjectId: subjectRow.id,
    levelId,
    examGoalId: examGoal.id,
    subjectName: subjectText,
    bookLabel: bookText,
  });
  const chapter = await resolveOrCreateChapter({
    bookId,
    chapterNum: chapterNumText,
    chapterName: chapterNameText,
    sectionNo: sectionNoText,
    sectionName: sectionNameText,
  });
  const sourceSectionId = await resolveOrCreateSourceSection({
    bookId,
    chapterId: chapter.id,
    chapterNum: chapterNumText,
    chapterName: chapterNameText,
    sectionNo: sectionNoText,
    sectionName: sectionNameText,
    board: boardText,
    classNum: classText,
    subjectName: subjectText,
    bookLabel: bookText,
    userId,
  });

  if (chapter.created) {
    // Best-effort: mv_chapter_catalog is otherwise only refreshed on server
    // startup (db/bootstrap.js), so without this a newly-created chapter
    // would be invisible to students (missing from the class/subject
    // picker, listClassSubjectOptionsWithContent) until a restart. A
    // failure here (e.g. concurrent refresh already in progress) is
    // logged rather than silently swallowed -- a real production incident
    // was caused by this failing on every import with nothing in the logs
    // to explain why newly-imported content never showed up; it should
    // still self-heal on the next successful refresh (import or restart),
    // this is just so a *persistent* failure is actually diagnosable next
    // time instead of invisible.
    await pool.query("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_chapter_catalog").catch((error) => {
      console.error("Failed to refresh mv_chapter_catalog after concept import:", error);
    });
  }

  return { fkMstChapterId: chapter.id, sourceSectionId };
};
