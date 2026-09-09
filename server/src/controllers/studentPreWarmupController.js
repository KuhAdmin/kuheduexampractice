import {
  getPreWarmupResult,
  restartPreWarmupAttempt,
  startPreWarmupPhase,
  submitPatternExercise,
  submitPreWarmupAnswer,
  submitPreWarmupAttempt,
} from "../services/studentPreWarmupService.js";

export const startPreWarmup = async (req, res, next) => {
  try {
    const result = await startPreWarmupPhase({
      sourceSectionId: req.params.sourceSectionId,
      phase: req.params.phase,
      userId: req.user.id,
      subsectionKey: req.query.subsection || undefined,
    });
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const restartPreWarmup = async (req, res, next) => {
  try {
    const result = await restartPreWarmupAttempt({
      sourceSectionId: req.params.sourceSectionId,
      phase: req.params.phase,
      userId: req.user.id,
    });
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const answerPreWarmupItem = async (req, res, next) => {
  try {
    const result = await submitPreWarmupAnswer({
      attemptId: req.params.attemptId,
      itemKey: req.params.itemKey,
      studentAnswer: req.body?.studentAnswer,
      timeTakenSeconds: req.body?.timeTakenSeconds,
      userId: req.user.id,
    });

    if (!result) {
      return res.status(404).json({ message: "Attempt or item not found." });
    }

    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const answerPatternExercise = async (req, res, next) => {
  try {
    const result = await submitPatternExercise({
      attemptId: req.params.attemptId,
      patternKey: req.params.patternKey,
      pattern: req.body?.pattern,
      meaning: req.body?.meaning,
      responses: req.body?.responses,
      userId: req.user.id,
    });

    if (!result) {
      return res.status(404).json({ message: "Attempt not found." });
    }

    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const finishPreWarmup = async (req, res, next) => {
  try {
    const result = await submitPreWarmupAttempt({
      attemptId: req.params.attemptId,
      userId: req.user.id,
    });

    if (!result) {
      return res.status(404).json({ message: "Attempt not found." });
    }

    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const getPreWarmupResultHandler = async (req, res, next) => {
  try {
    const result = await getPreWarmupResult({
      attemptId: req.params.attemptId,
      userId: req.user.id,
    });

    if (!result) {
      return res.status(404).json({ message: "Attempt not found." });
    }

    return res.json(result);
  } catch (error) {
    return next(error);
  }
};
