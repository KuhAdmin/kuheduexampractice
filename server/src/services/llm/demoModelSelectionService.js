import { getSetting, setSetting } from "../appSettingsService.js";
import { getModelRegistryEntry } from "./modelRegistry.js";
import { isNonLatinScriptSubjectCode } from "../assessmentStudioSubjectProfiles.js";

const SETTING_KEY = "ai_demo_model_selection";

// Mirrors modelSelectionService.js's shape exactly, keyed by subject code
// instead of pipeline layer number.
const getDefaultSelection = () => ({ subjectOverrides: {} });

export const getDemoModelSelection = async () => getSetting(SETTING_KEY, getDefaultSelection());

export const setDemoSubjectModelOverride = async (
  subjectCode,
  { ocrModelId, gradingModelId },
  { updatedBy = null } = {}
) => {
  if (ocrModelId && !getModelRegistryEntry(ocrModelId)) {
    throw new Error(`Unknown AI model id: ${ocrModelId}`);
  }
  if (gradingModelId && !getModelRegistryEntry(gradingModelId)) {
    throw new Error(`Unknown AI model id: ${gradingModelId}`);
  }

  const normalizedCode = String(subjectCode || "").toUpperCase().trim();
  if (!normalizedCode) {
    throw new Error("A valid subject code is required.");
  }

  const current = await getDemoModelSelection();
  const subjectOverrides = { ...current.subjectOverrides };

  if (!ocrModelId && !gradingModelId) {
    delete subjectOverrides[normalizedCode];
  } else {
    subjectOverrides[normalizedCode] = {
      ocrModelId: ocrModelId || null,
      gradingModelId: gradingModelId || null,
    };
  }

  return setSetting(SETTING_KEY, { ...current, subjectOverrides }, { updatedBy });
};

// Reproduces today's exact hardcoded OCR routing (isNonLatinScriptSubjectCode
// -> Gemini, else the provider default) as the system-default fallback, so
// an unconfigured subject behaves identically to before this feature existed.
export const resolveOcrModelForSubject = async (subjectCode) => {
  const normalizedCode = String(subjectCode || "").toUpperCase().trim();
  const selection = await getDemoModelSelection();
  const override = selection.subjectOverrides?.[normalizedCode]?.ocrModelId;

  if (override) {
    return { modelId: override };
  }

  return { modelId: isNonLatinScriptSubjectCode(normalizedCode) ? "gemini-2-5-flash" : null };
};

// Today's grading call never passes a modelId (always provider default) --
// that is this resolver's system-default fallback when no override is set.
export const resolveGradingModelForSubject = async (subjectCode) => {
  const normalizedCode = String(subjectCode || "").toUpperCase().trim();
  const selection = await getDemoModelSelection();
  const override = selection.subjectOverrides?.[normalizedCode]?.gradingModelId;

  return { modelId: override || null };
};
