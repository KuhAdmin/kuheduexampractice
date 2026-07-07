import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StudentBottomNav } from "../components/StudentBottomNav";
import { getStudentDiagrams } from "../api/client";

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

// The pipeline extracts diagram structure (name, purpose, labeled parts, which
// labels are commonly tested) but no image asset or label coordinates, so this
// renders as a labeled-parts reference card rather than a clickable image
// overlay. Each card is a flip card (same animation as StudentFlashcardsPage)
// posing the diagram as a recall prompt on the front, with the labeled-parts
// list revealed on the back -- active recall instead of just reading a list.
export const StudentDiagramsPage = () => {
  const navigate = useNavigate();
  const { chapterId: chapterNumber, sectionId: sourceSectionId } = useParams();
  const [diagrams, setDiagrams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flippedNames, setFlippedNames] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setFlippedNames(new Set());

    getStudentDiagrams(sourceSectionId)
      .then((result) => {
        if (!cancelled) setDiagrams(result?.diagrams || []);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || "Failed to load diagrams.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sourceSectionId]);

  const toggleFlip = (diagramName) => {
    setFlippedNames((current) => {
      const next = new Set(current);
      if (next.has(diagramName)) {
        next.delete(diagramName);
      } else {
        next.add(diagramName);
      }
      return next;
    });
  };

  return (
    <main className="student-dashboard-shell">
      <section className="student-dashboard-phone student-diagrams-phone">
        <header className="student-section-detail-header">
          <button
            type="button"
            className="student-chapter-detail-back"
            aria-label="Back to section"
            onClick={() => navigate(`/chapters/${chapterNumber}/sections/${sourceSectionId}`)}
          >
            <BackIcon />
          </button>
          <h1>Diagrams</h1>
        </header>

        {loading ? (
          <p className="student-empty-state">Loading diagrams...</p>
        ) : error ? (
          <p className="student-empty-state">{error}</p>
        ) : diagrams.length === 0 ? (
          <p className="student-empty-state">No diagrams have been generated for this section yet.</p>
        ) : (
          <div className="student-diagrams-list">
            {diagrams.map((diagram) => {
              const isFlipped = flippedNames.has(diagram.diagramName);
              return (
                <div className="student-flashcard-viewport" key={diagram.diagramName}>
                  <button
                    type="button"
                    className={`student-flashcard student-diagram-flip-card ${isFlipped ? "is-flipped" : ""}`}
                    aria-pressed={isFlipped}
                    onClick={() => toggleFlip(diagram.diagramName)}
                  >
                    <div className="student-flashcard-inner">
                      <div className="student-flashcard-face student-flashcard-face-front">
                        <span className="student-flashcard-label">Diagram</span>
                        <p className="student-flashcard-text">{diagram.diagramName}</p>
                        {diagram.purpose && <p className="student-diagram-purpose">{diagram.purpose}</p>}
                        <span className="student-flashcard-hint">
                          Tap to test yourself on the labeled parts
                        </span>
                      </div>
                      <div className="student-flashcard-face student-flashcard-face-back">
                        <span className="student-flashcard-label">Labeled parts</span>
                        {diagram.labels?.length > 0 ? (
                          <div className="student-diagram-labels">
                            <ul>
                              {diagram.labels.map((label) => (
                                <li
                                  key={label}
                                  className={diagram.testedLabels?.includes(label) ? "is-tested" : ""}
                                >
                                  {label}
                                  {diagram.testedLabels?.includes(label) && (
                                    <span className="student-diagram-tested-badge">Commonly tested</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p className="student-empty-state">No labeled parts recorded for this diagram.</p>
                        )}
                        <span className="student-flashcard-hint">Tap to flip back</span>
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <StudentBottomNav activeItem="chapters" />
      </section>
    </main>
  );
};
