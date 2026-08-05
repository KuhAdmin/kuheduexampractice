import { useNavigate } from "react-router-dom";

// "practice" removed from the nav (not from the app -- other flows still
// link to /practice directly). "labs" and "assessments" (Tests) are
// deliberately kept with no `path`: both this bar and StudentLayout.jsx's
// desktop sidebar (see studentMenuItems there) treat a missing path as
// "disabled," so they stay visible but inert until those features launch.
export const navItems = [
  { id: "home", label: "Home", icon: "home", path: "/dashboard" },
  { id: "chapters", label: "Lessons", icon: "book", path: "/chapters" },
  { id: "labs", label: "Labs", icon: "lab" },
  { id: "assessments", label: "Tests", icon: "clipboard" },
  { id: "profile", label: "Profile", icon: "user", path: "/profile" },
];

export const StudentNavIcon = ({ type }) => {
  const classes = "student-dashboard-icon";

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

  if (type === "lab") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M9.5 3.5h5m-4 0V9l-4.6 8.2a1.6 1.6 0 0 0 1.4 2.3h9.4a1.6 1.6 0 0 0 1.4-2.3L13.5 9V3.5m-5.5 12h8"
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

export const StudentBottomNav = ({ activeItem = "home" }) => {
  const navigate = useNavigate();

  return (
    <nav className="student-dashboard-bottom-nav" aria-label="Primary">
      {navItems.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`student-dashboard-nav-item ${item.id === activeItem ? "is-active" : ""} ${
            item.path ? "" : "is-disabled"
          }`}
          disabled={!item.path}
          aria-disabled={!item.path}
          onClick={() => {
            if (item.path) {
              navigate(item.path);
            }
          }}
        >
          <StudentNavIcon type={item.icon} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
};
