import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import {
  getChaptersForBookHandler,
  postChapterHandler,
  putChapterActiveHandler,
  putChapterHiddenHandler,
} from "../controllers/adminChapterController.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/book/:bookId", getChaptersForBookHandler);
router.post("/", postChapterHandler);
router.put("/:bookId/:chapterNumber/active", putChapterActiveHandler);
router.put("/:bookId/:chapterNumber/hidden", putChapterHiddenHandler);

export default router;
