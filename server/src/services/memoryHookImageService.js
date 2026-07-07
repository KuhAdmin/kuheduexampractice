import { pool } from "../db/pool.js";
import { createStructuredCompletion, generateImage } from "./openAiService.js";
import { getLayer2Memory } from "./assessmentStudioContextAssembler.js";

// All 7 Layer 2 memory-hook fields, each with a fixed expected media type
// (matches the image/video icon classification already established on the
// student Explore tab). AI generation only exists for the 4 image-type
// sections; manual upload covers all 7 (image for the 4, video for the 3).
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
const IMAGE_SECTION_KEYS = ALL_SECTION_KEYS.filter((key) => SECTION_CONFIG[key].mediaType === "image");

const IMAGE_SIZE = "1536x1024"; // 3:2 landscape
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // ~20MB decoded -- short mnemonic clips, not long-form video

const buildMemoryHookImagePrompt = async ({ primaryConcept, sectionLabel, sectionText }) => {
  const { parsed } = await createStructuredCompletion({
    systemPrompt:
      "You write single-scene, vivid image-generation prompts for a 3:2 landscape " +
      "educational illustration aimed at school students. The prompt must describe " +
      "ONE clear scene that visually captures the given concept text. Do NOT request " +
      "any embedded text, labels, captions, numbers, or writing of any kind inside the " +
      "image -- AI-generated in-image text is usually garbled and must never be " +
      "requested. Return only valid JSON matching the schema.",
    userPrompt:
      `Concept: ${primaryConcept}\nSection: ${sectionLabel}\nContent: ${sectionText}\n\n` +
      `Schema:\n{ "imagePrompt": "" }`,
    responseFormatName: "memory_hook_image_prompt",
  });

  const imagePrompt = typeof parsed?.imagePrompt === "string" ? parsed.imagePrompt.trim() : "";
  if (!imagePrompt) {
    throw new Error("The prompt-generation step returned no usable image prompt.");
  }
  return imagePrompt;
};

// Version-increment + is_selected flip, in one transaction -- same shape as
// recordLayerGenerationVersion (assessmentStudioService.js). Shared by both
// AI generation and manual upload: whichever happens most recently becomes
// the section's selected media, regardless of source.
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

export const generateMemoryHookImage = async ({ assessmentUnitId, sectionKey, userId, modelId }) => {
  const config = SECTION_CONFIG[sectionKey];
  if (!config || config.mediaType !== "image") {
    const error = new Error(`Invalid section key for image generation: ${sectionKey}`);
    error.statusCode = 400;
    throw error;
  }

  const memory = await getLayer2Memory(assessmentUnitId);
  if (!memory) {
    const error = new Error(
      "Layer 2 (Concept Memory) has not been generated for this concept yet. Run the pipeline through Layer 2 first."
    );
    error.statusCode = 404;
    throw error;
  }

  const sectionText = memory[config.column];
  if (!sectionText || !sectionText.trim()) {
    const error = new Error(`${config.label} has no text content yet, so an image cannot be generated from it.`);
    error.statusCode = 422;
    throw error;
  }

  const promptText = await buildMemoryHookImagePrompt({
    primaryConcept: memory.primary_concept,
    sectionLabel: config.label,
    sectionText,
  });

  const { imageDataUrl, mimeType, model } = await generateImage({
    prompt: promptText,
    size: IMAGE_SIZE,
    modelId,
  });

  const saved = await persistMemoryHookMedia({
    assessmentUnitId,
    sectionKey,
    mediaType: "image",
    source: "generated",
    promptText,
    mediaDataUrl: imageDataUrl,
    mimeType,
    originalFileName: null,
    modelName: model,
    userId,
  });

  return {
    sectionKey,
    mediaType: "image",
    source: "generated",
    versionNumber: saved.version_number,
    promptText,
    mediaData: imageDataUrl,
    mimeType,
    createdAt: saved.created_at,
  };
};

// Loops the 4 image-type sections sequentially, isolating each section's
// failure -- one content-policy rejection or transient error never blocks
// the other 3; partial success is the expected, normal outcome for this
// bulk action. Video-type sections have no generation capability (upload
// only), so they're excluded from this bulk action.
export const generateAllMemoryHookImages = async ({ assessmentUnitId, userId, modelId }) => {
  const results = [];
  for (const sectionKey of IMAGE_SECTION_KEYS) {
    try {
      const result = await generateMemoryHookImage({ assessmentUnitId, sectionKey, userId, modelId });
      results.push({ sectionKey, status: "success", ...result });
    } catch (error) {
      results.push({
        sectionKey,
        status: "error",
        message: error.message,
        isContentPolicyViolation: Boolean(error.isContentPolicyViolation),
      });
    }
  }

  return {
    assessmentUnitId,
    succeeded: results.filter((row) => row.status === "success").length,
    failed: results.filter((row) => row.status === "error").length,
    results,
  };
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
