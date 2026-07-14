import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { StudentMediaViewer } from "../components/StudentMediaViewer";
import { getStudentDiagramMedia, getStudentDiagrams } from "../api/client";

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

// The pipeline extracts diagram structure (name, purpose, labeled parts,
// which labels are commonly tested) with no coordinate/label-position data,
// so tapping a labeled part still isn't a clickable image overlay -- but a
// generated/uploaded picture (when one exists) now shows on the front face,
// turning the flip card from "read a name, recall the labels" into "see the
// actual diagram, recall the labels" (same flip-card animation as
// StudentFlashcardsPage; labeled parts still revealed on the back).
export const StudentDiagramsPage = () => {
  const navigate = useNavigate();
  const { chapterId: chapterNumber, sectionId: sourceSectionId } = useParams();
  const [diagrams, setDiagrams] = useState([]);
  const [mediaByDiagramId, setMediaByDiagramId] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flippedNames, setFlippedNames] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setFlippedNames(new Set());
    setMediaByDiagramId({});

    getStudentDiagrams(sourceSectionId)
      .then(async (result) => {
        if (cancelled) return;
        const nextDiagrams = result?.diagrams || [];
        setDiagrams(nextDiagrams);

        const mediaEntries = await Promise.all(
          nextDiagrams.map((diagram) =>
            getStudentDiagramMedia(diagram.diagramId)
              .then((mediaResult) => [diagram.diagramId, mediaResult?.media || null])
              .catch(() => [diagram.diagramId, null])
          )
        );
        if (!cancelled) setMediaByDiagramId(Object.fromEntries(mediaEntries));
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
    <StudentPageShell pageClass="student-page--diagrams" legacyModifierClass="student-diagrams-phone">
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
              const media = mediaByDiagramId[diagram.diagramId];
              return (
                <div className="student-flashcard-viewport" key={diagram.diagramId || diagram.diagramName}>
                  <button
                    type="button"
                    className={`student-flashcard student-diagram-flip-card ${isFlipped ? "is-flipped" : ""}`}
                    aria-pressed={isFlipped}
                    onClick={() => toggleFlip(diagram.diagramName)}
                  >
                    <div className="student-flashcard-inner">
                      <div className="student-flashcard-face student-flashcard-face-front">
                        <span className="student-flashcard-label">Diagram</span>
                        {media && (
                          <StudentMediaViewer
                            mediaType="image"
                            src={media.mediaData}
                            alt={`${diagram.diagramName} illustration`}
                          />
                        )}
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

    </StudentPageShell>
  );
};
