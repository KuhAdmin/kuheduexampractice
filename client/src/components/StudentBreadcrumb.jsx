import { Fragment } from "react";
import { useNavigate } from "react-router-dom";

const ChevronIcon = () => (
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

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" className="student-dashboard-icon" aria-hidden="true">
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

// Shared version of the breadcrumb trail already hand-rolled per page in
// StudentSectionDetailPage.jsx/StudentConceptLearningPage.jsx/
// StudentAssessmentPage.jsx/StudentAssessmentResultPage.jsx (same
// .student-concept-breadcrumb CSS + Home icon + chevron separators) --
// extracted here since Writing Practice and the Pre/Post-Lesson pages add
// three more callers needing the identical markup. Desktop/tablet only by
// convention (mobile keeps the compact back-arrow header instead); callers
// decide whether to render this or the mobile header via useBreakpoint.
// `items` is the trail after Home: [{label, to}], every entry clickable
// except the last (omit `to` on the current page).
export const StudentBreadcrumb = ({ items }) => {
  const navigate = useNavigate();

  return (
    <nav className="student-concept-breadcrumb" aria-label="Breadcrumb">
      <button type="button" onClick={() => navigate("/dashboard")} aria-label="Home">
        <HomeIcon />
      </button>
      {items.map((item, index) => (
        <Fragment key={index}>
          <ChevronIcon />
          {item.to ? (
            <button type="button" onClick={() => navigate(item.to)}>
              {item.label}
            </button>
          ) : (
            <span className="is-current">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
};
