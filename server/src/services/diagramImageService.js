import { pool } from "../db/pool.js";
import { getDiagramsForSection } from "./contentReadService.js";
import { generateImage } from "./openAiService.js";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const IMAGE_MODEL_ID = "azure-image-gpt-image-1";

const getDiagram = async (contentCardId) => {
  const result = await pool.query(
    "SELECT id, title, summary FROM content_card WHERE id = $1",
    [contentCardId]
  );
  const diagram = result.rows[0];
  if (!diagram) {
    return null;
  }

  return {
    id: diagram.id,
    diagramName: diagram.title,
    purpose: diagram.summary,
  };
};

const persistDiagramMedia = async ({
  contentCardId,
  mediaDataUrl,
  mimeType,
  originalFileName,
  userId,
  source = "uploaded",
  promptText = null,
  modelName = null,
}) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const versionResult = await client.query(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
       FROM content_card_media WHERE content_card_id = $1`,
      [contentCardId]
    );
    const nextVersion = versionResult.rows[0].next_version;

    await client.query(
      `UPDATE content_card_media SET is_selected = FALSE
       WHERE content_card_id = $1 AND is_selected = TRUE`,
      [contentCardId]
    );

    const insertResult = await client.query(
      `INSERT INTO content_card_media (
         content_card_id, version_number, is_selected,
         media_data, mime_type, original_file_name, created_by,
         source, prompt_text, model_name
       ) VALUES ($1, $2, TRUE, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, version_number, created_at`,
      [
        contentCardId,
        nextVersion,
        mediaDataUrl,
        mimeType,
        originalFileName || null,
        userId || null,
        source,
        promptText,
        modelName,
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

export const uploadDiagramMedia = async ({ contentCardId, dataUrl, fileName, userId }) => {
  const diagram = await getDiagram(contentCardId);
  if (!diagram) {
    const error = new Error("Diagram not found.");
    error.statusCode = 404;
    throw error;
  }

  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    const error = new Error("Uploaded file could not be read. Please try again.");
    error.statusCode = 400;
    throw error;
  }

  if (!parsed.mimeType.toLowerCase().startsWith("image/")) {
    const error = new Error(`Expected an image file, but received "${parsed.mimeType}".`);
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

  const saved = await persistDiagramMedia({
    contentCardId,
    mediaDataUrl: dataUrl,
    mimeType: parsed.mimeType,
    originalFileName: fileName || null,
    userId,
  });

  return {
    contentCardId,
    source: "uploaded",
    versionNumber: saved.version_number,
    mediaData: dataUrl,
    mimeType: parsed.mimeType,
    originalFileName: fileName || null,
    createdAt: saved.created_at,
  };
};

// Content-moderator "regenerate image" action -- calls the same generateImage
// already used nowhere else in the app (see openAiService.js), then persists
// via the exact same version-increment/is_selected-flip transaction as a
// manual upload, just tagged source='generated' with the prompt/model kept
// for the editor UI to show.
export const regenerateDiagramMedia = async ({ contentCardId, prompt, userId }) => {
  const diagram = await getDiagram(contentCardId);
  if (!diagram) {
    const error = new Error("Diagram not found.");
    error.statusCode = 404;
    throw error;
  }

  if (!prompt || !prompt.trim()) {
    const error = new Error("A prompt is required to generate an image.");
    error.statusCode = 400;
    throw error;
  }

  const result = await generateImage({ prompt: prompt.trim(), modelId: IMAGE_MODEL_ID });

  const saved = await persistDiagramMedia({
    contentCardId,
    mediaDataUrl: result.imageDataUrl,
    mimeType: result.mimeType,
    originalFileName: null,
    userId,
    source: "generated",
    promptText: prompt.trim(),
    modelName: result.model,
  });

  return {
    contentCardId,
    source: "generated",
    versionNumber: saved.version_number,
    mediaData: result.imageDataUrl,
    mimeType: result.mimeType,
    promptText: prompt.trim(),
    modelName: result.model,
    createdAt: saved.created_at,
  };
};

// Lets the admin Workbench (which only has an assessment_unit_id in scope,
// not the section id diagrams actually belong to) list the diagrams for
// whichever section that unit was imported into -- diagrams are section-
// scoped (one section's diagrams are shared by all its assessment units),
// not per-unit.
export const getDiagramsForAssessmentUnit = async (assessmentUnitId) => {
  const unitResult = await pool.query(
    "SELECT source_section_id FROM assessment_unit WHERE assessment_unit_id = $1",
    [assessmentUnitId]
  );
  const sourceSectionId = unitResult.rows[0]?.source_section_id;
  if (!sourceSectionId) {
    return [];
  }
  return getDiagramsForSection(sourceSectionId);
};

export const getDiagramMedia = async (contentCardId) => {
  const result = await pool.query(
    `SELECT version_number, media_data, mime_type, original_file_name, created_at,
            source, prompt_text, model_name
     FROM content_card_media
     WHERE content_card_id = $1 AND is_selected = TRUE
     LIMIT 1`,
    [contentCardId]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    source: row.source || "uploaded",
    versionNumber: row.version_number,
    mediaData: row.media_data,
    mimeType: row.mime_type,
    originalFileName: row.original_file_name,
    promptText: row.prompt_text,
    modelName: row.model_name,
    createdAt: row.created_at,
  };
};
