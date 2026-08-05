import { pool } from "../db/pool.js";
import { listBooks } from "./bookService.js";

// Book picker reuses the existing admin Books listing verbatim -- no reason
// to duplicate that query here.
export const listBooksForPicker = () => listBooks();

// Each mst_chapter row already IS one chapter+section pair (see
// conceptImportCatalogService.js's resolveOrCreateChapter) -- so "pick a
// chapter" and "pick a section" collapse into one selection step here,
// matching how content actually gets imported, rather than inventing an
// extra picker level. source_section_id (needed by listContentCardsForSection
// below) is resolved via section_code ("${bookId}:${chapterNumber}:${sectionNumber}"),
// NOT source_section.fk_mst_chapter_id -- that column is set imprecisely by
// the import pipeline and can point at a sibling section's chapter row (see
// the identical section_code resolution in studentContentService.js's
// resolveMostRecentSourceSectionId / studentDashboardService.js).
export const listChaptersForBook = async (bookId) => {
  const result = await pool.query(
    `
      SELECT mc.id, mc.chapter_number, mc.section_number, mc.chapter_name, mc.topic_name,
             ss.id AS source_section_id
      FROM mst_chapter mc
      LEFT JOIN LATERAL (
        SELECT id
        FROM source_section
        WHERE section_code = mc.fk_mst_book_id::text || ':' || mc.chapter_number || ':' || mc.section_number
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      ) ss ON TRUE
      WHERE mc.fk_mst_book_id = $1 AND mc.is_active = TRUE
      ORDER BY mc.chapter_number ASC, mc.section_number ASC
    `,
    [bookId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    chapterNumber: row.chapter_number,
    sectionNumber: row.section_number,
    chapterName: row.chapter_name,
    topicName: row.topic_name,
    sourceSectionId: row.source_section_id,
  }));
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
