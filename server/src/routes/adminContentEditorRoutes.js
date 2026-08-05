import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import {
  getBooksHandler,
  getChaptersHandler,
  getCardsHandler,
  putCardHandler,
  postRegenerateDiagramHandler,
  postRegenerateMemoryHookHandler,
  postGenerateMemoryHookPromptHandler,
  putMemoryHookPromptHandler,
} from "../controllers/adminContentEditorController.js";

const router = Router();

// Content moderators are only ever granted this one admin route group --
// see AdminLayout.jsx's menu filtering and App.jsx's /admin guard.
router.use(requireAuth, requireRole("admin", "moderator"));

router.get("/books", getBooksHandler);
router.get("/books/:bookId/chapters", getChaptersHandler);
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

export default router;
