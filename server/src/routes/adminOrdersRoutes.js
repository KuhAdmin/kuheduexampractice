import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import { getOrders, getOrdersSummaryHandler, exportOrders } from "../controllers/adminOrdersController.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", getOrders);
router.get("/summary", getOrdersSummaryHandler);
router.get("/export", exportOrders);

export default router;
