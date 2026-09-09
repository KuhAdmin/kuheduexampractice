import { generateImage } from "./openAiService.js";
import {
  resolveAspectRatio,
  resolveQuality,
  resolveStyle,
  applyStyleToPrompt,
  getAzureImageSize,
} from "./imageGenerationOptions.js";
import { getPreWarmupContentForSection, updatePreWarmupContentPayload } from "./preWarmupImportService.js";

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const invalidPathError = () => {
  const error = new Error("Invalid image path.");
  error.statusCode = 400;
  return error;
};

// Only ever allowed to target a field literally named "image", and every
// intermediate segment must already exist as an object/array in the
// payload -- this can overwrite an existing image slot, never fabricate
// new structure elsewhere in the blob. That's the safety boundary given
// `path` arrives from the client (an authenticated admin/moderator, but no
// reason to trust it more than necessary).
const setImageAtPath = (payload, path, imageValue) => {
  if (!Array.isArray(path) || path.length === 0 || path[path.length - 1] !== "image") {
    throw invalidPathError();
  }
  let cursor = payload;
  for (const key of path.slice(0, -1)) {
    if (FORBIDDEN_KEYS.has(key) || cursor == null || typeof cursor !== "object") {
      throw invalidPathError();
    }
    cursor = cursor[key];
  }
  if (cursor == null || typeof cursor !== "object") {
    throw invalidPathError();
  }
  cursor.image = imageValue;
};

// Unlike regenerateDiagramMedia/regenerateMemoryHookMedia (one image per
// dedicated table row), pre-warmup images live at multiple nested
// locations inside one JSONB blob -- so this does a fetch-mutate-whole-
// payload-write against pre_warmup_content instead of inserting a new
// versioned row. See PreWarmupContentPreview.jsx for the path values this
// is called with.
export const generatePreWarmupImage = async ({ sourceSectionId, path, prompt, aspectRatio, quality, style }) => {
  const trimmedPrompt = (prompt || "").trim();
  if (!trimmedPrompt) {
    const error = new Error("Enter a prompt to generate an image.");
    error.statusCode = 400;
    throw error;
  }

  const existing = await getPreWarmupContentForSection(sourceSectionId);
  if (!existing) {
    const error = new Error("No pre-warmup content exists for this section yet.");
    error.statusCode = 404;
    throw error;
  }

  const resolvedAspectRatio = resolveAspectRatio(aspectRatio, "9:16");
  const resolvedQuality = resolveQuality(quality);
  const resolvedStyle = resolveStyle(style);

  const { imageDataUrl, mimeType, model } = await generateImage({
    prompt: applyStyleToPrompt(trimmedPrompt, resolvedStyle),
    modelId: "azure-image-gpt-image-2",
    size: getAzureImageSize(resolvedAspectRatio),
    aspectRatio: resolvedAspectRatio,
    quality: resolvedQuality,
  });

  const payload = existing.payload;
  setImageAtPath(payload, path, {
    status: "generated",
    mediaType: "image",
    source: "generated",
    aspectRatio: resolvedAspectRatio,
    quality: resolvedQuality,
    style: resolvedStyle,
    promptText: trimmedPrompt,
    mediaData: imageDataUrl,
    mimeType,
    modelName: model,
  });

  return updatePreWarmupContentPayload({ sourceSectionId, payload });
};
