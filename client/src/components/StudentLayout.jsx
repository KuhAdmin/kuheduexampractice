import { Outlet } from "react-router-dom";
import { AppSidebarLayout } from "./AppSidebarLayout";
import { StudentNavIcon, navItems } from "./StudentBottomNav";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { AiTutorAvatarProvider } from "./AiTutorAvatarProvider";

const studentMenuItems = navItems.map((item) => ({
  label: item.label,
  to: item.path || "#",
  icon: <StudentNavIcon type={item.icon} />,
  disabled: !item.path,
}));

export const StudentLayout = ({ user, onLogout }) => {
  const tier = useBreakpoint();

  if (tier === "mobile") {
    return (
      <AiTutorAvatarProvider>
        <Outlet />
      </AiTutorAvatarProvider>
    );
  }

  return (
    <AiTutorAvatarProvider>
      <AppSidebarLayout
        brandTitle="KUHEDU EXAM-BUDDY"
        brandSubtitle="Your learning workspace"
        menuItems={studentMenuItems}
        user={user}
        onLogout={onLogout}
        collapsible
        railClassName="student-app-shell"
        ariaLabel="Student"
      />
    </AiTutorAvatarProvider>
  );
};
