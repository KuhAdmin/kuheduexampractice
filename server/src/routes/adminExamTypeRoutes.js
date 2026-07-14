import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import {
  deleteExamTypeHandler,
  getExamTypes,
  postExamType,
  putExamType,
} from "../controllers/adminExamTypeController.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", getExamTypes);
router.post("/", postExamType);
router.put("/:examTypeId", putExamType);
router.delete("/:examTypeId", deleteExamTypeHandler);

export default router;
