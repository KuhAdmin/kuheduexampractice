import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { StudentDrilldownCard } from "../components/StudentDrilldownCard";
import { getRemainingConcepts } from "../api/client";

const BackIcon = () => (
  <svg viewBox="0 0 24 24" className="student-dashboard-icon" aria-hidden="true">
    <path
      d="m15 6-6 6 6 6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    />
  </svg>
);

export const StudentRemainingConceptsPage = () => {
  const navigate = useNavigate();
  const [concepts, setConcepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    getRemainingConcepts()
      .then((result) => {
        if (!cancelled) setConcepts(result?.concepts || []);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || "Unable to load remaining concepts.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <StudentPageShell pageClass="student-page--goals" legacyModifierClass="student-section-detail-phone">
        <header className="student-section-detail-header">
          <button
            type="button"
            className="student-chapter-detail-back"
            aria-label="Back to dashboard"
            onClick={() => navigate("/dashboard")}
          >
            <BackIcon />
          </button>
          <h1>Today&apos;s Goal</h1>
        </header>

        {loading ? (
          <p className="student-empty-state">Loading remaining concepts...</p>
        ) : error ? (
          <p className="student-empty-state">{error}</p>
        ) : !concepts.length ? (
          <p className="student-empty-state">All concepts completed. Great work!</p>
        ) : (
          <section className="student-section-detail-concepts">
            <div className="student-section-detail-list">
              {concepts.map((concept, index) => (
                <StudentDrilldownCard
                  key={concept.assessmentUnitId}
                  className="student-section-detail-row"
                  onClick={() =>
                    navigate(
                      `/chapters/${concept.chapterNumber}/sections/${concept.sourceSectionId}/concepts/${concept.assessmentUnitId}`
                    )
                  }
                  leading={<div className="student-section-detail-index">{index + 1}</div>}
                  title={concept.topicName || concept.primaryConcept || concept.chapterName}
                  subtitle={`${concept.chapterName}${concept.sectionNumber ? ` · ${concept.sectionNumber}` : ""}`}
                />
              ))}
            </div>
          </section>
        )}

    </StudentPageShell>
  );
};
