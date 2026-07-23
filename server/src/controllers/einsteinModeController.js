import { generateEinsteinChallenge, recognizeEinsteinObject } from "../services/einsteinModeService.js";

export const postEinsteinChallenge = async (req, res, next) => {
  try {
    const result = await generateEinsteinChallenge({ assessmentUnitId: req.params.assessmentUnitId });
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const postEinsteinRecognize = async (req, res, next) => {
  try {
    const result = await recognizeEinsteinObject({
      targetObject: req.body?.targetObject,
      imageDataUrl: req.body?.imageDataUrl,
    });
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};
