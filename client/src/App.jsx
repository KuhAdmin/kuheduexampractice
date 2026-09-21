import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AdminLayout } from "./components/AdminLayout";
import { apiRequest } from "./api/client";
import { AdminAiAssessmentDemoPage } from "./pages/AdminAiAssessmentDemoPage";
import { AdminDemoModelSettingsPage } from "./pages/AdminDemoModelSettingsPage";
import { AdminChapterExerciseReviewPage } from "./pages/AdminChapterExerciseReviewPage";
import { AdminSettingsPage } from "./pages/AdminSettingsPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { AdminOrdersPage } from "./pages/AdminOrdersPage";
import { AdminExamTypesPage } from "./pages/AdminExamTypesPage";
import { AdminExamGoalsPage } from "./pages/AdminExamGoalsPage";
import { AdminLevelsPage } from "./pages/AdminLevelsPage";
import { AdminSubjectsPage } from "./pages/AdminSubjectsPage";
import { AdminBooksPage } from "./pages/AdminBooksPage";
import { AdminChaptersPage } from "./pages/AdminChaptersPage";
import { AdminConceptImportPage } from "./pages/AdminConceptImportPage";
import { AdminPreWarmupImportPage } from "./pages/AdminPreWarmupImportPage";
import { AdminContentEditorPage } from "./pages/AdminContentEditorPage";
import { StudentLayout } from "./components/StudentLayout";
import { useAuth } from "./context/authHooks";
import { AdminOverviewPage } from "./pages/AdminOverviewPage";
import { AdminInstitutionsPage } from "./pages/AdminInstitutionsPage";
import { AdminInstitutionDetailPage } from "./pages/AdminInstitutionDetailPage";
import { AdminQuestionReviewPage } from "./pages/AdminQuestionReviewPage";
import { AdminSectionPage } from "./pages/AdminSectionPage";
import { TeacherLayout } from "./components/TeacherLayout";
import { TeacherHomePage } from "./pages/TeacherHomePage";
import { TeacherClassesPage } from "./pages/TeacherClassesPage";
import { TeacherClassDetailPage } from "./pages/TeacherClassDetailPage";
import { TeacherStudentInsightPage } from "./pages/TeacherStudentInsightPage";
import { TeacherTestsPage } from "./pages/TeacherTestsPage";
import { TeacherTestBuilderPage } from "./pages/TeacherTestBuilderPage";
import { TeacherCustomQuestionsPage } from "./pages/TeacherCustomQuestionsPage";
import { TeacherGradingPage } from "./pages/TeacherGradingPage";
import { TeacherGradingNewPage } from "./pages/TeacherGradingNewPage";
import { TeacherGradebookPage } from "./pages/TeacherGradebookPage";
import { TeacherLessonsPage } from "./pages/TeacherLessonsPage";
import { TeacherLessonPlanDetailPage } from "./pages/TeacherLessonPlanDetailPage";
import { TeacherLessonPlanCreatePage } from "./pages/TeacherLessonPlanCreatePage";
import { TeacherMasterLessonPlanPage } from "./pages/TeacherMasterLessonPlanPage";
import { TeacherSharedMasterLessonPlanPage } from "./pages/TeacherSharedMasterLessonPlanPage";
import { TeacherProfilePage } from "./pages/TeacherProfilePage";
import { AuthSuccessPage } from "./pages/AuthSuccessPage";
import { HomePage } from "./pages/HomePage";
import { LegalPage } from "./pages/LegalPage";
import { PricingPage } from "./pages/PricingPage";
import { StudentAssessmentPage } from "./pages/StudentAssessmentPage";
import { StudentAssessmentResultPage } from "./pages/StudentAssessmentResultPage";
import { StudentPreLessonWarmupPage } from "./pages/StudentPreLessonWarmupPage";
import { StudentPostLessonPage } from "./pages/StudentPostLessonPage";
import { StudentHotsPage } from "./pages/StudentHotsPage";
import { StudentChapterDetailPage } from "./pages/StudentChapterDetailPage";
import { StudentBookQuestionsPage } from "./pages/StudentBookQuestionsPage";
import { StudentChaptersPage } from "./pages/StudentChaptersPage";
import { StudentWritingCategoriesPage } from "./pages/StudentWritingCategoriesPage";
import { StudentWritingSubCategoriesPage } from "./pages/StudentWritingSubCategoriesPage";
import { StudentWritingQuestionsPage } from "./pages/StudentWritingQuestionsPage";
import { StudentWritingQuestionDetailPage } from "./pages/StudentWritingQuestionDetailPage";
import { StudentRemainingConceptsPage } from "./pages/StudentRemainingConceptsPage";
import { StudentConceptLearningPage } from "./pages/StudentConceptLearningPage";
import { StudentDashboardPage } from "./pages/StudentDashboardPage";
import { StudentDiagramsPage } from "./pages/StudentDiagramsPage";
import { StudentFlashcardsPage } from "./pages/StudentFlashcardsPage";
import { StudentRevisionPage } from "./pages/StudentRevisionPage";
import { StudentTutorNotesPage } from "./pages/StudentTutorNotesPage";
import { StudentMemoryBoosterPage } from "./pages/StudentMemoryBoosterPage";
import { StudentMindMapPage } from "./pages/StudentMindMapPage";
import { StudentProfilePage } from "./pages/StudentProfilePage";
import { StudentPracticePage } from "./pages/StudentPracticePage";
import { StudentTestLabPage } from "./pages/StudentTestLabPage";
import { StudentTestLabSessionPage } from "./pages/StudentTestLabSessionPage";
import { StudentTestLabResultPage } from "./pages/StudentTestLabResultPage";
import { StudentSectionDetailPage } from "./pages/StudentSectionDetailPage";

