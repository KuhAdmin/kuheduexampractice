import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTeacherTestPapers } from "../api/client";

const STATUS_FILTERS = ["All Tests", "Drafts", "Finalized"];

export const TeacherTestsPage = () => {
  const navigate = useNavigate();
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Tests");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getTeacherTestPapers();
      setPapers(result?.papers || []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load tests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredPapers = useMemo(
    () =>
      papers.filter((paper) => {
        if (statusFilter === "Drafts") return paper.status === "draft";
        if (statusFilter === "Finalized") return paper.status === "finalized";
        return true;
      }),
    [papers, statusFilter]
  );

  const draftCount = useMemo(() => papers.filter((paper) => paper.status === "draft").length, [papers]);
  const finalizedCount = papers.length - draftCount;
  const finalizedPercent = papers.length ? Math.round((finalizedCount / papers.length) * 100) : 0;

  return (
    <div className="teacher-page">
      <div className="teacher-lessons-hero">
        <div>
          <span className="eyebrow">Teacher module</span>
          <h1>Test &amp; Assess with Confidence</h1>
          <p>Build curriculum-aligned question papers in minutes -- pick questions by hand or let the generator do it.</p>
          <div className="teacher-lessons-hero-badges">
            <span>✅ Aligned to your curriculum</span>
            <span>🧮 Auto-balanced marks</span>
            <span>📥 Export to PDF &amp; Excel</span>
          </div>
        </div>
        <div className="teacher-lessons-hero-actions">
          <button type="button" className="ghost-button teacher-lessons-ai-pill" onClick={() => navigate("/teacher/tests/new")}>
            ✨ Create Test
          </button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="teacher-lessons-layout">
        <div className="teacher-lessons-main">
          <div className="admin-panel">
            <div className="admin-panel-head teacher-lessons-quick-actions-head">
              <h2>Quick Actions</h2>
              <p>Start a new paper, or manage your existing tests.</p>
            </div>
            <div className="teacher-lessons-quick-actions">
              <div className="teacher-lessons-quick-action tone-red">
                <span className="teacher-lessons-quick-action-icon">🧾</span>
                <h3>Create Test</h3>
                <p>Generate a question paper by chapter, difficulty or question type</p>
                <button type="button" className="primary-button" onClick={() => navigate("/teacher/tests/new")}>
                  Create Test →
                </button>
              </div>
              <div className="teacher-lessons-quick-action tone-purple">
                <span className="teacher-lessons-quick-action-icon">✍️</span>
                <h3>Custom Questions</h3>
                <p>Author and manage your own question bank</p>
                <button type="button" className="primary-button" onClick={() => navigate("/teacher/tests/custom-questions")}>
                  Custom Questions →
                </button>
              </div>
              <div className="teacher-lessons-quick-action tone-amber">
                <span className="teacher-lessons-quick-action-icon">📝</span>
                <h3>Drafts</h3>
                <p>Papers still being built</p>
                <button type="button" className="primary-button" onClick={() => setStatusFilter("Drafts")}>
                  View Drafts {draftCount > 0 ? `(${draftCount})` : ""} →
                </button>
              </div>
              <div className="teacher-lessons-quick-action tone-green">
                <span className="teacher-lessons-quick-action-icon">✅</span>
                <h3>Finalized</h3>
                <p>Papers ready to print or assign</p>
                <button type="button" className="primary-button" onClick={() => setStatusFilter("Finalized")}>
                  View Finalized {finalizedCount > 0 ? `(${finalizedCount})` : ""} →
                </button>
              </div>
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head">
              <h2>My Tests</h2>
            </div>

            <div className="teacher-lessons-status-filter">
              {STATUS_FILTERS.map((label) => (
                <button
                  key={label}
                  type="button"
                  className={`teacher-tab ${statusFilter === label ? "is-active" : ""}`}
                  onClick={() => setStatusFilter(label)}
                >
                  {label}
                </button>
              ))}
            </div>

            {loading ? (
              <p>Loading...</p>
            ) : filteredPapers.length === 0 ? (
              <p>No tests here yet. Create one to get started.</p>
            ) : (
              <div className="teacher-card-list">
                {filteredPapers.map((paper) => (
                  <div
                    key={paper.id}
                    className="teacher-card teacher-lessons-plan-card is-clickable"
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/teacher/tests/${paper.id}`)}
                    onKeyDown={(e) => e.key === "Enter" && navigate(`/teacher/tests/${paper.id}`)}
                  >
                    <div className="teacher-card-head">
                      <h3>{paper.title}</h3>
                      <span className={`teacher-badge tone-${paper.status === "finalized" ? "published" : "draft"}`}>
                        {paper.status === "finalized" ? "Finalized" : "Draft"}
                      </span>
                    </div>
                    <p className="teacher-card-meta">
                      {paper.className ? `${paper.className}-${paper.sectionName} · ${paper.subjectName}` : "No class linked"}
                    </p>
                    <p className="teacher-card-meta">
                      {paper.questionCount} Questions &middot; {paper.totalMarks} Marks &middot; Created{" "}
                      {new Date(paper.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="teacher-lessons-sidebar">
          <div className="teacher-lessons-widget tone-blue">
            <div className="teacher-lessons-widget-head">
              <h3>Tests Overview</h3>
            </div>
            {papers.length === 0 ? (
              <p>No tests yet.</p>
            ) : (
              <>
                <div className="teacher-progress-track">
                  <div className="teacher-progress-fill" style={{ width: `${finalizedPercent}%` }} />
                </div>
                <p className="teacher-lessons-progress-caption">
                  {finalizedCount} / {papers.length} tests finalized
                </p>
                <div className="teacher-lessons-progress-legend">
                  <span className="tone-green">● Finalized {finalizedCount}</span>
                  <span className="tone-muted">● Draft {draftCount}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
