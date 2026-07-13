import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { StudentDrilldownCard } from "../components/StudentDrilldownCard";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { getBookQuestions, getStudentSections } from "../api/client";

const ChapterDetailIcon = ({ type, className = "" }) => {
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

  if (type === "book") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M4 5.5c0-.83.67-1.5 1.5-1.5H12v16H5.5A1.5 1.5 0 0 0 4 21.5v-16Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
        <path
          d="M20 5.5c0-.83-.67-1.5-1.5-1.5H12v16h6.5a1.5 1.5 0 0 1 1.5 1.5v-16Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
      </svg>
    );
  }

  if (type === "check") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
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
  }

  if (type === "clock") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 7.5V12l3 2"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (type === "circle-outline") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 3" />
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

// Real progress only -- section.progress is the server-computed
// mastered/total-concepts percentage; hasContent === false means the
// section has no generated content yet, which counts as not-started too.
const statusForSection = (section) => {
  if (!section.hasContent) return "notStarted";
  if (section.progress >= 100) return "completed";
  if (section.progress > 0) return "inProgress";
  return "notStarted";
};

const STATUS_LABEL = {
  completed: "Completed",
  inProgress: "In Progress",
  notStarted: "Not Started",
};

const STATUS_CLASS = {
  completed: "is-completed",
  inProgress: "is-in-progress",
  notStarted: "is-not-started",
};

const STATUS_ICON = {
  completed: "check",
  inProgress: "clock",
  notStarted: "circle-outline",
};

