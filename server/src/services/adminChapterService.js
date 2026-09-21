// The "Chapters" inventory under Admin -> Masters: a lightweight, book-scoped
// CRUD layer for mst_chapter that only the Content Editor previously touched
// (rename/delete). This adds the one thing that was missing there -- CREATE
// -- plus active/hidden toggles, at the top chapter level only. A "logical
// chapter" is really every mst_chapter row sharing (fk_mst_book_id,
// chapter_number) -- see contentEditorService.js's renameChapter/deleteChapter,
// which this deliberately does NOT duplicate; rename/delete/deletion-preview
// stay there and are called by the client directly.
import { pool } from "../db/pool.js";
import { refreshChapterCatalogView } from "./catalogService.js";

// Mirrors the identical (unexported) helper in conceptImportCatalogService.js
// -- copied locally rather than cross-importing a private helper from an
// unrelated service.
const nextDisplayOrder = async (table, whereClause = "", params = []) => {
  const result = await pool.query(`SELECT COALESCE(MAX(display_order), -1) AS max_order FROM ${table} ${whereClause}`, params);
  return Number(result.rows[0].max_order) + 1;
};

const mapChapterRow = (row) => ({
  chapterNumber: row.chapter_number,
  chapterName: row.chapter_name,
  displayOrder: row.display_order,
  isActive: row.is_active,
  isHidden: row.is_hidden,
  rowCount: Number(row.row_count),
});

export const listChaptersForBook = async (bookId) => {
  const result = await pool.query(
    `
      SELECT chapter_number, MAX(chapter_name) AS chapter_name, MIN(display_order) AS display_order,
             BOOL_AND(is_active) AS is_active, BOOL_OR(is_hidden) AS is_hidden, COUNT(*) AS row_count
      FROM mst_chapter
      WHERE fk_mst_book_id = $1
      GROUP BY chapter_number
      ORDER BY MIN(display_order) ASC
    `,
    [bookId]
  );
  return result.rows.map(mapChapterRow);
};

export const createChapter = async ({ bookId, chapterNumber, chapterName, displayOrder }) => {
  const trimmedNumber = String(chapterNumber || "").trim();
  const trimmedName = String(chapterName || "").trim();
  if (!trimmedNumber || !trimmedName) {
    const error = new Error("Chapter number and chapter name are both required.");
    error.statusCode = 400;
    throw error;
  }

  // The UNIQUE (fk_mst_book_id, chapter_number, section_number, topic_name)
  // constraint does NOT stop this -- Postgres treats NULLs as distinct, so
  // two bare top-level chapters (section/topic both NULL) with the same
  // number would otherwise both insert cleanly. Guarded explicitly here.
  const existing = await pool.query(
    "SELECT id FROM mst_chapter WHERE fk_mst_book_id = $1 AND chapter_number = $2 AND section_number IS NULL AND topic_name IS NULL",
    [bookId, trimmedNumber]
  );
  if (existing.rows[0]) {
    const error = new Error(`Chapter ${trimmedNumber} already exists for this book.`);
    error.statusCode = 409;
    throw error;
  }

  const resolvedDisplayOrder = Number.isFinite(Number(displayOrder))
    ? Number(displayOrder)
    : await nextDisplayOrder("mst_chapter", "WHERE fk_mst_book_id = $1", [bookId]);

  const result = await pool.query(
    `
      INSERT INTO mst_chapter (chapter_number, chapter_name, section_number, topic_name, display_order, fk_mst_book_id, is_active, is_hidden)
      VALUES ($1, $2, NULL, NULL, $3, $4, TRUE, FALSE)
      RETURNING chapter_number, chapter_name, display_order, is_active, is_hidden
    `,
    [trimmedNumber, trimmedName, resolvedDisplayOrder, bookId]
  );

  await refreshChapterCatalogView();
  return mapChapterRow({ ...result.rows[0], row_count: 1 });
};

const setChapterFlag = async ({ bookId, chapterNumber, column, value }) => {
  const result = await pool.query(
    `UPDATE mst_chapter SET ${column} = $3 WHERE fk_mst_book_id = $1 AND chapter_number = $2 RETURNING id`,
    [bookId, chapterNumber, value]
  );
  if (result.rows.length === 0) {
    const error = new Error("Chapter not found.");
    error.statusCode = 404;
    throw error;
  }
  await refreshChapterCatalogView();
};

export const setChapterActive = ({ bookId, chapterNumber, isActive }) =>
  setChapterFlag({ bookId, chapterNumber, column: "is_active", value: Boolean(isActive) });

export const setChapterHidden = ({ bookId, chapterNumber, isHidden }) =>
  setChapterFlag({ bookId, chapterNumber, column: "is_hidden", value: Boolean(isHidden) });
