import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import {
  deleteDemoSubmissionHandler,
  getDemoSubmissionById,
  getDemoSubmissions,
  postDemoSubmission,
} from "../controllers/adminDemoController.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", getDemoSubmissions);
router.get("/:submissionId", getDemoSubmissionById);
router.post("/", postDemoSubmission);
router.delete("/:submissionId", deleteDemoSubmissionHandler);

export default router;
