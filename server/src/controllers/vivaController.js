import { gradeVivaAnswer, generateVivaQuestions } from "../services/vivaService.js";

export const postVivaQuestions = async (req, res, next) => {
  try {
    const result = await generateVivaQuestions({ assessmentUnitId: req.params.assessmentUnitId });
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const postVivaFeedback = async (req, res, next) => {
  try {
    const result = await gradeVivaAnswer({
      assessmentUnitId: req.params.assessmentUnitId,
      question: req.body?.question,
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
