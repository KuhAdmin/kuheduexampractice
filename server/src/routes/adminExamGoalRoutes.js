import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import {
  deleteExamGoalHandler,
  getExamGoalOptions,
  getExamGoals,
  postExamGoal,
  putExamGoal,
} from "../controllers/adminExamGoalController.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", getExamGoals);
router.get("/options", getExamGoalOptions);
router.post("/", postExamGoal);
router.put("/:examGoalId", putExamGoal);
router.delete("/:examGoalId", deleteExamGoalHandler);

export default router;
