import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StudentBottomNav } from "../components/StudentBottomNav";
import { getAssessmentResult } from "../api/client";

export const StudentAssessmentResultPage = () => {
  const navigate = useNavigate();
  const { chapterId: chapterNumber, sectionId: sourceSectionId, conceptId, attemptId } = useParams();
  const isConceptMode = Boolean(conceptId);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    getAssessmentResult(attemptId)
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || "Failed to load result.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  const sectionPath = `/chapters/${chapterNumber}/sections/${sourceSectionId}`;
  const basePath = isConceptMode ? `${sectionPath}/concepts/${conceptId}` : sectionPath;
  const scorePercent = result?.score ?? 0;

  return (
    <main className="student-dashboard-shell">
      <section className="student-dashboard-phone student-assessment-result-phone">
        <header className="student-section-detail-header">
          <h1>Assessment Result</h1>
        </header>

        {loading ? (
          <p className="student-empty-state">Loading result...</p>
        ) : error || !result ? (
          <p className="student-empty-state">{error || "Result not found."}</p>
        ) : (
          <>
            <div className="student-result-score-ring">
              <span className="student-result-score-value">{scorePercent}%</span>
              <span className="student-result-score-label">
                {scorePercent >= 80 ? "Great job!" : scorePercent >= 50 ? "Good effort!" : "Keep practicing!"}
              </span>
            </div>

            <div className="student-result-counts">
              <div>
                <strong>{result.correctCount}</strong>
                <span>Correct</span>
              </div>
              <div>
                <strong>{result.incorrectCount}</strong>
                <span>Incorrect</span>
              </div>
              <div>
                <strong>{result.unattemptedCount}</strong>
                <span>Unattempted</span>
              </div>
            </div>

            <section className="student-result-topics">
              <h2>Performance by Topic</h2>
              {result.performanceByTopic.map((topic) => (
                <div key={topic.assessmentUnitId} className="student-result-topic-row">
                  <span>{topic.primaryConcept}</span>
                  <div className="student-result-topic-bar" aria-hidden="true">
                    <span style={{ width: `${topic.percentage}%` }} />
                  </div>
                  <strong>{topic.percentage}%</strong>
                </div>
              ))}
            </section>

            <div className="student-result-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => navigate(basePath)}
              >
                Back to Overview
              </button>
              <button
                type="button"
                className="student-concept-practice-next"
                onClick={() => navigate(`${basePath}/assessment`)}
              >
                Retake Assessment
              </button>
            </div>
          </>
        )}

        <StudentBottomNav activeItem="chapters" />
      </section>
    </main>
  );
};
