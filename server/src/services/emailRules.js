import { createRequire } from "node:module";

// disposable-email-domains is a legacy CJS package whose package.json "main"
// points straight at a .json file -- Node's ESM loader requires an explicit
// `with { type: "json" }` import attribute for that, which this package
// doesn't ship. createRequire sidesteps it entirely (plain CJS require()
// loads a .json file natively, no attribute needed).
const require = createRequire(import.meta.url);
const disposableDomains = require("disposable-email-domains");

// Registration-only (see authController.js's register()) -- Google sign-in
// emails come from Google's own verified profile via OAuth, never a raw
// user-typed string, so they're never checked against this list. There's
// also no email-change flow anywhere in the app, so registration is the
// only place a new email address ever enters the system.
const DISPOSABLE_DOMAINS = new Set(disposableDomains);

const EMAIL_FORMAT_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Returns "" when valid, otherwise the first-failing-rule error message.
export const validateEmail = (email) => {
  const value = String(email ?? "").trim();

  if (!EMAIL_FORMAT_PATTERN.test(value)) {
    return "Please enter a valid email address.";
  }

  const domain = value.split("@").pop().toLowerCase();
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return "Please use a permanent email address -- temporary/disposable email providers aren't allowed.";
  }

  return "";
};
