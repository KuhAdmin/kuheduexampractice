import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTeacherTestPapers } from "../api/client";

const TABS = ["All Tests", "Drafts", "Finalized"];

export const TeacherTestsPage = () => {
  const navigate = useNavigate();
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("All Tests");

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

  const filtered = papers.filter((paper) => {
    if (activeTab === "Drafts") return paper.status === "draft";
    if (activeTab === "Finalized") return paper.status === "finalized";
    return true;
  });

  return (
    <div className="teacher-page">
      <div className="teacher-page-header">
        <div>
          <span className="eyebrow">Teacher module</span>
          <h1>Tests</h1>
          <p>Create and manage question papers for your classes.</p>
        </div>
        <div>
          <button type="button" className="primary-button" onClick={() => navigate("/teacher/tests/new")}>
            + Create Test
          </button>
          <button type="button" className="ghost-button" onClick={() => navigate("/teacher/tests/custom-questions")}>
            My Custom Questions
          </button>
        </div>
      </div>

      <div className="teacher-tabs">
        {TABS.map((tab) => (
          <button key={tab} type="button" className={`teacher-tab ${activeTab === tab ? "is-active" : ""}`} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p>Loading tests...</p>
      ) : filtered.length === 0 ? (
        <div className="admin-panel">
          <p>No tests here yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="teacher-card-list">
          {filtered.map((paper) => (
            <div key={paper.id} className="teacher-card">
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
              <div className="teacher-card-row">
                <span />
                <button type="button" className="primary-button" onClick={() => navigate(`/teacher/tests/${paper.id}`)}>
                  Open
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
