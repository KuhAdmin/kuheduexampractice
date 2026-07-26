import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";
import {
  getPendingChapterExerciseQuestionsHandler,
  reviewChapterExerciseQuestionHandler,
  uploadChapterExerciseHandler,
} from "../controllers/chapterExerciseAdminController.js";

const router = Router();

router.use(requireAuth);

router.post(
  "/:bookId/:chapterNumber/upload",
  requireAdmin,
  uploadChapterExerciseHandler
);
router.get(
  "/:bookId/:chapterNumber/pending",
  requireAdmin,
  getPendingChapterExerciseQuestionsHandler
);
router.post(
  "/:questionId/review",
  requireAdmin,
  reviewChapterExerciseQuestionHandler
);

export default router;
