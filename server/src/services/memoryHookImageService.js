import { pool } from "../db/pool.js";
import { generateImage, createStructuredCompletion } from "./openAiService.js";
import { getLayer1Context } from "./contentReadService.js";

const IMAGE_MODEL_ID = "gemini-image";
const IMAGE_ASPECT_RATIO = "16:9";

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

// Content-moderator "regenerate image" action for the 4 image-type sections
// (analogy/visualHook/curiosityHook/memoryTrick) -- the 3 video-type
// sections (story/realWorldConnection/microActivity) have no AI generation
// path (generateImage is images-only), upload remains the only source for
// those. Reuses the exact same persistMemoryHookMedia transaction as upload,
// just tagged source='generated'.
export const regenerateMemoryHookMedia = async ({ assessmentUnitId, sectionKey, prompt, userId }) => {
  const config = SECTION_CONFIG[sectionKey];
  if (!config) {
    const error = new Error(`Invalid section key: ${sectionKey}`);
    error.statusCode = 400;
    throw error;
  }

  if (config.mediaType !== "image") {
    const error = new Error(`${config.label} is a video section and can't be AI-generated -- upload a file instead.`);
    error.statusCode = 422;
    throw error;
  }

  if (!prompt || !prompt.trim()) {
    const error = new Error("A prompt is required to generate an image.");
    error.statusCode = 400;
    throw error;
  }

  const result = await generateImage({
    prompt: prompt.trim(),
    modelId: IMAGE_MODEL_ID,
    aspectRatio: IMAGE_ASPECT_RATIO,
  });

  const saved = await persistMemoryHookMedia({
    assessmentUnitId,
    sectionKey,
    mediaType: "image",
    source: "generated",
    promptText: prompt.trim(),
    mediaDataUrl: result.imageDataUrl,
    mimeType: result.mimeType,
    originalFileName: null,
    modelName: result.model,
    userId,
  });

  return {
    sectionKey,
    mediaType: "image",
    source: "generated",
    versionNumber: saved.version_number,
    mediaData: result.imageDataUrl,
    mimeType: result.mimeType,
    promptText: prompt.trim(),
    modelName: result.model,
    createdAt: saved.created_at,
  };
};

// Visual/curiosity/memory-trick sections have no backing learn-content text
// of their own (see contentReadService.js's getLayer2Memory) -- unlike
// analogy, which the editor pre-fills its prompt box from directly -- so a
// moderator otherwise starts from a blank textarea. This drafts a prompt
// from the concept's Layer 1 learn content instead (title/summary/core
// concepts), tailored per section's distinct visual purpose.
const PROMPT_GENERATION_SECTIONS = {
  visualHook: {
    label: "Visual Hook",
    instruction:
      "a single striking, literal visual that lets a student instantly recognize this concept at a glance -- " +
      "the core idea rendered as one clear scene or object, not an abstract metaphor.",
  },
  curiosityHook: {
    label: "Curiosity Hook",
    instruction:
      "an intriguing, thought-provoking scene that makes a student curious to learn more -- a surprising " +
      "moment, an unanswered question, or a striking 'what if' tied directly to the concept.",
  },
  memoryTrick: {
    label: "Memory Trick",
    instruction:
      "a memorable mnemonic visual -- an exaggerated, funny, or visually-punny scene that helps a student " +
      "recall the concept through association, not a literal illustration of it.",
  },
};

// Style/aspect ratio are baked into the generated prompt text itself (not
// just passed as separate generation params) so the art direction survives
// even if a moderator copies the prompt elsewhere or hand-edits it before
// generating.
const PROMPT_GENERATION_SYSTEM =
  "You write short, vivid prompts for an AI image generator that illustrates school concepts for students. " +
  "Every prompt must render in warm, rounded Pixar-style 3D animation -- expressive character/object design, " +
  "soft cinematic lighting -- composed for a 16:9 widescreen frame. Describe a single concrete scene in 2-4 " +
  'sentences: what\'s in it, the style, the mood. Always end the prompt with the exact phrase "Pixar-style 3D ' +
  'animation, 16:9 widescreen." Never include any text, letters, numbers, or labels to render inside the ' +
  "image. Return only valid JSON matching the schema.";

export const generateMemoryHookPrompt = async ({ assessmentUnitId, sectionKey }) => {
  const config = PROMPT_GENERATION_SECTIONS[sectionKey];
  if (!config) {
    const error = new Error(`Prompt generation isn't supported for "${sectionKey}".`);
    error.statusCode = 400;
    throw error;
  }

  const context = await getLayer1Context(assessmentUnitId);
  if (!context) {
    const error = new Error("Concept not found.");
    error.statusCode = 404;
    throw error;
  }

  const { primary_concept: primaryConcept, learning_objective: learningObjective } = context.assessment_unit;
  const { context_summary: contextSummary, core_concepts: coreConcepts } = context.knowledge;

  const userPrompt =
    `Concept: ${primaryConcept || "Unknown"}\n` +
    `Learning objective: ${learningObjective || "N/A"}\n` +
    `What students learn: ${contextSummary || "N/A"}\n` +
    `Key ideas: ${coreConcepts.length ? coreConcepts.join("; ") : "N/A"}\n\n` +
    `Write an image-generation prompt for this concept's "${config.label}" -- ${config.instruction}\n` +
    `Return JSON: {"prompt": "..."}`;

  const { parsed } = await createStructuredCompletion({
    systemPrompt: PROMPT_GENERATION_SYSTEM,
    userPrompt,
    responseFormatName: "memory_hook_prompt_generation",
  });

  const prompt = typeof parsed?.prompt === "string" ? parsed.prompt.trim() : "";
  if (!prompt) {
    const error = new Error("The AI didn't return a prompt. Please try again.");
    error.statusCode = 502;
    throw error;
  }

  return { sectionKey, prompt };
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

// Lets a moderator fix/refine a prompt on the currently-selected image
// without spending an Azure OpenAI call to regenerate it (see
// regenerateMemoryHookMedia above for the generate path, which already
// saves whatever prompt was used) -- e.g. editing a typo or wording before
// the next regenerate. No-op-shaped 404 when nothing has been generated yet
// for this section, since there's no row to attach the prompt to (schema
// requires media_data NOT NULL, so a prompt can't be saved standalone).
export const updateMemoryHookPromptText = async ({ assessmentUnitId, sectionKey, promptText }) => {
  if (!ALL_SECTION_KEYS.includes(sectionKey)) {
    const error = new Error(`Invalid section key: ${sectionKey}`);
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
      UPDATE memory_hook_media SET prompt_text = $3
      WHERE assessment_unit_id = $1 AND section_key = $2 AND is_selected = TRUE
      RETURNING id
    `,
    [assessmentUnitId, sectionKey, promptText || null]
  );

  if (!result.rows[0]) {
    const error = new Error("No existing image to update the prompt for -- generate one first.");
    error.statusCode = 404;
    throw error;
  }

  return getMemoryHookMediaForSection(assessmentUnitId, sectionKey);
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
