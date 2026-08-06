import { useEffect, useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { EditProfileModal } from "../components/EditProfileModal";
import { ChangePasswordModal } from "../components/ChangePasswordModal";
import { StudentNotificationPanel } from "../components/StudentNotificationPanel";
import { useAuth } from "../context/AuthContext";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { useInstallPrompt } from "../hooks/useInstallPrompt";
import { getLastPaymentAttempt, getNotifications, markNotificationsSeen } from "../api/client";
import {
  getAvatarVisibleServerSnapshot,
  getAvatarVisibleSnapshot,
  setAvatarVisible,
  subscribeAvatarVisible,
} from "../lib/aiTutorAvatarVisibility";

const firstNameFromUser = (name) => {
  if (!name) {
    return "Student";
  }

  return name.trim().split(/\s+/)[0] || "Student";
};

const avatarLetters = (name) =>
  String(name || "ST")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

// Real countdown from user.premiumExpiresAt -- every current plan (2-week,
// 12-month, or Trial) has a real expiry now that recurring subscriptions
// are gone, so this always has something to show while premium is active.
const formatSubscriptionCountdown = (endDateIso) => {
  if (!endDateIso) {
    return null;
  }

  const diffMs = new Date(endDateIso).getTime() - Date.now();
  if (diffMs <= 0) {
    return null;
  }

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return `Ends in ${days}d ${hours}h`;
};

// user.premiumExpiresAt once it's in the past -- shown after premium lapses
// so a student sees when their access ended, not just that it's gone.
const formatSubscriptionEndedAgo = (endDateIso) => {
  if (!endDateIso) {
    return null;
  }

  const diffMs = Date.now() - new Date(endDateIso).getTime();
  if (diffMs <= 0) {
    return null;
  }

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) {
    const hours = Math.max(Math.floor(diffMs / (1000 * 60 * 60)), 1);
    return `Ended ${hours}h ago`;
  }
  return `Ended ${days}d ago`;
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

  if (type === "android") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M6 10a6 6 0 0 1 12 0v5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-5Z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path d="M7 10v5M17 10v5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        <path d="M5 12H3M21 12h-2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        <path d="m8 5 1.5-2M16 5l-1.5-2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        <circle cx="9.5" cy="9.5" r="0.9" fill="currentColor" />
        <circle cx="14.5" cy="9.5" r="0.9" fill="currentColor" />
      </svg>
    );
  }

  if (type === "apple") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M15.8 3.5c.1 1-.3 2-.9 2.7-.6.7-1.6 1.3-2.6 1.2-.1-1 .3-2 .9-2.7.6-.7 1.7-1.2 2.6-1.2Z"
          fill="currentColor"
        />
        <path
          d="M18.9 17.2c-.5 1.1-.7 1.6-1.3 2.6-.9 1.4-2.1 3.1-3.7 3.1-1.4 0-1.7-.9-3.6-.9-1.9 0-2.3.9-3.6.9-1.6 0-2.7-1.6-3.6-2.9C1.2 17.1.4 13.4 1.8 10.9c.9-1.7 2.5-2.7 4-2.7 1.4 0 2.3.9 3.6.9 1.2 0 1.9-.9 3.6-.9 1.3 0 2.7.7 3.6 1.9-3.2 1.7-2.7 6.2 1.3 6.7-.3.5-.6 1-1 1.4Z"
          fill="currentColor"
        />
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

