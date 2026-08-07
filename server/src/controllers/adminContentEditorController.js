import {
  listBooksForPicker,
  getContentTreeForBook,
  listContentCardsForSection,
  updateContentCard,
  renameChapter,
  renameSection,
  renameConcept,
  setSectionVisibility,
  setConceptVisibility,
} from "../services/contentEditorService.js";
import { regenerateDiagramMedia } from "../services/diagramImageService.js";
import {
  regenerateMemoryHookMedia,
  updateMemoryHookPromptText,
  generateMemoryHookPrompt,
} from "../services/memoryHookImageService.js";
import {
  getExercisesActivitiesTabVisible,
  setExercisesActivitiesTabVisible,
} from "../services/contentEditorSettingsService.js";

export const getBooksHandler = async (_req, res, next) => {
  try {
    const books = await listBooksForPicker();
    return res.json({ books });
  } catch (error) {
    return next(error);
  }
};

export const getContentTreeHandler = async (req, res, next) => {
  try {
    const chapters = await getContentTreeForBook(req.params.bookId);
    return res.json({ chapters });
  } catch (error) {
    return next(error);
  }
};

export const putChapterNameHandler = async (req, res, next) => {
  try {
    const chapter = await renameChapter({
      bookId: req.params.bookId,
      chapterNumber: req.params.chapterNumber,
      chapterName: req.body?.chapterName,
    });
    return res.json({ chapter });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const putSectionNameHandler = async (req, res, next) => {
  try {
    const section = await renameSection({
      id: req.params.id,
      topicName: req.body?.topicName,
    });
    return res.json({ section });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const putConceptNameHandler = async (req, res, next) => {
  try {
    const concept = await renameConcept({
      assessmentUnitId: req.params.assessmentUnitId,
      primaryConcept: req.body?.primaryConcept,
    });
    return res.json({ concept });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const putSectionVisibilityHandler = async (req, res, next) => {
  try {
    const section = await setSectionVisibility({ id: req.params.id, isHidden: req.body?.isHidden });
    return res.json({ section });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const putConceptVisibilityHandler = async (req, res, next) => {
  try {
    const concept = await setConceptVisibility({
      assessmentUnitId: req.params.assessmentUnitId,
      isHidden: req.body?.isHidden,
    });
    return res.json({ concept });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
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

// content_card.details is always Array<{ label: string, value: string |
// string[] }> in practice (see AdminContentDetailsEditor.jsx, the only
// client-side producer of this shape now that the raw-JSON textarea is
// admin-only). Guards data integrity for any caller -- not a role check,
// since a moderator's requests never contain anything but this shape to
// begin with.
const isValidDetailsShape = (details) =>
  Array.isArray(details) &&
  details.every(
    (entry) => entry !== null && typeof entry === "object" && !Array.isArray(entry) && typeof entry.label === "string"
  );

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

    if (details !== undefined && !isValidDetailsShape(details)) {
      return res
        .status(400)
        .json({ message: "Details must be a list of fields, each with a label." });
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

export const getExercisesActivitiesTabVisibleHandler = async (_req, res, next) => {
  try {
    const visible = await getExercisesActivitiesTabVisible();
    return res.json({ visible });
  } catch (error) {
    return next(error);
  }
};

export const putExercisesActivitiesTabVisibleHandler = async (req, res, next) => {
  try {
    const visible = await setExercisesActivitiesTabVisible(Boolean(req.body?.visible), {
      updatedBy: req.user?.id || null,
    });
    return res.json({ visible });
  } catch (error) {
    return next(error);
  }
};
