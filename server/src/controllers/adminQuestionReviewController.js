import { listPendingQuestions, reviewQuestion } from "../services/questionReviewService.js";

export const getPendingQuestions = async (_req, res, next) => {
  try {
    res.json({ questions: await listPendingQuestions() });
  } catch (error) {
    next(error);
  }
};

export const postReviewDecision = async (req, res, next) => {
  try {
    await reviewQuestion(req.params.itemId, {
      decision: req.body?.decision,
      notes: req.body?.notes,
      reviewerUserId: req.user.id,
    });
    return res.json({ ok: true });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};
