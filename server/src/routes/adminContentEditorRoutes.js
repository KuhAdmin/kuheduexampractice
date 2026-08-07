import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import {
  getBooksHandler,
  getContentTreeHandler,
  putChapterNameHandler,
  putSectionNameHandler,
  putConceptNameHandler,
  getCardsHandler,
  putCardHandler,
  postRegenerateDiagramHandler,
  postRegenerateMemoryHookHandler,
  postGenerateMemoryHookPromptHandler,
  putMemoryHookPromptHandler,
  getExercisesActivitiesTabVisibleHandler,
  putExercisesActivitiesTabVisibleHandler,
} from "../controllers/adminContentEditorController.js";

const router = Router();

// Content moderators are only ever granted this one admin route group --
// see AdminLayout.jsx's menu filtering and App.jsx's /admin guard.
router.use(requireAuth, requireRole("admin", "moderator"));

router.get("/books", getBooksHandler);
router.get("/books/:bookId/tree", getContentTreeHandler);
router.put("/books/:bookId/chapters/:chapterNumber/name", putChapterNameHandler);
router.put("/chapters/:id/name", putSectionNameHandler);
router.put("/concepts/:assessmentUnitId/name", putConceptNameHandler);
router.get("/sections/:sourceSectionId/cards", getCardsHandler);
router.put("/cards/:cardId", putCardHandler);
router.post("/cards/:cardId/regenerate-image", postRegenerateDiagramHandler);
router.post(
  "/memory-hooks/:assessmentUnitId/:sectionKey/regenerate-image",
  postRegenerateMemoryHookHandler
);
router.post(
  "/memory-hooks/:assessmentUnitId/:sectionKey/generate-prompt",
  postGenerateMemoryHookPromptHandler
);
router.put(
  "/memory-hooks/:assessmentUnitId/:sectionKey/prompt",
  putMemoryHookPromptHandler
);
router.get("/settings/exercises-activities-tab", getExercisesActivitiesTabVisibleHandler);
router.put("/settings/exercises-activities-tab", putExercisesActivitiesTabVisibleHandler);

export default router;
