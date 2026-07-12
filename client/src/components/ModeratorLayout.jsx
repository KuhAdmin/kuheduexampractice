import { AppSidebarLayout } from "./AppSidebarLayout";

const moderatorMenu = [{ label: "My Tasks", to: "/moderator", end: true }];

export const ModeratorLayout = ({ onLogout, user }) => (
  <AppSidebarLayout
    brandTitle="KUHEDU Moderator"
    brandSubtitle="Content review workspace"
    menuItems={moderatorMenu}
    user={user}
    onLogout={onLogout}
    ariaLabel="Moderator"
  />
);
