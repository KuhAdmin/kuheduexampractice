import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { StudentDrilldownCard } from "../components/StudentDrilldownCard";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { getStudentSectionOverview, getStudentSections } from "../api/client";
import { decodeSelectionChapterId } from "./studentChapterData";
import { PRE_LESSON_SUBSECTIONS, POST_LESSON_SUBSECTIONS } from "../content/preWarmupSubsections";

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

  if (type === "home") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="m4 11 8-6.5L20 11v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
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

  if (type === "revision") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M6 4.5h9l3 3V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
        <path
          d="M8 9.5h8M8 13h8M8 16.5h5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.6"
        />
      </svg>
    );
  }

  if (type === "tutor") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M12 4.5c-3.6 0-6.5 2.6-6.5 5.8 0 1.9 1 3.6 2.6 4.7-.1.9-.5 1.7-1.2 2.4a.5.5 0 0 0 .4.9c1.4-.2 2.6-.7 3.6-1.5.7.2 1.4.3 2.1.3 3.6 0 6.5-2.6 6.5-5.8s-2.9-5.8-6.5-5.8Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
        <circle cx="9.3" cy="10.3" r="0.9" fill="currentColor" />
        <circle cx="14.7" cy="10.3" r="0.9" fill="currentColor" />
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

  if (type === "list") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M8 6.5h10M8 12h10M8 17.5h10"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
        <circle cx="4.5" cy="6.5" r="1.1" fill="currentColor" />
        <circle cx="4.5" cy="12" r="1.1" fill="currentColor" />
        <circle cx="4.5" cy="17.5" r="1.1" fill="currentColor" />
      </svg>
    );
  }

  if (type === "atom") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <circle cx="12" cy="12" r="2" fill="currentColor" />
        <ellipse
          cx="12"
          cy="12"
          rx="9"
          ry="4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          transform="rotate(0 12 12)"
        />
        <ellipse
          cx="12"
          cy="12"
          rx="9"
          ry="4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          transform="rotate(60 12 12)"
        />
        <ellipse
          cx="12"
          cy="12"
          rx="9"
          ry="4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          transform="rotate(120 12 12)"
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

  if (type === "chevron-down") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="m7 10 5 5 5-5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.9"
        />
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

// Competency ("learning pillar") chips a concept develops -- see
// conceptImportService.js's resolveConceptPillarLinks/concept_learning_pillar
// and studentContentService.js's getSectionOverview, which attaches
// concept.competencies. Purely a label, not interactive -- no drill-down
// into the pillar's own content (summary/details) from here.
const ConceptCompetencyChips = ({ competencies }) => {
  if (!competencies?.length) return null;
  return (
    <span className="student-concept-pillar-chips">
      {competencies.map((pillar) => (
        <span key={pillar.key} className="student-concept-pillar-chip">
          {pillar.title}
        </span>
      ))}
    </span>
  );
};

const CONCEPTS_PAGE_SIZE = 12;

