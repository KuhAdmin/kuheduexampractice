// Single source of truth for password strength on the client -- consumed by
// AuthModal.jsx (registration) and ChangePasswordModal.jsx (new password).
// Must stay worded identically to server/src/services/passwordRules.js so
// client and server never disagree about what "valid" means.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 15;

export const PASSWORD_RULE_HINT =
  "8-15 characters, with uppercase, lowercase, a number, and a special character";

// Returns "" when valid, otherwise the first-failing-rule error message.
export const validatePasswordStrength = (password) => {
  const value = String(password ?? "");

  if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) {
    return `Password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters long.`;
  }
  if (!/[A-Z]/.test(value)) {
    return "Password must include at least one uppercase letter.";
  }
  if (!/[a-z]/.test(value)) {
    return "Password must include at least one lowercase letter.";
  }
  if (!/[0-9]/.test(value)) {
    return "Password must include at least one number.";
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    return "Password must include at least one special character.";
  }
  return "";
};
