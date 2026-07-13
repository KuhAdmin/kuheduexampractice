import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { StudentDrilldownCard } from "../components/StudentDrilldownCard";
import { useBreakpoint } from "../hooks/useBreakpoint";
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

const ChevronRightIcon = () => (
  <svg viewBox="0 0 24 24" className="student-dashboard-icon" aria-hidden="true">
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

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="m5 12.5 4.5 4.5L19 7"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.4"
    />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

const CircleOutlineIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 3" />
  </svg>
);

const DocumentIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M6 3.5h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.6"
    />
    <path d="M14 3.5V8h4" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" />
    <path d="M8 13h8M8 16.5h8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
  </svg>
);

// Real status only -- derived server-side from the same mastery threshold
// used elsewhere in the app (student_mastery.mastery_probability) and
// whether the student has ever attempted the concept, not fabricated.
const STATUS_META = {
  completed: { label: "Completed", className: "is-completed", Icon: CheckIcon },
  inProgress: { label: "In Progress", className: "is-in-progress", Icon: ClockIcon },
  notStarted: { label: "Not Started", className: "is-not-started", Icon: CircleOutlineIcon },
};

const conceptTitle = (concept) => concept.primaryConcept || concept.topicName || concept.chapterName;

const conceptSubtitle = (concept) =>
  `${concept.chapterName}${concept.topicName ? ` · ${concept.topicName}` : ""}${
    concept.sectionNumber ? ` · ${concept.sectionNumber}` : ""
  }`;

export const StudentRemainingConceptsPage = () => {
  const navigate = useNavigate();
  const tier = useBreakpoint();
  const isDesktop = tier !== "mobile";
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
        if (!cancelled) setError(fetchError.message || "Unable to load today's goal.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(
    () => ({
      total: concepts.length,
      completed: concepts.filter((concept) => concept.status === "completed").length,
      inProgress: concepts.filter((concept) => concept.status === "inProgress").length,
      notStarted: concepts.filter((concept) => concept.status === "notStarted").length,
    }),
    [concepts]
  );

  // Mobile keeps the original "what's left to do today" list -- the richer
  // completed/in-progress/not-started breakdown below is desktop/tablet only.
  const remainingConcepts = useMemo(
    () => concepts.filter((concept) => concept.status !== "completed"),
    [concepts]
  );

  const goToConcept = (concept) =>
    navigate(`/chapters/${concept.chapterNumber}/sections/${concept.sourceSectionId}/concepts/${concept.assessmentUnitId}`);

  if (isDesktop) {
    return (
      <StudentPageShell pageClass="student-page--goals" legacyModifierClass="student-section-detail-phone">
        <div className="student-goals-desktop">
          <header className="student-goals-header">
            <div className="student-goals-header-title">
              <button
                type="button"
                className="student-chapter-detail-back"
                aria-label="Back to dashboard"
                onClick={() => navigate("/dashboard")}
              >
                <BackIcon />
              </button>
              <div>
                <h1>Today&apos;s Goal</h1>
                <p>Complete topics and strengthen your understanding.</p>
              </div>
            </div>
            {summary.total > 0 && (
              <span className="student-goals-progress-badge">
                <CheckIcon />
                {summary.completed} / {summary.total} Completed
              </span>
            )}
          </header>

          {loading ? (
            <p className="student-empty-state">Loading topics...</p>
          ) : error ? (
            <p className="student-empty-state">{error}</p>
          ) : !concepts.length ? (
            <p className="student-empty-state">No topics available yet.</p>
          ) : (
            <>
              <section className="student-goals-stats">
                <div className="student-goals-stat-card">
                  <span className="student-goals-stat-icon is-total">
                    <DocumentIcon />
                  </span>
                  <strong>{summary.total}</strong>
                  <span>Total Topics</span>
                </div>
                <div className="student-goals-stat-card is-completed">
                  <span className="student-goals-stat-icon is-completed">
                    <CheckIcon />
                  </span>
                  <strong>{summary.completed}</strong>
                  <span>Completed</span>
                </div>
                <div className="student-goals-stat-card is-in-progress">
                  <span className="student-goals-stat-icon is-in-progress">
                    <ClockIcon />
                  </span>
                  <strong>{summary.inProgress}</strong>
                  <span>In Progress</span>
                </div>
                <div className="student-goals-stat-card is-not-started">
                  <span className="student-goals-stat-icon is-not-started">
                    <CircleOutlineIcon />
                  </span>
                  <strong>{summary.notStarted}</strong>
                  <span>Not Started</span>
                </div>
              </section>

              <section className="student-goals-list">
                {concepts.map((concept, index) => {
                  const meta = STATUS_META[concept.status] || STATUS_META.notStarted;
                  const StatusIcon = meta.Icon;
                  return (
                    <button
                      key={concept.assessmentUnitId}
                      type="button"
                      className={`student-goals-row ${meta.className}`}
                      onClick={() => goToConcept(concept)}
                    >
                      <span className="student-goals-row-rail">
                        <span className="student-goals-row-circle">
                          {concept.status === "completed" ? <CheckIcon /> : index + 1}
                        </span>
                      </span>
                      <span className="student-goals-row-copy">
                        <strong>{conceptTitle(concept)}</strong>
                        <small>{conceptSubtitle(concept)}</small>
                      </span>
                      <span className={`student-goals-row-status ${meta.className}`}>
                        <StatusIcon />
                        {meta.label}
                      </span>
                      <ChevronRightIcon />
                    </button>
                  );
                })}
              </section>
            </>
          )}
        </div>
      </StudentPageShell>
    );
  }

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
        ) : !remainingConcepts.length ? (
          <p className="student-empty-state">All concepts completed. Great work!</p>
        ) : (
          <section className="student-section-detail-concepts">
            <div className="student-section-detail-list">
              {remainingConcepts.map((concept, index) => (
                <StudentDrilldownCard
                  key={concept.assessmentUnitId}
                  className="student-section-detail-row"
                  onClick={() => goToConcept(concept)}
                  leading={<div className="student-section-detail-index">{index + 1}</div>}
                  title={conceptTitle(concept)}
                  subtitle={conceptSubtitle(concept)}
                />
              ))}
            </div>
          </section>
        )}

    </StudentPageShell>
  );
};
