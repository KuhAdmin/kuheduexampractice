import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";
import {
  abortAssessmentStudioRun,
  deleteAssessmentStudioRun,
  downloadAssessmentStudioRunAudit,
  generateAllMemoryHookImagesHandler,
  generateMemoryHookImageHandler,
  getAssessmentStudioCompletedRuns,
  getAssessmentStudioConcurrency,
  getAssessmentStudioLayerVersions,
  getAssessmentStudioRunNavigator,
  getAssessmentStudioRunAudit,
  getAssessmentStudioRunStatus,
  getAssessmentStudioRunStatusBatch,
  getMemoryHookMediaHandler,
  getPendingChapterExerciseQuestionsHandler,
  initializeAssessmentStudioDatabase,
  rerunAssessmentStudioLayer,
  reviewChapterExerciseQuestionHandler,
  runAssessmentStudioPipeline,
  selectAssessmentStudioLayerVersionHandler,
  uploadChapterExerciseHandler,
  uploadMemoryHookMediaHandler,
} from "../controllers/assessmentStudioController.js";

const router = Router();

router.use(requireAuth);

router.post("/admin/db/initialize", requireAdmin, initializeAssessmentStudioDatabase);

router.post("/pipeline/run", runAssessmentStudioPipeline);
router.get("/pipeline/navigation", getAssessmentStudioRunNavigator);
router.get("/pipeline/status-batch", getAssessmentStudioRunStatusBatch);
router.get("/pipeline/concurrency", getAssessmentStudioConcurrency);
router.get("/pipeline/completed", requireAdmin, getAssessmentStudioCompletedRuns);
router.get("/pipeline/:jobId", getAssessmentStudioRunStatus);
router.get("/pipeline/:jobId/audit", getAssessmentStudioRunAudit);
router.get("/pipeline/:jobId/audit.txt", downloadAssessmentStudioRunAudit);
router.post("/pipeline/:jobId/abort", abortAssessmentStudioRun);
router.post("/pipeline/:jobId/layers/:layerNumber/rerun", requireAdmin, rerunAssessmentStudioLayer);
router.get("/pipeline/:jobId/layers/:layerNumber/versions", requireAdmin, getAssessmentStudioLayerVersions);
router.post(
  "/assessment-units/:assessmentUnitId/layers/:layerNumber/versions/:generationId/select",
  requireAdmin,
  selectAssessmentStudioLayerVersionHandler
);
router.delete("/pipeline/:jobId", requireAdmin, deleteAssessmentStudioRun);

router.get(
  "/assessment-units/:assessmentUnitId/memory-hook-media",
  requireAdmin,
  getMemoryHookMediaHandler
);
router.post(
  "/assessment-units/:assessmentUnitId/memory-hook-media/:sectionKey/upload",
  requireAdmin,
  uploadMemoryHookMediaHandler
);
router.post(
  "/assessment-units/:assessmentUnitId/memory-hook-images/:sectionKey/generate",
  requireAdmin,
  generateMemoryHookImageHandler
);
router.post(
  "/assessment-units/:assessmentUnitId/memory-hook-images/generate-all",
  requireAdmin,
  generateAllMemoryHookImagesHandler
);

router.post(
  "/chapters/:bookId/:chapterNumber/exercises/upload",
  requireAdmin,
  uploadChapterExerciseHandler
);
router.get(
  "/chapters/:bookId/:chapterNumber/exercises/pending",
  requireAdmin,
  getPendingChapterExerciseQuestionsHandler
);
router.post(
  "/chapters/exercises/:questionId/review",
  requireAdmin,
  reviewChapterExerciseQuestionHandler
);

export default router;
