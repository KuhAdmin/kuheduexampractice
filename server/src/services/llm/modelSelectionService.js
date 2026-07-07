import { getSetting, setSetting } from "../appSettingsService.js";
import { getDefaultModelEntry, getModelRegistryEntry } from "./modelRegistry.js";

const SETTING_KEY = "ai_model_selection";

const getDefaultSelection = () => ({
  activeModelId: getDefaultModelEntry().id,
  layerOverrides: {},
});

export const getActiveModelSelection = async () =>
  getSetting(SETTING_KEY, getDefaultSelection());

export const setActiveModel = async (modelId, { updatedBy = null } = {}) => {
  if (!getModelRegistryEntry(modelId)) {
    throw new Error(`Unknown AI model id: ${modelId}`);
  }

  const current = await getActiveModelSelection();
  return setSetting(SETTING_KEY, { ...current, activeModelId: modelId }, { updatedBy });
};

export const setLayerModelOverride = async (layerNumber, modelId, { updatedBy = null } = {}) => {
  if (modelId && !getModelRegistryEntry(modelId)) {
    throw new Error(`Unknown AI model id: ${modelId}`);
  }

  const current = await getActiveModelSelection();
  const layerOverrides = { ...current.layerOverrides };

  if (modelId) {
    layerOverrides[layerNumber] = modelId;
  } else {
    delete layerOverrides[layerNumber];
  }

  return setSetting(SETTING_KEY, { ...current, layerOverrides }, { updatedBy });
};

export const resolveModelForLayer = async (layerNumber, { fallbackModelName } = {}) => {
  const selection = await getActiveModelSelection();
  const modelId = selection.layerOverrides?.[layerNumber] || selection.activeModelId;
  const registryEntry = modelId ? getModelRegistryEntry(modelId) : null;

  if (!registryEntry) {
    return { modelId: null, modelName: fallbackModelName };
  }

  return { modelId: registryEntry.id, modelName: registryEntry.modelName };
};
