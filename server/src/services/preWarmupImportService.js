import { pool } from "../db/pool.js";
import { resolveOrCreateCatalogTarget } from "./conceptImportCatalogService.js";

const REQUIRED_ROOT_FIELDS = [
  "board",
  "classNum",
  "subject",
  "book",
  "chapterNum",
  "chapterName",
  "sectionNo",
  "sectionName",
];

// Pre-migration files (a single flat "prewarmup" object holding
// avs/avsVisual/avsAssessment/experientialWarmup/transferablePatterns/
// storyAnchorQuestions -- the shape this schema had before it was split
// into preLessonWarmup/postLesson) are auto-upgraded rather than rejected,
// the same way conceptImportService.js upgrades its own legacy shape.
// sensoryWarmup and holisticAssessment have no legacy equivalent to carry
// forward -- they're simply absent from the result, same as if this were a
// brand-new file missing that content; validatePreWarmupPayload doesn't
// require them (see its comment below), so the upgraded payload still
// imports successfully and those two can be authored in later.
export const normalizePreWarmupPayload = (payload) => {
  if (!payload || typeof payload !== "object" || payload.preLessonWarmup) {
    return payload;
  }
  const legacy = payload.prewarmup;
  if (!legacy || typeof legacy !== "object") {
    return payload;
  }

  const { prewarmup: _legacy, ...rest } = payload;
  return {
    ...rest,
    preLessonWarmup: {
      vocabularyWarmup: {
        avs: legacy.avs,
        avsVisual: legacy.avsVisual,
        avsAssessment: legacy.avsAssessment,
      },
      experientialWarmup: legacy.experientialWarmup,
    },
    postLesson: {
      transferablePatterns: legacy.transferablePatterns,
      storyAnchorQuestions: legacy.storyAnchorQuestions,
    },
  };
};

// Deliberately shallow -- it checks the root metadata and that both
// top-level groups exist, but does not walk into avs/sensoryWarmup/etc. so
// content authors can keep iterating the internal shape without a code
// change here every time.
export const validatePreWarmupPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    const error = new Error("A JSON payload is required.");
    error.statusCode = 400;
    throw error;
  }

  const missing = REQUIRED_ROOT_FIELDS.filter((field) => {
    const value = payload[field];
    return value === undefined || value === null || String(value).trim() === "";
  });
  if (missing.length) {
    const error = new Error(`Missing required root field(s): ${missing.join(", ")}.`);
    error.statusCode = 400;
    throw error;
  }

  if (!payload.preLessonWarmup || typeof payload.preLessonWarmup !== "object") {
    const error = new Error('Missing "preLessonWarmup" object.');
    error.statusCode = 400;
    throw error;
  }
  if (!payload.postLesson || typeof payload.postLesson !== "object") {
    const error = new Error('Missing "postLesson" object.');
    error.statusCode = 400;
    throw error;
  }
};

// Walks oldPayload/newPayload in parallel; for any "image" key the new
// upload leaves null (uploaded files never author images -- they're
// generated afterward in the moderator UI), keeps the previously
// generated image instead of letting a re-import null it out.
const preserveExistingImages = (oldNode, newNode) => {
  if (Array.isArray(newNode)) {
    if (!Array.isArray(oldNode)) return newNode;
    return newNode.map((item, index) => preserveExistingImages(oldNode[index], item));
  }
  if (newNode && typeof newNode === "object") {
    if (!oldNode || typeof oldNode !== "object") return newNode;
    const merged = { ...newNode };
    for (const key of Object.keys(newNode)) {
      if (key === "image") {
        merged.image = newNode.image == null && oldNode.image != null ? oldNode.image : newNode.image;
        continue;
      }
      merged[key] = preserveExistingImages(oldNode[key], newNode[key]);
    }
    return merged;
  }
  return newNode;
};

export const importPreWarmupContent = async ({ payload, userId }) => {
  const { board, classNum, subject, book, chapterNum, chapterName, sectionNo, sectionName } = payload;

  const catalogTarget = await resolveOrCreateCatalogTarget({
    board,
    classNum,
    subject,
    book,
    chapterNum,
    chapterName,
    sectionNo,
    sectionName,
    userId,
  });
  if (!catalogTarget) {
    const error = new Error("Could not resolve chapter/section from the provided metadata.");
    error.statusCode = 400;
    throw error;
  }
  const { fkMstChapterId, sourceSectionId } = catalogTarget;

  // "The other half" -- this upload attaches to a section's Concept Import
  // content_key rather than inventing its own, so both halves of a
  // section's content share one identity. If nothing has been imported for
  // this section yet, there's no content_key to attach to.
  const existingCardResult = await pool.query(
    `SELECT content_key FROM content_card
     WHERE source_section_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [sourceSectionId]
  );
  if (existingCardResult.rows.length === 0) {
    const error = new Error(
      `No micro learning unit content found for "${sectionName}" (Chapter ${chapterNum}). Upload the main content via Micro Learning Unit Import first, then retry this pre-warmup upload.`
    );
    error.statusCode = 409;
    throw error;
  }
  const contentKey = existingCardResult.rows[0].content_key;

  const existingContent = await getPreWarmupContentForSection(sourceSectionId);
  const payloadToStore = existingContent
    ? preserveExistingImages(existingContent.payload, payload)
    : payload;

  const upsertResult = await pool.query(
    `INSERT INTO pre_warmup_content (fk_mst_chapter_id, source_section_id, content_key, payload, created_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (source_section_id, content_key)
     DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
     RETURNING id, (xmax = 0) AS inserted`,
    [fkMstChapterId, sourceSectionId, contentKey, JSON.stringify(payloadToStore), userId]
  );
  const { inserted } = upsertResult.rows[0];

  return {
    contentKey,
    action: inserted ? "created" : "updated",
    chapterId: fkMstChapterId,
    sectionId: sourceSectionId,
    chapterName,
    sectionName,
    // Surfaced purely for the admin's visibility into what this request
    // actually touched -- resolveOrCreateCatalogTarget auto-creates
    // mst_chapter/source_section (and the master-data chain behind them)
    // on demand rather than requiring them pre-seeded, so "resolved" here
    // covers both "already existed" and "just created" without needing to
    // plumb that distinction out of a function shared with Concept Import.
    tablesTouched: [
      { table: "mst_chapter", operation: "resolved" },
      { table: "source_section", operation: "resolved" },
      { table: "content_card", operation: "read (content key lookup)" },
      { table: "pre_warmup_content", operation: inserted ? "insert" : "update" },
    ],
  };
};

export const getPreWarmupContentForSection = async (sourceSectionId) => {
  const result = await pool.query(
    `SELECT id, content_key, payload, created_at, updated_at, created_by
     FROM pre_warmup_content
     WHERE source_section_id = $1`,
    [sourceSectionId]
  );
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    contentKey: row.content_key,
    payload: row.payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
};

export const updatePreWarmupContentPayload = async ({ sourceSectionId, payload }) => {
  const result = await pool.query(
    `UPDATE pre_warmup_content
     SET payload = $1, updated_at = NOW()
     WHERE source_section_id = $2
     RETURNING id, content_key, payload, created_at, updated_at, created_by`,
    [JSON.stringify(payload), sourceSectionId]
  );
  if (result.rows.length === 0) {
    const error = new Error("No pre-warmup content exists for this section yet.");
    error.statusCode = 404;
    throw error;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    contentKey: row.content_key,
    payload: row.payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
};
