import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";
import {
  abortAssessmentStudioRun,
  addSourceSectionImageHandler,
  deleteAssessmentStudioRun,
  downloadAssessmentStudioRunAudit,
  generateAllMemoryHookImagesHandler,
  generateDiagramImageHandler,
  generateMemoryHookImageHandler,
  getAssessmentStudioCompletedRuns,
  getAssessmentUnitDiagramsHandler,
  getAssessmentStudioConcurrency,
  getAssessmentStudioLayerVersions,
  getAssessmentStudioRunNavigator,
  getAssessmentStudioRunAudit,
  getAssessmentStudioRunStatus,
  getAssessmentStudioRunStatusBatch,
  getDiagramMediaHandler,
  getMemoryHookMediaHandler,
  getPendingChapterExerciseQuestionsHandler,
  getSourceDocumentPdfHandler,
  getSourceSectionDraftHandler,
  initializeAssessmentStudioDatabase,
  removeSourceSectionImageHandler,
  rerunAssessmentStudioLayer,
  reviewChapterExerciseQuestionHandler,
  runAssessmentStudioPipeline,
  saveSourceDocumentPdfHandler,
  saveSourceSectionDraftHandler,
  selectAssessmentStudioLayerVersionHandler,
  updateSourceSectionHandler,
  uploadChapterExerciseHandler,
  uploadDiagramMediaHandler,
  uploadMemoryHookMediaHandler,
} from "../controllers/assessmentStudioController.js";

const router = Router();

router.use(requireAuth);

router.post("/admin/db/initialize", requireAdmin, initializeAssessmentStudioDatabase);

router.post("/sections/draft", requireAdmin, saveSourceSectionDraftHandler);
router.get("/sections/:sourceSectionId", requireAdmin, getSourceSectionDraftHandler);
router.put("/sections/:sourceSectionId", requireAdmin, updateSourceSectionHandler);
router.post("/sections/:sourceSectionId/images", requireAdmin, addSourceSectionImageHandler);
router.delete("/sections/:sourceSectionId/images/:imageId", requireAdmin, removeSourceSectionImageHandler);
router.post("/documents/:sourceDocumentId/pdf", requireAdmin, saveSourceDocumentPdfHandler);
router.get("/documents/:sourceDocumentId/pdf", requireAdmin, getSourceDocumentPdfHandler);

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

router.get(
  "/assessment-units/:assessmentUnitId/diagrams",
  requireAdmin,
  getAssessmentUnitDiagramsHandler
);
router.get("/diagrams/:diagramId/media", requireAdmin, getDiagramMediaHandler);
router.post("/diagrams/:diagramId/media/upload", requireAdmin, uploadDiagramMediaHandler);
router.post("/diagrams/:diagramId/media/generate", requireAdmin, generateDiagramImageHandler);

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
