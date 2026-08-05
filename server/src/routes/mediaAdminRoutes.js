import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import {
  getAssessmentUnitDiagramsHandler,
  getDiagramMediaHandler,
  getMemoryHookMediaHandler,
  uploadDiagramMediaHandler,
  uploadMemoryHookMediaHandler,
} from "../controllers/mediaAdminController.js";

const router = Router();

// Widened to moderator alongside admin -- manual image upload is one of
// the "editor" capabilities content moderators need (AI regeneration is
// handled separately by adminContentEditorRoutes.js).
const requireAdminOrModerator = requireRole("admin", "moderator");

router.use(requireAuth);

router.get(
  "/memory-hooks/:assessmentUnitId",
  requireAdminOrModerator,
  getMemoryHookMediaHandler
);
router.post(
  "/memory-hooks/:assessmentUnitId/:sectionKey/upload",
  requireAdminOrModerator,
  uploadMemoryHookMediaHandler
);

router.get(
  "/diagrams/unit/:assessmentUnitId",
  requireAdminOrModerator,
  getAssessmentUnitDiagramsHandler
);
router.get("/diagrams/:diagramId", requireAdminOrModerator, getDiagramMediaHandler);
router.post("/diagrams/:diagramId/upload", requireAdminOrModerator, uploadDiagramMediaHandler);

export default router;