const AccountToggleRow = ({ label, description, checked, onChange }) => (
  <div className="student-profile-account-row student-profile-account-row-stacked">
    <div className="student-profile-account-row-top">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`student-profile-toggle-switch ${checked ? "is-on" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className="student-profile-toggle-switch-thumb" />
      </button>
    </div>
    {description && <span className="student-profile-account-row-hint">{description}</span>}
  </div>
);

const AccountThemeRow = ({ theme, onChange }) => (
  <div className="student-profile-account-row student-profile-account-row-stacked">
    <div className="student-profile-account-row-top">
      <span>Select Theme</span>
      <div className="student-profile-theme-toggle" role="radiogroup" aria-label="Appearance">
        <button
          type="button"
          role="radio"
          aria-checked={theme !== "dusk"}
          className={`student-profile-theme-chip ${theme !== "dusk" ? "is-active" : ""}`}
          onClick={() => onChange("dawn")}
        >
          Dawn
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={theme === "dusk"}
          className={`student-profile-theme-chip ${theme === "dusk" ? "is-active" : ""}`}
          onClick={() => onChange("dusk")}
        >
          Dusk
        </button>
      </div>
    </div>
    <span className="student-profile-account-row-hint">Choose Dawn (light) or Dusk (dark)</span>
  </div>
);

export const StudentProfilePage = ({ user, onLogout }) => {
  const { updateProfile, changePassword, setTheme } = useAuth();
  const navigate = useNavigate();
  const isMobile = useBreakpoint() === "mobile";
  const { platform } = useInstallPrompt();
  // Defaults to the visiting device's own platform, but both tabs are always
  // shown/selectable -- e.g. a student could be looking at this on Android
  // while wanting to read the iOS steps to relay to a friend.
  const [activeInstallTab, setActiveInstallTab] = useState(platform === "android" ? "android" : "ios");
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [lastPaymentAttempt, setLastPaymentAttempt] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const canChangePassword = user?.provider !== "google";
  const avatarEnabled = useSyncExternalStore(
    subscribeAvatarVisible,
    getAvatarVisibleSnapshot,
    getAvatarVisibleServerSnapshot
  );
  const firstName = firstNameFromUser(user?.name);
  const handleThemeChange = (nextTheme) => {
    const current = user?.theme === "dusk" ? "dusk" : "dawn";
    if (nextTheme === current) return;
    setTheme(nextTheme).catch(() => {});
  };

  // Same fetch/mark-seen/panel-toggle pattern as StudentDashboardPage.jsx's
  // bell -- reusing StudentNotificationPanel rather than inventing a second
  // notifications UI.
  useEffect(() => {
    let cancelled = false;

    getNotifications()
      .then((result) => {
        if (cancelled) return;
        setNotifications(result?.notifications || []);
        setUnreadCount(result?.unreadCount || 0);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const handleBellClick = () => {
    setNotificationPanelOpen((current) => {
      const next = !current;
      if (next && unreadCount > 0) {
        markNotificationsSeen()
          .then(() => setUnreadCount(0))
          .catch(() => {});
      }
      return next;
    });
  };

  // Fetched regardless of isPremium now -- lastAttempt (the most recent
  // payment_order, whatever its outcome) is exactly what a NOT-premium
  // student needs to see, e.g. "your last attempt failed."
  useEffect(() => {
    let cancelled = false;
    getLastPaymentAttempt()
      .then((result) => {
        if (cancelled) return;
        setLastPaymentAttempt(result?.lastAttempt || null);
      })
      .catch(() => {
        if (cancelled) return;
        setLastPaymentAttempt(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.isPremium]);

  const subscriptionCountdown = formatSubscriptionCountdown(user?.premiumExpiresAt || null);
  const subscriptionEndedAgo = formatSubscriptionEndedAgo(user?.premiumExpiresAt);
  const lastAttemptFailed = !user?.isPremium && lastPaymentAttempt?.status === "failed";

  return (
    <StudentPageShell pageClass="student-page--profile" legacyModifierClass="student-profile-phone">
        <header className="student-profile-header">
          <div className="student-profile-header-copy">
            <p className="student-profile-title">Profile</p>
            <h1>Keep learning, keep growing!</h1>
          </div>
          <div className="student-profile-header-actions">
            <div className="student-profile-bell-wrap">
              <button
                type="button"
                className="student-profile-icon-button"
                aria-label="Notifications"
                onClick={handleBellClick}
              >
                <ProfileIcon type="bell" />
                {unreadCount > 0 ? <span className="student-profile-notice-dot">{unreadCount}</span> : null}
              </button>
              {notificationPanelOpen ? (
                <StudentNotificationPanel
                  notifications={notifications}
                  onNavigateAway={() => setNotificationPanelOpen(false)}
                />
              ) : null}
            </div>
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
              </div>
              <p className="student-profile-email">
                <ProfileIcon type="mail" />
                <span>{user?.email || "alex.sharma@gmail.com"}</span>
              </p>
            </div>
          </div>
        </section>

        <section className="student-profile-premium">
          <div className="student-profile-premium-mark">
            <img src="/crown.png" alt="" className="student-profile-premium-mark-image" aria-hidden="true" />
          </div>
          <div className="student-profile-premium-copy">
            <div className="student-profile-premium-head">
              <div>
                <strong>Kuhedu Study Buddy Premium</strong>
                <p>
                  {user?.isPremium
                    ? "You have full access to all features and premium content"
                    : "Access all features and premium content"}
                </p>
              </div>
            </div>
          </div>
          <div className="student-profile-premium-actions">
            {user?.isPremium ? (
              <>
                <div className="student-profile-premium-trial">Premium Active</div>
                {subscriptionCountdown ? (
                  <div className="student-profile-premium-trial">{subscriptionCountdown}</div>
                ) : null}
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="student-profile-premium-cta"
                  onClick={() => navigate("/pricing")}
                >
                  Subscribe
                </button>
                {subscriptionEndedAgo ? (
                  <div className="student-profile-premium-trial">{subscriptionEndedAgo}</div>
                ) : null}
                {lastAttemptFailed ? (
                  <div className="student-profile-premium-trial is-alert">Attempt failed</div>
                ) : null}
              </>
            )}
          </div>
        </section>

        <section className="student-profile-section">
          <h2>Smart Tutor</h2>
          <div className="student-profile-account-card">
            <AccountToggleRow
              label="Show Avatar"
              description="Display a 3D avatar face during Smart Tutor voice sessions"
              checked={avatarEnabled}
              onChange={setAvatarVisible}
            />
          </div>
        </section>

        <section className="student-profile-section">
          <h2>Appearance</h2>
          <div className="student-profile-account-card">
            <AccountThemeRow theme={user?.theme} onChange={handleThemeChange} />
          </div>
        </section>

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
            <AccountRow label="Logout" onClick={onLogout} tone="danger" />
          </div>
        </section>

        {/* Hidden once the PWA is actually running standalone (installed).
            isStandalone()/getInstallState() in pwaInstall.js/useInstallPrompt.js
            are live checks made fresh on every load -- not a stored flag -- so
            if the student later deletes the home screen icon, platform stops
            reporting "already-installed" on the next visit and this section
            comes back automatically. Shown for BOTH platforms via tabs now
            (not just the visiting device's own platform), including
            "unsupported" (e.g. Android before beforeinstallprompt has fired
            yet) -- previously that case showed nothing at all. */}
        {isMobile && platform !== "already-installed" && (
          <section className="student-profile-premium student-profile-install">
            <div className="student-profile-premium-mark">
              <img src="/icons/icon-192.png" alt="" className="student-profile-premium-mark-image" aria-hidden="true" />
            </div>
            <div className="student-profile-premium-copy">
              <div className="student-profile-premium-head">
                <div>
                  <strong>KUHEDU STUDY BUDDY</strong>
                  <p>Add to your Home Screen for quick access</p>
                </div>
              </div>

            </div>

            <div className="student-profile-install-tabs" role="tablist" aria-label="Install instructions">
              <div className="student-profile-install-download" aria-hidden="true">
                <ProfileIcon type="download" />
              </div>
              <button
                type="button"
                role="tab"
                aria-selected={activeInstallTab === "ios"}
                className={`student-profile-install-tab ${activeInstallTab === "ios" ? "is-active" : ""}`}
                onClick={() => setActiveInstallTab("ios")}
              >
                <ProfileIcon type="apple" className="student-profile-install-tab-icon" />
                iOS
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeInstallTab === "android"}
                className={`student-profile-install-tab ${activeInstallTab === "android" ? "is-active" : ""}`}
                onClick={() => setActiveInstallTab("android")}
              >
                <ProfileIcon
                  type="android"
                  className="student-profile-install-tab-icon student-profile-install-tab-icon-android"
                />
                Android
              </button>
            </div>

            <div className="student-profile-premium-actions" role="tabpanel">
              {activeInstallTab === "android" ? (
                <ol className="student-profile-install-steps">
                  <li>
                    Tap the <strong>&#8942;</strong> menu icon in Chrome (top-right)
                  </li>
                  <li>
                    Tap <strong>&quot;Install app&quot;</strong> (or <strong>&quot;Add to Home screen&quot;</strong>)
                  </li>
                  <li>
                    Tap <strong>&quot;Install&quot;</strong> to confirm
                  </li>
                </ol>
              ) : (
                <ol className="student-profile-install-steps">
                  <li>
                    Tap the <strong>Share</strong> icon in Safari&apos;s toolbar
                  </li>
                  <li>
                    Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong>
                  </li>
                  <li>
                    Tap <strong>&quot;Add&quot;</strong> at the top-right corner
                  </li>
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
