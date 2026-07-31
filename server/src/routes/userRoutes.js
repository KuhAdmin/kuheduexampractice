import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import {
  getChaptersForClassSubjectSelection,
  getNotificationsForUser,
  getReturningDashboardForSelection,
  getReturningDashboardForUser,
  listRemainingConceptsForUser,
  markNotificationsSeen,
} from "../services/studentDashboardService.js";
import { listClassSubjectOptionsWithContent } from "../services/catalogService.js";
import { createOrder, verifyPayment } from "../controllers/paymentController.js";
import {
  getMicroActivityResponseHandler,
  getStudentBookQuestions,
  getStudentConceptCard,
  getStudentConceptChallenges,
  getStudentConceptSectionMedia,
  getStudentDiagramMedia,
  getStudentDiagrams,
  getStudentFlashcards,
  getStudentLearningMap,
  getStudentMemoryBoosterForSection,
  getStudentMemoryBoosterForUnit,
  getStudentRevision,
  getStudentSectionOverview,
  getStudentSections,
  getStudentTutorNotes,
  getStudentVisualLearningItems,
  submitMicroActivityResponseHandler,
  uploadStudentConceptSectionMedia,
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
  restartConceptAssessmentHandler,
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
import {
  postConceptPracticeAnswerCapture,
  postConceptPracticeGrade,
  postConceptPracticeQuestionCapture,
} from "../controllers/conceptPracticeCaptureController.js";
import { postEinsteinChallenge, postEinsteinRecognize } from "../controllers/einsteinModeController.js";
import { postVivaFeedback, postVivaQuestions } from "../controllers/vivaController.js";

const router = Router();

router.use(requireAuth);

router.get("/sections", getStudentSections);
router.get("/sections/:sourceSectionId/overview", getStudentSectionOverview);
router.get("/sections/:sourceSectionId/learning-map", getStudentLearningMap);
router.get("/sections/:sourceSectionId/memory-booster", getStudentMemoryBoosterForSection);
router.get("/sections/:sourceSectionId/flashcards", getStudentFlashcards);
router.get("/sections/:sourceSectionId/revision", getStudentRevision);
router.get("/sections/:sourceSectionId/tutor-notes", getStudentTutorNotes);
router.get("/sections/:sourceSectionId/diagrams", getStudentDiagrams);
router.get("/sections/:sourceSectionId/visual-learning", getStudentVisualLearningItems);
router.get("/diagrams/:diagramId/media", getStudentDiagramMedia);
router.get("/sections/:sourceSectionId/mind-map", getMindMap);
router.get("/concepts/:assessmentUnitId/card", getStudentConceptCard);
router.get("/concepts/:assessmentUnitId/challenges", getStudentConceptChallenges);
router.get("/concepts/:assessmentUnitId/memory-hook-media/:sectionKey", getStudentConceptSectionMedia);
router.post("/concepts/:assessmentUnitId/memory-hook-media/:sectionKey/upload", uploadStudentConceptSectionMedia);
router.get("/concepts/:assessmentUnitId/memory-booster", getStudentMemoryBoosterForUnit);
router.get("/concepts/:assessmentUnitId/micro-activity/response", getMicroActivityResponseHandler);
router.post("/concepts/:assessmentUnitId/micro-activity/respond", submitMicroActivityResponseHandler);
router.post("/concepts/:assessmentUnitId/tutor", postConceptTutorMessage);
router.post("/concepts/:assessmentUnitId/tutor/voice-token", postConceptTutorVoiceToken);
router.post("/tutor/avatar-token", postTutorAvatarToken);
router.post("/concepts/:assessmentUnitId/practice-capture/question", postConceptPracticeQuestionCapture);
router.post("/concepts/:assessmentUnitId/practice-capture/answer", postConceptPracticeAnswerCapture);
router.post("/concepts/:assessmentUnitId/practice-capture/grade", postConceptPracticeGrade);
router.post("/concepts/:assessmentUnitId/einstein-mode/challenge", postEinsteinChallenge);
router.post("/concepts/:assessmentUnitId/einstein-mode/recognize", postEinsteinRecognize);
router.post("/concepts/:assessmentUnitId/viva/questions", postVivaQuestions);
router.post("/concepts/:assessmentUnitId/viva/feedback", postVivaFeedback);
router.get("/chapters/:chapterNumber/book-questions", getStudentBookQuestions);
router.post("/chapters/:chapterNumber/book-questions/:questionId/respond", submitStudentBookQuestionResponse);

router.post("/sections/:sourceSectionId/assessment/start", startAssessment);
router.post("/sections/:sourceSectionId/assessment/restart", restartAssessmentHandler);
router.get("/sections/:sourceSectionId/assessment/attempts", getRecentAttempts);
router.post("/concepts/:assessmentUnitId/assessment/start", startConceptAssessment);
router.post("/concepts/:assessmentUnitId/assessment/restart", restartConceptAssessmentHandler);
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

// Powers the class/subject switcher on StudentChaptersPage.jsx -- lists
// every board/class/subject combo that actually has content, independent of
// the requesting student's own profile.
router.get("/class-subject-options", async (req, res, next) => {
  try {
    const options = await listClassSubjectOptionsWithContent();
    res.json({ options });
  } catch (error) {
    next(error);
  }
});

router.get("/chapters-for-selection", async (req, res, next) => {
  try {
    const result = await getChaptersForClassSubjectSelection({
      userId: req.user.id,
      examGoalCode: req.query.examGoalCode,
      levelCode: req.query.levelCode,
      subjectCode: req.query.subjectCode,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Powers the sidebar class/subject switcher extended to the Dashboard's
// Continue Learning/Today's Goal/Weak Concepts (see chapters-for-selection
// above for the same pattern already used by the Chapters list). No
// "greeting"/"streak" here -- those are account-wide, not subject-scoped;
// the client reuses the values from its own /dashboard fetch instead.
router.get("/dashboard-for-selection", async (req, res, next) => {
  try {
    const dashboard = await getReturningDashboardForSelection({
      userId: req.user.id,
      examGoalCode: req.query.examGoalCode,
      levelCode: req.query.levelCode,
      subjectCode: req.query.subjectCode,
    });

    res.json(dashboard);
  } catch (error) {
    next(error);
  }
});

// STEMLab Premium purchase (Razorpay Standard Checkout) -- see
// services/paymentService.js for order creation + signature verification.
router.post("/payments/create-order", createOrder);
router.post("/payments/verify", verifyPayment);

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
