import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTeacherGradebookExams } from "../api/client";

const statusOf = (exam) => {
  if (exam.gradedCount === 0) return "Pending";
  if (exam.gradedCount >= exam.studentCount) return "Completed";
  return "In Progress";
};

const TABS = ["Pending", "In Progress", "Completed"];

export const TeacherGradingPage = () => {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("Pending");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getTeacherGradebookExams();
      setExams(result?.exams || []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load gradebook exams.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const withStatus = exams.map((exam) => ({ ...exam, status: statusOf(exam) }));
  const filtered = withStatus.filter((exam) => exam.status === activeTab);
  const pendingCount = withStatus.filter((exam) => exam.status !== "Completed").length;

  return (
    <div className="teacher-page">
      <div className="teacher-page-header">
        <div>
          <span className="eyebrow">Teacher module</span>
          <h1>Grading</h1>
          <p>{pendingCount} submission{pendingCount === 1 ? "" : "s"} waiting for your review.</p>
        </div>
        <button type="button" className="primary-button" onClick={() => navigate("/teacher/grading/new")}>
          + New Exam
        </button>
      </div>

      <div className="teacher-tabs">
        {TABS.map((tab) => (
          <button key={tab} type="button" className={`teacher-tab ${activeTab === tab ? "is-active" : ""}`} onClick={() => setActiveTab(tab)}>
            {tab} ({withStatus.filter((exam) => exam.status === tab).length})
          </button>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="admin-panel">
          <p>Nothing here.</p>
        </div>
      ) : (
        <div className="teacher-card-list">
          {filtered.map((exam) => (
            <div key={exam.id} className="teacher-card">
              <div className="teacher-card-head">
                <h3>{exam.title}</h3>
                <span
                  className={`teacher-badge tone-${
                    exam.status === "Completed" ? "published" : exam.status === "Pending" ? "pending" : "draft"
                  }`}
                >
                  {exam.status}
                </span>
              </div>
              <p className="teacher-card-meta">
                {exam.className}-{exam.sectionName} &middot; {exam.subjectName} &middot; {new Date(exam.examDate).toLocaleDateString()}
              </p>
              <div className="teacher-progress-row">
                <span>
                  {exam.gradedCount}/{exam.studentCount} graded
                </span>
                <div className="teacher-progress-track">
                  <div
                    className="teacher-progress-fill"
                    style={{ width: exam.studentCount ? `${(exam.gradedCount / exam.studentCount) * 100}%` : "0%" }}
                  />
                </div>
              </div>
              <div className="teacher-card-row">
                <span />
                <button type="button" className="primary-button" onClick={() => navigate(`/teacher/grading/${exam.id}`)}>
                  {exam.status === "Completed" ? "View" : "Continue →"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
