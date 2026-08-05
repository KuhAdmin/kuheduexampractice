import { AppSidebarLayout } from "./AppSidebarLayout";

const adminMenu = [
  { label: "Overview", to: "/admin" },
  { label: "AI Assessment Demo", to: "/admin/ai-demo" },
  { label: "Demo Model Settings", to: "/admin/ai-demo/model-settings" },
  { label: "Users", to: "/admin/users" },
  { label: "Orders", to: "/admin/orders" },
  {
    label: "Masters",
    children: [
      { label: "Exam Types", to: "/admin/exam-types" },
      { label: "Exam Goals", to: "/admin/exam-goals" },
      { label: "Levels", to: "/admin/levels" },
      { label: "Subjects", to: "/admin/subjects" },
      { label: "Books", to: "/admin/books" },
    ],
  },
  { label: "Concept Import", to: "/admin/concept-import" },
  { label: "Content Editor", to: "/admin/content-editor" },
  { label: "Settings", to: "/admin/settings" },
];

// A moderator only ever has server-side access to the content-editor route
// group (see adminContentEditorRoutes.js's requireRole("admin", "moderator"))
// -- every other admin route still 403s for them, so hide those menu entries
// rather than showing dead links.
const moderatorMenu = [{ label: "Content Editor", to: "/admin/content-editor" }];

export const AdminLayout = ({ onLogout, user }) => {
  const isModerator = user?.role === "moderator";
  const menu = isModerator ? moderatorMenu : adminMenu;

  return (
    <AppSidebarLayout
      brandTitle="KUHEDU Admin"
      brandSubtitle="Workspace for content and analytics"
      menuItems={menu.map((item) => ({ ...item, end: item.to === "/admin" }))}
      homeLink={isModerator ? { to: "/dashboard", label: "Back to app" } : { to: "/", label: "Home" }}
      user={user}
      onLogout={onLogout}
      ariaLabel="Admin"
    />
  );
};
