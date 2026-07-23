import { useNavigate } from "react-router-dom";

export const navItems = [
  { id: "home", label: "Home", icon: "home", path: "/dashboard" },
  { id: "chapters", label: "Chapters", icon: "book", path: "/chapters" },
  { id: "practice", label: "Practice", icon: "spark", path: "/practice" },
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
          className={`student-dashboard-nav-item ${item.id === activeItem ? "is-active" : ""}`}
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
