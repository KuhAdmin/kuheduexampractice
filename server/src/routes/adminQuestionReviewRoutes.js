import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import { getPendingQuestions, postReviewDecision } from "../controllers/adminQuestionReviewController.js";

const router = Router();

router.use(requireAuth, requireRole("admin", "moderator"));

router.get("/", getPendingQuestions);
router.put("/:itemId", postReviewDecision);

export default router;
