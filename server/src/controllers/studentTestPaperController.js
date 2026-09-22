import {
  finishTestPaperAttempt,
  getTestPaperAttempt,
  listAssignedTestPapers,
  startOrResumeTestPaperAttempt,
  submitTestPaperAnswer,
} from "../services/studentTestPaperService.js";

const handleError = (error, res, next) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  return next(error);
};

export const getAssignedTestPapers = async (req, res, next) => {
  try {
    const result = await listAssignedTestPapers({ userId: req.user.id });
    return res.json({ papers: result });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const startAttempt = async (req, res, next) => {
  try {
    const result = await startOrResumeTestPaperAttempt({ paperId: req.params.paperId, userId: req.user.id });
    return res.json(result);
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const getAttempt = async (req, res, next) => {
  try {
    const result = await getTestPaperAttempt({ attemptId: req.params.attemptId, userId: req.user.id });
    return res.json(result);
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const answerAttemptItem = async (req, res, next) => {
  try {
    const result = await submitTestPaperAnswer({
      attemptId: req.params.attemptId,
      displayOrder: Number(req.params.displayOrder),
      studentAnswer: req.body?.studentAnswer,
      userId: req.user.id,
    });
    return res.json(result);
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const finishAttempt = async (req, res, next) => {
  try {
    const result = await finishTestPaperAttempt({ attemptId: req.params.attemptId, userId: req.user.id });
    return res.json(result);
  } catch (error) {
    return handleError(error, res, next);
  }
};
