import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";
import {
  getAssessmentUnitDiagramsHandler,
  getDiagramMediaHandler,
  getMemoryHookMediaHandler,
  uploadDiagramMediaHandler,
  uploadMemoryHookMediaHandler,
} from "../controllers/mediaAdminController.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/memory-hooks/:assessmentUnitId",
  requireAdmin,
  getMemoryHookMediaHandler
);
router.post(
  "/memory-hooks/:assessmentUnitId/:sectionKey/upload",
  requireAdmin,
  uploadMemoryHookMediaHandler
);

router.get(
  "/diagrams/unit/:assessmentUnitId",
  requireAdmin,
  getAssessmentUnitDiagramsHandler
);
router.get("/diagrams/:diagramId", requireAdmin, getDiagramMediaHandler);
router.post("/diagrams/:diagramId/upload", requireAdmin, uploadDiagramMediaHandler);

export default router;
