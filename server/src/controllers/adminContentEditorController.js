import {
  listBooksForPicker,
  listChaptersForBook,
  listContentCardsForSection,
  updateContentCard,
} from "../services/contentEditorService.js";
import { regenerateDiagramMedia } from "../services/diagramImageService.js";
import {
  regenerateMemoryHookMedia,
  updateMemoryHookPromptText,
  generateMemoryHookPrompt,
} from "../services/memoryHookImageService.js";

export const getBooksHandler = async (_req, res, next) => {
  try {
    const books = await listBooksForPicker();
    return res.json({ books });
  } catch (error) {
    return next(error);
  }
};

export const getChaptersHandler = async (req, res, next) => {
  try {
    const chapters = await listChaptersForBook(req.params.bookId);
    return res.json({ chapters });
  } catch (error) {
    return next(error);
  }
};

export const getCardsHandler = async (req, res, next) => {
  try {
    const cards = await listContentCardsForSection(req.params.sourceSectionId);
    return res.json({ cards });
  } catch (error) {
    return next(error);
  }
};

export const putCardHandler = async (req, res, next) => {
  try {
    let details = req.body?.details;
    if (typeof details === "string") {
      try {
        details = JSON.parse(details);
      } catch {
        return res.status(400).json({ message: "Details must be valid JSON." });
      }
    }

    const card = await updateContentCard(req.params.cardId, {
      title: req.body?.title,
      summary: req.body?.summary,
      details,
      isHidden: req.body?.isHidden,
    });
    return res.json({ card });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const postRegenerateDiagramHandler = async (req, res, next) => {
  try {
    const result = await regenerateDiagramMedia({
      contentCardId: req.params.cardId,
      prompt: req.body?.prompt,
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

export const postRegenerateMemoryHookHandler = async (req, res, next) => {
  try {
    const result = await regenerateMemoryHookMedia({
      assessmentUnitId: req.params.assessmentUnitId,
      sectionKey: req.params.sectionKey,
      prompt: req.body?.prompt,
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

export const postGenerateMemoryHookPromptHandler = async (req, res, next) => {
  try {
    const result = await generateMemoryHookPrompt({
      assessmentUnitId: req.params.assessmentUnitId,
      sectionKey: req.params.sectionKey,
    });
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const putMemoryHookPromptHandler = async (req, res, next) => {
  try {
    const result = await updateMemoryHookPromptText({
      assessmentUnitId: req.params.assessmentUnitId,
      sectionKey: req.params.sectionKey,
      promptText: req.body?.prompt,
    });
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};
