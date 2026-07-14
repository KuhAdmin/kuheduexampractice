import { pool } from "../db/pool.js";
import { createStructuredCompletion, generateImage } from "./openAiService.js";
import { getDiagramsForSection } from "./assessmentStudioContextAssembler.js";

const IMAGE_SIZE = "1536x1024"; // 3:2 landscape, matches memoryHookImageService.js
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const getDiagram = async (layer1DiagramId) => {
  const diagramResult = await pool.query(
    "SELECT id, diagram_name, purpose FROM layer1_diagram WHERE id = $1",
    [layer1DiagramId]
  );
  const diagram = diagramResult.rows[0];
  if (!diagram) {
    return null;
  }

  const labelsResult = await pool.query(
    "SELECT label_name FROM layer1_diagram_label WHERE layer1_diagram_id = $1 ORDER BY display_order ASC, id ASC",
    [layer1DiagramId]
  );

  return {
    id: diagram.id,
    diagramName: diagram.diagram_name,
    purpose: diagram.purpose,
    labels: labelsResult.rows.map((row) => row.label_name),
  };
};

// Same reasoning as memoryHookImageService.js's buildMemoryHookImagePrompt:
// AI-generated in-image text/labels are unreliable, so the prompt explicitly
// asks for an unlabeled illustration -- the existing labeled-parts text list
// stays the source of truth for label names, rendered separately underneath.
const buildDiagramImagePrompt = async ({ diagramName, purpose, labels }) => {
  const { parsed } = await createStructuredCompletion({
    systemPrompt:
      "You write single-scene, vivid image-generation prompts for a 3:2 landscape " +
      "educational diagram illustration aimed at school students. The prompt must " +
      "describe ONE clear, accurate diagram/figure that visually captures the given " +
      "diagram. Do NOT request any embedded text, labels, captions, numbers, or " +
      "writing of any kind inside the image -- AI-generated in-image text is usually " +
      "garbled and must never be requested; the labeled parts are shown separately as " +
      "a text list next to the image. Return only valid JSON matching the schema.",
    userPrompt:
      `Diagram name: ${diagramName}\nPurpose: ${purpose || "(not specified)"}\n` +
      `Labeled parts: ${labels.join(", ") || "(none specified)"}\n\n` +
      `Schema:\n{ "imagePrompt": "" }`,
    responseFormatName: "diagram_image_prompt",
  });

  const imagePrompt = typeof parsed?.imagePrompt === "string" ? parsed.imagePrompt.trim() : "";
  if (!imagePrompt) {
    throw new Error("The prompt-generation step returned no usable image prompt.");
  }
  return imagePrompt;
};

const persistDiagramMedia = async ({
  layer1DiagramId,
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
       FROM layer1_diagram_media WHERE layer1_diagram_id = $1`,
      [layer1DiagramId]
    );
    const nextVersion = versionResult.rows[0].next_version;

    await client.query(
      `UPDATE layer1_diagram_media SET is_selected = FALSE
       WHERE layer1_diagram_id = $1 AND is_selected = TRUE`,
      [layer1DiagramId]
    );

    const insertResult = await client.query(
      `INSERT INTO layer1_diagram_media (
         layer1_diagram_id, source, version_number, is_selected,
         prompt_text, aspect_ratio, media_data, mime_type, original_file_name, model_name, created_by
       ) VALUES ($1, $2, $3, TRUE, $4, '3:2', $5, $6, $7, $8, $9)
       RETURNING id, version_number, created_at`,
      [layer1DiagramId, source, nextVersion, promptText || null, mediaDataUrl, mimeType, originalFileName || null, modelName || null, userId || null]
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

export const generateDiagramImage = async ({ layer1DiagramId, userId, modelId }) => {
  const diagram = await getDiagram(layer1DiagramId);
  if (!diagram) {
    const error = new Error("Diagram not found.");
    error.statusCode = 404;
    throw error;
  }

  const promptText = await buildDiagramImagePrompt(diagram);

  const { imageDataUrl, mimeType, model } = await generateImage({
    prompt: promptText,
    size: IMAGE_SIZE,
    modelId,
  });

  const saved = await persistDiagramMedia({
    layer1DiagramId,
    source: "generated",
    promptText,
    mediaDataUrl: imageDataUrl,
    mimeType,
    originalFileName: null,
    modelName: model,
    userId,
  });

  return {
    layer1DiagramId,
    source: "generated",
    versionNumber: saved.version_number,
    promptText,
    mediaData: imageDataUrl,
    mimeType,
    createdAt: saved.created_at,
  };
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

export const uploadDiagramMedia = async ({ layer1DiagramId, dataUrl, fileName, userId }) => {
  const diagram = await getDiagram(layer1DiagramId);
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
    layer1DiagramId,
    source: "uploaded",
    promptText: null,
    mediaDataUrl: dataUrl,
    mimeType: parsed.mimeType,
    originalFileName: fileName || null,
    modelName: null,
    userId,
  });

  return {
    layer1DiagramId,
    source: "uploaded",
    versionNumber: saved.version_number,
    mediaData: dataUrl,
    mimeType: parsed.mimeType,
    originalFileName: fileName || null,
    createdAt: saved.created_at,
  };
};

// Lets the admin Workbench (which only has an assessment_unit_id in scope,
// not the section id diagrams actually belong to) list the diagrams for
// whichever section that unit was extracted from -- diagrams are section-
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

export const getDiagramMedia = async (layer1DiagramId) => {
  const result = await pool.query(
    `SELECT source, version_number, prompt_text, media_data, mime_type, original_file_name, created_at
     FROM layer1_diagram_media
     WHERE layer1_diagram_id = $1 AND is_selected = TRUE
     LIMIT 1`,
    [layer1DiagramId]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    source: row.source,
    versionNumber: row.version_number,
    promptText: row.prompt_text,
    mediaData: row.media_data,
    mimeType: row.mime_type,
    originalFileName: row.original_file_name,
    createdAt: row.created_at,
  };
};
