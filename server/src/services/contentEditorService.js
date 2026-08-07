import { pool } from "../db/pool.js";
import { listBooks } from "./bookService.js";
import { refreshChapterCatalogView } from "./catalogService.js";

// Book picker reuses the existing admin Books listing verbatim -- no reason
// to duplicate that query here.
export const listBooksForPicker = () => listBooks();

// Each mst_chapter row already IS one chapter+section pair (see
// conceptImportCatalogService.js's resolveOrCreateChapter) -- so a book's
// tree is built by grouping these flat rows by chapter_number (Chapter
// level), then listing each row as one Section, then each section's
// assessment_units as its Concepts. source_section_id (needed by
// listContentCardsForSection below) is resolved via section_code
// ("${bookId}:${chapterNumber}:${sectionNumber}"), NOT
// source_section.fk_mst_chapter_id -- that column is set imprecisely by
// the import pipeline and can point at a sibling section's chapter row (see
// the identical section_code resolution in studentContentService.js's
// resolveMostRecentSourceSectionId / studentDashboardService.js).
export const getContentTreeForBook = async (bookId) => {
  const result = await pool.query(
    `
      SELECT mc.id, mc.chapter_number, mc.section_number, mc.chapter_name, mc.topic_name,
             ss.id AS source_section_id,
             au.assessment_unit_id, au.primary_concept
      FROM mst_chapter mc
      LEFT JOIN LATERAL (
        SELECT id
        FROM source_section
        WHERE section_code = mc.fk_mst_book_id::text || ':' || mc.chapter_number || ':' || mc.section_number
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      ) ss ON TRUE
      LEFT JOIN assessment_unit au ON au.source_section_id = ss.id AND au.is_active = TRUE
      WHERE mc.fk_mst_book_id = $1 AND mc.is_active = TRUE
      ORDER BY mc.chapter_number ASC, mc.section_number ASC, au.primary_concept ASC NULLS LAST
    `,
    [bookId]
  );

  const chaptersByNumber = new Map();
  for (const row of result.rows) {
    if (!chaptersByNumber.has(row.chapter_number)) {
      chaptersByNumber.set(row.chapter_number, {
        chapterNumber: row.chapter_number,
        chapterName: row.chapter_name,
        sections: new Map(),
      });
    }
    const chapter = chaptersByNumber.get(row.chapter_number);

    if (!chapter.sections.has(row.id)) {
      chapter.sections.set(row.id, {
        id: row.id,
        sectionNumber: row.section_number,
        topicName: row.topic_name,
        sourceSectionId: row.source_section_id,
        concepts: [],
      });
    }
    const section = chapter.sections.get(row.id);

    if (row.assessment_unit_id && !section.concepts.some((c) => c.assessmentUnitId === row.assessment_unit_id)) {
      section.concepts.push({
        assessmentUnitId: row.assessment_unit_id,
        primaryConcept: row.primary_concept,
      });
    }
  }

  return Array.from(chaptersByNumber.values()).map((chapter) => ({
    chapterNumber: chapter.chapterNumber,
    chapterName: chapter.chapterName,
    sections: Array.from(chapter.sections.values()),
  }));
};

const validateName = (value, label) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    const error = new Error(`${label} is required.`);
    error.statusCode = 400;
    throw error;
  }
  if (trimmed.length > 255) {
    const error = new Error(`${label} must be 255 characters or fewer.`);
    error.statusCode = 400;
    throw error;
  }
  return trimmed;
};

// Updates every mst_chapter row sharing this chapter_number together --
// there's no separate "chapter" entity to update once (see the comment
// above), so keeping every section's chapter_name in sync is what "rename
// the chapter" has to mean here.
export const renameChapter = async ({ bookId, chapterNumber, chapterName }) => {
  const trimmed = validateName(chapterName, "Chapter name");
  const result = await pool.query(
    `UPDATE mst_chapter SET chapter_name = $3 WHERE fk_mst_book_id = $1 AND chapter_number = $2 RETURNING id`,
    [bookId, chapterNumber, trimmed]
  );

  if (result.rows.length === 0) {
    const error = new Error("Chapter not found.");
    error.statusCode = 404;
    throw error;
  }

  await refreshChapterCatalogView();
  return { chapterNumber, chapterName: trimmed };
};

