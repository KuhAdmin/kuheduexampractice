import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import {
  getBatchActivity,
  getBatchInsights,
  getTeacherBatches,
  getTeacherBatchStudents,
  getTeacherHome,
  getStudentInsightHandler,
  regenerateTeacherBatchCode,
  removeTeacherBatchStudent,
} from "../controllers/teacherController.js";
import {
  deletePaperItem,
  getFilterOptions,
  getMyCustomQuestions,
  getPaper,
  getPaperExcel,
  getPaperPdf,
  getPapers,
  postCustomQuestion,
  postFinalizePaper,
  postPaper,
  postSwapPaperItem,
} from "../controllers/teacherTestController.js";
import {
  getExam,
  getExamExcel,
  getExams,
  postAiAssist,
  postExam,
  putExamMarks,
} from "../controllers/gradebookController.js";
import {
  deletePlanEntry,
  deletePlanHandler,
  getPlanDetail,
  getPlanPdf,
  getPlans,
  postPlan,
  postPlanEntry,
  postPublishPlan,
  putPlan,
  putPlanEntry,
} from "../controllers/lessonPlanController.js";

const router = Router();

router.use(requireAuth, requireRole("teacher"));

router.get("/home", getTeacherHome);
router.get("/batches", getTeacherBatches);
router.get("/batches/:batchId/students", getTeacherBatchStudents);
router.put("/batches/:batchId/students/:userId/remove", removeTeacherBatchStudent);
router.post("/batches/:batchId/regenerate-code", regenerateTeacherBatchCode);
router.get("/batches/:batchId/insights", getBatchInsights);
router.get("/batches/:batchId/activity", getBatchActivity);
router.get("/batches/:batchId/students/:userId/insight", getStudentInsightHandler);

router.get("/test-lab/filter-options", getFilterOptions);
router.get("/test-papers", getPapers);
router.post("/test-papers", postPaper);
router.get("/test-papers/:paperId", getPaper);
router.post("/test-papers/:paperId/finalize", postFinalizePaper);
router.get("/test-papers/:paperId/export.pdf", getPaperPdf);
router.get("/test-papers/:paperId/export.xlsx", getPaperExcel);
router.delete("/test-papers/:paperId/items/:itemId", deletePaperItem);
router.post("/test-papers/:paperId/items/:itemId/swap", postSwapPaperItem);
router.post("/custom-questions", postCustomQuestion);
router.get("/custom-questions", getMyCustomQuestions);

router.get("/gradebook/exams", getExams);
router.post("/gradebook/exams", postExam);
router.get("/gradebook/exams/:examId", getExam);
router.put("/gradebook/exams/:examId/marks", putExamMarks);
router.post("/gradebook/exams/:examId/questions/:questionId/students/:userId/ai-assist", postAiAssist);
router.get("/gradebook/exams/:examId/export.xlsx", getExamExcel);

router.get("/lesson-plans", getPlans);
router.post("/lesson-plans", postPlan);
router.put("/lesson-plans/:planId", putPlan);
router.delete("/lesson-plans/:planId", deletePlanHandler);
router.post("/lesson-plans/:planId/publish", postPublishPlan);
router.get("/lesson-plans/:planId", getPlanDetail);
router.get("/lesson-plans/:planId/export.pdf", getPlanPdf);
router.post("/lesson-plans/:planId/entries", postPlanEntry);
router.put("/lesson-plans/:planId/entries/:entryId", putPlanEntry);
router.delete("/lesson-plans/:planId/entries/:entryId", deletePlanEntry);

export default router;
