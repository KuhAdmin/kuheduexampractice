import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StudentBottomNav } from "../components/StudentBottomNav";
import { StudentNotificationPanel } from "../components/StudentNotificationPanel";
import { getNotifications, markNotificationsSeen } from "../api/client";

const defaultContinueCard = {
  eyebrow: "Continue Learning",
  title: "The Living World",
  section: "Taxonomy",
  concept: "Artificial Classification",
  progress: 72,
};

const defaultFirstTimeDashboard = {
  greeting: "Hi, Alex",
  subheading: "Let's start learning!",
  continueCard: defaultContinueCard,
  chapters: [
    { id: 1, title: "The Living World", progress: 60 },
    { id: 2, title: "Biological Classification", progress: 15 },
    { id: 3, title: "Plant Kingdom", progress: 0 },
    { id: 4, title: "Animal Kingdom", progress: 0 },
  ],
};

const defaultReturningDashboard = {
  greeting: "Hi, Alex",
  subheading: "Keep learning, keep growing!",
  continueCard: {
    eyebrow: "Continue Learning",
    title: "No chapter started yet",
    section: "Start your first practice set",
    concept: "Your live learning progress will appear here",
    progress: 0,
  },
  todayGoal: {
    title: "Today's Goal",
    value: "No concepts available yet",
  },
  weakConcepts: [],
  streak: {
    label: "Study Streak",
    value: "0 Days",
    last7Days: [],
  },
};

const firstNameFromUser = (name) => {
  if (!name) {
    return "Alex";
  }

  return name.trim().split(/\s+/)[0] || "Alex";
};

const toTitleLabel = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const Icon = ({ type, className = "" }) => {
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

  if (type === "book") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M5 6.5A2.5 2.5 0 0 1 7.5 4H19v15H7.5A2.5 2.5 0 0 0 5 21V6.5Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="M5 18.5A2.5 2.5 0 0 1 7.5 16H19"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (type === "spark") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="m8 8 3 3-3 3-3-3 3-3Zm8-3 1.8 3.2L21 10l-3.2 1.8L16 15l-1.8-3.2L11 10l3.2-1.8L16 5Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (type === "clipboard") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M9 4.5h6m-5 0a1 1 0 0 0-1 1v1h6v-1a1 1 0 0 0-1-1m-4 0h4m-7 3h10a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (type === "user") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 7a6 6 0 0 1 12 0"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (type === "streak") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M12.1 3.5c.7 2-1 3.9-1 5.7 0 1.5 1.2 2.8 2.7 2.8 2.1 0 3.6-1.8 3.6-4.5 2.1 1.7 3.2 4 3.2 6.6 0 4.1-3.3 7.4-7.4 7.4S5.8 18.2 5.8 14.1c0-3.5 2-6.4 4.9-8.1.2 1.6-.3 2.7-.3 4 0 1.4 1 2.4 2.2 2.4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
      <path
        d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1v-7.5Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
};

const normalizeContinueCard = (continueCard, fallbackCard = defaultContinueCard) => ({
  ...fallbackCard,
  ...(continueCard || {}),
});

const ChapterRow = ({ chapter }) => (
  <article className="student-dashboard-chapter-row">
    <div className="student-dashboard-chapter-index">{chapter.id}</div>
    <div className="student-dashboard-chapter-copy">
      <strong>{chapter.title}</strong>
      <div className="student-dashboard-progress-bar" aria-hidden="true">
        <span style={{ width: `${chapter.progress}%` }} />
      </div>
    </div>
    <span className="student-dashboard-chapter-progress">{chapter.progress}%</span>
  </article>
);

const FirstTimeDashboard = ({ view }) => {
  const navigate = useNavigate();
  const [showAllChapters, setShowAllChapters] = useState(false);
  const visibleChapters = showAllChapters ? view.chapters : view.chapters.slice(0, 2);
  const continueCard = normalizeContinueCard(view.continueCard);

  return (
    <>
      <section className="student-dashboard-continue-card">
        <div className="student-dashboard-continue-copy">
          <span>{continueCard.eyebrow}</span>
          <strong>{continueCard.title}</strong>
          <p>Section: {continueCard.section}</p>
          <p>Concept: {continueCard.concept}</p>
          <button
            type="button"
            className="student-dashboard-continue-button"
            onClick={() => navigate("/chapters")}
          >
            Continue
          </button>
        </div>
        <div
          className="student-dashboard-progress-ring"
          style={{ "--progress": `${continueCard.progress}%` }}
          aria-label={`${continueCard.progress}% completed`}
        >
          <span>{continueCard.progress}%</span>
        </div>
      </section>

      <section className="student-dashboard-chapters-card">
        <div className="student-dashboard-section-head">
          <h2>Your Chapters</h2>
          <button type="button" onClick={() => setShowAllChapters((current) => !current)}>
            {showAllChapters ? "View Less" : "View All"}
          </button>
        </div>
        <div className="student-dashboard-chapter-list">
          {visibleChapters.map((chapter) => (
            <ChapterRow key={chapter.id} chapter={chapter} />
          ))}
        </div>
      </section>
    </>
  );
};

