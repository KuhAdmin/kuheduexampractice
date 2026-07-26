import {
  extractChapterExerciseQuestions,
  listPendingChapterExerciseQuestions,
  reviewChapterExerciseQuestion,
} from "../services/chapterExerciseService.js";

export const uploadChapterExerciseHandler = async (req, res, next) => {
  try {
    const result = await extractChapterExerciseQuestions({
      fkMstBookId: req.params.bookId,
      chapterNumber: req.params.chapterNumber,
      chapterName: req.body?.chapterName || null,
      imageDataUrl: req.body?.dataUrl,
      mimeType: req.body?.mimeType,
      pipelineJobId: req.body?.pipelineJobId || null,
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

export const getPendingChapterExerciseQuestionsHandler = async (req, res, next) => {
  try {
    const result = await listPendingChapterExerciseQuestions({
      fkMstBookId: req.params.bookId,
      chapterNumber: req.params.chapterNumber,
    });
    return res.json({ questions: result });
  } catch (error) {
    return next(error);
  }
};

export const reviewChapterExerciseQuestionHandler = async (req, res, next) => {
  try {
    const result = await reviewChapterExerciseQuestion({
      questionId: req.params.questionId,
      decision: req.body?.decision,
      reviewerId: req.user?.id || null,
    });
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};
