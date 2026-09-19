import { useState } from "react";
import { EditProfileModal } from "../components/EditProfileModal";
import { ChangePasswordModal } from "../components/ChangePasswordModal";
import { useAuth } from "../context/authHooks";

const avatarLetters = (name) =>
  String(name || "TR")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

export const TeacherProfilePage = ({ user, onLogout }) => {
  const { updateProfile, changePassword } = useAuth();
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const canChangePassword = user?.provider !== "google";

  return (
    <section className="admin-bulk-pipeline-page">
      <header className="admin-bulk-pipeline-header">
        <div>
          <span className="eyebrow">Teacher module</span>
          <h1>Profile</h1>
        </div>
      </header>

      <div className="admin-panel">
        <div className="student-profile-summary">
          <div className="student-profile-avatar-wrap">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user?.name || "Teacher avatar"} className="student-profile-avatar" />
            ) : (
              <div className="student-profile-avatar student-profile-avatar-fallback">
                {avatarLetters(user?.name)}
              </div>
            )}
          </div>
          <div className="student-profile-summary-copy">
            <div className="student-profile-summary-head">
              <strong>{user?.name || "Teacher"}</strong>
            </div>
            <p className="student-profile-email">
              <span>{user?.email}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <h2>Account</h2>
        </div>
        <div className="student-profile-account-card">
          <button type="button" className="student-profile-account-row" onClick={() => setEditProfileOpen(true)}>
            <span>Edit Profile</span>
          </button>
          <button
            type="button"
            className={`student-profile-account-row ${!canChangePassword ? "is-disabled" : ""}`}
            onClick={() => setChangePasswordOpen(true)}
            disabled={!canChangePassword}
            title={!canChangePassword ? "Not available for Google sign-in" : undefined}
          >
            <span>Change Password</span>
          </button>
          <button type="button" className="student-profile-account-row is-danger" onClick={onLogout}>
            <span>Logout</span>
          </button>
        </div>
      </div>

      <EditProfileModal open={editProfileOpen} onClose={() => setEditProfileOpen(false)} user={user} onSave={updateProfile} />
      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        onSave={changePassword}
      />
    </section>
  );
};
