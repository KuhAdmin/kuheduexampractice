import { pool } from "../db/pool.js";

// All 7 Layer 2 memory-hook fields, each with a fixed expected media type
// (matches the image/video icon classification already established on the
// student Explore tab). Manual upload covers all 7 (image for 4, video for
// 3) -- AI generation for the 4 image-type sections was removed along with
// the seven-layer pipeline's admin tooling.
const SECTION_CONFIG = {
  analogy: { column: "analogy", label: "Analogy", mediaType: "image" },
  visualHook: { column: "visual_hook", label: "Visual Hook", mediaType: "image" },
  curiosityHook: { column: "curiosity_hook", label: "Curiosity Hook", mediaType: "image" },
  memoryTrick: { column: "memory_trick", label: "Memory Trick", mediaType: "image" },
  story: { column: "story", label: "Story", mediaType: "video" },
  realWorldConnection: { column: "real_world_connection", label: "Real World Connection", mediaType: "video" },
  microActivity: { column: "micro_activity", label: "Try This", mediaType: "video" },
};
const ALL_SECTION_KEYS = Object.keys(SECTION_CONFIG);

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // ~20MB decoded -- short mnemonic clips, not long-form video

// Version-increment + is_selected flip, in one transaction -- same
// version/is_selected pattern content_card_media uses for diagram uploads.
// Only upload sources this now (AI generation was removed), but the schema
// still supports both.
const persistMemoryHookMedia = async ({
  assessmentUnitId,
  sectionKey,
  mediaType,
  source,
  promptText,
  mediaDataUrl,
  mimeType,
  originalFileName,
  modelName,
  userId,
}) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const versionResult = await client.query(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
       FROM memory_hook_media WHERE assessment_unit_id = $1 AND section_key = $2`,
      [assessmentUnitId, sectionKey]
    );
    const nextVersion = versionResult.rows[0].next_version;

    await client.query(
      `UPDATE memory_hook_media SET is_selected = FALSE
       WHERE assessment_unit_id = $1 AND section_key = $2 AND is_selected = TRUE`,
      [assessmentUnitId, sectionKey]
    );

    const insertResult = await client.query(
      `INSERT INTO memory_hook_media (
         assessment_unit_id, section_key, media_type, source, version_number, is_selected,
         prompt_text, aspect_ratio, media_data, mime_type, original_file_name, model_name, status, created_by
       ) VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7, $8, $9, $10, $11, 'completed', $12)
       RETURNING id, version_number, created_at`,
      [
        assessmentUnitId,
        sectionKey,
        mediaType,
        source,
        nextVersion,
        promptText || null,
        mediaType === "image" ? "3:2" : null,
        mediaDataUrl,
        mimeType,
        originalFileName || null,
        modelName || null,
        userId || null,
      ]
    );

    await client.query("COMMIT");
    return insertResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// data:<mime>;base64,<payload> -- the same convention already used
// throughout this app for client-side file reads (OCR upload, admin section
// image upload).
const parseDataUrl = (dataUrl) => {
  const match = /^data:([^;,]+)(?:;charset=[^;,]+)?;base64,([\s\S]+)$/.exec(dataUrl || "");
  if (!match) {
    return null;
  }
  return { mimeType: match[1], base64Data: match[2] };
};

const estimateDecodedBytes = (base64Data) => {
  const padding = (base64Data.match(/=+$/) || [""])[0].length;
  return Math.max(0, Math.floor((base64Data.length * 3) / 4) - padding);
};

export const uploadMemoryHookMedia = async ({ assessmentUnitId, sectionKey, dataUrl, fileName, userId }) => {
  const config = SECTION_CONFIG[sectionKey];
  if (!config) {
    const error = new Error(`Invalid section key: ${sectionKey}`);
    error.statusCode = 400;
    throw error;
  }

  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    const error = new Error("Uploaded file could not be read. Please try again.");
    error.statusCode = 400;
    throw error;
  }

  const expectedCategory = `${config.mediaType}/`;
  if (!parsed.mimeType.toLowerCase().startsWith(expectedCategory)) {
    const error = new Error(
      `${config.label} expects ${config.mediaType === "image" ? "an image" : "a video"} file, but received "${parsed.mimeType}".`
    );
    error.statusCode = 422;
    throw error;
  }

  const decodedBytes = estimateDecodedBytes(parsed.base64Data);
  if (decodedBytes > MAX_UPLOAD_BYTES) {
    const error = new Error(
      `File is too large (${(decodedBytes / (1024 * 1024)).toFixed(1)}MB). Please upload a file under ${
        MAX_UPLOAD_BYTES / (1024 * 1024)
      }MB.`
    );
    error.statusCode = 413;
    throw error;
  }

  const saved = await persistMemoryHookMedia({
    assessmentUnitId,
    sectionKey,
    mediaType: config.mediaType,
    source: "uploaded",
    promptText: null,
    mediaDataUrl: dataUrl,
    mimeType: parsed.mimeType,
    originalFileName: fileName || null,
    modelName: null,
    userId,
  });

  return {
    sectionKey,
    mediaType: config.mediaType,
    source: "uploaded",
    versionNumber: saved.version_number,
    mediaData: dataUrl,
    mimeType: parsed.mimeType,
    originalFileName: fileName || null,
    createdAt: saved.created_at,
  };
};

export const getMemoryHookMedia = async (assessmentUnitId) => {
  const result = await pool.query(
    `SELECT section_key, media_type, source, version_number, prompt_text, media_data,
            mime_type, original_file_name, created_at
     FROM memory_hook_media
     WHERE assessment_unit_id = $1 AND is_selected = TRUE`,
    [assessmentUnitId]
  );

  const bySection = {};
  for (const key of ALL_SECTION_KEYS) {
    bySection[key] = null;
  }
  for (const row of result.rows) {
    bySection[row.section_key] = {
      mediaType: row.media_type,
      source: row.source,
      versionNumber: row.version_number,
      promptText: row.prompt_text,
      mediaData: row.media_data,
      mimeType: row.mime_type,
      originalFileName: row.original_file_name,
      createdAt: row.created_at,
    };
  }
  return bySection;
};

// Single-section variant for student-facing lazy loading -- the Concept
// Learning page only ever displays one memory-hook section's media at a
// time (the active Explore step / expanded accordion panel), so fetching
// all 7 sections' base64 media_data up front (getMemoryHookMedia above,
// still used by the admin workbench and the Memory Booster pages) wastes
// most of the transfer on sections the student never opens.
export const getMemoryHookMediaForSection = async (assessmentUnitId, sectionKey) => {
  if (!ALL_SECTION_KEYS.includes(sectionKey)) {
    return null;
  }

  const result = await pool.query(
    `SELECT section_key, media_type, source, version_number, prompt_text, media_data,
            mime_type, original_file_name, created_at
     FROM memory_hook_media
     WHERE assessment_unit_id = $1 AND section_key = $2 AND is_selected = TRUE
     LIMIT 1`,
    [assessmentUnitId, sectionKey]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    mediaType: row.media_type,
    source: row.source,
    versionNumber: row.version_number,
    promptText: row.prompt_text,
    mediaData: row.media_data,
    mimeType: row.mime_type,
    originalFileName: row.original_file_name,
    createdAt: row.created_at,
  };
};
