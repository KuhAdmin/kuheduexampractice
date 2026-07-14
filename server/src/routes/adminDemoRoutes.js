import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import {
  deleteDemoSubmissionHandler,
  getDemoModelSettings,
  getDemoSubmissionById,
  getDemoSubmissions,
  postDemoSubmission,
  putDemoSubjectModelOverride,
} from "../controllers/adminDemoController.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

// Static routes MUST be registered before the /:submissionId param routes
// below -- otherwise Express matches GET /model-settings against
// /:submissionId first (param routes match any single path segment),
// passing "model-settings" as a bigint id and throwing an uncaught Postgres
// invalid-input-syntax error.
router.get("/model-settings", getDemoModelSettings);
router.put("/model-settings/:subjectCode", putDemoSubjectModelOverride);

router.get("/", getDemoSubmissions);
router.get("/:submissionId", getDemoSubmissionById);
router.post("/", postDemoSubmission);
router.delete("/:submissionId", deleteDemoSubmissionHandler);

export default router;
