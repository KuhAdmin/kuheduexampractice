import {
  getChapterHotsPreview,
  startOrResumeChapterHots,
  submitHotsAnswer,
} from "../services/studentPreWarmupService.js";

const chapterHotsContext = (req) => ({
  board: req.user.board,
  studentClass: req.user.studentClass,
  subject: req.user.subject,
  chapterNumber: req.params.chapterNumber,
  userId: req.user.id,
});

export const getChapterHotsPreviewHandler = async (req, res, next) => {
  try {
    const result = await getChapterHotsPreview(chapterHotsContext(req));
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const startChapterHots = async (req, res, next) => {
  try {
    const result = await startOrResumeChapterHots(chapterHotsContext(req));
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const answerHotsItem = async (req, res, next) => {
  try {
    const result = await submitHotsAnswer({
      attemptId: req.params.attemptId,
      displayOrder: Number(req.params.displayOrder),
      studentAnswer: req.body?.studentAnswer,
      timeTakenSeconds: req.body?.timeTakenSeconds,
      userId: req.user.id,
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
