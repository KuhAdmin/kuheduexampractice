import { createContext, useContext } from "react";

// Split out of AuthContext.jsx: Vite's react-refresh plugin only preserves
// component state across HMR for files that export components ONLY --
// mixing this hook into the same file as the AuthProvider component meant
// any live edit to AuthContext.jsx (or a cascade from one of its many
// consumers) could leave some already-mounted consumers holding a stale
// module instance of AuthContext, throwing "must be used inside
// AuthProvider" (or, worse, leaving an unrelated context like
// ClassSubjectContext looking stale to its own consumers) despite the
// component tree being structurally correct. See classSubjectHooks.js for
// the same fix applied to ClassSubjectContext -- this mirrors it.
export const AuthContext = createContext(null);

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
};
