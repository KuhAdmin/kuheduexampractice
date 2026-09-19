import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebarLayout } from "./AppSidebarLayout";
import { TeacherNavIcon } from "./TeacherNavIcon";
import { TeacherIcon } from "./TeacherIcon";
import { TeacherBottomNav } from "./TeacherBottomNav";
import { getTeacherHome } from "../api/client";

const teacherMenu = [
  { label: "Home", to: "/teacher", icon: <TeacherNavIcon type="home" /> },
  { label: "My Classes", to: "/teacher/classes", icon: <TeacherNavIcon type="classes" /> },
  { label: "Lessons", to: "/teacher/lessons", icon: <TeacherNavIcon type="lessons" /> },
  { label: "Tests", to: "/teacher/tests", icon: <TeacherNavIcon type="tests" /> },
  { label: "Grading", to: "/teacher/grading", icon: <TeacherNavIcon type="grading" /> },
  { label: "Profile", to: "/teacher/profile", icon: <TeacherNavIcon type="profile" /> },
];

const initials = (name) =>
  String(name || "T")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

export const TeacherLayout = ({ onLogout, user }) => {
  const navigate = useNavigate();
  // Real signal, not decoration: the bell's dot reflects actual ungraded
  // work waiting on this teacher, and tapping it goes straight to Grading --
  // no fabricated "notifications" list behind it.
  const [pendingGradingCount, setPendingGradingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getTeacherHome()
      .then((result) => {
        if (!cancelled) setPendingGradingCount(result?.pendingGradingCount || 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const topbarExtra = (
    <div className="teacher-mobile-topbar-actions">
      <button
        type="button"
        className="teacher-mobile-icon-button"
        aria-label={pendingGradingCount > 0 ? `${pendingGradingCount} pending grading` : "Grading"}
        onClick={() => navigate("/teacher/grading")}
      >
        <TeacherIcon type="bell" />
        {pendingGradingCount > 0 && <span className="teacher-notification-dot" />}
      </button>
      <button type="button" className="teacher-mobile-avatar" onClick={() => navigate("/teacher/profile")} aria-label="Profile">
        {user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials(user?.name)}
      </button>
    </div>
  );

  return (
    <>
      <AppSidebarLayout
        brandTitle="Kuhedu"
        brandSubtitle="Teacher"
        menuItems={teacherMenu.map((item) => ({ ...item, end: item.to === "/teacher" }))}
        homeLink={null}
        user={user}
        onLogout={onLogout}
        railClassName="teacher-app-shell"
        ariaLabel="Teacher"
        mobileTopbarExtra={topbarExtra}
      />
      <TeacherBottomNav />
    </>
  );
};
