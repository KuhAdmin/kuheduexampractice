import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import { postConceptImport } from "../controllers/adminConceptImportController.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.post("/", postConceptImport);

export default router;
