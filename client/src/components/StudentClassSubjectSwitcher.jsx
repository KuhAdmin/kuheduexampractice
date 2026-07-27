import { useNavigate } from "react-router-dom";
import { selectionKey, useClassSubject } from "../context/ClassSubjectContext";

const BookIcon = () => (
  <svg viewBox="0 0 24 24" className="student-dashboard-icon" aria-hidden="true">
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

// Lives in the sidebar (below the brand block) instead of on the Chapters
// page itself -- changing it here jumps straight to /dashboard (wired to
// this same selection via ClassSubjectContext's selectionDashboard, see
// StudentDashboardPage.jsx) so the selection change is immediately visible,
// since the sidebar persists across every student page, not just Chapters.
export const StudentClassSubjectSwitcher = () => {
  const navigate = useNavigate();
  const { classSubjectOptions, selection, setSelection } = useClassSubject();

  return (
    <div className="admin-sidebar-class-filter">
      <BookIcon />
      <select
        aria-label="Class and subject"
        value={selection ? selectionKey(selection) : ""}
        onChange={(event) => {
          const next = classSubjectOptions.find((option) => selectionKey(option) === event.target.value);
          if (next) {
            setSelection(next);
            navigate("/dashboard");
          }
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
};
