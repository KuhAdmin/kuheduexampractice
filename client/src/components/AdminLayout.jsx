import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

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

export const AdminLayout = ({ onLogout, user }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <main className={`admin-page ${sidebarOpen ? "is-nav-open" : ""}`}>
      <div className="admin-mobile-topbar">
        <div className="admin-mobile-brand">
          <img className="brand-logo" src="/kuhedu-logo.png" alt="KUHEDU logo" />
          <div>
            <p>KUHEDU Admin</p>
            <span>Content and analytics</span>
          </div>
        </div>
        <button
          type="button"
          className="admin-mobile-menu-button"
          onClick={() => setSidebarOpen((current) => !current)}
          aria-expanded={sidebarOpen}
          aria-controls="admin-sidebar-nav"
        >
          {sidebarOpen ? "Close" : "Menu"}
        </button>
      </div>

      <div
        className={`admin-mobile-backdrop ${sidebarOpen ? "is-open" : ""}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden={!sidebarOpen}
      />

      <aside className={`admin-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="admin-sidebar-brand">
          <img className="brand-logo" src="/kuhedu-logo.png" alt="KUHEDU logo" />
          <div>
            <p>KUHEDU Admin</p>
            <span>Workspace for content and analytics</span>
          </div>
        </div>

        <nav className="admin-sidebar-nav" id="admin-sidebar-nav" aria-label="Admin">
          <NavLink to="/" className="admin-sidebar-link admin-sidebar-home">
            Home
          </NavLink>
          {adminMenu.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.to === "/admin"}
              className={({ isActive }) =>
                `admin-sidebar-link ${isActive ? "is-active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <p>{user?.name || "Admin User"}</p>
          <span>{user?.email}</span>
          <button
            className="ghost-button"
            onClick={() => {
              setSidebarOpen(false);
              onLogout();
            }}
          >
            Logout
          </button>
        </div>
      </aside>

      <section className="admin-main">
        <Outlet />
      </section>
    </main>
  );
};
