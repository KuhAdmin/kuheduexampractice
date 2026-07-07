import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AdminLayout } from "./components/AdminLayout";
import { apiRequest } from "./api/client";
import { AdminAssessmentStudioPage } from "./pages/AdminAssessmentStudioPage";
import { AdminBulkPipelinePage } from "./pages/AdminBulkPipelinePage";
import { AdminPipelineRunsPage } from "./pages/AdminPipelineRunsPage";
import { AdminChapterExerciseReviewPage } from "./pages/AdminChapterExerciseReviewPage";
import { AdminAssessmentAuditPage } from "./pages/AdminAssessmentAuditPage";
import { AdminAssessmentManualPage } from "./pages/AdminAssessmentManualPage";
import { AdminAssessmentWorkbenchPage } from "./pages/AdminAssessmentWorkbenchPage";
import { AdminContentReviewPage } from "./pages/AdminContentReviewPage";
import { AdminLearningAnalyticsPage } from "./pages/AdminLearningAnalyticsPage";
import { AdminModerationPage } from "./pages/AdminModerationPage";
import { AdminPerformanceInsightsPage } from "./pages/AdminPerformanceInsightsPage";
import { AdminQuestionBankPage } from "./pages/AdminQuestionBankPage";
import { AdminSettingsPage } from "./pages/AdminSettingsPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { ModeratorLayout } from "./components/ModeratorLayout";
import { ModeratorConsolePage } from "./pages/ModeratorConsolePage";
import { ModeratorLayerReviewPage } from "./pages/ModeratorLayerReviewPage";
import { useAuth } from "./context/AuthContext";
import { AdminOverviewPage } from "./pages/AdminOverviewPage";
import { AdminPracticeSetsPage } from "./pages/AdminPracticeSetsPage";
import { AdminSectionPage } from "./pages/AdminSectionPage";
import { AuthSuccessPage } from "./pages/AuthSuccessPage";
import { HomePage } from "./pages/HomePage";
import { StudentAssessmentPage } from "./pages/StudentAssessmentPage";
import { StudentAssessmentResultPage } from "./pages/StudentAssessmentResultPage";
import { StudentChapterDetailPage } from "./pages/StudentChapterDetailPage";
import { StudentBookQuestionsPage } from "./pages/StudentBookQuestionsPage";
import { StudentChaptersPage } from "./pages/StudentChaptersPage";
import { StudentRemainingConceptsPage } from "./pages/StudentRemainingConceptsPage";
import { StudentConceptLearningPage } from "./pages/StudentConceptLearningPage";
import { StudentDashboardPage } from "./pages/StudentDashboardPage";
import { StudentDiagramsPage } from "./pages/StudentDiagramsPage";
import { StudentFlashcardsPage } from "./pages/StudentFlashcardsPage";
import { StudentMemoryBoosterPage } from "./pages/StudentMemoryBoosterPage";
import { StudentMindMapPage } from "./pages/StudentMindMapPage";
import { StudentProfilePage } from "./pages/StudentProfilePage";
import { StudentSectionDetailPage } from "./pages/StudentSectionDetailPage";

