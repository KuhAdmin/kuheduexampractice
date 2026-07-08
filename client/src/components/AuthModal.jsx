import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const initialForm = {
  name: "",
  email: "",
  password: "",
};
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 80;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 15;

const validateRegisterForm = (form) => {
  const trimmedName = form.name.trim();

  if (trimmedName.length < MIN_NAME_LENGTH) {
    return `Full name must be at least ${MIN_NAME_LENGTH} characters long.`;
  }

  if (trimmedName.length > MAX_NAME_LENGTH) {
    return `Full name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  }

  if (form.password.length < MIN_PASSWORD_LENGTH || form.password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters long.`;
  }

  return "";
};

const PasswordField = ({ value, onChange }) => {
  const [visible, setVisible] = useState(false);

  return (
    <label>
      Password
      <div className="password-input-shell">
        <input
          name="password"
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

export const AuthModal = ({ open, onClose, onLogin, onRegister }) => {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const updateField = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (mode === "login") {
        await onLogin({
          email: form.email,
          password: form.password,
        });
      } else {
        const validationError = validateRegisterForm(form);
        if (validationError) {
          throw new Error(validationError);
        }

        await onRegister(form);
      }

      setForm(initialForm);
      onClose();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  };

 const openGoogle = () => {
  window.location.href = "/api/auth/google";
};

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="modal-panel"
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.98, opacity: 0 }}
          >
            <button className="close-button" onClick={onClose}>
              x
            </button>
            <p className="eyebrow" id="auth">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </p>
            <h2>
              {mode === "login"
                ? "Sign in to continue practice"
                : "Start your KUHEDU journey"}
            </h2>
            <form className="auth-form" onSubmit={submit}>
              {mode === "register" ? (
                <label>
                  Full name
                  <input
                    name="name"
                    placeholder="Aarav Sharma"
                    value={form.name}
                    minLength={MIN_NAME_LENGTH}
                    maxLength={MAX_NAME_LENGTH}
                    onChange={updateField}
                    required
                  />
                </label>
              ) : null}
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  placeholder="student@example.com"
                  value={form.email}
                  onChange={updateField}
                  required
                />
              </label>
              <PasswordField value={form.password} onChange={updateField} />
              {error ? <p className="error-text">{error}</p> : null}
              <button className="primary-button" disabled={submitting} type="submit">
                {submitting
                  ? "Please wait..."
                  : mode === "login"
                    ? "Sign in"
                    : "Create account"}
              </button>
            </form>
            <button className="google-button" onClick={openGoogle} type="button">
              Continue with Google
            </button>
            <p className="mode-switch">
              {mode === "login" ? "New here?" : "Already have an account?"}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setError("");
                }}
              >
                {mode === "login" ? "Create an account" : "Sign in instead"}
              </button>
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
