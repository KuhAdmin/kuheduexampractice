import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import {
  deleteSubjectHandler,
  getSubjects,
  postSubject,
  putSubject,
} from "../controllers/adminSubjectController.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", getSubjects);
router.post("/", postSubject);
router.put("/:subjectId", putSubject);
router.delete("/:subjectId", deleteSubjectHandler);

export default router;
