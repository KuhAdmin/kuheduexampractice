import { useState } from "react";
import { StudentPageShell } from "../components/StudentPageShell";
import { EditProfileModal } from "../components/EditProfileModal";
import { ChangePasswordModal } from "../components/ChangePasswordModal";
import { useAuth } from "../context/AuthContext";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { useInstallPrompt } from "../hooks/useInstallPrompt";

const firstNameFromUser = (name) => {
  if (!name) {
    return "Student";
  }

  return name.trim().split(/\s+/)[0] || "Student";
};

const toTitleLabel = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const avatarLetters = (name) =>
  String(name || "ST")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

const parseDayCount = (value) => {
  const match = String(value || "").match(/\d+/);
  return match ? match[0] : "0";
};

const averageProgress = (chapters = []) => {
  if (!chapters.length) {
    return 0;
  }

  const total = chapters.reduce((sum, chapter) => sum + Number(chapter.progress || 0), 0);
  return Math.round(total / chapters.length);
};

const ProfileIcon = ({ type, className = "" }) => {
  const classes = `student-profile-icon ${className}`.trim();

  if (type === "bell") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M12 4a4 4 0 0 0-4 4v2.1c0 .8-.2 1.6-.7 2.3L6 14.5h12l-1.3-2.1a4.5 4.5 0 0 1-.7-2.3V8a4 4 0 0 0-4-4Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="M10.2 17a2 2 0 0 0 3.6 0"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (type === "settings") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M12 8.8A3.2 3.2 0 1 1 8.8 12 3.2 3.2 0 0 1 12 8.8Zm7 3.2-1.7-.5a5.8 5.8 0 0 0-.6-1.4l.9-1.6-1.8-1.8-1.6.9a5.8 5.8 0 0 0-1.4-.6L12 5l-2.2.6a5.8 5.8 0 0 0-1.4.6l-1.6-.9-1.8 1.8.9 1.6a5.8 5.8 0 0 0-.6 1.4L5 12l.6 2.2a5.8 5.8 0 0 0 .6 1.4l-.9 1.6 1.8 1.8 1.6-.9a5.8 5.8 0 0 0 1.4.6L12 19l2.2-.6a5.8 5.8 0 0 0 1.4-.6l1.6.9 1.8-1.8-.9-1.6a5.8 5.8 0 0 0 .6-1.4Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
      </svg>
    );
  }

  if (type === "mail") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M4.5 7.5h15a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15V9a1.5 1.5 0 0 1 1.5-1.5Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="m5 8 7 5 7-5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (type === "camera") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M7.5 8.5 9 6.8c.2-.2.4-.3.7-.3h4.6c.3 0 .5.1.7.3l1.5 1.7h1.8A1.7 1.7 0 0 1 20 10.2v6.3a1.7 1.7 0 0 1-1.7 1.7H5.7A1.7 1.7 0 0 1 4 16.5v-6.3a1.7 1.7 0 0 1 1.7-1.7Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
        <circle
          cx="12"
          cy="13"
          r="3"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
    );
  }

  if (type === "download") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M12 4v11m0 0 3.5-3.5M12 15l-3.5-3.5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="M5 16.5v1.7A1.8 1.8 0 0 0 6.8 20h10.4a1.8 1.8 0 0 0 1.8-1.8v-1.7"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (type === "chevron") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="m9 6 6 6-6 6"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.9"
        />
      </svg>
    );
  }

  if (type === "flame") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M12.1 3.5c.7 2-1 3.9-1 5.7 0 1.5 1.2 2.8 2.7 2.8 2.1 0 3.6-1.8 3.6-4.5 2.1 1.7 3.2 4 3.2 6.6 0 4.1-3.3 7.4-7.4 7.4S5.8 18.2 5.8 14.1c0-3.5 2-6.4 4.9-8.1.2 1.6-.3 2.7-.3 4 0 1.4 1 2.4 2.2 2.4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (type === "star") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="m12 4 2.5 5.1 5.6.8-4 3.9.9 5.5L12 16.8 7 19.3l.9-5.5-4-3.9 5.6-.8Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
    );
  }

  if (type === "ribbon") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <circle
          cx="12"
          cy="9"
          r="4.5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
        <path
          d="m9.8 13 1 6 1.2-1.7 1.2 1.7 1-6"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
    );
  }

  if (type === "trend") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M5 16.5 10 11l3 3 6-7"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="M15 7h4v4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (type === "crown") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M4.8 17.7 5.9 9.8c.1-.4.5-.6.9-.4l3.2 2.5c.3.2.7.1.8-.2l1-3.7c.1-.4.7-.4.8 0l1 3.7c.1.3.5.4.8.2l3.2-2.5c.3-.3.8 0 .9.4l1.1 7.9H4.8Z"
          fill="currentColor"
        />
        <path
          d="M7 14.2 9 10.7l2.7 2.1 3-2.2 2.3 3.6"
          fill="none"
          stroke="rgba(255, 255, 255, 0.4)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="0.9"
        />
        <rect x="6.4" y="15.2" width="11.2" height="1.8" rx="0.9" fill="rgba(29, 36, 31, 0.12)" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
      <path
        d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 7a6 6 0 0 1 12 0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
};

