import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import {
  getAllTasks,
  getAssignableSections,
  getMyTasks,
  getTaskDetail,
  postAdminDecision,
  postModeratorDecision,
  postTask,
} from "../controllers/moderationController.js";

const router = Router();

router.use(requireAuth);

router.get("/assignable-sections", requireRole("admin"), getAssignableSections);
router.post("/tasks", requireRole("admin"), postTask);
router.get("/tasks/mine", requireRole("moderator"), getMyTasks);
router.get("/tasks", requireRole("admin"), getAllTasks);
router.get("/tasks/:reviewQueueId", requireRole("admin", "moderator"), getTaskDetail);
router.post("/tasks/:reviewQueueId/moderator-decision", requireRole("moderator"), postModeratorDecision);
router.post("/tasks/:reviewQueueId/admin-decision", requireRole("admin"), postAdminDecision);

export default router;
