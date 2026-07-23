import {
  captureAnswerForConcept,
  captureQuestionForConcept,
  gradeConceptPracticeSubmission,
} from "../services/conceptPracticeCaptureService.js";

export const postConceptPracticeQuestionCapture = async (req, res, next) => {
  try {
    const result = await captureQuestionForConcept({
      assessmentUnitId: req.params.assessmentUnitId,
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

export const postConceptPracticeAnswerCapture = async (req, res, next) => {
  try {
    const result = await captureAnswerForConcept({ imageDataUrl: req.body?.imageDataUrl });
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const postConceptPracticeGrade = async (req, res, next) => {
  try {
    const result = await gradeConceptPracticeSubmission({
      assessmentUnitId: req.params.assessmentUnitId,
      questionText: req.body?.questionText,
      answerText: req.body?.answerText,
    });
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};
