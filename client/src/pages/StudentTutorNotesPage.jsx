import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { StudentDetailCard } from "../components/StudentDetailCard";
import { getStudentTutorNotes } from "../api/client";

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

const ChevronIcon = ({ direction }) => (
  <svg viewBox="0 0 24 24" className="student-dashboard-icon" aria-hidden="true">
    <path
      d={direction === "left" ? "m14.5 6-6 6 6 6" : "m9.5 6 6 6-6 6"}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    />
  </svg>
);

// Same left/right swipe threshold + touch/pointer handler pattern as
// StudentMemoryBoosterPage.jsx's concept pager / StudentRevisionPage.jsx.
const SWIPE_THRESHOLD = 50;

// "Tutor Notes" -- static, pre-generated coach/interview/viva content
// imported via the admin JSON pipeline. Named distinctly from the existing
// "AI Tutor" tab (StudentAiTutorPanel.jsx inside StudentConceptLearningPage),
// which is a live chat feature, to avoid the two being mistaken for the same
// thing.
const MODE_TABS = [
  { key: "coach", label: "Coach" },
  { key: "interview", label: "Interview" },
  { key: "viva", label: "Viva" },
  { key: "debate", label: "Debate" },
];

export const StudentTutorNotesPage = () => {
  const navigate = useNavigate();
  const { chapterId: chapterNumber, sectionId: sourceSectionId } = useParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeMode, setActiveMode] = useState(null);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const swipeStartX = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    getStudentTutorNotes(sourceSectionId)
      .then((result) => {
        if (!cancelled) setItems(result?.items || []);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || "Failed to load tutor notes.");
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

  // Switching tabs (Coach/Interview/Viva/Debate) starts back at the first
  // card of that mode rather than retaining an index that may be out of
  // range (or just the wrong card) for the newly-selected list.
  useEffect(() => {
    setActiveItemIndex(0);
  }, [activeMode]);

  const goToItem = (nextIndex) => {
    setActiveItemIndex((current) => {
      const clamped = Math.max(0, Math.min(nextIndex, visibleItems.length - 1));
      return clamped === current ? current : clamped;
    });
  };

  const handleSwipeStart = (event) => {
    swipeStartX.current = (event.touches?.[0] ?? event).clientX;
  };

  const handleSwipeEnd = (event) => {
    if (swipeStartX.current === null) return;
    const endX = (event.changedTouches?.[0] ?? event).clientX;
    const deltaX = endX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
    goToItem(activeItemIndex + (deltaX < 0 ? 1 : -1));
  };

  const activeItem = visibleItems[activeItemIndex];

  return (
    <StudentPageShell pageClass="student-page--tutor-notes" legacyModifierClass="student-tutor-notes-phone">
      <header className="student-section-detail-header">
        <button
          type="button"
          className="student-chapter-detail-back"
          aria-label="Back to section"
          onClick={() => navigate(`/chapters/${chapterNumber}/sections/${sourceSectionId}`)}
        >
          <BackIcon />
        </button>
        <h1>Tutor Notes</h1>
      </header>

      {loading ? (
        <p className="student-empty-state">Loading tutor notes...</p>
      ) : error ? (
        <p className="student-empty-state">{error}</p>
      ) : availableTabs.length === 0 ? (
        <p className="student-empty-state">No tutor notes have been generated for this section yet.</p>
      ) : (
        <>
          <nav
            className="student-section-detail-tabs"
            aria-label="Tutor notes mode"
            style={{
              gridTemplateColumns: `repeat(${availableTabs.length}, minmax(0, 1fr))`,
              "--tab-count": availableTabs.length,
            }}
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

          {visibleItems.length > 1 && (
            <div className="student-memory-booster-counter-row">
              <button
                type="button"
                className="student-memory-booster-counter-nav"
                aria-label="Previous"
                onClick={() => goToItem(activeItemIndex - 1)}
                disabled={activeItemIndex === 0}
              >
                <ChevronIcon direction="left" />
              </button>
              <span className="student-memory-booster-concept-counter">
                {activeItemIndex + 1} of {visibleItems.length}
              </span>
              <button
                type="button"
                className="student-memory-booster-counter-nav"
                aria-label="Next"
                onClick={() => goToItem(activeItemIndex + 1)}
                disabled={activeItemIndex === visibleItems.length - 1}
              >
                <ChevronIcon direction="right" />
              </button>
            </div>
          )}

          {activeItem && (
            <div
              className="student-detail-pager-viewport"
              onTouchStart={handleSwipeStart}
              onTouchEnd={handleSwipeEnd}
              onPointerDown={handleSwipeStart}
              onPointerUp={handleSwipeEnd}
            >
              <StudentDetailCard
                key={`${activeItem.assessmentUnitId}-${activeItemIndex}`}
                title={activeItem.title}
                summary={activeItem.summary}
                details={activeItem.details}
              />
            </div>
          )}
        </>
      )}
    </StudentPageShell>
  );
};
