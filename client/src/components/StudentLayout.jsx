import { Outlet } from "react-router-dom";
import { AppSidebarLayout } from "./AppSidebarLayout";
import { StudentNavIcon, navItems } from "./StudentBottomNav";
import { StudentClassSubjectSwitcher } from "./StudentClassSubjectSwitcher";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { AiTutorAvatarProvider } from "./AiTutorAvatarProvider";
import { ClassSubjectProvider } from "../context/ClassSubjectContext";

const studentMenuItems = navItems.map((item) => ({
  label: item.label,
  to: item.path || "#",
  icon: <StudentNavIcon type={item.icon} />,
  disabled: !item.path,
}));

export const StudentLayout = ({ user, onLogout }) => {
  const tier = useBreakpoint();

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
          brandTitle="KUHEDU STUDY BUDDY"
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
