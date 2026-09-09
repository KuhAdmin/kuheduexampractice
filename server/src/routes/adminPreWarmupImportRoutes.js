import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import { postPreWarmupImport } from "../controllers/adminPreWarmupImportController.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.post("/", postPreWarmupImport);

export default router;