export const StudentChapterDetailPage = ({ dashboard }) => {
  const navigate = useNavigate();
  const tier = useBreakpoint();
  const isDesktop = tier !== "mobile";
  const { chapterId: chapterNumber } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bookQuestions, setBookQuestions] = useState([]);
  const [bookQuestionsLoading, setBookQuestionsLoading] = useState(true);
  const [bookQuestionsError, setBookQuestionsError] = useState("");

  const dashboardChapter = (Array.isArray(dashboard?.chapters) ? dashboard.chapters : []).find(
    (chapter) => String(chapter.chapterNumber) === String(chapterNumber)
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    getStudentSections(chapterNumber)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || "Failed to load chapter sections.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [chapterNumber]);

  useEffect(() => {
    let cancelled = false;
    setBookQuestionsLoading(true);
    setBookQuestionsError("");

    getBookQuestions(chapterNumber)
      .then((result) => {
        if (!cancelled) setBookQuestions(result?.questions || []);
      })
      .catch((fetchError) => {
        if (!cancelled) setBookQuestionsError(fetchError.message || "Failed to load book questions.");
      })
      .finally(() => {
        if (!cancelled) setBookQuestionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [chapterNumber]);

  const chapterName = data?.chapterName || dashboardChapter?.title || "Chapter";
  const sections = data?.sections || [];
  const generatedSections = sections.filter((section) => section.hasContent);
  // Weighted by conceptCount (not a plain per-section average) so this matches
  // the concept-weighted definition used everywhere else (dashboard chapter
  // list, today's goal) -- otherwise a 3-concept section and a 17-concept
  // section count equally and the number drifts from the real mastery ratio.
  const totalConcepts = generatedSections.reduce(
    (sum, section) => sum + (section.conceptCount || 0),
    0
  );
  const overallProgress = totalConcepts
    ? Math.round(
        generatedSections.reduce(
          (sum, section) => sum + (section.progress || 0) * (section.conceptCount || 0),
          0
        ) / totalConcepts
      )
    : 0;

  const bookQuestionsAnsweredCount = bookQuestions.filter((question) => question.isCorrect !== null).length;
  const bookQuestionsCorrectCount = bookQuestions.filter((question) => question.isCorrect === true).length;
  const bookQuestionsProgress = bookQuestions.length
    ? Math.round((bookQuestionsCorrectCount / bookQuestions.length) * 100)
    : 0;

  const summary = useMemo(() => {
    const withStatus = sections.map(statusForSection);
    return {
      total: sections.length,
      completed: withStatus.filter((status) => status === "completed").length,
      inProgress: withStatus.filter((status) => status === "inProgress").length,
      notStarted: withStatus.filter((status) => status === "notStarted").length,
    };
  }, [sections]);

  if (isDesktop) {
    return (
      <StudentPageShell pageClass="student-page--chapter-detail" legacyModifierClass="student-chapter-detail-phone">
        <div className="student-chapters-desktop">
          <header className="student-chapter-detail-header">
            <button
              type="button"
              className="student-chapter-detail-back"
              aria-label="Back to chapters"
              onClick={() => navigate("/chapters")}
            >
              <ChapterDetailIcon type="back" />
            </button>
            <div>
              <h1>{`Chapter ${chapterNumber}. ${chapterName}`}</h1>
              <p>Browse sections and continue where you left off.</p>
            </div>
          </header>

          <section className="student-chapter-detail-card">
            <div className="student-chapter-detail-progress-copy">
              <span>Overall Progress</span>
              <strong>{overallProgress}%</strong>
              <p>
                {generatedSections.length}/{sections.length || 0} Sections Available
              </p>
              <div className="student-chapter-detail-progress-bar" aria-hidden="true">
                <span style={{ width: `${overallProgress}%` }} />
              </div>
              {bookQuestions.length > 0 && (
                <>
                  <span>Book Questions</span>
                  <strong>{bookQuestionsProgress}%</strong>
                  <p>
                    {bookQuestionsAnsweredCount}/{bookQuestions.length} Answered
                  </p>
                  <div className="student-chapter-detail-progress-bar" aria-hidden="true">
                    <span style={{ width: `${bookQuestionsProgress}%` }} />
                  </div>
                </>
              )}
            </div>
            <img src="/plant.png" alt="" className="student-chapter-detail-illustration" aria-hidden="true" />
          </section>

          {loading ? (
            <p className="student-empty-state">Loading sections...</p>
          ) : error ? (
            <p className="student-empty-state">{error}</p>
          ) : sections.length === 0 ? (
            <p className="student-empty-state">No sections found for this chapter yet.</p>
          ) : (
            <>
              <section className="student-goals-stats">
                <div className="student-goals-stat-card">
                  <span className="student-goals-stat-icon is-total">
                    <ChapterDetailIcon type="book" />
                  </span>
                  <strong>{summary.total}</strong>
                  <span>Total Sections</span>
                </div>
                <div className="student-goals-stat-card is-in-progress">
                  <span className="student-goals-stat-icon is-in-progress">
                    <ChapterDetailIcon type="clock" />
                  </span>
                  <strong>{summary.inProgress}</strong>
                  <span>In Progress</span>
                </div>
                <div className="student-goals-stat-card is-completed">
                  <span className="student-goals-stat-icon is-completed">
                    <ChapterDetailIcon type="check" />
                  </span>
                  <strong>{summary.completed}</strong>
                  <span>Completed</span>
                </div>
                <div className="student-goals-stat-card is-not-started">
                  <span className="student-goals-stat-icon is-not-started">
                    <ChapterDetailIcon type="circle-outline" />
                  </span>
                  <strong>{summary.notStarted}</strong>
                  <span>Not Started</span>
                </div>
              </section>

              <div className="student-goals-list">
                {sections.map((section) => {
                  const status = statusForSection(section);
                  const statusClass = STATUS_CLASS[status];
                  return (
                    <button
                      key={section.sectionNumber}
                      type="button"
                      className={`student-goals-row ${statusClass} ${!section.hasContent ? "is-disabled" : ""}`}
                      onClick={() =>
                        section.hasContent &&
                        navigate(`/chapters/${chapterNumber}/sections/${section.sourceSectionId}`)
                      }
                    >
                      <span className="student-goals-row-rail">
                        <span className="student-goals-row-circle">
                          {status === "completed" ? <ChapterDetailIcon type="check" /> : section.sectionNumber}
                        </span>
                      </span>
                      <span className="student-goals-row-copy">
                        <strong>{section.topicName || section.sectionNumber}</strong>
                        <small>{section.hasContent ? `${section.conceptCount} Concepts` : "Not generated yet"}</small>
                      </span>
                      {section.hasContent ? (
                        <span className={`student-goals-row-status ${statusClass}`}>
                          <ChapterDetailIcon type={STATUS_ICON[status]} />
                          {STATUS_LABEL[status]}
                        </span>
                      ) : (
                        <span />
                      )}
                      <ChapterDetailIcon />
                    </button>
                  );
                })}
                {!bookQuestionsLoading && !bookQuestionsError && (
                  <button
                    type="button"
                    className="student-goals-row"
                    onClick={() => navigate(`/chapters/${chapterNumber}/assessment`)}
                  >
                    <span className="student-goals-row-rail">
                      <span className="student-goals-row-circle">{totalConcepts}</span>
                    </span>
                    <span className="student-goals-row-copy">
                      <strong>{`Question Bank (${totalConcepts})`}</strong>
                      <small>All chapter concepts, arranged randomly</small>
                    </span>
                    <span />
                    <ChapterDetailIcon />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell pageClass="student-page--chapter-detail" legacyModifierClass="student-chapter-detail-phone">
        <header className="student-chapter-detail-header">
          <button
            type="button"
            className="student-chapter-detail-back"
            aria-label="Back to chapters"
            onClick={() => navigate("/chapters")}
          >
            <ChapterDetailIcon type="back" />
          </button>
          <h1>{`Chapter ${chapterNumber}. ${chapterName}`}</h1>
        </header>

        <section className="student-chapter-detail-card">
          <div className="student-chapter-detail-progress-copy">
            <span>Overall Progress</span>
            <strong>{overallProgress}%</strong>
            <p>
              {generatedSections.length}/{sections.length || 0} Sections Available
            </p>
            <div className="student-chapter-detail-progress-bar" aria-hidden="true">
              <span style={{ width: `${overallProgress}%` }} />
            </div>
            {bookQuestions.length > 0 && (
              <>
                <span>Book Questions</span>
                <strong>{bookQuestionsProgress}%</strong>
                <p>
                  {bookQuestionsAnsweredCount}/{bookQuestions.length} Answered
                </p>
                <div className="student-chapter-detail-progress-bar" aria-hidden="true">
                  <span style={{ width: `${bookQuestionsProgress}%` }} />
                </div>
              </>
            )}
          </div>
          <img
            src="/plant.png"
            alt=""
            className="student-chapter-detail-illustration"
            aria-hidden="true"
          />
        </section>

        <section className="student-chapter-detail-section">
          {loading ? (
            <p className="student-empty-state">Loading sections...</p>
          ) : error ? (
            <p className="student-empty-state">{error}</p>
          ) : sections.length === 0 ? (
            <p className="student-empty-state">No sections found for this chapter yet.</p>
          ) : (
            <div className="student-chapter-detail-list">
              {sections.map((section) => (
                <StudentDrilldownCard
                  key={section.sectionNumber}
                  className={`student-chapter-detail-row ${!section.hasContent ? "is-disabled" : ""}`}
                  onClick={() =>
                    section.hasContent &&
                    navigate(`/chapters/${chapterNumber}/sections/${section.sourceSectionId}`)
                  }
                  leading={<div className="student-chapter-detail-index">{section.sectionNumber}</div>}
                  title={section.topicName || section.sectionNumber}
                  subtitle={
                    section.hasContent
                      ? `${section.conceptCount} Concepts - ${section.progress}%`
                      : "Not generated yet"
                  }
                >
                </StudentDrilldownCard>
              ))}
              {!bookQuestionsLoading && !bookQuestionsError && (
                <StudentDrilldownCard
                  className="student-chapter-detail-row"
                  onClick={() => navigate(`/chapters/${chapterNumber}/assessment`)}
                  leading={<div className="student-chapter-detail-index">{totalConcepts}</div>}
                  title={`Question Bank (${totalConcepts})`}
                  subtitle="All chapter concepts, arranged randomly"
                >
                </StudentDrilldownCard>
              )}
            </div>
          )}
        </section>

    </StudentPageShell>
  );
};
