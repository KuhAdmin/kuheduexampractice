import { useLocation } from "react-router-dom";
import { StudentBottomNav } from "./StudentBottomNav";
import { useBreakpoint } from "../hooks/useBreakpoint";

const resolveActiveNavItem = (pathname) => {
  if (pathname.startsWith("/chapters")) {
    return "chapters";
  }
  if (pathname.startsWith("/profile")) {
    return "profile";
  }
  return "home";
};

/**
 * Owns the mobile-vs-desktop split for a single student screen. Mobile keeps
 * the original phone-card + bottom nav markup byte-for-byte; tablet/desktop
 * drop the phone card (StudentLayout's sidebar supplies nav chrome there)
 * but keep the legacy modifier class so existing inner-content CSS still
 * applies at every tier.
 */
export const StudentPageShell = ({ pageClass = "", legacyModifierClass = "", children }) => {
  const tier = useBreakpoint();
  const location = useLocation();

  if (tier === "mobile") {
    return (
      <main className="student-dashboard-shell">
        <section className={`student-dashboard-phone ${legacyModifierClass}`.trim()}>
          <div className="home-onboarding-topbar">
            <img src="/kuhedu-logo.png" alt="KUHEDU logo" />
            <span>KUHEDU MASTER</span>
          </div>
          {children}
          <StudentBottomNav activeItem={resolveActiveNavItem(location.pathname)} />
        </section>
      </main>
    );
  }

  return (
    <div className={`student-page ${pageClass} ${legacyModifierClass}`.trim()}>{children}</div>
  );
};
