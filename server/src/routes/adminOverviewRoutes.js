import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import { getOverviewStatsHandler } from "../controllers/adminOverviewController.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", getOverviewStatsHandler);

export default router;
