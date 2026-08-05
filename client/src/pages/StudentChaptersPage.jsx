import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { StudentDrilldownCard } from "../components/StudentDrilldownCard";
import { StudentNotificationPanel } from "../components/StudentNotificationPanel";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { getChaptersForSelection, getNotifications, markNotificationsSeen } from "../api/client";
import { buildChapterRows, encodeSelectionChapterId } from "./studentChapterData";
import { selectionKey, useClassSubject } from "../context/classSubjectHooks";

const ChapterIcon = ({ type, className = "" }) => {
  const classes = `student-dashboard-icon ${className}`.trim();

  if (type === "bell") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M12 4a4 4 0 0 0-4 4v2.1c0 .8-.2 1.6-.7 2.3L6 14.5h12l-1.3-2.1a4.5 4.5 0 0 1-.7-2.3V8a4 4 0 0 0-4-4Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="M10.2 17a2 2 0 0 0 3.6 0"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (type === "chevron") {
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

  if (type === "lock") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <rect x="6" y="10.5" width="12" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"
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
        d="m7 10 5 5 5-5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
};

// Real progress only -- chapter.progress is the already-computed
// mastered/total-units percentage from buildChapterProgress on the server;
// no new data source, just a 3-way bucketing of the same number.
const statusForProgress = (progress) => {
  if (progress >= 100) return "completed";
  if (progress > 0) return "inProgress";
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

export const StudentChaptersPage = ({ dashboard, user }) => {
  const navigate = useNavigate();
  const tier = useBreakpoint();
  const isDesktop = tier !== "mobile";
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);

  // Class/subject switcher state now lives in ClassSubjectContext (provided
  // by StudentLayout, above both this page and the sidebar switcher that
  // replaced the old in-page dropdown on desktop) -- shared instead of
  // page-local so the sidebar and this page's own data-fetching agree on
  // the same selection.
  const { classSubjectOptions, selection, setSelection, isDefaultSelection } = useClassSubject();
  const [selectedChapters, setSelectedChapters] = useState([]);
  const [selectedChaptersError, setSelectedChaptersError] = useState("");

  // The student's own combo reuses the already-loaded `dashboard` prop
  // (no extra request, and chapterNumber stays a plain, unencoded value so
  // every existing profile-scoped route -- book questions, assessments, mind
  // maps -- keeps working exactly as before). Only a genuine switch away
  // from that combo fetches via getChaptersForSelection and encodes the
  // chapter id with the chosen codes so the detail page knows which
  // subject's chapter was meant.
  const realChapters = isDefaultSelection
    ? buildChapterRows(Array.isArray(dashboard?.chapters) ? dashboard.chapters : [])
    : buildChapterRows(
        selectedChapters.map((chapter) => ({
          ...chapter,
          chapterNumber: encodeSelectionChapterId({ ...selection, chapterNumber: chapter.chapterNumber }),
        }))
      );

  useEffect(() => {
    let cancelled = false;

    getNotifications()
      .then((result) => {
        if (cancelled) return;
        setNotifications(result?.notifications || []);
        setUnreadCount(result?.unreadCount || 0);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selection || isDefaultSelection) {
      setSelectedChapters([]);
      setSelectedChaptersError("");
      return undefined;
    }

    let cancelled = false;
    setSelectedChaptersError("");

    getChaptersForSelection(selection)
      .then((result) => {
        if (!cancelled) setSelectedChapters(result?.chapters || []);
      })
      .catch((error) => {
        if (!cancelled) setSelectedChaptersError(error.message || "Failed to load chapters.");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, isDefaultSelection]);

  const chapters = realChapters;

  // Free preview: only the first chapter of the student's own class/subject
  // is browsable without an active subscription -- everything else (and any
  // chapter reached via the class/subject switcher, since that's a premium
  // browse-other-subjects feature) stays locked until user.isPremium.
  const subscriptionActive = Boolean(user?.isPremium);
  const isChapterLocked = (index) => !subscriptionActive && (!isDefaultSelection || index !== 0);

  const handleBellClick = () => {
    setPanelOpen((current) => {
      const next = !current;
      if (next && unreadCount > 0) {
        markNotificationsSeen()
          .then(() => setUnreadCount(0))
          .catch(() => {});
      }
      return next;
    });
  };

  const summary = useMemo(() => {
    const withStatus = chapters.map((chapter) => statusForProgress(chapter.progress));
    return {
      total: chapters.length,
      completed: withStatus.filter((status) => status === "completed").length,
      inProgress: withStatus.filter((status) => status === "inProgress").length,
      notStarted: withStatus.filter((status) => status === "notStarted").length,
    };
  }, [chapters]);

  const goToChapter = (chapter, locked) => {
    if (locked) return;
    navigate(`/chapters/${chapter.chapterNumber || chapter.id}`);
  };

  const subscribeBanner = !subscriptionActive && (
    <button type="button" className="student-chapters-subscribe-banner" onClick={() => navigate("/pricing")}>
      <ChapterIcon type="lock" />
      Subscribe to unlock all chapters
    </button>
  );

  const filterControl = (
    <div className="student-chapters-filter">
      <ChapterIcon type="book" />
      <select
        aria-label="Class and subject"
        value={selection ? selectionKey(selection) : ""}
        onChange={(event) => {
          const next = classSubjectOptions.find((option) => selectionKey(option) === event.target.value);
          if (next) setSelection(next);
        }}
        disabled={!classSubjectOptions.length}
      >
        {classSubjectOptions.length === 0 && <option value="">No chapters available yet</option>}
        {classSubjectOptions.map((option) => (
          <option key={selectionKey(option)} value={selectionKey(option)}>
            {`Class ${option.levelCode} - ${option.subjectName}`}
          </option>
        ))}
      </select>
    </div>
  );

  const bell = (
    <div className="student-dashboard-bell-wrap">
      <button type="button" className="student-dashboard-bell" aria-label="Notifications" onClick={handleBellClick}>
        <ChapterIcon type="bell" />
        {unreadCount > 0 ? <span className="student-dashboard-bell-badge">{unreadCount}</span> : null}
      </button>
      {panelOpen ? (
        <StudentNotificationPanel notifications={notifications} onNavigateAway={() => setPanelOpen(false)} />
      ) : null}
    </div>
  );

  if (isDesktop) {
    return (
      <StudentPageShell pageClass="student-page--chapters" legacyModifierClass="student-chapters-phone">
        <div className="student-chapters-desktop">
          {/* Class/subject switcher moved to the sidebar (see
              StudentClassSubjectSwitcher) -- desktop no longer has its own
              copy in this header, mobile still does below (no sidebar
              there to embed it in). */}
          <header className="student-chapters-header">
            {bell}
          </header>

          <div className="student-chapters-desktop-heading">
            <h1>All Chapters</h1>
            <p>Track your progress and continue learning.</p>
          </div>

          {selectedChaptersError && <p className="error-text">{selectedChaptersError}</p>}

          {chapters.length === 0 ? (
            <p className="student-empty-state">No chapters available yet for the selected class/subject.</p>
          ) : (
            <>
              <section className="student-goals-stats">
                <div className="student-goals-stat-card">
                  <span className="student-goals-stat-icon is-total">
                    <ChapterIcon type="book" />
                  </span>
                  <strong>{summary.total}</strong>
                  <span>Total Chapters</span>
                </div>
                <div className="student-goals-stat-card is-in-progress">
                  <span className="student-goals-stat-icon is-in-progress">
                    <ChapterIcon type="clock" />
                  </span>
                  <strong>{summary.inProgress}</strong>
                  <span>In Progress</span>
                </div>
                <div className="student-goals-stat-card is-completed">
                  <span className="student-goals-stat-icon is-completed">
                    <ChapterIcon type="check" />
                  </span>
                  <strong>{summary.completed}</strong>
                  <span>Completed</span>
                </div>
                <div className="student-goals-stat-card is-not-started">
                  <span className="student-goals-stat-icon is-not-started">
                    <ChapterIcon type="circle-outline" />
                  </span>
                  <strong>{summary.notStarted}</strong>
                  <span>Not Started</span>
                </div>
              </section>

              {subscribeBanner}

              <div className="student-goals-list">
                {chapters.map((chapter, index) => {
                  const status = statusForProgress(chapter.progress);
                  const statusClass = STATUS_CLASS[status];
                  const locked = isChapterLocked(index);
                  return (
                    <button
                      key={chapter.chapterNumber || chapter.id}
                      type="button"
                      className={`student-goals-row ${statusClass} ${locked ? "is-disabled" : ""}`}
                      onClick={() => goToChapter(chapter, locked)}
                    >
                      <span className="student-goals-row-rail">
                        <span className="student-goals-row-circle">
                          {status === "completed" ? <ChapterIcon type="check" /> : index + 1}
                        </span>
                      </span>
                      <span className="student-goals-row-copy">
                        <strong>{chapter.title}</strong>
                        <small>{chapter.progress}% complete</small>
                      </span>
                      {locked ? (
                        <span className="student-goals-row-status">
                          <ChapterIcon type="lock" />
                          Premium
                        </span>
                      ) : (
                        <span className={`student-goals-row-status ${statusClass}`}>
                          <ChapterIcon type={STATUS_ICON[status]} />
                          {STATUS_LABEL[status]}
                        </span>
                      )}
                      <ChapterIcon type={locked ? "lock" : "chevron"} />
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell pageClass="student-page--chapters" legacyModifierClass="student-chapters-phone">
        <header className="student-chapters-header">
          <div className="student-chapters-header-filters">
            {filterControl}
          </div>
          {bell}
        </header>

        <section className="student-chapters-section">
          <h1>All Chapters</h1>
          {selectedChaptersError && <p className="error-text">{selectedChaptersError}</p>}
          {chapters.length === 0 ? (
            <p className="student-empty-state">No chapters available yet for the selected class/subject.</p>
          ) : (
            <>
              {subscribeBanner}
              <div className="student-chapters-list">
                {chapters.map((chapter, index) => {
                  const locked = isChapterLocked(index);
                  return (
                    <StudentDrilldownCard
                      key={chapter.chapterNumber || chapter.id}
                      className={`student-chapters-row ${locked ? "is-disabled" : ""}`}
                      onClick={() => goToChapter(chapter, locked)}
                      leading={<div className="student-chapters-index">{index + 1}</div>}
                      title={chapter.title}
                      subtitle={locked ? "Premium" : `${chapter.progress}% complete`}
                      trailing={locked ? <ChapterIcon type="lock" /> : undefined}
                    >
                    </StudentDrilldownCard>
                  );
                })}
              </div>
            </>
          )}
        </section>

    </StudentPageShell>
  );
};
