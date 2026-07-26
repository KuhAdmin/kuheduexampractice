import { getMemoryHookMedia, uploadMemoryHookMedia } from "../services/memoryHookImageService.js";
import {
  getDiagramMedia,
  getDiagramsForAssessmentUnit,
  uploadDiagramMedia,
} from "../services/diagramImageService.js";

export const getMemoryHookMediaHandler = async (req, res, next) => {
  try {
    const result = await getMemoryHookMedia(req.params.assessmentUnitId);
    return res.json({ assessmentUnitId: req.params.assessmentUnitId, media: result });
  } catch (error) {
    return next(error);
  }
};

export const uploadMemoryHookMediaHandler = async (req, res, next) => {
  try {
    const result = await uploadMemoryHookMedia({
      assessmentUnitId: req.params.assessmentUnitId,
      sectionKey: req.params.sectionKey,
      dataUrl: req.body?.dataUrl,
      fileName: req.body?.fileName || null,
      userId: req.user?.id || null,
    });
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const getAssessmentUnitDiagramsHandler = async (req, res, next) => {
  try {
    const result = await getDiagramsForAssessmentUnit(req.params.assessmentUnitId);
    return res.json({ diagrams: result });
  } catch (error) {
    return next(error);
  }
};

export const getDiagramMediaHandler = async (req, res, next) => {
  try {
    const result = await getDiagramMedia(req.params.diagramId);
    return res.json({ diagramId: req.params.diagramId, media: result });
  } catch (error) {
    return next(error);
  }
};

export const uploadDiagramMediaHandler = async (req, res, next) => {
  try {
    const result = await uploadDiagramMedia({
      contentCardId: req.params.diagramId,
      dataUrl: req.body?.dataUrl,
      fileName: req.body?.fileName || null,
      userId: req.user?.id || null,
    });
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};
