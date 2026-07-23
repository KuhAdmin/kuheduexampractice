import { useEffect, useRef, useState } from "react";
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
  const menuButtonRef = useRef(null);
  const navRef = useRef(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Off-canvas drawer: on open, lock background scroll and move focus into
  // the nav (it otherwise stays on the topbar toggle button, which sits
  // outside the scrollable <aside> -- so arrow keys scroll the page behind
  // the drawer instead of the menu). On close, restore both, returning
  // focus to the toggle only if the drawer had actually been open.
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
      navRef.current?.querySelector("a, button")?.focus();
      wasOpenRef.current = true;
    } else {
      document.body.style.overflow = "";
      if (wasOpenRef.current) {
        menuButtonRef.current?.focus();
        wasOpenRef.current = false;
      }
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

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
          ref={menuButtonRef}
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

        <nav className="admin-sidebar-nav" id="app-sidebar-nav" aria-label={ariaLabel} ref={navRef}>
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
