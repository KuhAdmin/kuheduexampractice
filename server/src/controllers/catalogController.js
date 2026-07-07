import {
  getAssessmentStudioBootstrap,
  getAssessmentStudioChapters,
  getAssessmentStudioSections,
  listChapters,
} from "../services/catalogService.js";

const parseBoolean = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
};

export const getChapters = async (req, res, next) => {
  try {
    const { bookId, chapterNumber, sectionPrefix, isActive } = req.query;
    const normalizedIsActive = parseBoolean(isActive);

    if (isActive !== undefined && normalizedIsActive === null) {
      return res.status(400).json({
        message: "isActive must be either 'true' or 'false'.",
      });
    }

    const chapters = await listChapters({
      bookId: bookId || undefined,
      chapterNumber: chapterNumber || undefined,
      sectionPrefix: sectionPrefix || undefined,
      isActive: normalizedIsActive,
    });

    return res.json({ chapters });
  } catch (error) {
    return next(error);
  }
};

export const getAssessmentStudioBootstrapOptions = async (req, res, next) => {
  try {
    const { levelCode } = req.query;
    const catalog = await getAssessmentStudioBootstrap({
      levelCode: levelCode || undefined,
    });

    return res.json(catalog);
  } catch (error) {
    return next(error);
  }
};

export const getAssessmentStudioChapterOptions = async (req, res, next) => {
  try {
    const { levelCode, subjectCode, excludeCompleted, targetLayerNumber } = req.query;
    const catalog = await getAssessmentStudioChapters({
      levelCode: levelCode || undefined,
      subjectCode: subjectCode || undefined,
      excludeCompleted: excludeCompleted === "true",
      targetLayerNumber: targetLayerNumber ? Number(targetLayerNumber) : undefined,
    });

    return res.json(catalog);
  } catch (error) {
    return next(error);
  }
};

export const getAssessmentStudioSectionOptions = async (req, res, next) => {
  try {
    const { levelCode, subjectCode, chapterKey, targetLayerNumber } = req.query;
    const catalog = await getAssessmentStudioSections({
      levelCode: levelCode || undefined,
      subjectCode: subjectCode || undefined,
      chapterKey: chapterKey || undefined,
      targetLayerNumber: targetLayerNumber ? Number(targetLayerNumber) : undefined,
    });

    return res.json(catalog);
  } catch (error) {
    return next(error);
  }
};
