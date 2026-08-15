// Shared aspect-ratio/quality options for the two admin image-generation
// surfaces (diagramImageService.js, memoryHookImageService.js). Keep the
// values/order in sync with client/src/content/imageGenerationOptions.js.

export const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"];
export const DEFAULT_ASPECT_RATIO_DIAGRAM = "16:9";
export const DEFAULT_ASPECT_RATIO_MEMORY_HOOK = "9:16";

export const QUALITY_VALUES = ["low", "medium", "high", "auto"];
export const DEFAULT_QUALITY = "low";

export const STYLES = ["pixar-3d", "realistic", "watercolor", "flat-vector"];
export const DEFAULT_STYLE = "watercolor";

const resolveFromSet = (validValues, value, fallback) => {
  if (!value) {
    return fallback;
  }
  if (!validValues.includes(value)) {
    const error = new Error(`Invalid value "${value}". Expected one of: ${validValues.join(", ")}.`);
    error.statusCode = 400;
    throw error;
  }
  return value;
};

export const resolveAspectRatio = (value, fallback) => resolveFromSet(ASPECT_RATIOS, value, fallback);

export const resolveQuality = (value, fallback = DEFAULT_QUALITY) =>
  resolveFromSet(QUALITY_VALUES, value, fallback);

export const resolveStyle = (value, fallback = DEFAULT_STYLE) => resolveFromSet(STYLES, value, fallback);

// No dedicated "style" field exists in Azure's images/generations API (only
// prompt/size/quality/n) -- style has to be real words in the prompt sent
// to the model. Composed on-the-fly at generation time, kept OUT of the
// promptText that gets persisted/shown/edited, so the moderator's saved
// prompt always stays a pure scene description (see regenerateDiagramMedia/
// regenerateMemoryHookMedia).
const STYLE_PROMPT_SUFFIX = {
  "pixar-3d": "Pixar-style 3D animation, expressive character and object design, soft cinematic lighting",
  realistic: "photorealistic rendering, accurate detail, natural lighting",
  watercolor: "soft watercolor illustration, hand-painted texture, gentle color bleed",
  "flat-vector": "flat vector illustration, clean geometric shapes, minimal flat shading",
};

export const applyStyleToPrompt = (prompt, styleCode) => {
  const trimmed = (prompt || "").trim();
  if (!trimmed) {
    return trimmed;
  }
  const suffix = STYLE_PROMPT_SUFFIX[styleCode] || STYLE_PROMPT_SUFFIX[DEFAULT_STYLE];
  return `${trimmed}, ${suffix}.`;
};

// Azure's images/generations API only documents three real pixel sizes --
// 1024x1024 (1:1), 1536x1024 (~16:9/4:3), 1024x1536 (~9:16/3:4) -- so the
// 5-value UI enum above collapses onto these 3 real geometries.
const AZURE_IMAGE_SIZE_BY_ASPECT_RATIO = {
  "1:1": "1024x1024",
  "16:9": "1536x1024",
  "4:3": "1536x1024",
  "9:16": "1024x1536",
  "3:4": "1024x1536",
};

export const getAzureImageSize = (aspectRatioCode) => AZURE_IMAGE_SIZE_BY_ASPECT_RATIO[aspectRatioCode];

// Gemini's own imageConfig.aspectRatio enum (1:1/3:4/4:3/9:16/16:9) matches
// the UI codes exactly -- kept as its own export (rather than inlined at
// call sites) so the two providers' mappings stay independently
// correctable if either one's documented enum changes.
export const getGeminiAspectRatio = (aspectRatioCode) => aspectRatioCode;
