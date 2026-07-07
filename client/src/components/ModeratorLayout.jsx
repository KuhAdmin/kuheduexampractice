import { NavLink, Outlet } from "react-router-dom";

export const ModeratorLayout = ({ onLogout, user }) => (
  <main className="admin-page">
    <aside className="admin-sidebar is-open">
      <div className="admin-sidebar-brand">
        <img className="brand-logo" src="/kuhedu-logo.png" alt="KUHEDU logo" />
        <div>
          <p>KUHEDU Moderator</p>
          <span>Content review workspace</span>
        </div>
      </div>

      <nav className="admin-sidebar-nav" aria-label="Moderator">
        <NavLink to="/moderator" end className={({ isActive }) => `admin-sidebar-link ${isActive ? "is-active" : ""}`}>
          My Tasks
        </NavLink>
      </nav>

      <div className="admin-sidebar-footer">
        <p>{user?.name || "Moderator"}</p>
        <span>{user?.email}</span>
        <button className="ghost-button" onClick={onLogout}>
          Logout
        </button>
      </div>
    </aside>

    <section className="admin-main">
      <Outlet />
    </section>
  </main>
);
