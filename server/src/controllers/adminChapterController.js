import { createChapter, listChaptersForBook, setChapterActive, setChapterHidden } from "../services/adminChapterService.js";

const handleError = (error, res, next) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  return next(error);
};

export const getChaptersForBookHandler = async (req, res, next) => {
  try {
    const chapters = await listChaptersForBook(req.params.bookId);
    return res.json({ chapters });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const postChapterHandler = async (req, res, next) => {
  try {
    const chapter = await createChapter({
      bookId: req.body?.bookId,
      chapterNumber: req.body?.chapterNumber,
      chapterName: req.body?.chapterName,
      displayOrder: req.body?.displayOrder,
    });
    return res.status(201).json({ chapter });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const putChapterActiveHandler = async (req, res, next) => {
  try {
    await setChapterActive({
      bookId: req.params.bookId,
      chapterNumber: req.params.chapterNumber,
      isActive: req.body?.isActive,
    });
    return res.status(204).send();
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const putChapterHiddenHandler = async (req, res, next) => {
  try {
    await setChapterHidden({
      bookId: req.params.bookId,
      chapterNumber: req.params.chapterNumber,
      isHidden: req.body?.isHidden,
    });
    return res.status(204).send();
  } catch (error) {
    return handleError(error, res, next);
  }
};
