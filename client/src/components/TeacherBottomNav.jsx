import { NavLink } from "react-router-dom";
import { TeacherNavIcon } from "./TeacherNavIcon";

const items = [
  { label: "Home", to: "/teacher", icon: "home", end: true },
  { label: "My Classes", to: "/teacher/classes", icon: "classes" },
  { label: "Tests", to: "/teacher/tests", icon: "tests" },
  { label: "Grading", to: "/teacher/grading", icon: "grading" },
];

// Fixed to the viewport, shown only below the mobile breakpoint (see
// .teacher-bottom-nav in index.css) -- a quick-access shortcut to the four
// most-used sections. The full menu (including Lessons/Profile) stays
// reachable via the hamburger drawer in the topbar, so nothing is lost by
// only surfacing four items here.
export const TeacherBottomNav = () => (
  <nav className="teacher-bottom-nav" aria-label="Primary">
    {items.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        className={({ isActive }) => `teacher-bottom-nav-item ${isActive ? "is-active" : ""}`}
      >
        <TeacherNavIcon type={item.icon} />
        <span>{item.label}</span>
      </NavLink>
    ))}
  </nav>
);
