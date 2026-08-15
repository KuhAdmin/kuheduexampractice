// Aspect-ratio/quality/style dropdown options for the admin Content
// Editor's two image-generation surfaces (diagram cards, Memory Hook
// images). Keep the values/order in sync with
// server/src/services/imageGenerationOptions.js.

export const ASPECT_RATIO_OPTIONS = [
  { value: "1:1", label: "Square (1:1)" },
  { value: "16:9", label: "Landscape — Wide (16:9)" },
  { value: "9:16", label: "Portrait — Tall (9:16)" },
  { value: "4:3", label: "Landscape — Standard (4:3)" },
  { value: "3:4", label: "Portrait — Standard (3:4)" },
];

export const QUALITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "auto", label: "Auto" },
];

export const STYLE_OPTIONS = [
  { value: "pixar-3d", label: "Pixar 3D" },
  { value: "realistic", label: "Realistic" },
  { value: "watercolor", label: "Watercolor" },
  { value: "flat-vector", label: "Flat / Vector" },
];

export const DEFAULT_ASPECT_RATIO_DIAGRAM = "16:9";
export const DEFAULT_ASPECT_RATIO_MEMORY_HOOK = "9:16";
export const DEFAULT_QUALITY = "low";
export const DEFAULT_STYLE = "watercolor";
