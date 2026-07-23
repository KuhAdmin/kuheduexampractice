import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import {
  getNotificationsForUser,
  getReturningDashboardForUser,
  listRemainingConceptsForUser,
  markNotificationsSeen,
} from "../services/studentDashboardService.js";
import {
  getMicroActivityResponseHandler,
  getStudentBookQuestions,
  getStudentConceptCard,
  getStudentConceptSectionMedia,
  getStudentDiagramMedia,
  getStudentDiagrams,
  getStudentFlashcards,
  getStudentLearningMap,
  getStudentMemoryBoosterForSection,
  getStudentMemoryBoosterForUnit,
  getStudentSectionOverview,
  getStudentSections,
  submitMicroActivityResponseHandler,
  submitStudentBookQuestionResponse,
} from "../controllers/studentContentController.js";
import {
  answerAssessmentItem,
  finishAssessment,
  getAssessmentResultHandler,
  getMindMap,
  getRecentAttempts,
  getRecentChapterAttempts,
  getRecentConceptAttempts,
  restartAssessmentHandler,
  restartChapterAssessmentHandler,
  startAssessment,
  startChapterAssessment,
  startConceptAssessment,
} from "../controllers/studentPracticeController.js";
import { postHandwrittenNoteOcr } from "../controllers/ocrController.js";
import {
  postConceptTutorMessage,
  postConceptTutorVoiceToken,
  postTutorAvatarToken,
} from "../controllers/studentTutorController.js";

const router = Router();

router.use(requireAuth);

router.get("/sections", getStudentSections);
router.get("/sections/:sourceSectionId/overview", getStudentSectionOverview);
router.get("/sections/:sourceSectionId/learning-map", getStudentLearningMap);
router.get("/sections/:sourceSectionId/memory-booster", getStudentMemoryBoosterForSection);
router.get("/sections/:sourceSectionId/flashcards", getStudentFlashcards);
router.get("/sections/:sourceSectionId/diagrams", getStudentDiagrams);
router.get("/diagrams/:diagramId/media", getStudentDiagramMedia);
router.get("/sections/:sourceSectionId/mind-map", getMindMap);
router.get("/concepts/:assessmentUnitId/card", getStudentConceptCard);
router.get("/concepts/:assessmentUnitId/memory-hook-media/:sectionKey", getStudentConceptSectionMedia);
router.get("/concepts/:assessmentUnitId/memory-booster", getStudentMemoryBoosterForUnit);
router.get("/concepts/:assessmentUnitId/micro-activity/response", getMicroActivityResponseHandler);
router.post("/concepts/:assessmentUnitId/micro-activity/respond", submitMicroActivityResponseHandler);
router.post("/concepts/:assessmentUnitId/tutor", postConceptTutorMessage);
router.post("/concepts/:assessmentUnitId/tutor/voice-token", postConceptTutorVoiceToken);
router.post("/tutor/avatar-token", postTutorAvatarToken);
router.get("/chapters/:chapterNumber/book-questions", getStudentBookQuestions);
router.post("/chapters/:chapterNumber/book-questions/:questionId/respond", submitStudentBookQuestionResponse);

router.post("/sections/:sourceSectionId/assessment/start", startAssessment);
router.post("/sections/:sourceSectionId/assessment/restart", restartAssessmentHandler);
router.get("/sections/:sourceSectionId/assessment/attempts", getRecentAttempts);
router.post("/concepts/:assessmentUnitId/assessment/start", startConceptAssessment);
router.get("/concepts/:assessmentUnitId/assessment/attempts", getRecentConceptAttempts);
router.post("/chapters/:chapterNumber/assessment/start", startChapterAssessment);
router.post("/chapters/:chapterNumber/assessment/restart", restartChapterAssessmentHandler);
router.get("/chapters/:chapterNumber/assessment/attempts", getRecentChapterAttempts);
router.post("/attempts/:attemptId/items/:displayOrder/answer", answerAssessmentItem);
router.post("/attempts/:attemptId/submit", finishAssessment);
router.get("/attempts/:attemptId/result", getAssessmentResultHandler);
router.post("/ocr/handwritten-note", postHandwrittenNoteOcr);

router.get("/dashboard", async (req, res, next) => {
  const firstName = req.user.name?.trim().split(/\s+/)[0] || "Alex";

  try {
    const dashboard = await getReturningDashboardForUser({
      userId: req.user.id,
      board: req.user.board,
      studentClass: req.user.studentClass,
      subject: req.user.subject,
    });

    res.json({
      greeting: `Hi, ${firstName}`,
      ...dashboard,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/goals/remaining-concepts", async (req, res, next) => {
  try {
    const result = await listRemainingConceptsForUser({
      userId: req.user.id,
      board: req.user.board,
      studentClass: req.user.studentClass,
      subject: req.user.subject,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/notifications", async (req, res, next) => {
  try {
    const result = await getNotificationsForUser({
      userId: req.user.id,
      board: req.user.board,
      studentClass: req.user.studentClass,
      subject: req.user.subject,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/notifications/mark-seen", async (req, res, next) => {
  try {
    await markNotificationsSeen({ userId: req.user.id });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
