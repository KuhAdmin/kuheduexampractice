import {
  getAssessmentExtraForUnit,
  getConceptCard,
  getDiagramsForSourceSection,
  getFlashcardsForSection,
  getLearningMap,
  getMemoryBoosterForSection,
  getMemoryBoosterForUnit,
  getRevisionForSection,
  getSectionOverview,
  getTutorNotesForSection,
  getVisualLearningItemsForSection,
  listSectionsForChapter,
} from "../services/studentContentService.js";
import { getMemoryHookMediaForSection, uploadMemoryHookMedia } from "../services/memoryHookImageService.js";
import { getDiagramMedia } from "../services/diagramImageService.js";
import {
  getMostRecentMicroActivityResponse,
  gradeMicroActivityResponse,
} from "../services/microActivityService.js";
import {
  getBookQuestionsForStudent,
  submitBookQuestionResponseForStudent,
} from "../services/chapterExerciseService.js";

const studentAcademicContext = (req) => ({
  board: req.user.board,
  studentClass: req.user.studentClass,
  subject: req.user.subject,
  userId: req.user.id,
});

export const getStudentSections = async (req, res, next) => {
  try {
    const result = await listSectionsForChapter({
      ...studentAcademicContext(req),
      examGoalCode: req.query.examGoalCode || undefined,
      levelCode: req.query.levelCode || undefined,
      subjectCode: req.query.subjectCode || undefined,
      chapterNumber: String(req.query.chapterNumber || ""),
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const getStudentSectionOverview = async (req, res, next) => {
  try {
    const result = await getSectionOverview({
      sourceSectionId: req.params.sourceSectionId,
      userId: req.user.id,
    });

    if (!result) {
      return res.status(404).json({ message: "This section has not been generated yet." });
    }

    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const getStudentLearningMap = async (req, res, next) => {
  try {
    const result = await getLearningMap({
      sourceSectionId: req.params.sourceSectionId,
      userId: req.user.id,
    });

    if (!result) {
      return res.status(404).json({ message: "This section has not been generated yet." });
    }

    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const getStudentConceptCard = async (req, res, next) => {
  try {
    const result = await getConceptCard({ assessmentUnitId: req.params.assessmentUnitId });

    if (!result) {
      return res.status(404).json({ message: "This concept has not been generated yet." });
    }

    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const getStudentConceptChallenges = async (req, res, next) => {
  try {
    const result = await getAssessmentExtraForUnit({ assessmentUnitId: req.params.assessmentUnitId });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const getStudentConceptSectionMedia = async (req, res, next) => {
  try {
    const media = await getMemoryHookMediaForSection(
      req.params.assessmentUnitId,
      req.params.sectionKey
    );

    return res.json({ media });
  } catch (error) {
    return next(error);
  }
};

// Student-facing upload for a missing Explore-step visual/video -- becomes
// the shared, official media for this concept section (same
// memory_hook_media table/versioning the admin workbench uses), by design:
// there is no separate per-student copy.
export const uploadStudentConceptSectionMedia = async (req, res, next) => {
  try {
    const result = await uploadMemoryHookMedia({
      assessmentUnitId: req.params.assessmentUnitId,
      sectionKey: req.params.sectionKey,
      dataUrl: req.body?.dataUrl,
      fileName: req.body?.fileName || null,
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

export const getStudentMemoryBoosterForUnit = async (req, res, next) => {
  try {
    const result = await getMemoryBoosterForUnit({
      assessmentUnitId: req.params.assessmentUnitId,
    });

    if (!result) {
      return res.status(404).json({ message: "No memory aid has been generated for this concept yet." });
    }

    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const getStudentMemoryBoosterForSection = async (req, res, next) => {
  try {
    const result = await getMemoryBoosterForSection({
      sourceSectionId: req.params.sourceSectionId,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const getStudentFlashcards = async (req, res, next) => {
  try {
    const result = await getFlashcardsForSection({
      sourceSectionId: req.params.sourceSectionId,
    });
    return res.json({ flashcards: result });
  } catch (error) {
    return next(error);
  }
};

export const getStudentRevision = async (req, res, next) => {
  try {
    const result = await getRevisionForSection({ sourceSectionId: req.params.sourceSectionId });
    return res.json({ items: result });
  } catch (error) {
    return next(error);
  }
};

export const getStudentTutorNotes = async (req, res, next) => {
  try {
    const result = await getTutorNotesForSection({ sourceSectionId: req.params.sourceSectionId });
    return res.json({ items: result });
  } catch (error) {
    return next(error);
  }
};

export const getStudentVisualLearningItems = async (req, res, next) => {
  try {
    const result = await getVisualLearningItemsForSection({
      sourceSectionId: req.params.sourceSectionId,
    });
    return res.json({ items: result });
  } catch (error) {
    return next(error);
  }
};

export const getStudentDiagrams = async (req, res, next) => {
  try {
    const result = await getDiagramsForSourceSection({
      sourceSectionId: req.params.sourceSectionId,
    });
    return res.json({ diagrams: result });
  } catch (error) {
    return next(error);
  }
};

export const getStudentDiagramMedia = async (req, res, next) => {
  try {
    const media = await getDiagramMedia(req.params.diagramId);
    return res.json({ media });
  } catch (error) {
    return next(error);
  }
};

export const getMicroActivityResponseHandler = async (req, res, next) => {
  try {
    const result = await getMostRecentMicroActivityResponse({
      assessmentUnitId: req.params.assessmentUnitId,
      userId: req.user.id,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const submitMicroActivityResponseHandler = async (req, res, next) => {
  try {
    const result = await gradeMicroActivityResponse({
      assessmentUnitId: req.params.assessmentUnitId,
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

export const getStudentBookQuestions = async (req, res, next) => {
  try {
    const result = await getBookQuestionsForStudent({
      ...studentAcademicContext(req),
      chapterNumber: String(req.params.chapterNumber || ""),
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const submitStudentBookQuestionResponse = async (req, res, next) => {
  try {
    const result = await submitBookQuestionResponseForStudent({
      ...studentAcademicContext(req),
      chapterNumber: String(req.params.chapterNumber || ""),
      questionId: req.params.questionId,
      studentAnswer: req.body?.studentAnswer,
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
