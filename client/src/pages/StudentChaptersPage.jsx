import { useNavigate } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { StudentDrilldownCard } from "../components/StudentDrilldownCard";
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

export const StudentChaptersPage = ({ dashboard, user }) => {
  const navigate = useNavigate();
  const classLabel = user?.studentClass ? `Class ${user.studentClass}` : "Class 11";
  const subjectLabel = toTitleLabel(user?.subject) || "Biology";
  const chapters = buildChapterRows(Array.isArray(dashboard?.chapters) ? dashboard.chapters : []);

  return (
    <StudentPageShell pageClass="student-page--chapters" legacyModifierClass="student-chapters-phone">
        <header className="student-chapters-header">
          <button type="button" className="student-chapters-filter" aria-label="Selected class and subject">
            <span>{`${classLabel} - ${subjectLabel}`}</span>
            <ChapterIcon type="caret" />
          </button>
          <button type="button" className="student-dashboard-bell" aria-label="Notifications">
            <ChapterIcon type="bell" />
          </button>
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
                  onClick={() => navigate(`/chapters/${chapter.chapterNumber || chapter.id}`)}
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
