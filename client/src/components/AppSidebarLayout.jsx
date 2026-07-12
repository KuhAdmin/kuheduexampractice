import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useBreakpoint } from "../hooks/useBreakpoint";

export const AppSidebarLayout = ({
  brandTitle,
  brandSubtitle,
  menuItems,
  homeLink,
  user,
  onLogout,
  collapsible = false,
  railClassName = "",
  ariaLabel = "Primary",
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const tier = useBreakpoint();
  const isTabletCollapsed = collapsible && tier === "tablet";

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <main
      className={`admin-page ${railClassName} ${sidebarOpen ? "is-nav-open" : ""} ${
        isTabletCollapsed ? "admin-page--tablet-collapsed" : ""
      }`}
    >
      <div className="admin-mobile-topbar">
        <div className="admin-mobile-brand">
          <img className="brand-logo" src="/kuhedu-logo.png" alt="KUHEDU logo" />
          <div>
            <p>{brandTitle}</p>
            <span>{brandSubtitle}</span>
          </div>
        </div>
        <button
          type="button"
          className="admin-mobile-menu-button"
          onClick={() => setSidebarOpen((current) => !current)}
          aria-expanded={sidebarOpen}
          aria-controls="app-sidebar-nav"
        >
          {sidebarOpen ? "Close" : "Menu"}
        </button>
      </div>

      <div
        className={`admin-mobile-backdrop ${sidebarOpen ? "is-open" : ""}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden={!sidebarOpen}
      />

      <aside
        className={`admin-sidebar ${sidebarOpen ? "is-open" : ""} ${isTabletCollapsed ? "is-collapsed" : ""}`}
      >
        <div className="admin-sidebar-brand">
          <img className="brand-logo" src="/kuhedu-logo.png" alt="KUHEDU logo" />
          <div>
            <p>{brandTitle}</p>
            <span>{brandSubtitle}</span>
          </div>
        </div>

        <nav className="admin-sidebar-nav" id="app-sidebar-nav" aria-label={ariaLabel}>
          {homeLink && (
            <NavLink to={homeLink.to} end className="admin-sidebar-link admin-sidebar-home">
              {homeLink.icon}
              <span className="admin-sidebar-link-label">{homeLink.label}</span>
            </NavLink>
          )}
          {menuItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `admin-sidebar-link ${isActive ? "is-active" : ""} ${item.disabled ? "is-disabled" : ""}`
              }
              onClick={item.disabled ? (event) => event.preventDefault() : undefined}
              aria-disabled={item.disabled || undefined}
            >
              {item.icon}
              <span className="admin-sidebar-link-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <p>{user?.name || "User"}</p>
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
