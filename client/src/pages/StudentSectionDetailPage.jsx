import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StudentBottomNav } from "../components/StudentBottomNav";
import { StudentDrilldownCard } from "../components/StudentDrilldownCard";
import { getStudentSectionOverview } from "../api/client";

const SectionDetailIcon = ({ type, className = "" }) => {
  const classes = `student-dashboard-icon ${className}`.trim();

  if (type === "back") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
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
  }

  if (type === "quiz") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M8 6.5h8m-8 4h8m-8 4h5M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="m8.2 15.5 1.2 1.2 2-2.4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (type === "memory") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M12 5.5a4 4 0 0 1 4 4c0 1.3-.6 2.4-1.4 3.2-.8.8-1.3 1.4-1.4 2.3h-2.4c-.1-.9-.6-1.5-1.4-2.3A4.4 4.4 0 0 1 8 9.5a4 4 0 0 1 4-4Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="M10 18h4M10.5 20.5h3"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (type === "cards") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M6 8.5A2.5 2.5 0 0 1 8.5 6h7A2.5 2.5 0 0 1 18 8.5v7A2.5 2.5 0 0 1 15.5 18h-7A2.5 2.5 0 0 1 6 15.5v-7Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (type === "diagram") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 5v14M5 12h14"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (type === "tree") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <circle cx="7" cy="6" r="2" fill="currentColor" />
        <circle cx="17" cy="12" r="2" fill="currentColor" />
        <circle cx="17" cy="18" r="2" fill="currentColor" />
        <path
          d="M9 6h4a2 2 0 0 1 2 2v2M15 12H9V8"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.6"
        />
        <path d="M9 8v10" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
        <path d="M9 18h6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
      <path
        d="m9 6 6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
};

export const StudentSectionDetailPage = () => {
  const navigate = useNavigate();
  const { chapterId: chapterNumber, sectionId: sourceSectionId } = useParams();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("concepts");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setActiveTab("concepts");

    getStudentSectionOverview(sourceSectionId)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || "This section has not been generated yet.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sourceSectionId]);

  const basePath = `/chapters/${chapterNumber}/sections/${sourceSectionId}`;

  return (
    <main className="student-dashboard-shell">
      <section className="student-dashboard-phone student-section-detail-phone">
        <header className="student-section-detail-header">
          <button
            type="button"
            className="student-chapter-detail-back"
            aria-label="Back to chapter"
            onClick={() => navigate(`/chapters/${chapterNumber}`)}
          >
            <SectionDetailIcon type="back" />
          </button>
          <h1>{detail ? `${detail.sectionNumber} ${detail.topicName || ""}`.trim() : "Section"}</h1>
        </header>

        {loading ? (
          <p className="student-empty-state">Loading section...</p>
        ) : error || !detail ? (
          <p className="student-empty-state">{error || "This section has not been generated yet."}</p>
        ) : (
          <>
            <section className="student-section-detail-card">
              <div className="student-section-detail-copy">
                <span>Overview</span>
                <p>{detail.overview}</p>
              </div>
            </section>

            <nav className="student-section-detail-tabs" aria-label="Section content">
              <button
                type="button"
                className={`student-section-detail-tab ${activeTab === "concepts" ? "is-active" : ""}`}
                onClick={() => setActiveTab("concepts")}
              >
                Concepts ({detail.conceptCount})
              </button>
              <button
                type="button"
                className={`student-section-detail-tab ${activeTab === "deepLearn" ? "is-active" : ""}`}
                onClick={() => setActiveTab("deepLearn")}
              >
                Deep Learn
              </button>
            </nav>

            {activeTab === "concepts" ? (
              <section className="student-section-detail-concepts">
                <div className="student-section-detail-list">
                  {detail.concepts.map((concept, index) => (
                    <StudentDrilldownCard
                      key={concept.assessmentUnitId}
                      className="student-section-detail-row"
                      onClick={() => navigate(`${basePath}/concepts/${concept.assessmentUnitId}`)}
                      leading={<div className="student-section-detail-index">{index + 1}</div>}
                      title={concept.title}
                      subtitle={concept.completed ? "Status - Completed" : "Status - Ready to learn"}
                    >
                    </StudentDrilldownCard>
                  ))}
                </div>
              </section>
            ) : (
              <section className="student-section-detail-actions">
                <button
                  type="button"
                  className="student-chapter-detail-action is-violet"
                  onClick={() => navigate(`${basePath}/assessment`)}
                >
                  <span className="student-chapter-detail-action-mark is-violet">
                    <SectionDetailIcon type="quiz" />
                  </span>
                  <span className="student-chapter-detail-action-copy">
                    <strong>Section Assessment</strong>
                    <small>{detail.conceptCount} concepts covered</small>
                  </span>
                  <SectionDetailIcon type="chevron" />
                </button>
                <button
                  type="button"
                  className="student-chapter-detail-action is-lilac"
                  onClick={() => navigate(`${basePath}/memory-booster`)}
                >
                  <span className="student-chapter-detail-action-mark is-lilac">
                    <SectionDetailIcon type="memory" />
                  </span>
                  <span className="student-chapter-detail-action-copy">
                    <strong>Memory Booster</strong>
                    <small>Strengthen your memory</small>
                  </span>
                  <SectionDetailIcon type="chevron" />
                </button>
                <button
                  type="button"
                  className="student-chapter-detail-action is-amber"
                  onClick={() => navigate(`${basePath}/flashcards`)}
                >
                  <span className="student-chapter-detail-action-mark is-amber">
                    <SectionDetailIcon type="cards" />
                  </span>
                  <span className="student-chapter-detail-action-copy">
                    <strong>Flashcards</strong>
                    <small>Key terms for this section</small>
                  </span>
                  <SectionDetailIcon type="chevron" />
                </button>
                <button
                  type="button"
                  className="student-chapter-detail-action is-green"
                  onClick={() => navigate(`${basePath}/diagrams`)}
                >
                  <span className="student-chapter-detail-action-mark is-green">
                    <SectionDetailIcon type="diagram" />
                  </span>
                  <span className="student-chapter-detail-action-copy">
                    <strong>Diagrams</strong>
                    <small>Labeled parts to review</small>
                  </span>
                  <SectionDetailIcon type="chevron" />
                </button>
                <button
                  type="button"
                  className="student-chapter-detail-action is-blue"
                  onClick={() => navigate(`${basePath}/mind-map`)}
                >
                  <span className="student-chapter-detail-action-mark is-blue">
                    <SectionDetailIcon type="tree" />
                  </span>
                  <span className="student-chapter-detail-action-copy">
                    <strong>Mind Map</strong>
                    <small>See how concepts connect</small>
                  </span>
                  <SectionDetailIcon type="chevron" />
                </button>
              </section>
            )}
          </>
        )}

        <StudentBottomNav activeItem="chapters" />
      </section>
    </main>
  );
};