const isStudentOnboardingComplete = (user) => {
  if (!user || user.role === "admin" || user.role === "moderator") {
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

    if (data.user?.role === "moderator") {
      navigate("/moderator");
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
                user={user}
              />
            </div>
          }
        />
        <Route
          path="/dashboard"
          element={
            authPending || (isAuthenticated && dashboardLoading && !dashboard) ? null : isAuthenticated ? (
              user?.role === "admin" ? (
                <Navigate replace to="/admin" />
              ) : user?.role === "moderator" ? (
                <Navigate replace to="/moderator" />
              ) : !isStudentOnboardingComplete(user) ? (
                <Navigate replace to="/" state={{ resumeOnboarding: true }} />
              ) : (
                <div className="app-shell dashboard-app-shell">
                  <StudentDashboardPage
                    dashboard={dashboard}
                    dashboardMode={location.state?.dashboardMode === "first-time" ? "first-time" : "returning"}
                    user={user}
                  />
                </div>
              )
            ) : (
              <Navigate replace to="/" />
            )
          }
        />
        <Route
          path="/profile"
          element={
            authPending ? null : isAuthenticated ? (
              user?.role === "admin" ? (
                <Navigate replace to="/admin" />
              ) : user?.role === "moderator" ? (
                <Navigate replace to="/moderator" />
              ) : !isStudentOnboardingComplete(user) ? (
                <Navigate replace to="/" state={{ resumeOnboarding: true }} />
              ) : (
                <div className="app-shell dashboard-app-shell">
                  <StudentProfilePage
                    dashboard={dashboard}
                    user={user}
                    onLogout={handleLogout}
                  />
                </div>
              )
            ) : (
              <Navigate replace to="/" />
            )
          }
        />
        <Route
          path="/chapters"
          element={
            authPending ? null : isAuthenticated ? (
              user?.role === "admin" ? (
                <Navigate replace to="/admin" />
              ) : user?.role === "moderator" ? (
                <Navigate replace to="/moderator" />
              ) : !isStudentOnboardingComplete(user) ? (
                <Navigate replace to="/" state={{ resumeOnboarding: true }} />
              ) : (
                <div className="app-shell dashboard-app-shell">
                  <StudentChaptersPage
                    dashboard={dashboard}
                    user={user}
                  />
                </div>
              )
            ) : (
              <Navigate replace to="/" />
            )
          }
        />
        <Route
          path="/goals"
          element={
            authPending ? null : isAuthenticated ? (
              user?.role === "admin" ? (
                <Navigate replace to="/admin" />
              ) : user?.role === "moderator" ? (
                <Navigate replace to="/moderator" />
              ) : !isStudentOnboardingComplete(user) ? (
                <Navigate replace to="/" state={{ resumeOnboarding: true }} />
              ) : (
                <div className="app-shell dashboard-app-shell">
                  <StudentRemainingConceptsPage />
                </div>
              )
            ) : (
              <Navigate replace to="/" />
            )
          }
        />
        <Route
          path="/chapters/:chapterId"
          element={
            authPending ? null : isAuthenticated ? (
              user?.role === "admin" ? (
                <Navigate replace to="/admin" />
              ) : user?.role === "moderator" ? (
                <Navigate replace to="/moderator" />
              ) : !isStudentOnboardingComplete(user) ? (
                <Navigate replace to="/" state={{ resumeOnboarding: true }} />
              ) : (
                <div className="app-shell dashboard-app-shell">
                  <StudentChapterDetailPage
                    dashboard={dashboard}
                  />
                </div>
              )
            ) : (
              <Navigate replace to="/" />
            )
          }
        />
        <Route
          path="/chapters/:chapterId/book-questions"
          element={
            authPending ? null : isAuthenticated ? (
              user?.role === "admin" ? (
                <Navigate replace to="/admin" />
              ) : user?.role === "moderator" ? (
                <Navigate replace to="/moderator" />
              ) : !isStudentOnboardingComplete(user) ? (
                <Navigate replace to="/" state={{ resumeOnboarding: true }} />
              ) : (
                <div className="app-shell dashboard-app-shell">
                  <StudentBookQuestionsPage />
                </div>
              )
            ) : (
              <Navigate replace to="/" />
            )
          }
        />
        <Route
          path="/chapters/:chapterId/sections/:sectionId"
          element={
            authPending ? null : isAuthenticated ? (
              user?.role === "admin" ? (
                <Navigate replace to="/admin" />
              ) : user?.role === "moderator" ? (
                <Navigate replace to="/moderator" />
              ) : !isStudentOnboardingComplete(user) ? (
                <Navigate replace to="/" state={{ resumeOnboarding: true }} />
              ) : (
                <div className="app-shell dashboard-app-shell">
                  <StudentSectionDetailPage />
                </div>
              )
            ) : (
              <Navigate replace to="/" />
            )
          }
        />
        <Route
          path="/chapters/:chapterId/sections/:sectionId/concepts/:conceptId"
          element={
            authPending ? null : isAuthenticated ? (
              user?.role === "admin" ? (
                <Navigate replace to="/admin" />
              ) : user?.role === "moderator" ? (
                <Navigate replace to="/moderator" />
              ) : !isStudentOnboardingComplete(user) ? (
                <Navigate replace to="/" state={{ resumeOnboarding: true }} />
              ) : (
                <div className="app-shell dashboard-app-shell">
                  <StudentConceptLearningPage />
                </div>
              )
            ) : (
              <Navigate replace to="/" />
            )
          }
        />
        <Route
          path="/chapters/:chapterId/sections/:sectionId/memory-booster"
          element={
            authPending ? null : isAuthenticated ? (
              user?.role === "admin" ? (
                <Navigate replace to="/admin" />
              ) : user?.role === "moderator" ? (
                <Navigate replace to="/moderator" />
              ) : !isStudentOnboardingComplete(user) ? (
                <Navigate replace to="/" state={{ resumeOnboarding: true }} />
              ) : (
                <div className="app-shell dashboard-app-shell">
                  <StudentMemoryBoosterPage />
                </div>
              )
            ) : (
              <Navigate replace to="/" />
            )
          }
        />
        <Route
          path="/chapters/:chapterId/sections/:sectionId/flashcards"
          element={
            authPending ? null : isAuthenticated ? (
              user?.role === "admin" ? (
                <Navigate replace to="/admin" />
              ) : user?.role === "moderator" ? (
                <Navigate replace to="/moderator" />
              ) : !isStudentOnboardingComplete(user) ? (
                <Navigate replace to="/" state={{ resumeOnboarding: true }} />
              ) : (
                <div className="app-shell dashboard-app-shell">
                  <StudentFlashcardsPage />
                </div>
              )
            ) : (
              <Navigate replace to="/" />
            )
          }
        />
        <Route
          path="/chapters/:chapterId/sections/:sectionId/diagrams"
          element={
            authPending ? null : isAuthenticated ? (
              user?.role === "admin" ? (
                <Navigate replace to="/admin" />
              ) : user?.role === "moderator" ? (
                <Navigate replace to="/moderator" />
              ) : !isStudentOnboardingComplete(user) ? (
                <Navigate replace to="/" state={{ resumeOnboarding: true }} />
              ) : (
                <div className="app-shell dashboard-app-shell">
                  <StudentDiagramsPage />
                </div>
              )
            ) : (
              <Navigate replace to="/" />
            )
          }
        />
        <Route
          path="/chapters/:chapterId/sections/:sectionId/mind-map"
          element={
            authPending ? null : isAuthenticated ? (
              user?.role === "admin" ? (
                <Navigate replace to="/admin" />
              ) : user?.role === "moderator" ? (
                <Navigate replace to="/moderator" />
              ) : !isStudentOnboardingComplete(user) ? (
                <Navigate replace to="/" state={{ resumeOnboarding: true }} />
              ) : (
                <div className="app-shell dashboard-app-shell">
                  <StudentMindMapPage />
                </div>
              )
            ) : (
              <Navigate replace to="/" />
            )
          }
        />
        <Route
          path="/chapters/:chapterId/sections/:sectionId/assessment"
          element={
            authPending ? null : isAuthenticated ? (
              user?.role === "admin" ? (
                <Navigate replace to="/admin" />
              ) : user?.role === "moderator" ? (
                <Navigate replace to="/moderator" />
              ) : !isStudentOnboardingComplete(user) ? (
                <Navigate replace to="/" state={{ resumeOnboarding: true }} />
              ) : (
                <div className="app-shell dashboard-app-shell">
                  <StudentAssessmentPage />
                </div>
              )
            ) : (
              <Navigate replace to="/" />
            )
          }
        />
        <Route
          path="/chapters/:chapterId/sections/:sectionId/assessment/result/:attemptId"
          element={
            authPending ? null : isAuthenticated ? (
              user?.role === "admin" ? (
                <Navigate replace to="/admin" />
              ) : user?.role === "moderator" ? (
                <Navigate replace to="/moderator" />
              ) : !isStudentOnboardingComplete(user) ? (
                <Navigate replace to="/" state={{ resumeOnboarding: true }} />
              ) : (
                <div className="app-shell dashboard-app-shell">
                  <StudentAssessmentResultPage />
                </div>
              )
            ) : (
              <Navigate replace to="/" />
            )
          }
        />
        <Route
          path="/chapters/:chapterId/sections/:sectionId/concepts/:conceptId/assessment"
          element={
            authPending ? null : isAuthenticated ? (
              user?.role === "admin" ? (
                <Navigate replace to="/admin" />
              ) : user?.role === "moderator" ? (
                <Navigate replace to="/moderator" />
              ) : !isStudentOnboardingComplete(user) ? (
                <Navigate replace to="/" state={{ resumeOnboarding: true }} />
              ) : (
                <div className="app-shell dashboard-app-shell">
                  <StudentAssessmentPage />
                </div>
              )
            ) : (
              <Navigate replace to="/" />
            )
          }
        />
        <Route
          path="/chapters/:chapterId/sections/:sectionId/concepts/:conceptId/assessment/result/:attemptId"
          element={
            authPending ? null : isAuthenticated ? (
              user?.role === "admin" ? (
                <Navigate replace to="/admin" />
              ) : user?.role === "moderator" ? (
                <Navigate replace to="/moderator" />
              ) : !isStudentOnboardingComplete(user) ? (
                <Navigate replace to="/" state={{ resumeOnboarding: true }} />
              ) : (
                <div className="app-shell dashboard-app-shell">
                  <StudentAssessmentResultPage />
                </div>
              )
            ) : (
              <Navigate replace to="/" />
            )
          }
        />
        <Route
          path="/admin"
          element={
            authPending ? null : isAuthenticated ? (
              user?.role === "admin" ? (
                <div className="app-shell admin-app-shell">
                  <AdminLayout onLogout={handleLogout} user={user} />
                </div>
              ) : user?.role === "moderator" ? (
                <Navigate replace to="/moderator" />
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
            path="practice-sets"
            element={<AdminPracticeSetsPage />}
          />
          <Route
            path="ai-assessment-studio"
            element={<AdminAssessmentStudioPage />}
          />
          <Route
            path="ai-assessment-studio/audit/:jobId"
            element={<AdminAssessmentAuditPage />}
          />
          <Route
            path="ai-assessment-studio/workbench/:jobId"
            element={<AdminAssessmentWorkbenchPage />}
          />
          <Route
            path="ai-assessment-studio/bulk"
            element={<AdminBulkPipelinePage />}
          />
          <Route
            path="ai-assessment-studio/runs"
            element={<AdminPipelineRunsPage />}
          />
          <Route
            path="ai-assessment-studio/chapter-exercises/:bookId/:chapterNumber"
            element={<AdminChapterExerciseReviewPage />}
          />
          <Route
            path="assessment-studio"
            element={<AdminAssessmentStudioPage />}
          />
          <Route
            path="assessment-studio/audit/:jobId"
            element={<AdminAssessmentAuditPage />}
          />
          <Route
            path="assessment-studio/workbench/:jobId"
            element={<AdminAssessmentWorkbenchPage />}
          />
          <Route
            path="assessment-studio/manual"
            element={<AdminAssessmentManualPage />}
          />
          <Route
            path="question-bank"
            element={<AdminQuestionBankPage />}
          />
          <Route
            path="learning-analytics"
            element={<AdminLearningAnalyticsPage />}
          />
          <Route
            path="performance-insights"
            element={<AdminPerformanceInsightsPage />}
          />
          <Route
            path="content-review"
            element={<AdminContentReviewPage />}
          />
          <Route
            path="moderation"
            element={<AdminModerationPage />}
          />
          <Route
            path="users"
            element={<AdminUsersPage />}
          />
          <Route
            path="settings"
            element={<AdminSettingsPage />}
          />
        </Route>
        <Route
          path="/moderator"
          element={
            authPending ? null : isAuthenticated ? (
              user?.role === "moderator" ? (
                <div className="app-shell admin-app-shell">
                  <ModeratorLayout onLogout={handleLogout} user={user} />
                </div>
              ) : user?.role === "admin" ? (
                <Navigate replace to="/admin" />
              ) : (
                <Navigate replace to="/dashboard" />
              )
            ) : (
              <Navigate replace to="/" />
            )
          }
        >
          <Route index element={<ModeratorConsolePage />} />
          <Route path="tasks/:reviewQueueId" element={<ModeratorLayerReviewPage />} />
        </Route>
      </Routes>
    </>
  );
};

export default App;
