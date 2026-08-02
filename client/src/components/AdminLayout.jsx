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
  { label: "Settings", to: "/admin/settings" },
];

export const AdminLayout = ({ onLogout, user }) => (
  <AppSidebarLayout
    brandTitle="KUHEDU Admin"
    brandSubtitle="Workspace for content and analytics"
    menuItems={adminMenu.map((item) => ({ ...item, end: item.to === "/admin" }))}
    homeLink={{ to: "/", label: "Home" }}
    user={user}
    onLogout={onLogout}
    ariaLabel="Admin"
  />
);
