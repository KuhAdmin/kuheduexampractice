import { pool } from "../db/pool.js";
import { listBooks } from "./bookService.js";
import { refreshChapterCatalogView } from "./catalogService.js";

// Mirrors the identical (unexported) helper in studentPracticeService.js --
// copied locally rather than cross-importing a private helper from an
// unrelated service.
const withTransaction = async (work) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

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
const emptyCount = () => ({ total: 0, visible: 0 });

const addCounts = (a, b) => ({ total: a.total + b.total, visible: a.visible + b.visible });

export const getContentTreeForBook = async (bookId) => {
  const result = await pool.query(
    `
      SELECT mc.id, mc.chapter_number, mc.section_number, mc.chapter_name, mc.topic_name,
             mc.is_hidden AS section_is_hidden,
             ss.id AS source_section_id,
             au.assessment_unit_id, au.primary_concept, au.is_hidden AS concept_is_hidden
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
  const sourceSectionIds = [];
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
        isHidden: row.section_is_hidden,
        concepts: [],
      });
      if (row.source_section_id) sourceSectionIds.push(row.source_section_id);
    }
    const section = chapter.sections.get(row.id);

    if (row.assessment_unit_id && !section.concepts.some((c) => c.assessmentUnitId === row.assessment_unit_id)) {
      section.concepts.push({
        assessmentUnitId: row.assessment_unit_id,
        primaryConcept: row.primary_concept,
        isHidden: row.concept_is_hidden,
      });
    }
  }

  // Two aggregate queries instead of joining content_card into the query
  // above -- that would fan out one row per card against this query's
  // per-concept shape. Root/section-scoped cards (no assessment_unit_id)
  // counted separately from concept-scoped ones, then summed in JS below.
  const [rootCounts, conceptCounts] = await Promise.all([
    pool.query(
      `
        SELECT source_section_id,
               COUNT(*) AS total_cards,
               COUNT(*) FILTER (WHERE is_hidden = FALSE) AS visible_cards
        FROM content_card
        WHERE source_section_id = ANY($1::bigint[])
        GROUP BY source_section_id
      `,
      [sourceSectionIds]
    ),
    pool.query(
      `
        SELECT au.source_section_id, cc.assessment_unit_id,
               COUNT(cc.id) AS total_cards,
               COUNT(cc.id) FILTER (WHERE cc.is_hidden = FALSE) AS visible_cards
        FROM assessment_unit au
        JOIN content_card cc ON cc.assessment_unit_id = au.assessment_unit_id
        WHERE au.source_section_id = ANY($1::bigint[])
        GROUP BY au.source_section_id, cc.assessment_unit_id
      `,
      [sourceSectionIds]
    ),
  ]);

  const rootCountBySection = new Map(
    rootCounts.rows.map((row) => [row.source_section_id, { total: Number(row.total_cards), visible: Number(row.visible_cards) }])
  );
  const countByConcept = new Map(
    conceptCounts.rows.map((row) => [row.assessment_unit_id, { total: Number(row.total_cards), visible: Number(row.visible_cards) }])
  );
  const conceptCountsBySection = new Map();
  for (const row of conceptCounts.rows) {
    const current = conceptCountsBySection.get(row.source_section_id) || emptyCount();
    conceptCountsBySection.set(
      row.source_section_id,
      addCounts(current, { total: Number(row.total_cards), visible: Number(row.visible_cards) })
    );
  }

  return Array.from(chaptersByNumber.values()).map((chapter) => ({
    chapterNumber: chapter.chapterNumber,
    chapterName: chapter.chapterName,
    sections: Array.from(chapter.sections.values()).map((section) => ({
      ...section,
      cardCount: addCounts(
        rootCountBySection.get(section.sourceSectionId) || emptyCount(),
        conceptCountsBySection.get(section.sourceSectionId) || emptyCount()
      ),
      concepts: section.concepts.map((concept) => ({
        ...concept,
        cardCount: countByConcept.get(concept.assessmentUnitId) || emptyCount(),
      })),
    })),
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

// Hides/shows every concept and every card (root + concept-scoped) under
// this section in one transaction -- bulk-writes content_card.is_hidden
// rather than teaching every one of the ~15 student-facing card reads
// about a separate section/concept-level flag, since is_hidden is already
// the one enforcement point every one of those reads checks. Accepted
// trade-off: un-hiding resets every card under the section to visible
// uniformly -- an individually-hidden card's own prior state isn't
// preserved through a parent hide/unhide cycle.
export const setSectionVisibility = ({ id, isHidden }) => {
  const hidden = Boolean(isHidden);
  return withTransaction(async (client) => {
    const sectionResult = await client.query(
      `
        SELECT mc.id, ss.id AS source_section_id
        FROM mst_chapter mc
        LEFT JOIN LATERAL (
          SELECT id
          FROM source_section
          WHERE section_code = mc.fk_mst_book_id::text || ':' || mc.chapter_number || ':' || mc.section_number
          ORDER BY created_at DESC, id DESC
          LIMIT 1
        ) ss ON TRUE
        WHERE mc.id = $1
        FOR UPDATE OF mc
      `,
      [id]
    );

    if (!sectionResult.rows[0]) {
      const error = new Error("Section not found.");
      error.statusCode = 404;
      throw error;
    }
    const { source_section_id: sourceSectionId } = sectionResult.rows[0];

    await client.query(`UPDATE mst_chapter SET is_hidden = $2 WHERE id = $1`, [id, hidden]);

    // No source_section resolved means no concepts/cards either (both key
    // off ss.id, same as getContentTreeForBook) -- skip cleanly.
    if (sourceSectionId) {
      await client.query(`UPDATE assessment_unit SET is_hidden = $2 WHERE source_section_id = $1`, [
        sourceSectionId,
        hidden,
      ]);

      // Root + concept-scoped cards in one statement -- identical OR-shape
      // to listContentCardsForSection's own membership query, so
      // "everything this page shows for the section" is exactly
      // "everything the cascade touches."
      await client.query(
        `
          UPDATE content_card
          SET is_hidden = $2
          WHERE source_section_id = $1
             OR assessment_unit_id IN (
                  SELECT assessment_unit_id FROM assessment_unit WHERE source_section_id = $1
                )
        `,
        [sourceSectionId, hidden]
      );
    }

    return { id, isHidden: hidden };
  });
};

// Concept-scoped cards only (no OR source_section_id clause) -- root/
// section-scoped cards aren't owned by any concept, so a concept-level
// hide doesn't touch them.
export const setConceptVisibility = ({ assessmentUnitId, isHidden }) => {
  const hidden = Boolean(isHidden);
  return withTransaction(async (client) => {
    const parentResult = await client.query(
      `
        SELECT au.assessment_unit_id, mc.is_hidden AS section_is_hidden
        FROM assessment_unit au
        LEFT JOIN source_section ss ON ss.id = au.source_section_id
        LEFT JOIN mst_chapter mc
          ON mc.fk_mst_book_id::text || ':' || mc.chapter_number || ':' || mc.section_number = ss.section_code
        WHERE au.assessment_unit_id = $1
        ORDER BY mc.id ASC
        LIMIT 1
        FOR UPDATE OF au
      `,
      [assessmentUnitId]
    );

    if (!parentResult.rows[0]) {
      const error = new Error("Concept not found.");
      error.statusCode = 404;
      throw error;
    }

    // Race-safe against a concurrent section-hide: this check and the
    // write below run in the same transaction against a row-locked `au`,
    // and setSectionVisibility's own cascade UPDATE against assessment_unit
    // blocks on that same lock until this transaction commits/rolls back.
    if (!hidden && parentResult.rows[0].section_is_hidden) {
      const error = new Error("This concept's section is hidden. Un-hide the section first.");
      error.statusCode = 409;
      throw error;
    }

    await client.query(`UPDATE assessment_unit SET is_hidden = $2 WHERE assessment_unit_id = $1`, [
      assessmentUnitId,
      hidden,
    ]);
    await client.query(`UPDATE content_card SET is_hidden = $2 WHERE assessment_unit_id = $1`, [
      assessmentUnitId,
      hidden,
    ]);

    return { assessmentUnitId, isHidden: hidden };
  });
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

// Same "children's toggle state cannot be changed until the parent is on"
// rule setConceptVisibility enforces, one level down -- without this, a
// request that bypasses the (disabled-in-the-UI) per-card Hide/Show
// button could un-hide one card while its concept or section stays
// flagged hidden, leaving it visible to students despite its owning
// concept/section saying otherwise. Only checked when un-hiding; hiding a
// card is always allowed regardless of ancestor state.
const assertCardAncestryVisible = async (id) => {
  const result = await pool.query(
    `
      SELECT COALESCE(mc.is_hidden, FALSE) AS section_is_hidden,
             COALESCE(au.is_hidden, FALSE) AS concept_is_hidden
      FROM content_card cc
      LEFT JOIN assessment_unit au ON au.assessment_unit_id = cc.assessment_unit_id
      LEFT JOIN source_section ss ON ss.id = COALESCE(cc.source_section_id, au.source_section_id)
      LEFT JOIN mst_chapter mc
        ON mc.fk_mst_book_id::text || ':' || mc.chapter_number || ':' || mc.section_number = ss.section_code
      WHERE cc.id = $1
      ORDER BY mc.id ASC
      LIMIT 1
    `,
    [id]
  );

  const ancestry = result.rows[0];
  if (ancestry?.section_is_hidden || ancestry?.concept_is_hidden) {
    const error = new Error(
      ancestry.section_is_hidden
        ? "This card's section is hidden. Un-hide the section first."
        : "This card's concept is hidden. Un-hide the concept first."
    );
    error.statusCode = 409;
    throw error;
  }
};

export const updateContentCard = async (id, { title, summary, details, isHidden }) => {
  if (isHidden === false) {
    await assertCardAncestryVisible(id);
  }

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
