import { Outlet } from "react-router-dom";
import { AppSidebarLayout } from "./AppSidebarLayout";
import { StudentNavIcon, navItems } from "./StudentBottomNav";
import { StudentClassSubjectSwitcher } from "./StudentClassSubjectSwitcher";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { AiTutorAvatarProvider } from "./AiTutorAvatarProvider";
import { ClassSubjectProvider } from "../context/ClassSubjectContext";

// "Skills" gets a "Write" child on desktop, reusing AppSidebarLayout's
// SidebarGroup mechanism (already used by Admin's "Masters" group in
// AdminLayout.jsx) -- Write is the only Tests feature at launch, so this is
// a single-item expand/collapse group rather than a plain link.
const baseStudentMenuItems = navItems.map((item) => {
  const mapped = {
    label: item.label,
    to: item.path || "#",
    icon: <StudentNavIcon type={item.icon} />,
    disabled: !item.path,
  };
  return item.id === "assessments"
    ? { ...mapped, children: [{ label: "Write", to: "/tests/write", icon: <StudentNavIcon type="clipboard" /> }] }
    : mapped;
});

export const StudentLayout = ({ user, onLogout }) => {
  const tier = useBreakpoint();
  // Content moderators are normal student-app users (see App.jsx's /dashboard
  // guard) but also need a way back to their one allowed admin route --
  // see AdminLayout.jsx's menu filtering for the other half of this.
  const studentMenuItems =
    user?.role === "moderator"
      ? [
          ...baseStudentMenuItems,
          {
            label: "Moderate Content",
            to: "/admin/content-editor",
            icon: <StudentNavIcon type="clipboard" />,
          },
        ]
      : baseStudentMenuItems;

  // Wraps both branches (not just the desktop sidebar) since
  // StudentChaptersPage -- rendered via <Outlet/> in either case -- reads
  // this same context on mobile too (mobile just has no sidebar to embed
  // the switcher in, so it keeps its own inline copy in the page header).
  if (tier === "mobile") {
    return (
      <AiTutorAvatarProvider>
        <ClassSubjectProvider user={user}>
          <Outlet />
        </ClassSubjectProvider>
      </AiTutorAvatarProvider>
    );
  }

  return (
    <AiTutorAvatarProvider>
      <ClassSubjectProvider user={user}>
        <AppSidebarLayout
          brandTitle="English 24x7"
          brandSubtitle="Your learning workspace"
          belowBrand={<StudentClassSubjectSwitcher />}
          menuItems={studentMenuItems}
          user={user}
          onLogout={onLogout}
          collapsible
          railClassName="student-app-shell"
          ariaLabel="Student"
        />
      </ClassSubjectProvider>
    </AiTutorAvatarProvider>
  );
};
