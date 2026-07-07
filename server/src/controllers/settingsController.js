import { listSelectableModels, getModelRegistryEntry } from "../services/llm/modelRegistry.js";
import {
  getActiveModelSelection,
  setActiveModel,
  setLayerModelOverride,
} from "../services/llm/modelSelectionService.js";

const PIPELINE_LAYERS = [
  { layerNumber: 1, layerName: "Knowledge Extraction" },
  { layerNumber: 2, layerName: "Concept Memory" },
  { layerNumber: 3, layerName: "Assessment Capability" },
  { layerNumber: 4, layerName: "Assessment Strategy" },
  { layerNumber: 5, layerName: "Blueprint Generation" },
  { layerNumber: 6, layerName: "Item Generation" },
  { layerNumber: 7, layerName: "Learning Support" },
];

export const getAiModelSettings = async (_req, res, next) => {
  try {
    const selection = await getActiveModelSelection();

    return res.json({
      activeModelId: selection.activeModelId,
      availableModels: listSelectableModels(),
      layerOverrides: selection.layerOverrides || {},
      layers: PIPELINE_LAYERS,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateActiveAiModel = async (req, res, next) => {
  try {
    const { modelId } = req.body || {};

    if (typeof modelId !== "string" || !getModelRegistryEntry(modelId)) {
      return res.status(400).json({ message: "modelId must reference a known AI model." });
    }

    const updated = await setActiveModel(modelId, { updatedBy: req.user?.id || null });

    return res.json({ activeModelId: updated.activeModelId });
  } catch (error) {
    return next(error);
  }
};

export const updateLayerAiModelOverride = async (req, res, next) => {
  try {
    const { layerNumber, modelId } = req.body || {};
    const parsedLayerNumber = Number(layerNumber);

    if (!PIPELINE_LAYERS.some((layer) => layer.layerNumber === parsedLayerNumber)) {
      return res.status(400).json({ message: "layerNumber must be a valid pipeline layer (1-7)." });
    }

    if (modelId !== null && (typeof modelId !== "string" || !getModelRegistryEntry(modelId))) {
      return res.status(400).json({ message: "modelId must reference a known AI model, or null to clear." });
    }

    const updated = await setLayerModelOverride(parsedLayerNumber, modelId, {
      updatedBy: req.user?.id || null,
    });

    return res.json({ layerOverrides: updated.layerOverrides || {} });
  } catch (error) {
    return next(error);
  }
};
