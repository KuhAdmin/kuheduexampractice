import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { StudentDetailCard } from "../components/StudentDetailCard";
import { getStudentRevision } from "../api/client";

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

const MODE_TABS = [
  { key: "cheatsheet", label: "Cheat Sheet" },
  { key: "mnemonics", label: "Mnemonics" },
  { key: "examnotes", label: "Exam Notes" },
];

export const StudentRevisionPage = () => {
  const navigate = useNavigate();
  const { chapterId: chapterNumber, sectionId: sourceSectionId } = useParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeMode, setActiveMode] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    getStudentRevision(sourceSectionId)
      .then((result) => {
        if (!cancelled) setItems(result?.items || []);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || "Failed to load revision content.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sourceSectionId]);

  const availableTabs = useMemo(
    () => MODE_TABS.filter((tab) => items.some((item) => item.mode === tab.key)),
    [items]
  );

  useEffect(() => {
    setActiveMode(availableTabs[0]?.key || null);
  }, [availableTabs]);

  const visibleItems = items.filter((item) => item.mode === activeMode);

  return (
    <StudentPageShell pageClass="student-page--revision" legacyModifierClass="student-revision-phone">
      <header className="student-section-detail-header">
        <button
          type="button"
          className="student-chapter-detail-back"
          aria-label="Back to section"
          onClick={() => navigate(`/chapters/${chapterNumber}/sections/${sourceSectionId}`)}
        >
          <BackIcon />
        </button>
        <h1>Revision</h1>
      </header>

      {loading ? (
        <p className="student-empty-state">Loading revision content...</p>
      ) : error ? (
        <p className="student-empty-state">{error}</p>
      ) : availableTabs.length === 0 ? (
        <p className="student-empty-state">No revision content has been generated for this section yet.</p>
      ) : (
        <>
          <nav
            className="student-section-detail-tabs"
            aria-label="Revision mode"
            style={{ gridTemplateColumns: `repeat(${availableTabs.length}, minmax(0, 1fr))` }}
          >
            {availableTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`student-section-detail-tab ${activeMode === tab.key ? "is-active" : ""}`}
                onClick={() => setActiveMode(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="student-detail-card-list-page">
            {visibleItems.map((item, index) => (
              <StudentDetailCard
                key={`${item.assessmentUnitId}-${index}`}
                title={item.title}
                summary={item.summary}
                details={item.details}
              />
            ))}
          </div>
        </>
      )}
    </StudentPageShell>
  );
};