const ReturningDashboard = ({ view }) => {
  const navigate = useNavigate();
  const continueCard = normalizeContinueCard(
    view.continueCard,
    defaultReturningDashboard.continueCard
  );

  const goToConcept = ({ chapterNumber, sourceSectionId, assessmentUnitId }) => {
    if (chapterNumber && sourceSectionId && assessmentUnitId) {
      navigate(`/chapters/${chapterNumber}/sections/${sourceSectionId}/concepts/${assessmentUnitId}`);
    } else {
      navigate("/chapters");
    }
  };

  return (
    <>
      <section className="student-dashboard-continue-card">
        <div className="student-dashboard-continue-copy">
          <span>{continueCard.eyebrow}</span>
          <strong>{continueCard.title}</strong>
          <p>Section: {continueCard.section}</p>
          <p>Concept: {continueCard.concept}</p>
          <button
            type="button"
            className="student-dashboard-continue-button"
            onClick={() => goToConcept(continueCard)}
          >
            Continue
          </button>
        </div>
        <div
          className="student-dashboard-progress-ring"
          style={{ "--progress": `${continueCard.progress}%` }}
          aria-label={`${continueCard.progress}% completed`}
        >
          <span>{continueCard.progress}%</span>
        </div>
      </section>

      <section className="student-dashboard-info-card">
        <div className="student-dashboard-info-copy">
          <span>{view.todayGoal.title}</span>
          <strong>{view.todayGoal.value}</strong>
        </div>
        <button
          type="button"
          className="student-dashboard-pill-button"
          onClick={() => navigate("/goals")}
        >
          View
        </button>
      </section>

      <section className="student-dashboard-section">
        <h2>Weak Concepts</h2>
        {view.weakConcepts.length === 0 ? (
          <p className="student-empty-state">No weak concepts yet</p>
        ) : (
          view.weakConcepts.map((concept) => (
            <article
              key={concept.assessmentUnitId || concept.title}
              className="student-dashboard-weak-card"
            >
              <div className="student-dashboard-weak-badge" aria-hidden="true">
                {(concept.title || "?").trim().charAt(0).toUpperCase() || "?"}
              </div>
              <div className="student-dashboard-weak-copy">
                <strong>{concept.title}</strong>
                <p>{concept.lastPracticed}</p>
              </div>
              <button
                type="button"
                className="student-dashboard-pill-button"
                onClick={() => goToConcept(concept)}
              >
                Review
              </button>
            </article>
          ))
        )}
      </section>

      <section className="student-dashboard-section">
        <h2>Study Streak</h2>
        <article className="student-dashboard-streak-card">
          <div className="student-dashboard-streak-mark">
            <Icon type="streak" />
          </div>
          <div className="student-dashboard-streak-copy">
            <strong>{view.streak.value}</strong>
          </div>
        </article>
        {view.streak.last7Days?.length ? (
          <div className="student-dashboard-streak-strip" aria-hidden="true">
            {view.streak.last7Days.map((day) => (
              <span
                key={day.date}
                className={`student-dashboard-streak-dot ${day.active ? "is-active" : ""}`}
              />
            ))}
          </div>
        ) : null}
      </section>
    </>
  );
};

export const StudentDashboardPage = ({ dashboard, dashboardMode = "returning", user }) => {
  const firstName = firstNameFromUser(user?.name);
  const enrollmentParts = [
    toTitleLabel(user?.board),
    user?.studentClass ? `Class ${user.studentClass}` : "",
    toTitleLabel(user?.subject),
  ].filter(Boolean);
  const enrollmentLabel =
    enrollmentParts.length > 0 ? `You have enrolled for ${enrollmentParts.join(" | ")}` : "";
  const defaults = dashboardMode === "first-time" ? defaultFirstTimeDashboard : defaultReturningDashboard;
  const view =
    dashboardMode === "first-time"
      ? {
          ...defaultFirstTimeDashboard,
          greeting: dashboard?.greeting || `Hi, ${firstName}`,
          continueCard: {
            ...defaultContinueCard,
            ...dashboard?.continueCard,
            progress: 0,
          },
          chapters: (
            Array.isArray(dashboard?.chapters) ? dashboard.chapters : defaultFirstTimeDashboard.chapters
          ).map((chapter) => ({
            ...chapter,
            progress: 0,
          })),
        }
      : {
          ...defaults,
          ...dashboard,
          greeting: dashboard?.greeting || `Hi, ${firstName}`,
        };

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

  return (
    <main className="student-dashboard-shell">
      <section className="student-dashboard-phone">
        <header className="student-dashboard-header">
          <div className="student-dashboard-header-copy">
            <p className="student-dashboard-greeting">{view.greeting}</p>
            {enrollmentLabel ? (
              <p className="student-dashboard-enrollment">{enrollmentLabel}</p>
            ) : null}
            <h1>{view.subheading}</h1>
          </div>
          <div className="student-dashboard-bell-wrap">
            <button
              type="button"
              className="student-dashboard-bell"
              aria-label="Notifications"
              onClick={handleBellClick}
            >
              <Icon type="bell" />
              {unreadCount > 0 ? (
                <span className="student-dashboard-bell-badge">{unreadCount}</span>
              ) : null}
            </button>
            {panelOpen ? (
              <StudentNotificationPanel
                notifications={notifications}
                onNavigateAway={() => setPanelOpen(false)}
              />
            ) : null}
          </div>
        </header>

        {dashboardMode === "first-time" ? (
          <FirstTimeDashboard view={view} />
        ) : (
          <ReturningDashboard view={view} />
        )}
        <StudentBottomNav activeItem="home" />
      </section>
    </main>
  );
};