const StatCard = ({ tone, icon, value, label }) => (
  <article className="student-profile-stat-card">
    <div className={`student-profile-stat-icon is-${tone}`}>
      <ProfileIcon type={icon} />
    </div>
    <strong>{value}</strong>
    <span>{label}</span>
  </article>
);

const ActivityRow = ({ tone, badge, title, subtitle, meta }) => (
  <article className="student-profile-activity-row">
    <div className={`student-profile-activity-badge is-${tone}`}>{badge}</div>
    <div className="student-profile-activity-copy">
      <strong>{title}</strong>
      <p>{subtitle}</p>
    </div>
    <span className="student-profile-activity-meta">{meta}</span>
  </article>
);

const Tile = ({ tone, badge, label }) => (
  <article className="student-profile-tile">
    <div className={`student-profile-tile-badge is-${tone}`}>{badge}</div>
    <strong>{label}</strong>
  </article>
);

const AccountRow = ({ label, onClick, tone = "default", disabled = false, disabledHint = "Coming soon" }) => (
  <button
    type="button"
    className={`student-profile-account-row ${tone === "danger" ? "is-danger" : ""} ${
      disabled ? "is-disabled" : ""
    }`}
    onClick={onClick}
    disabled={disabled}
    title={disabled ? disabledHint : undefined}
  >
    <span>
      {label}
      {disabled && <span className="student-profile-account-row-hint">{disabledHint}</span>}
    </span>
    <ProfileIcon type="chevron" />
  </button>
);

