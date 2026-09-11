import {
  gradeAndPersistWritingPracticeResponse,
  getMostRecentWritingPracticeResponse,
  getWritingPracticeCategoryWithSubcategories,
  getWritingPracticeQuestionDetail,
  listWritingPracticeCategories,
  listWritingPracticeQuestions,
} from "../services/writingPracticeService.js";

export const getWritingPracticeCategories = async (req, res, next) => {
  try {
    const result = await listWritingPracticeCategories();
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const getWritingPracticeCategoryDetail = async (req, res, next) => {
  try {
    const result = await getWritingPracticeCategoryWithSubcategories(req.params.categorySlug);
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const getWritingPracticeQuestions = async (req, res, next) => {
  try {
    const result = await listWritingPracticeQuestions(req.params.categorySlug, req.params.subCategorySlug);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const getWritingPracticeQuestionDetailHandler = async (req, res, next) => {
  try {
    const result = await getWritingPracticeQuestionDetail(req.params.questionId);
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const getWritingPracticeResponseHandler = async (req, res, next) => {
  try {
    const result = await getMostRecentWritingPracticeResponse({
      questionId: req.params.questionId,
      userId: req.user.id,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const postWritingPracticeSubmit = async (req, res, next) => {
  try {
    const result = await gradeAndPersistWritingPracticeResponse({
      questionId: req.params.questionId,
      userId: req.user.id,
      responseText: req.body?.responseText,
      sourcePageImages: req.body?.sourcePageImages,
    });
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};