export const renameSection = async ({ id, topicName }) => {
  const trimmed = validateName(topicName, "Section name");

  let result;
  try {
    result = await pool.query(
      `UPDATE mst_chapter SET topic_name = $2 WHERE id = $1 RETURNING id, topic_name`,
      [id, trimmed]
    );
  } catch (error) {
    if (error.code === "23505") {
      const duplicateError = new Error("A section with this name already exists in this chapter.");
      duplicateError.statusCode = 409;
      throw duplicateError;
    }
    throw error;
  }

  if (!result.rows[0]) {
    const error = new Error("Section not found.");
    error.statusCode = 404;
    throw error;
  }

  await refreshChapterCatalogView();
  return { id: result.rows[0].id, topicName: result.rows[0].topic_name };
};

// No mv_chapter_catalog refresh needed -- that view only denormalizes
// mst_chapter/mst_book data, nothing joins assessment_unit into it, so
// every read of primary_concept (student and admin) already goes straight
// to this table live.
export const renameConcept = async ({ assessmentUnitId, primaryConcept }) => {
  const trimmed = validateName(primaryConcept, "Concept name");
  const result = await pool.query(
    `UPDATE assessment_unit SET primary_concept = $2 WHERE assessment_unit_id = $1 RETURNING assessment_unit_id, primary_concept`,
    [assessmentUnitId, trimmed]
  );

  if (!result.rows[0]) {
    const error = new Error("Concept not found.");
    error.statusCode = 404;
    throw error;
  }

  return { assessmentUnitId: result.rows[0].assessment_unit_id, primaryConcept: result.rows[0].primary_concept };
};

// Every content_card for a section -- both section-scoped root cards
// (pdfassets/visual/textbook/learningpillars, source_section_id set directly)
// and concept-scoped cards (teaching/assessment/revision/tutor/deeplearning/
// extraction, reached via their assessment_unit's source_section_id) -- so
// the editor shows everything imported for this section in one list,
// deliberately UNFILTERED by is_hidden (a moderator must be able to see and
// re-show a card they already hid, unlike every student-facing read path).
export const listContentCardsForSection = async (sourceSectionId) => {
  const result = await pool.query(
    `
      SELECT cc.id, cc.assessment_unit_id, cc.source_section_id, cc.content_key,
             cc.contentuitab, cc.processorkey, cc.parent_cardkey, cc.cardkey,
             cc.sort_order, cc.title, cc.summary, cc.details, cc.is_hidden,
             au.primary_concept
      FROM content_card cc
      LEFT JOIN assessment_unit au ON au.assessment_unit_id = cc.assessment_unit_id
      WHERE cc.source_section_id = $1
         OR cc.assessment_unit_id IN (
              SELECT assessment_unit_id FROM assessment_unit WHERE source_section_id = $1
            )
      ORDER BY au.primary_concept ASC NULLS FIRST, cc.contentuitab ASC, cc.sort_order ASC, cc.id ASC
    `,
    [sourceSectionId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    assessmentUnitId: row.assessment_unit_id,
    sourceSectionId: row.source_section_id,
    contentKey: row.content_key,
    contentuitab: row.contentuitab,
    processorkey: row.processorkey,
    parentCardkey: row.parent_cardkey,
    cardkey: row.cardkey,
    title: row.title,
    summary: row.summary,
    details: row.details,
    isHidden: row.is_hidden,
    primaryConcept: row.primary_concept,
  }));
};

export const updateContentCard = async (id, { title, summary, details, isHidden }) => {
  const result = await pool.query(
    `
      UPDATE content_card
      SET title = $2, summary = $3, details = $4, is_hidden = $5
      WHERE id = $1
      RETURNING id, title, summary, details, is_hidden
    `,
    [id, title ?? null, summary ?? null, JSON.stringify(details ?? []), Boolean(isHidden)]
  );

  if (!result.rows[0]) {
    const error = new Error("Content card not found.");
    error.statusCode = 404;
    throw error;
  }

  return {
    id: result.rows[0].id,
    title: result.rows[0].title,
    summary: result.rows[0].summary,
    details: result.rows[0].details,
    isHidden: result.rows[0].is_hidden,
  };
};