export const StudentProfilePage = ({ user, dashboard, onLogout }) => {
  const { updateProfile, changePassword } = useAuth();
  const isMobile = useBreakpoint() === "mobile";
  const { platform, canInstall, promptInstall } = useInstallPrompt();
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const canChangePassword = user?.provider !== "google";
  const firstName = firstNameFromUser(user?.name);
  const subjectLabel = toTitleLabel(user?.subject) || "Biology";
  const boardLabel = String(user?.board || "CBSE").toUpperCase();
  const classLabel = user?.studentClass ? `Class ${user.studentClass}` : "Class 11";
  const chapters = Array.isArray(dashboard?.chapters) ? dashboard.chapters : [];
  const streakCount = parseDayCount(dashboard?.streak?.value);
  const progressAverage = averageProgress(chapters);
  const recentActivity = [
    {
      tone: "green",
      badge: "CL",
      title: `Continue: ${dashboard?.continueCard?.title || "Your next chapter"}`,
      subtitle: `${subjectLabel} • ${classLabel}`,
      meta: `${dashboard?.continueCard?.progress ?? 0}% done`,
    },
    {
      tone: "violet",
      badge: "EN",
      title: `Enrolled in ${boardLabel} ${classLabel}`,
      subtitle: `${subjectLabel} learning path is active`,
      meta: "Active",
    },
    {
      tone: "blue",
      badge: "CH",
      title: `${chapters.length || 0} chapters unlocked`,
      subtitle: `Current subject: ${subjectLabel}`,
      meta: "Library",
    },
    {
      tone: "amber",
      badge: "AC",
      title: `${toTitleLabel(user?.provider) || "Local"} account ready`,
      subtitle: "Profile synced for guided learning",
      meta: "Secure",
    },
  ];

  return (
    <StudentPageShell pageClass="student-page--profile" legacyModifierClass="student-profile-phone">
        <header className="student-profile-header">
          <div className="student-profile-header-copy">
            <p className="student-profile-title">Profile</p>
            <h1>Keep learning, keep growing!</h1>
          </div>
          <div className="student-profile-header-actions">
            <button type="button" className="student-profile-icon-button" aria-label="Notifications">
              <ProfileIcon type="bell" />
              <span className="student-profile-notice-dot">1</span>
            </button>
            <button type="button" className="student-profile-icon-button" aria-label="Settings">
              <ProfileIcon type="settings" />
            </button>
          </div>
        </header>

        <section className="student-profile-card">
          <div className="student-profile-summary">
            <div className="student-profile-avatar-wrap">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user?.name || "Student avatar"}
                  className="student-profile-avatar"
                />
              ) : (
                <div className="student-profile-avatar student-profile-avatar-fallback">
                  {avatarLetters(user?.name)}
                </div>
              )}
              <button
                type="button"
                className="student-profile-avatar-edit"
                aria-label="Upload profile image"
                onClick={() => setEditProfileOpen(true)}
              >
                <ProfileIcon type="camera" />
              </button>
            </div>

            <div className="student-profile-summary-copy">
              <div className="student-profile-summary-head">
                <strong>{user?.name || "Alex Sharma"}</strong>
                <button type="button" className="student-profile-inline-action" aria-label="Open profile details">
                  <ProfileIcon type="chevron" />
                </button>
              </div>
              <p className="student-profile-email">
                <ProfileIcon type="mail" />
                <span>{user?.email || "alex.sharma@gmail.com"}</span>
              </p>
            </div>
          </div>

          <div className="student-profile-stat-grid">
            <StatCard tone="amber" icon="flame" value={streakCount} label="Learning Streak" />
            <StatCard tone="gold" icon="star" value={chapters.length || 0} label="Learning IQ" />
            <StatCard tone="orange" icon="ribbon" value="12" label="Skills Mastered" />
            <StatCard tone="green" icon="trend" value={`${progressAverage}%`} label="Growth Index" />
          </div>
        </section>

        <section className="student-profile-premium">
          <div className="student-profile-premium-mark">
            <img src="/crown.png" alt="" className="student-profile-premium-mark-image" aria-hidden="true" />
          </div>
          <div className="student-profile-premium-copy">
            <div className="student-profile-premium-head">
              <div>
                <strong>STEMLab Premium</strong>
                <p>Access all features and premium content</p>
              </div>
              <button
                type="button"
                className="student-profile-premium-arrow"
                aria-label="Open subscription details"
              >
                <ProfileIcon type="chevron" />
              </button>
            </div>
          </div>
          <div className="student-profile-premium-actions">
            <button type="button" className="student-profile-premium-cta">
              View Subscription
            </button>
            <div className="student-profile-premium-trial">Trial Ends in 15 Days</div>
          </div>
        </section>

        <section className="student-profile-section">
          <div className="student-profile-section-head">
            <h2>Recent Activity</h2>
            <button type="button">View All</button>
          </div>
          <div className="student-profile-list-card">
            {recentActivity.map((item) => (
              <ActivityRow key={item.title} {...item} />
            ))}
          </div>
        </section>

        <section className="student-profile-section">
          <h2>Quick Access</h2>
          <div className="student-profile-tile-grid">
            <Tile tone="green" badge="CL" label="My Class" />
            <Tile tone="blue" badge="SB" label="My Subject" />
            <Tile tone="violet" badge="DL" label="Downloads" />
            <Tile tone="orange" badge="TS" label="My Tests" />
            <Tile tone="rose" badge="BM" label="Bookmarks" />
          </div>
        </section>

        <button type="button" className="student-profile-help-card">
          <div className="student-profile-help-badge">?</div>
          <div className="student-profile-help-copy">
            <strong>Help & FAQs</strong>
            <p>Find answers to common questions</p>
          </div>
          <ProfileIcon type="chevron" />
        </button>

        <section className="student-profile-section">
          <h2>Account</h2>
          <div className="student-profile-account-card">
            <AccountRow label="Edit Profile" onClick={() => setEditProfileOpen(true)} />
            <AccountRow
              label="Change Password"
              onClick={() => setChangePasswordOpen(true)}
              disabled={!canChangePassword}
              disabledHint="Not available for Google sign-in"
            />
            <AccountRow label="Privacy & Security" disabled />
            <AccountRow label="Manage Devices" disabled />
            <AccountRow label="Parental Controls" disabled />
            <AccountRow label="Logout" onClick={onLogout} tone="danger" />
          </div>
        </section>

        {isMobile && (platform === "android" || platform === "ios") && (
          <section className="student-profile-premium student-profile-install">
            <div className="student-profile-premium-mark">
              <img src="/icons/icon-192.png" alt="" className="student-profile-premium-mark-image" aria-hidden="true" />
            </div>
            <div className="student-profile-premium-copy">
              <div className="student-profile-premium-head">
                <div>
                  <strong>Install KUHEDU MASTER</strong>
                  <p>Add to your home screen for quick access</p>
                </div>
                <ProfileIcon type="download" />
              </div>
            </div>
            <div className="student-profile-premium-actions">
              {platform === "android" ? (
                <button
                  type="button"
                  className="student-profile-premium-cta"
                  onClick={promptInstall}
                  disabled={!canInstall}
                >
                  Install App
                </button>
              ) : (
                <ol className="student-profile-install-steps">
                  <li>Tap the Share icon in Safari</li>
                  <li>Scroll down and tap "Add to Home Screen"</li>
                  <li>Tap "Add"</li>
                </ol>
              )}
            </div>
          </section>
        )}

      <EditProfileModal
        open={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        user={user}
        onSave={updateProfile}
      />
      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        onSave={changePassword}
      />
    </StudentPageShell>
  );
};
