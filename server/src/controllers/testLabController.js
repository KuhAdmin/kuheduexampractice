import {
  getTestLabFilterOptions,
  startTestLabAttempt,
  getTestLabAttempt,
  submitTestLabAnswer,
  setTestLabItemReviewFlag,
  submitTestLabAttempt,
  getTestLabAttemptResult,
  listRecentTestLabAttempts,
} from "../services/testLabService.js";

// Falls back to the user's own board/class/subject profile, but an explicit
// class/subject-switcher selection (see StudentTestLabPage.jsx reading
// useClassSubject()) always wins when present -- required for accounts with
// no fixed profile at all, e.g. a superstudent with unrestricted "all" scope.
const academicContext = (req, source) => ({
  board: req.user.board,
  studentClass: req.user.studentClass,
  subject: req.user.subject,
  userId: req.user.id,
  examGoalCode: source.examGoalCode || undefined,
  levelCode: source.levelCode || undefined,
  subjectCode: source.subjectCode || undefined,
});

export const getFilterOptions = async (req, res, next) => {
  try {
    const result = await getTestLabFilterOptions(academicContext(req, req.query));
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const startAttempt = async (req, res, next) => {
  try {
    const result = await startTestLabAttempt({
      ...academicContext(req, req.body || {}),
      chapterNumbers: req.body?.chapterNumbers,
      interactionTypes: req.body?.interactionTypes,
      questionCount: req.body?.questionCount,
    });
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const getAttempt = async (req, res, next) => {
  try {
    const result = await getTestLabAttempt({ attemptId: req.params.attemptId, userId: req.user.id });
    if (!result) {
      return res.status(404).json({ message: "TestLab set not found." });
    }
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const answerAttemptItem = async (req, res, next) => {
  try {
    const result = await submitTestLabAnswer({
      attemptId: req.params.attemptId,
      displayOrder: Number(req.params.displayOrder),
      studentAnswer: req.body?.studentAnswer,
      timeTakenSeconds: req.body?.timeTakenSeconds,
      userId: req.user.id,
    });
    if (!result) {
      return res.status(404).json({ message: "TestLab question not found." });
    }
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const setItemReviewFlag = async (req, res, next) => {
  try {
    const result = await setTestLabItemReviewFlag({
      attemptId: req.params.attemptId,
      displayOrder: Number(req.params.displayOrder),
      markedForReview: Boolean(req.body?.markedForReview),
      userId: req.user.id,
    });
    if (!result) {
      return res.status(404).json({ message: "TestLab question not found." });
    }
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const finishAttempt = async (req, res, next) => {
  try {
    const result = await submitTestLabAttempt({ attemptId: req.params.attemptId, userId: req.user.id });
    if (!result) {
      return res.status(404).json({ message: "TestLab set not found." });
    }
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const getAttemptResult = async (req, res, next) => {
  try {
    const result = await getTestLabAttemptResult({ attemptId: req.params.attemptId, userId: req.user.id });
    if (!result) {
      return res.status(404).json({ message: "TestLab result not found." });
    }
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const getRecentAttempts = async (req, res, next) => {
  try {
    const result = await listRecentTestLabAttempts({ userId: req.user.id });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};
