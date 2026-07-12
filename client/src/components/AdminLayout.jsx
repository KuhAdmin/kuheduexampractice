import { AppSidebarLayout } from "./AppSidebarLayout";

const adminMenu = [
  { label: "Overview", to: "/admin" },
  { label: "Practice Sets", to: "/admin/practice-sets" },
  { label: "AI Assessment Studio", to: "/admin/ai-assessment-studio" },
  { label: "Bulk Pipeline", to: "/admin/ai-assessment-studio/bulk" },
  { label: "Pipeline Runs", to: "/admin/ai-assessment-studio/runs" },
  { label: "Assessment Studio", to: "/admin/assessment-studio" },
  { label: "Question Bank", to: "/admin/question-bank" },
  { label: "Learning Analytics", to: "/admin/learning-analytics" },
  { label: "Performance Insights", to: "/admin/performance-insights" },
  { label: "Content Review", to: "/admin/content-review" },
  { label: "Moderation", to: "/admin/moderation" },
  { label: "Users", to: "/admin/users" },
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
