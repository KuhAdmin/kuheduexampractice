import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import {
  getUsers,
  postUser,
  putUserRole,
  putSuperstudentAccess,
  putUserPassword,
} from "../controllers/adminUserController.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", getUsers);
router.post("/", postUser);
router.put("/:userId/role", putUserRole);
router.put("/:userId/superstudent-access", putSuperstudentAccess);
router.put("/:userId/password", putUserPassword);

export default router;
