import {
  getAssessmentResult,
  getMindMapForSection,
  listRecentAttemptsForChapter,
  listRecentAttemptsForConcept,
  listRecentAttemptsForSection,
  restartAssessment,
  restartChapterAssessment,
  startOrResumeAssessment,
  startOrResumeChapterAssessment,
  startOrResumeConceptAssessment,
  submitAnswer,
  submitAssessment,
} from "../services/studentPracticeService.js";

const chapterAssessmentContext = (req) => ({
  board: req.user.board,
  studentClass: req.user.studentClass,
  subject: req.user.subject,
  chapterNumber: req.params.chapterNumber,
  userId: req.user.id,
});

export const startAssessment = async (req, res, next) => {
  try {
    const result = await startOrResumeAssessment({
      sourceSectionId: req.params.sourceSectionId,
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

export const startConceptAssessment = async (req, res, next) => {
  try {
    const result = await startOrResumeConceptAssessment({
      assessmentUnitId: req.params.assessmentUnitId,
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

export const restartAssessmentHandler = async (req, res, next) => {
  try {
    const result = await restartAssessment({
      sourceSectionId: req.params.sourceSectionId,
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

export const startChapterAssessment = async (req, res, next) => {
  try {
    const result = await startOrResumeChapterAssessment(chapterAssessmentContext(req));
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const restartChapterAssessmentHandler = async (req, res, next) => {
  try {
    const result = await restartChapterAssessment(chapterAssessmentContext(req));
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const getRecentChapterAttempts = async (req, res, next) => {
  try {
    const result = await listRecentAttemptsForChapter(chapterAssessmentContext(req));
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const getRecentAttempts = async (req, res, next) => {
  try {
    const result = await listRecentAttemptsForSection({
      sourceSectionId: req.params.sourceSectionId,
      userId: req.user.id,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const getRecentConceptAttempts = async (req, res, next) => {
  try {
    const result = await listRecentAttemptsForConcept({
      assessmentUnitId: req.params.assessmentUnitId,
      userId: req.user.id,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const answerAssessmentItem = async (req, res, next) => {
  try {
    const result = await submitAnswer({
      attemptId: req.params.attemptId,
      displayOrder: Number(req.params.displayOrder),
      studentAnswer: req.body?.studentAnswer,
      timeTakenSeconds: req.body?.timeTakenSeconds,
      userId: req.user.id,
      sourcePageImages: req.body?.sourcePageImages,
    });

    if (!result) {
      return res.status(404).json({ message: "Attempt or question not found." });
    }

    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const finishAssessment = async (req, res, next) => {
  try {
    const result = await submitAssessment({
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

export const getAssessmentResultHandler = async (req, res, next) => {
  try {
    const result = await getAssessmentResult({
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

export const getMindMap = async (req, res, next) => {
  try {
    const result = await getMindMapForSection(req.params.sourceSectionId);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};
