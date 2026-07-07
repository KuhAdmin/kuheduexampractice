import { Router } from "express";
import {
  getAssessmentStudioBootstrapOptions,
  getAssessmentStudioChapterOptions,
  getAssessmentStudioSectionOptions,
  getChapters,
} from "../controllers/catalogController.js";

const router = Router();

router.get("/assessment-studio/bootstrap", getAssessmentStudioBootstrapOptions);
router.get("/assessment-studio/chapters", getAssessmentStudioChapterOptions);
router.get("/assessment-studio/sections", getAssessmentStudioSectionOptions);
router.get("/chapters", getChapters);

export default router;
