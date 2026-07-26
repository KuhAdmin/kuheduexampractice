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

// Diagrams are imported as AI-image-generation prompts (title + description),
// not interactive labeled parts -- there's no labeled-parts data to quiz on
// anymore, so the flip card's back face just shows the fuller description
// text instead (same flip-card animation as StudentFlashcardsPage).
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
                        <span className="student-flashcard-hint">Tap to read more</span>
                      </div>
                      <div className="student-flashcard-face student-flashcard-face-back">
                        <span className="student-flashcard-label">About this diagram</span>
                        {diagram.purpose ? (
                          <p className="student-diagram-purpose">{diagram.purpose}</p>
                        ) : (
                          <p className="student-empty-state">No description recorded for this diagram.</p>
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