const isStudentOnboardingComplete = (user) => {
  if (!user || user.role === "admin" || user.role === "moderator" || user.role === "superstudent") {
    return true;
  }

  return Boolean(user.board && user.studentClass && user.subject);
};

const hasStoredAuthToken = () => Boolean(localStorage.getItem("kuhedu_token"));

const App = () => {
  const [dashboard, setDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const { user, login, register, logout, completeOnboarding, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const authPending = loading || (!isAuthenticated && hasStoredAuthToken());

  useEffect(() => {
    if (!isAuthenticated) {
      setDashboard(null);
      setDashboardLoading(false);
      return;
    }

    setDashboardLoading(true);
    apiRequest("/user/dashboard")
      .then(setDashboard)
      .catch(() => setDashboard(null))
      .finally(() => setDashboardLoading(false));
  }, [isAuthenticated, user?.board, user?.studentClass, user?.subject, location.pathname]);

  const handleLogin = async (payload) => {
    const data = await login(payload);
    if (data.user?.role === "admin") {
      navigate("/admin");
      return data;
    }

    if (data.user?.role === "teacher") {
      navigate("/teacher");
      return data;
    }

    if (data.user?.role === "moderator" || data.user?.role === "superstudent") {
      navigate("/dashboard");
      return data;
    }

    if (!isStudentOnboardingComplete(data.user)) {
      navigate("/", {
        replace: true,
        state: { resumeOnboarding: true },
      });
      return data;
    }

    navigate("/dashboard");
    return data;
  };

  const handleRegister = async (payload) => {
    const data = await register(payload);
    navigate("/", {
      replace: true,
      state: { emailOnboarding: true },
    });
    return data;
  };

  const handleOnboardingComplete = async (payload) => {
    await completeOnboarding(payload);
    navigate("/dashboard", {
      replace: true,
      state: { dashboardMode: "first-time" },
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <>
      <Routes>
        <Route path="/auth/success" element={<AuthSuccessPage />} />
        <Route path="/legal/:docId" element={<LegalPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route
          path="/"
          element={
            <div className="app-shell home-app-shell">
              <HomePage
                onLogin={handleLogin}
                onRegister={handleRegister}
                onOnboardingComplete={handleOnboardingComplete}
                onLogout={handleLogout}
                emailOnboarding={Boolean(location.state?.emailOnboarding)}
                googleOnboarding={Boolean(location.state?.googleOnboarding)}
                resumeOnboarding={Boolean(location.state?.resumeOnboarding)}
                initialScreenId={location.state?.resumeScreenId ?? null}
                user={user}
              />
            </div>
          }
        />
        <Route
          element={
            // NOT `null` -- react-router's _renderMatches only substitutes a
            // route's own element when it's truthy (`else if (match.route.element)`,
            // not `!== undefined` as its docs/older versions implied); a
            // `null` element is treated as "no element provided" and it
            // renders the outlet (this route's nested children, i.e.
            // StudentDashboardPage etc.) DIRECTLY instead, completely
            // skipping StudentLayout/ClassSubjectProvider below. That was
            // the real cause of "useClassSubject must be used within a
            // ClassSubjectProvider" crashing on any fresh page load that
            // lands on /dashboard (or any nested route) while `loading` is
            // still true -- confirmed via node_modules/react-router/dist/
            // react-router.development.js. An empty fragment is a real,
            // truthy React element, so it renders nothing while still being
            // used as this route's own element.
            authPending ? <></> : isAuthenticated ? (
              user?.role === "admin" ? (
                <Navigate replace to="/admin" />
              ) : user?.role === "teacher" ? (
                <Navigate replace to="/teacher" />
              ) : !isStudentOnboardingComplete(user) ? (
                <Navigate replace to="/" state={{ resumeOnboarding: true }} />
              ) : (
                <div className="app-shell dashboard-app-shell">
                  <StudentLayout user={user} onLogout={handleLogout} />
                </div>
              )
            ) : (
              <Navigate replace to="/" />
            )
          }
        >
          <Route
            path="/dashboard"
            element={
              dashboardLoading && !dashboard ? null : (
                <StudentDashboardPage
                  dashboard={dashboard}
                  dashboardMode={location.state?.dashboardMode === "first-time" ? "first-time" : "returning"}
                  user={user}
                />
              )
            }
          />
          <Route
            path="/profile"
            element={<StudentProfilePage user={user} onLogout={handleLogout} />}
          />
          <Route path="/chapters" element={<StudentChaptersPage dashboard={dashboard} user={user} />} />
          <Route path="/practice" element={<StudentPracticePage />} />
          <Route path="/test-lab" element={<StudentTestLabPage />} />
          <Route path="/test-lab/attempts/:attemptId" element={<StudentTestLabSessionPage />} />
          <Route path="/test-lab/attempts/:attemptId/result" element={<StudentTestLabResultPage />} />
          <Route path="/goals" element={<StudentRemainingConceptsPage />} />
          <Route path="/tests/write" element={<StudentWritingCategoriesPage />} />
          <Route path="/tests/write/:categorySlug" element={<StudentWritingSubCategoriesPage />} />
          <Route
            path="/tests/write/:categorySlug/:subCategorySlug"
            element={<StudentWritingQuestionsPage />}
          />
          <Route
            path="/tests/write/:categorySlug/:subCategorySlug/:questionId"
            element={<StudentWritingQuestionDetailPage />}
          />
          <Route path="/chapters/:chapterId" element={<StudentChapterDetailPage dashboard={dashboard} user={user} />} />
          <Route path="/chapters/:chapterId/book-questions" element={<StudentBookQuestionsPage />} />
          <Route path="/chapters/:chapterId/assessment" element={<StudentAssessmentPage />} />
          <Route path="/chapters/:chapterId/hots" element={<StudentHotsPage />} />
          <Route
            path="/chapters/:chapterId/assessment/result/:attemptId"
            element={<StudentAssessmentResultPage />}
          />
          <Route path="/chapters/:chapterId/sections/:sectionId" element={<StudentSectionDetailPage />} />
          <Route
            path="/chapters/:chapterId/sections/:sectionId/concepts/:conceptId"
            element={<StudentConceptLearningPage />}
          />
          <Route
            path="/chapters/:chapterId/sections/:sectionId/memory-booster"
            element={<StudentMemoryBoosterPage />}
          />
          <Route
            path="/chapters/:chapterId/sections/:sectionId/flashcards"
            element={<StudentFlashcardsPage />}
          />
          <Route
            path="/chapters/:chapterId/sections/:sectionId/revision"
            element={<StudentRevisionPage />}
          />
          <Route
            path="/chapters/:chapterId/sections/:sectionId/tutor-notes"
            element={<StudentTutorNotesPage />}
          />
          <Route
            path="/chapters/:chapterId/sections/:sectionId/diagrams"
            element={<StudentDiagramsPage />}
          />
          <Route
            path="/chapters/:chapterId/sections/:sectionId/mind-map"
            element={<StudentMindMapPage />}
          />
          <Route
            path="/chapters/:chapterId/sections/:sectionId/warm-up"
            element={<StudentPreLessonWarmupPage />}
          />
          <Route
            path="/chapters/:chapterId/sections/:sectionId/post-lesson"
            element={<StudentPostLessonPage />}
          />
          <Route
            path="/chapters/:chapterId/sections/:sectionId/assessment"
            element={<StudentAssessmentPage />}
          />
          <Route
            path="/chapters/:chapterId/sections/:sectionId/assessment/result/:attemptId"
            element={<StudentAssessmentResultPage />}
          />
          <Route
            path="/chapters/:chapterId/sections/:sectionId/concepts/:conceptId/assessment"
            element={<StudentAssessmentPage />}
          />
          <Route
            path="/chapters/:chapterId/sections/:sectionId/concepts/:conceptId/assessment/result/:attemptId"
            element={<StudentAssessmentResultPage />}
          />
        </Route>
        <Route
          path="/admin"
          element={
            // See the matching comment on the other authPending gate above --
            // must be a truthy empty element, not null.
            authPending ? <></> : isAuthenticated ? (
              user?.role === "admin" || user?.role === "moderator" ? (
                <div className="app-shell admin-app-shell" data-theme="dawn">
                  <AdminLayout onLogout={handleLogout} user={user} />
                </div>
              ) : (
                <Navigate replace to="/dashboard" />
              )
            ) : (
              <Navigate replace to="/" />
            )
          }
        >
          <Route index element={<AdminOverviewPage />} />
          <Route
            path="ai-demo"
            element={<AdminAiAssessmentDemoPage />}
          />
          <Route
            path="ai-demo/model-settings"
            element={<AdminDemoModelSettingsPage />}
          />
          <Route
            path="chapter-exercises/:bookId/:chapterNumber"
            element={<AdminChapterExerciseReviewPage />}
          />
          <Route
            path="users"
            element={<AdminUsersPage />}
          />
          <Route
            path="institutions"
            element={<AdminInstitutionsPage />}
          />
          <Route
            path="institutions/:institutionId"
            element={<AdminInstitutionDetailPage />}
          />
          <Route
            path="question-review"
            element={<AdminQuestionReviewPage />}
          />
          <Route
            path="orders"
            element={<AdminOrdersPage />}
          />
          <Route
            path="exam-types"
            element={<AdminExamTypesPage />}
          />
          <Route
            path="exam-goals"
            element={<AdminExamGoalsPage />}
          />
          <Route
            path="levels"
            element={<AdminLevelsPage />}
          />
          <Route
            path="subjects"
            element={<AdminSubjectsPage />}
          />
          <Route
            path="books"
            element={<AdminBooksPage />}
          />
          <Route
            path="chapters"
            element={<AdminChaptersPage />}
          />
          <Route
            path="concept-import"
            element={<AdminConceptImportPage />}
          />
          <Route
            path="pre-warmup-import"
            element={<AdminPreWarmupImportPage />}
          />
          <Route
            path="content-editor"
            element={<AdminContentEditorPage />}
          />
          <Route
            path="settings"
            element={<AdminSettingsPage />}
          />
        </Route>
        <Route
          path="/teacher"
          element={
            // See the matching comment on the other authPending gates above --
            // must be a truthy empty element, not null.
            authPending ? <></> : isAuthenticated ? (
              user?.role === "teacher" ? (
                <div className="app-shell teacher-app-shell" data-theme="dawn">
                  <TeacherLayout onLogout={handleLogout} user={user} />
                </div>
              ) : (
                <Navigate replace to="/dashboard" />
              )
            ) : (
              <Navigate replace to="/" />
            )
          }
        >
          <Route index element={<TeacherHomePage />} />
          <Route path="classes" element={<TeacherClassesPage />} />
          <Route path="classes/:batchId" element={<TeacherClassDetailPage />} />
          <Route path="classes/:batchId/students/:userId" element={<TeacherStudentInsightPage />} />
          <Route path="tests" element={<TeacherTestsPage />} />
          <Route path="tests/custom-questions" element={<TeacherCustomQuestionsPage />} />
          <Route path="tests/:paperId" element={<TeacherTestBuilderPage />} />
          <Route path="grading" element={<TeacherGradingPage />} />
          <Route path="grading/new" element={<TeacherGradingNewPage />} />
          <Route path="grading/:examId" element={<TeacherGradebookPage />} />
          <Route path="lessons" element={<TeacherLessonsPage />} />
          <Route path="lessons/master-plan" element={<TeacherMasterLessonPlanPage />} />
          <Route path="lessons/master-plan/shared/:shareId" element={<TeacherSharedMasterLessonPlanPage />} />
          <Route path="lessons/new" element={<TeacherLessonPlanCreatePage />} />
          <Route path="lessons/shared/:shareId" element={<TeacherLessonPlanDetailPage sharedView />} />
          <Route path="lessons/:planId" element={<TeacherLessonPlanDetailPage />} />
          <Route path="profile" element={<TeacherProfilePage user={user} onLogout={handleLogout} />} />
        </Route>
      </Routes>
    </>
  );
};

export default App;
