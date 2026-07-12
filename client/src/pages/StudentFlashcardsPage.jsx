import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { FocusLayout } from "../components/FocusLayout";
import { getStudentFlashcards } from "../api/client";

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

export const StudentFlashcardsPage = () => {
  const navigate = useNavigate();
  const { chapterId: chapterNumber, sectionId: sourceSectionId } = useParams();
  const [flashcards, setFlashcards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    getStudentFlashcards(sourceSectionId)
      .then((result) => {
        if (!cancelled) setFlashcards(result?.flashcards || []);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || "Failed to load flashcards.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sourceSectionId]);

  const activeCard = flashcards[activeIndex];

  const goToCard = (nextIndex) => {
    setIsFlipped(false);
    setActiveIndex(Math.max(0, Math.min(nextIndex, flashcards.length - 1)));
  };

  return (
    <StudentPageShell pageClass="student-page--flashcards" legacyModifierClass="student-flashcards-phone">
      <FocusLayout>
        <header className="student-section-detail-header">
          <button
            type="button"
            className="student-chapter-detail-back"
            aria-label="Back to section"
            onClick={() => navigate(`/chapters/${chapterNumber}/sections/${sourceSectionId}`)}
          >
            <BackIcon />
          </button>
          <h1>Flashcards</h1>
        </header>

        {loading ? (
          <p className="student-empty-state">Loading flashcards...</p>
        ) : error ? (
          <p className="student-empty-state">{error}</p>
        ) : flashcards.length === 0 ? (
          <p className="student-empty-state">No terms have been generated for this section yet.</p>
        ) : (
          <>
            <div className="student-flashcard-viewport">
              <button
                type="button"
                className={`student-flashcard ${isFlipped ? "is-flipped" : ""} ${
                  activeIndex % 2 === 1 ? "is-alternate" : ""
                }`}
                aria-pressed={isFlipped}
                onClick={() => setIsFlipped((current) => !current)}
              >
                <div className="student-flashcard-inner">
                  <div className="student-flashcard-face student-flashcard-face-front">
                    <span className="student-flashcard-label">Term</span>
                    <p className="student-flashcard-text">{activeCard.term}</p>
                    <span className="student-flashcard-hint">Tap to flip</span>
                  </div>
                  <div className="student-flashcard-face student-flashcard-face-back">
                    <span className="student-flashcard-label">Definition</span>
                    <p className="student-flashcard-text">{activeCard.definition}</p>
                    {activeCard.relatedConcepts?.length > 0 && (
                      <p className="student-flashcard-related">
                        Related: {activeCard.relatedConcepts.join(", ")}
                      </p>
                    )}
                    <span className="student-flashcard-hint">Tap to flip back</span>
                  </div>
                </div>
              </button>
            </div>

            <footer className="student-concept-learning-footer">
              <button
                type="button"
                className="student-concept-learning-nav is-previous"
                onClick={() => goToCard(activeIndex - 1)}
                disabled={activeIndex === 0}
              >
                <span>Previous</span>
              </button>
              <span className="student-concept-learning-counter">
                {activeIndex + 1}/{flashcards.length}
              </span>
              <button
                type="button"
                className="student-concept-learning-nav is-next"
                onClick={() => goToCard(activeIndex + 1)}
                disabled={activeIndex === flashcards.length - 1}
              >
                <span>Next</span>
              </button>
            </footer>
          </>
        )}
      </FocusLayout>
    </StudentPageShell>
  );
};
