import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";
import {
  getAiModelSettings,
  updateActiveAiModel,
  updateLayerAiModelOverride,
} from "../controllers/settingsController.js";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/ai-model", getAiModelSettings);
router.put("/ai-model", updateActiveAiModel);
router.put("/ai-model/layer-overrides", updateLayerAiModelOverride);

export default router;
