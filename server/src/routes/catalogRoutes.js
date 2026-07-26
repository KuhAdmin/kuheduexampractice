import { Router } from "express";
import { getChapters } from "../controllers/catalogController.js";

const router = Router();

router.get("/chapters", getChapters);

export default router;
