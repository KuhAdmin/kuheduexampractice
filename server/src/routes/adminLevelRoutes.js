import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import {
  deleteLevelHandler,
  getLevels,
  postLevel,
  putLevel,
} from "../controllers/adminLevelController.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", getLevels);
router.post("/", postLevel);
router.put("/:levelId", putLevel);
router.delete("/:levelId", deleteLevelHandler);

export default router;
