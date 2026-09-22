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
  putPaperAssignment,
  putPaperItemMarks,
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
  getAssistantHistoryList,
  getColleagues,
  getDashboardSummary,
  getPlanDetail,
  getPlanExcel,
  getPlanFilterOptions,
  getPlanPdf,
  getPlans,
  getSharedPlanDetail,
  getSharedWithMePlans,
  postAssistantHistoryEntry,
  postAssistantQuestion,
  postCloneSharedPlan,
  postGeneratePlan,
  postPlan,
  postPlanEntriesBulk,
  postPlanEntriesReorder,
  postPlanEntry,
  postPlanEntryDuplicate,
  postPublishPlan,
  postRateSharedPlan,
  postSharePlan,
  putPlan,
  putPlanEntry,
} from "../controllers/lessonPlanController.js";
import {
  deleteMasterPlanHandler,
  getMasterPlanByChapterHandler,
  getMasterPlanDetail,
  getMasterPlanPdf,
  getMasterPlans,
  getSharedMasterPlanDetail,
  getSharedMasterPlansWithMe,
  postGenerateMasterPlan,
  postMasterPlan,
  postPublishMasterPlan,
  postShareMasterPlan,
  putMasterPlan,
} from "../controllers/masterLessonPlanController.js";

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
router.put("/test-papers/:paperId/items/:itemId/marks", putPaperItemMarks);
router.put("/test-papers/:paperId/assignment", putPaperAssignment);
router.post("/custom-questions", postCustomQuestion);
router.get("/custom-questions", getMyCustomQuestions);

router.get("/gradebook/exams", getExams);
router.post("/gradebook/exams", postExam);
router.get("/gradebook/exams/:examId", getExam);
router.put("/gradebook/exams/:examId/marks", putExamMarks);
router.post("/gradebook/exams/:examId/questions/:questionId/students/:userId/ai-assist", postAiAssist);
router.get("/gradebook/exams/:examId/export.xlsx", getExamExcel);

router.get("/lesson-plans/filter-options", getPlanFilterOptions);
router.get("/lesson-plans/colleagues", getColleagues);
router.get("/lesson-plans/dashboard-summary", getDashboardSummary);
router.get("/lesson-plans/shared-with-me", getSharedWithMePlans);
router.get("/lesson-plans/shared/:shareId", getSharedPlanDetail);
router.post("/lesson-plans/shared/:shareId/clone", postCloneSharedPlan);
router.post("/lesson-plans/shared/:shareId/rating", postRateSharedPlan);
router.post("/lesson-plans/generate", postGeneratePlan);
router.post("/lesson-plans/assistant", postAssistantQuestion);
router.post("/lesson-plans/assistant/history", postAssistantHistoryEntry);
router.get("/lesson-plans/assistant/history", getAssistantHistoryList);

router.get("/lesson-plans", getPlans);
router.post("/lesson-plans", postPlan);
router.put("/lesson-plans/:planId", putPlan);
router.delete("/lesson-plans/:planId", deletePlanHandler);
router.post("/lesson-plans/:planId/publish", postPublishPlan);
router.post("/lesson-plans/:planId/share", postSharePlan);
router.get("/lesson-plans/:planId", getPlanDetail);
router.get("/lesson-plans/:planId/export.pdf", getPlanPdf);
router.get("/lesson-plans/:planId/export.xlsx", getPlanExcel);
router.post("/lesson-plans/:planId/entries", postPlanEntry);
router.post("/lesson-plans/:planId/entries/bulk", postPlanEntriesBulk);
router.post("/lesson-plans/:planId/entries/reorder", postPlanEntriesReorder);
router.put("/lesson-plans/:planId/entries/:entryId", putPlanEntry);
router.delete("/lesson-plans/:planId/entries/:entryId", deletePlanEntry);
router.post("/lesson-plans/:planId/entries/:entryId/duplicate", postPlanEntryDuplicate);

router.get("/master-lesson-plans/by-chapter", getMasterPlanByChapterHandler);
router.get("/master-lesson-plans/shared-with-me", getSharedMasterPlansWithMe);
router.get("/master-lesson-plans/shared/:shareId", getSharedMasterPlanDetail);
router.post("/master-lesson-plans/generate", postGenerateMasterPlan);
router.get("/master-lesson-plans", getMasterPlans);
router.post("/master-lesson-plans", postMasterPlan);
router.put("/master-lesson-plans/:planId", putMasterPlan);
router.delete("/master-lesson-plans/:planId", deleteMasterPlanHandler);
router.post("/master-lesson-plans/:planId/publish", postPublishMasterPlan);
router.post("/master-lesson-plans/:planId/share", postShareMasterPlan);
router.get("/master-lesson-plans/:planId", getMasterPlanDetail);
router.get("/master-lesson-plans/:planId/export.pdf", getMasterPlanPdf);

export default router;
