import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { StudentDrilldownCard } from "../components/StudentDrilldownCard";
import { StudentNotificationPanel } from "../components/StudentNotificationPanel";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { getNotifications, markNotificationsSeen } from "../api/client";
import { buildChapterRows, toTitleLabel } from "./studentChapterData";

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
  const classLabel = user?.studentClass ? `Class ${user.studentClass}` : "Class 11";
  const subjectLabel = toTitleLabel(user?.subject) || "Biology";
  const chapters = buildChapterRows(Array.isArray(dashboard?.chapters) ? dashboard.chapters : []);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);

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

  const goToChapter = (chapter) => navigate(`/chapters/${chapter.chapterNumber || chapter.id}`);

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
          <header className="student-chapters-header">
            <button type="button" className="student-chapters-filter" aria-label="Selected class and subject">
              <ChapterIcon type="book" />
              <span>{`${classLabel} - ${subjectLabel}`}</span>
              <ChapterIcon type="caret" />
            </button>
            {bell}
          </header>

          <div className="student-chapters-desktop-heading">
            <h1>All Chapters</h1>
            <p>Track your progress and continue learning.</p>
          </div>

          {chapters.length === 0 ? (
            <p className="student-empty-state">No chapters available yet for your board/class/subject.</p>
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

              <div className="student-goals-list">
                {chapters.map((chapter, index) => {
                  const status = statusForProgress(chapter.progress);
                  const statusClass = STATUS_CLASS[status];
                  return (
                    <button
                      key={chapter.chapterNumber || chapter.id}
                      type="button"
                      className={`student-goals-row ${statusClass}`}
                      onClick={() => goToChapter(chapter)}
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
                      <span className={`student-goals-row-status ${statusClass}`}>
                        <ChapterIcon type={STATUS_ICON[status]} />
                        {STATUS_LABEL[status]}
                      </span>
                      <ChapterIcon type="chevron" />
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
          <button type="button" className="student-chapters-filter" aria-label="Selected class and subject">
            <span>{`${classLabel} - ${subjectLabel}`}</span>
            <ChapterIcon type="caret" />
          </button>
          {bell}
        </header>

        <section className="student-chapters-section">
          <h1>All Chapters</h1>
          {chapters.length === 0 ? (
            <p className="student-empty-state">No chapters available yet for your board/class/subject.</p>
          ) : (
            <div className="student-chapters-list">
              {chapters.map((chapter, index) => (
                <StudentDrilldownCard
                  key={chapter.chapterNumber || chapter.id}
                  className="student-chapters-row"
                  onClick={() => goToChapter(chapter)}
                  leading={<div className="student-chapters-index">{index + 1}</div>}
                  title={chapter.title}
                  subtitle={`${chapter.progress}% complete`}
                >
                </StudentDrilldownCard>
              ))}
            </div>
          )}
        </section>

    </StudentPageShell>
  );
};