export const StudentSectionDetailPage = () => {
  const navigate = useNavigate();
  const tier = useBreakpoint();
  const isDesktop = tier !== "mobile";
  const { chapterId: chapterNumber, sectionId: sourceSectionId } = useParams();
  // Chapters browsed via the real class/subject switcher outside the
  // student's own profile subject carry (examGoalCode, levelCode,
  // subjectCode) encoded into the route param -- see
  // StudentChapterDetailPage.jsx/studentChapterData.js for the same pattern.
  const selectionOverride = decodeSelectionChapterId(chapterNumber);
  const displayChapterNumber = selectionOverride?.chapterNumber ?? chapterNumber;

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("concepts");
  const [visibleConceptCount, setVisibleConceptCount] = useState(CONCEPTS_PAGE_SIZE);
  const [chapterName, setChapterName] = useState("");
  // null | "preLessonWarmup" | "postLesson" -- which accordion group (if any)
  // is currently expanded in the Micro Learning Units list.
  const [expandedGroup, setExpandedGroup] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setActiveTab("concepts");
    setVisibleConceptCount(CONCEPTS_PAGE_SIZE);

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

  // Breadcrumb needs just the chapter's own name (one level up) -- same
  // endpoint StudentChapterDetailPage/StudentConceptLearningPage already use
  // for this.
  useEffect(() => {
    let cancelled = false;

    getStudentSections(displayChapterNumber, selectionOverride || undefined)
      .then((result) => {
        if (!cancelled) setChapterName(result?.chapterName || "");
      })
      .catch(() => {
        if (!cancelled) setChapterName("");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterNumber]);

  const basePath = `/chapters/${chapterNumber}/sections/${sourceSectionId}`;

  const summary = useMemo(() => {
    const concepts = detail?.concepts || [];
    return {
      completed: concepts.filter((concept) => concept.status === "completed").length,
      inProgress: concepts.filter((concept) => concept.status === "inProgress").length,
      notStarted: concepts.filter((concept) => concept.status === "notStarted").length,
    };
  }, [detail]);

  // Each button (besides Section Assessment, always available) only shows
  // once contentFlags confirms that content actually exists -- otherwise it
  // just linked to a page whose only content was its own "nothing
  // generated yet" empty state (see getSectionContentFlags on the server).
  const flags = detail?.contentFlags || {};
  const deepLearnActions = detail && (
    <section className="student-section-detail-actions">
      <button type="button" className="student-chapter-detail-action is-violet" onClick={() => navigate(`${basePath}/assessment`)}>
        <span className="student-chapter-detail-action-mark is-violet">
          <SectionDetailIcon type="quiz" />
        </span>
        <span className="student-chapter-detail-action-copy">
          <strong>Section Assessment</strong>
          <small>{detail.conceptCount} micro learning units covered</small>
        </span>
        <SectionDetailIcon type="chevron" />
      </button>
      {flags.hasMemoryBooster && (
        <button type="button" className="student-chapter-detail-action is-lilac" onClick={() => navigate(`${basePath}/memory-booster`)}>
          <span className="student-chapter-detail-action-mark is-lilac">
            <SectionDetailIcon type="memory" />
          </span>
          <span className="student-chapter-detail-action-copy">
            <strong>Memory Booster</strong>
            <small>Strengthen your memory</small>
          </span>
          <SectionDetailIcon type="chevron" />
        </button>
      )}
      {flags.hasFlashcards && (
        <button type="button" className="student-chapter-detail-action is-amber" onClick={() => navigate(`${basePath}/flashcards`)}>
          <span className="student-chapter-detail-action-mark is-amber">
            <SectionDetailIcon type="cards" />
          </span>
          <span className="student-chapter-detail-action-copy">
            <strong>Flashcards</strong>
            <small>Key terms for this section</small>
          </span>
          <SectionDetailIcon type="chevron" />
        </button>
      )}
      {flags.hasRevision && (
        <button type="button" className="student-chapter-detail-action is-rose" onClick={() => navigate(`${basePath}/revision`)}>
          <span className="student-chapter-detail-action-mark is-rose">
            <SectionDetailIcon type="revision" />
          </span>
          <span className="student-chapter-detail-action-copy">
            <strong>Revision</strong>
            <small>Cheat sheets, mnemonics &amp; exam notes</small>
          </span>
          <SectionDetailIcon type="chevron" />
        </button>
      )}
      {flags.hasTutorNotes && (
        <button type="button" className="student-chapter-detail-action is-teal" onClick={() => navigate(`${basePath}/tutor-notes`)}>
          <span className="student-chapter-detail-action-mark is-teal">
            <SectionDetailIcon type="tutor" />
          </span>
          <span className="student-chapter-detail-action-copy">
            <strong>Tutor Notes</strong>
            <small>Coach, interview &amp; viva prep</small>
          </span>
          <SectionDetailIcon type="chevron" />
        </button>
      )}
      {flags.hasDiagrams && (
        <button type="button" className="student-chapter-detail-action is-green" onClick={() => navigate(`${basePath}/diagrams`)}>
          <span className="student-chapter-detail-action-mark is-green">
            <SectionDetailIcon type="diagram" />
          </span>
          <span className="student-chapter-detail-action-copy">
            <strong>Diagrams</strong>
            <small>Labeled parts to review</small>
          </span>
          <SectionDetailIcon type="chevron" />
        </button>
      )}
      {flags.hasMindMap && (
        <button type="button" className="student-chapter-detail-action is-blue" onClick={() => navigate(`${basePath}/mind-map`)}>
          <span className="student-chapter-detail-action-mark is-blue">
            <SectionDetailIcon type="tree" />
          </span>
          <span className="student-chapter-detail-action-copy">
            <strong>Mind Map</strong>
            <small>See how micro learning units connect</small>
          </span>
          <SectionDetailIcon type="chevron" />
        </button>
      )}
    </section>
  );

  // Pinned as the first row of the Micro Learning Units list (not gated
  // inside Deep Learn, and not part of `detail.concepts`/`conceptCount` --
  // same "extra row appended without inflating the real count" pattern as
  // Question Bank on StudentChapterDetailPage.jsx) so a learner sees it
  // before starting concepts -- that's the whole point of a warm-up.
  // preWarmupStatus is per-learner (getPreWarmupStatus in
  // studentContentService.js), separate from hasPreWarmup (whether the
  // section has any pre-warmup content at all). Styled with the same
  // .is-highlight treatment as Question Bank so it stands out the same way.
  const preWarmupStatusLabel = {
    completed: "Completed — review anytime",
    in_progress: "Continue where you left off",
    not_started: "Get ready before you start",
  }[detail?.preWarmupStatus?.preLessonWarmup || "not_started"];

  // Pinned as the LAST row of the same list (see the comment above
  // preWarmupStatusLabel) -- comes after the real concepts since it's meant
  // to be done once the learner has finished them, not before.
  const postLessonStatusLabel = {
    completed: "Completed — review anytime",
    in_progress: "Continue where you left off",
    not_started: "Reflect & apply what you read",
  }[detail?.preWarmupStatus?.postLesson || "not_started"];

  if (isDesktop) {
    const visibleConcepts = detail?.concepts?.slice(0, visibleConceptCount) || [];
    const hasMoreConcepts = Boolean(detail) && visibleConceptCount < detail.concepts.length;

    return (
      <StudentPageShell pageClass="student-page--section-detail" legacyModifierClass="student-section-detail-phone">
        <div className="student-chapters-desktop">
          <nav className="student-concept-breadcrumb" aria-label="Breadcrumb">
            <button type="button" onClick={() => navigate("/dashboard")} aria-label="Home">
              <SectionDetailIcon type="home" />
            </button>
            <SectionDetailIcon />
            <button type="button" onClick={() => navigate(`/chapters/${chapterNumber}`)}>
              {`Chapter ${displayChapterNumber}${chapterName ? `. ${chapterName}` : ""}`}
            </button>
            <SectionDetailIcon />
            <span className="is-current">
              {detail ? `${detail.sectionNumber} ${detail.topicName || ""}`.trim() : "Section"}
            </span>
          </nav>

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

              <section className="student-chapter-detail-card">
                <div className="student-chapter-detail-summary-row">
                  <div className="student-chapter-detail-progress-copy">
                    <span>Overall Progress</span>
                    <strong>{detail.progress}%</strong>
                    <p>
                      {summary.completed} of {detail.conceptCount} micro learning units completed
                    </p>
                  </div>

                  <div className="student-goals-stats student-goals-stats--three student-goals-stats--embedded">
                    <div className="student-goals-stat-card is-not-started">
                      <span className="student-goals-stat-icon is-not-started">
                        <SectionDetailIcon type="circle-outline" />
                      </span>
                      <strong>{summary.notStarted}</strong>
                      <span>Not Started</span>
                    </div>
                    <div className="student-goals-stat-card is-in-progress">
                      <span className="student-goals-stat-icon is-in-progress">
                        <SectionDetailIcon type="clock" />
                      </span>
                      <strong>{summary.inProgress}</strong>
                      <span>In Progress</span>
                    </div>
                    <div className="student-goals-stat-card is-completed">
                      <span className="student-goals-stat-icon is-completed">
                        <SectionDetailIcon type="check" />
                      </span>
                      <strong>{summary.completed}</strong>
                      <span>Completed</span>
                    </div>
                  </div>
                </div>

                <div className="student-chapter-detail-progress-bar" aria-hidden="true">
                  <span style={{ width: `${detail.progress}%` }} />
                </div>
              </section>

              <nav className="student-section-detail-tabs is-iconic" aria-label="Section content">
                <button
                  type="button"
                  className={`student-section-detail-tab ${activeTab === "concepts" ? "is-active" : ""}`}
                  onClick={() => setActiveTab("concepts")}
                >
                  <SectionDetailIcon type="list" />
                  {`Micro Learning Units (${detail.conceptCount})`}
                </button>
                <button
                  type="button"
                  className={`student-section-detail-tab ${activeTab === "deepLearn" ? "is-active" : ""}`}
                  onClick={() => setActiveTab("deepLearn")}
                >
                  <SectionDetailIcon type="atom" />
                  Memory Boosters
                </button>
              </nav>

              {activeTab === "concepts" ? (
                <section className="student-section-detail-concepts">
                  <div className="student-goals-list">
                    {flags.hasPreWarmup && (
                      <>
                        <button
                          type="button"
                          className="student-goals-row is-highlight"
                          onClick={() => setExpandedGroup((current) => (current === "preLessonWarmup" ? null : "preLessonWarmup"))}
                        >
                          <span className="student-goals-row-rail">
                            <span className="student-goals-row-circle">
                              <SectionDetailIcon type="atom" />
                            </span>
                          </span>
                          <span className="student-goals-row-copy">
                            <strong>Pre-Lesson Warm-Up</strong>
                            <small>{preWarmupStatusLabel}</small>
                          </span>
                          <SectionDetailIcon type={expandedGroup === "preLessonWarmup" ? "chevron-down" : undefined} />
                        </button>
                        {expandedGroup === "preLessonWarmup" &&
                          PRE_LESSON_SUBSECTIONS.map((subsection) => (
                            <button
                              key={subsection.key}
                              type="button"
                              className="student-goals-row is-highlight is-subitem"
                              onClick={() => navigate(`${basePath}/warm-up?section=${subsection.key}`)}
                            >
                              <span className="student-goals-row-copy">
                                <strong>{subsection.title}</strong>
                              </span>
                              <SectionDetailIcon />
                            </button>
                          ))}
                      </>
                    )}
                    {visibleConcepts.map((concept, index) => {
                      const statusClass = STATUS_CLASS[concept.status];
                      return (
                        <button
                          key={concept.assessmentUnitId}
                          type="button"
                          className={`student-goals-row ${statusClass}`}
                          onClick={() => navigate(`${basePath}/concepts/${concept.assessmentUnitId}`)}
                        >
                          <span className="student-goals-row-rail">
                            <span className="student-goals-row-circle">
                              {concept.status === "completed" ? <SectionDetailIcon type="check" /> : index + 1}
                            </span>
                          </span>
                          <span className="student-goals-row-copy">
                            <strong>{concept.title}</strong>
                            <ConceptCompetencyChips competencies={concept.competencies} />
                          </span>
                          <span className={`student-goals-row-status ${statusClass}`}>
                            <SectionDetailIcon type={STATUS_ICON[concept.status]} />
                            {STATUS_LABEL[concept.status]}
                          </span>
                          <SectionDetailIcon />
                        </button>
                      );
                    })}
                    {flags.hasPreWarmup && (
                      <>
                        <button
                          type="button"
                          className="student-goals-row is-highlight"
                          onClick={() => setExpandedGroup((current) => (current === "postLesson" ? null : "postLesson"))}
                        >
                          <span className="student-goals-row-rail">
                            <span className="student-goals-row-circle">
                              <SectionDetailIcon type="quiz" />
                            </span>
                          </span>
                          <span className="student-goals-row-copy">
                            <strong>Post-Lesson Follow-Up</strong>
                            <small>{postLessonStatusLabel}</small>
                          </span>
                          <SectionDetailIcon type={expandedGroup === "postLesson" ? "chevron-down" : undefined} />
                        </button>
                        {expandedGroup === "postLesson" &&
                          POST_LESSON_SUBSECTIONS.map((subsection) => (
                            <button
                              key={subsection.key}
                              type="button"
                              className="student-goals-row is-highlight is-subitem"
                              onClick={() => navigate(`${basePath}/post-lesson?section=${subsection.key}`)}
                            >
                              <span className="student-goals-row-copy">
                                <strong>{subsection.title}</strong>
                              </span>
                              <SectionDetailIcon />
                            </button>
                          ))}
                      </>
                    )}
                  </div>
                  {hasMoreConcepts && (
                    <button
                      type="button"
                      className="student-section-detail-show-more"
                      onClick={() => setVisibleConceptCount(detail.concepts.length)}
                    >
                      Show more micro learning units
                      <SectionDetailIcon type="chevron-down" />
                    </button>
                  )}
                </section>
              ) : (
                deepLearnActions
              )}
            </>
          )}
        </div>
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell pageClass="student-page--section-detail" legacyModifierClass="student-section-detail-phone">
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
                Micro Learning Units ({detail.conceptCount})
              </button>
              <button
                type="button"
                className={`student-section-detail-tab ${activeTab === "deepLearn" ? "is-active" : ""}`}
                onClick={() => setActiveTab("deepLearn")}
              >
                Memory Boosters
              </button>
            </nav>

            {activeTab === "concepts" ? (
              <section className="student-section-detail-concepts">
                <div className="student-section-detail-list">
                  {flags.hasPreWarmup && (
                    <>
                      <StudentDrilldownCard
                        className="student-section-detail-row is-highlight"
                        onClick={() => setExpandedGroup((current) => (current === "preLessonWarmup" ? null : "preLessonWarmup"))}
                        leading={
                          <div className="student-section-detail-index">
                            <SectionDetailIcon type="atom" />
                          </div>
                        }
                        title="Pre-Lesson Warm-Up"
                        subtitle={preWarmupStatusLabel}
                        trailing={<SectionDetailIcon type={expandedGroup === "preLessonWarmup" ? "chevron-down" : undefined} />}
                      />
                      {expandedGroup === "preLessonWarmup" &&
                        PRE_LESSON_SUBSECTIONS.map((subsection) => (
                          <StudentDrilldownCard
                            key={subsection.key}
                            className="student-section-detail-row is-highlight is-subitem"
                            onClick={() => navigate(`${basePath}/warm-up?section=${subsection.key}`)}
                            title={subsection.title}
                          />
                        ))}
                    </>
                  )}
                  {detail.concepts.map((concept, index) => (
                    <StudentDrilldownCard
                      key={concept.assessmentUnitId}
                      className="student-section-detail-row"
                      onClick={() => navigate(`${basePath}/concepts/${concept.assessmentUnitId}`)}
                      leading={<div className="student-section-detail-index">{index + 1}</div>}
                      title={concept.title}
                      subtitle={concept.completed ? "Status - Completed" : "Status - Ready to learn"}
                    >
                      <ConceptCompetencyChips competencies={concept.competencies} />
                    </StudentDrilldownCard>
                  ))}
                  {flags.hasPreWarmup && (
                    <>
                      <StudentDrilldownCard
                        className="student-section-detail-row is-highlight"
                        onClick={() => setExpandedGroup((current) => (current === "postLesson" ? null : "postLesson"))}
                        leading={
                          <div className="student-section-detail-index">
                            <SectionDetailIcon type="quiz" />
                          </div>
                        }
                        title="Post-Lesson Follow-Up"
                        subtitle={postLessonStatusLabel}
                        trailing={<SectionDetailIcon type={expandedGroup === "postLesson" ? "chevron-down" : undefined} />}
                      />
                      {expandedGroup === "postLesson" &&
                        POST_LESSON_SUBSECTIONS.map((subsection) => (
                          <StudentDrilldownCard
                            key={subsection.key}
                            className="student-section-detail-row is-highlight is-subitem"
                            onClick={() => navigate(`${basePath}/post-lesson?section=${subsection.key}`)}
                            title={subsection.title}
                          />
                        ))}
                    </>
                  )}
                </div>
              </section>
            ) : (
              deepLearnActions
            )}
          </>
        )}

    </StudentPageShell>
  );
};
