import { AppSidebarLayout } from "./AppSidebarLayout";

const adminMenu = [
  { label: "Overview", to: "/admin" },
  { label: "Practice Sets", to: "/admin/practice-sets" },
  { label: "AI Assessment Studio", to: "/admin/ai-assessment-studio" },
  { label: "AI Assessment Demo", to: "/admin/ai-assessment-studio/demo" },
  { label: "Demo Model Settings", to: "/admin/ai-assessment-studio/demo-model-settings" },
  { label: "Bulk Pipeline", to: "/admin/ai-assessment-studio/bulk" },
  { label: "Source Builder", to: "/admin/ai-assessment-studio/source-builder" },
  { label: "Pipeline Runs", to: "/admin/ai-assessment-studio/runs" },
  { label: "Assessment Studio", to: "/admin/assessment-studio" },
  { label: "Question Bank", to: "/admin/question-bank" },
  { label: "Learning Analytics", to: "/admin/learning-analytics" },
  { label: "Performance Insights", to: "/admin/performance-insights" },
  { label: "Content Review", to: "/admin/content-review" },
  { label: "Moderation", to: "/admin/moderation" },
  { label: "Users", to: "/admin/users" },
  { label: "Exam Types", to: "/admin/exam-types" },
  { label: "Exam Goals", to: "/admin/exam-goals" },
  { label: "Levels", to: "/admin/levels" },
  { label: "Subjects", to: "/admin/subjects" },
  { label: "Books", to: "/admin/books" },
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
