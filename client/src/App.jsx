import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AdminLayout } from "./components/AdminLayout";
import { apiRequest } from "./api/client";
import { AdminAiAssessmentDemoPage } from "./pages/AdminAiAssessmentDemoPage";
import { AdminDemoModelSettingsPage } from "./pages/AdminDemoModelSettingsPage";
import { AdminChapterExerciseReviewPage } from "./pages/AdminChapterExerciseReviewPage";
import { AdminSettingsPage } from "./pages/AdminSettingsPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { AdminExamTypesPage } from "./pages/AdminExamTypesPage";
import { AdminExamGoalsPage } from "./pages/AdminExamGoalsPage";
import { AdminLevelsPage } from "./pages/AdminLevelsPage";
import { AdminSubjectsPage } from "./pages/AdminSubjectsPage";
import { AdminBooksPage } from "./pages/AdminBooksPage";
import { AdminConceptImportPage } from "./pages/AdminConceptImportPage";
import { StudentLayout } from "./components/StudentLayout";
import { useAuth } from "./context/AuthContext";
import { AdminOverviewPage } from "./pages/AdminOverviewPage";
import { AdminSectionPage } from "./pages/AdminSectionPage";
import { AuthSuccessPage } from "./pages/AuthSuccessPage";
import { HomePage } from "./pages/HomePage";
import { LegalPage } from "./pages/LegalPage";
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
import { StudentRevisionPage } from "./pages/StudentRevisionPage";
import { StudentTutorNotesPage } from "./pages/StudentTutorNotesPage";
import { StudentMemoryBoosterPage } from "./pages/StudentMemoryBoosterPage";
import { StudentMindMapPage } from "./pages/StudentMindMapPage";
import { StudentProfilePage } from "./pages/StudentProfilePage";
import { StudentPracticePage } from "./pages/StudentPracticePage";
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
      navigate("/admin");
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
          element={
            authPending ? null : isAuthenticated ? (
              user?.role === "admin" || user?.role === "moderator" ? (
                <Navigate replace to="/admin" />
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
            element={<StudentProfilePage dashboard={dashboard} user={user} onLogout={handleLogout} />}
          />
          <Route path="/chapters" element={<StudentChaptersPage dashboard={dashboard} user={user} />} />
          <Route path="/practice" element={<StudentPracticePage />} />
          <Route path="/goals" element={<StudentRemainingConceptsPage />} />
          <Route path="/chapters/:chapterId" element={<StudentChapterDetailPage dashboard={dashboard} />} />
          <Route path="/chapters/:chapterId/book-questions" element={<StudentBookQuestionsPage />} />
          <Route path="/chapters/:chapterId/assessment" element={<StudentAssessmentPage />} />
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
            authPending ? null : isAuthenticated ? (
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
            path="concept-import"
            element={<AdminConceptImportPage />}
          />
          <Route
            path="settings"
            element={<AdminSettingsPage />}
          />
        </Route>
      </Routes>
    </>
  );
};

export default App;
