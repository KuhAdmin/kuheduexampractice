import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import { getUsers, postUser, putUserRole } from "../controllers/adminUserController.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", getUsers);
router.post("/", postUser);
router.put("/:userId/role", putUserRole);

export default router;
