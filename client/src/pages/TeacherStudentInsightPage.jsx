import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getTeacherStudentInsight } from "../api/client";

const STATUS_TONE = { "Needs support": "tone-red", Developing: "tone-amber", Secure: "tone-green" };

export const TeacherStudentInsightPage = () => {
  const { batchId, userId } = useParams();
  const navigate = useNavigate();
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setInsight(await getTeacherStudentInsight(batchId, userId));
    } catch (loadError) {
      setError(loadError.message || "Failed to load this student's insight.");
    } finally {
      setLoading(false);
    }
  }, [batchId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="teacher-page">
      <div className="teacher-page-header">
        <div>
          <button type="button" className="teacher-back-link" onClick={() => navigate(`/teacher/classes/${batchId}`)}>
            &larr; Back to class
          </button>
          <h1>{insight?.student?.name || "Student"}</h1>
          {insight?.student && <p>{insight.student.email}</p>}
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <div className="admin-panel">
            <div className="admin-panel-head">
              <h2>Learning Progress</h2>
              <span>{insight.conceptsTracked} concept{insight.conceptsTracked === 1 ? "" : "s"} tracked in this subject</span>
            </div>
            <div style={{ display: "flex", gap: "32px", flexWrap: "wrap", alignItems: "center" }}>
              <div className="teacher-donut-wrap">
                <div className="teacher-donut" style={{ "--pct": insight.overallProgress }}>
                  <span>{insight.overallProgress}%</span>
                </div>
                <span className="teacher-donut-label">Current learning progress</span>
              </div>
              <div className="teacher-metric-list" style={{ flex: 1, minWidth: 240 }}>
                <div className="teacher-metric-row">
                  <span>Concept understanding</span>
                  <div className="teacher-progress-track">
                    <div className="teacher-progress-fill" style={{ width: `${insight.conceptUnderstanding}%` }} />
                  </div>
                  <span>{insight.conceptUnderstanding}%</span>
                </div>
                <div className="teacher-metric-row">
                  <span>Practice consistency</span>
                  <div className="teacher-progress-track">
                    <div className="teacher-progress-fill" style={{ width: `${insight.practiceConsistency}%` }} />
                  </div>
                  <span>{insight.practiceConsistency}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head">
              <h2>Learning Gaps</h2>
            </div>
            {insight.learningGaps.length === 0 ? (
              <p>No concepts tracked yet for this subject -- gaps will appear once the student starts practicing.</p>
            ) : (
              <div className="teacher-card-list">
                {insight.learningGaps.map((gap) => (
                  <div key={gap.concept} className="teacher-flag-row">
                    <span>{gap.concept}</span>
                    <span className={`teacher-badge ${STATUS_TONE[gap.status] === "tone-red" ? "tone-rejected" : STATUS_TONE[gap.status] === "tone-amber" ? "tone-pending" : "tone-approved"}`}>
                      {gap.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
