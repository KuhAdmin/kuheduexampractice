import { useEffect, useState } from "react";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 15;

const initialForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const PasswordField = ({ name, label, value, onChange }) => {
  const [visible, setVisible] = useState(false);

  return (
    <label>
      {label}
      <div className="password-input-shell">
        <input
          name={name}
          type={visible ? "text" : "password"}
          placeholder={`Use ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters`}
          value={value}
          onChange={onChange}
          minLength={MIN_PASSWORD_LENGTH}
          maxLength={MAX_PASSWORD_LENGTH}
          required
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M3 4.5 19.5 21M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 5.2A10.7 10.7 0 0 1 12 5c5.2 0 9.4 4.2 10 7-.2.9-.8 2.1-1.8 3.3M6.6 6.7C4.5 8.1 3.2 10 2 12c1 2.8 5 7 10 7 1.5 0 2.9-.3 4.2-.8"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.7"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M2 12c1.2-2.8 5.2-7 10-7s8.8 4.2 10 7c-1.2 2.8-5.2 7-10 7S3.2 14.8 2 12Z"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.7"
              />
              <circle
                cx="12"
                cy="12"
                r="3"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.7"
              />
            </svg>
          )}
        </button>
      </div>
    </label>
  );
};

export const ChangePasswordModal = ({ open, onClose, onSave }) => {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(initialForm);
      setError("");
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!form.currentPassword) {
      setError("Current password is required.");
      return;
    }

    if (form.newPassword.length < MIN_PASSWORD_LENGTH || form.newPassword.length > MAX_PASSWORD_LENGTH) {
      setError(`New password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters long.`);
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await onSave({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      onClose();
    } catch (saveError) {
      setError(saveError.message || "Failed to change password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-panel">
        <button className="close-button" onClick={onClose} type="button">
          x
        </button>
        <p className="eyebrow">Security</p>
        <h2>Change Password</h2>

        <form className="auth-form" onSubmit={submit}>
          <PasswordField
            name="currentPassword"
            label="Current password"
            value={form.currentPassword}
            onChange={updateField}
          />
          <PasswordField
            name="newPassword"
            label="New password"
            value={form.newPassword}
            onChange={updateField}
          />
          <PasswordField
            name="confirmPassword"
            label="Confirm new password"
            value={form.confirmPassword}
            onChange={updateField}
          />

          {error && <p className="error-text">{error}</p>}

          <button className="primary-button" disabled={submitting} type="submit">
            {submitting ? "Saving..." : "Change password"}
          </button>
        </form>
      </div>
    </div>
  );
};
