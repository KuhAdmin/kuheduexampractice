import { useEffect, useState, startTransition } from "react";
import { apiRequest } from "../api/client";
import { applyTheme } from "../lib/theme";
import { AuthContext } from "./authHooks";

// This file exports ONLY the AuthProvider component -- see authHooks.js for
// why useAuth/the raw context object live in a separate, non-component file
// (Vite Fast Refresh requirement, not just style).
const storageKeys = {
  token: "kuhedu_token",
  user: "kuhedu_user",
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKeys.user);
      const parsed = stored ? JSON.parse(stored) : null;
      if (parsed?.theme) {
        applyTheme(parsed.theme);
      }
      return parsed;
    } catch (_error) {
      localStorage.removeItem(storageKeys.user);
      localStorage.removeItem(storageKeys.token);
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // Shared by the initial mount fetch below and the two re-validation
  // effects further down -- user (isPremium/premiumExpiresAt in particular)
  // otherwise only ever updates via an explicit persistUser/persistAuth
  // call (login, purchase verify, profile edit, ...), so a tab left open
  // through e.g. a Trial plan's 1-hour window would keep showing "Premium
  // Active" indefinitely with no way to learn the server-side flag flipped.
  // `useTransition` must stay false for the initial-mount call below --
  // that call is what flips `loading` (an urgent, non-transition update)
  // to false and lets StudentLayout/ClassSubjectProvider mount for the
  // first time. Wrapping its setUser in startTransition (as this used to
  // unconditionally do) put that mount's context-providing render on the
  // concurrent/interruptible lane while `loading` flipped on the sync
  // lane, and React's concurrent renderer hit the resulting inconsistency
  // and threw "useClassSubject must be used within a ClassSubjectProvider"
  // (visible as `recoverFromConcurrentError` in the thrown stack) --
  // reproducible specifically on the Google OAuth redirect landing (a
  // fresh mount with loading:true) and not on in-app email login (where
  // loading has already long settled before navigate("/dashboard") runs).
  // The two background revalidation call sites below don't gate any
  // mount, so they keep opting into the transition to avoid jank.
  const fetchAndSetUser = ({ useTransition = false } = {}) => {
    const token = localStorage.getItem(storageKeys.token);
    if (!token) {
      return Promise.resolve(null);
    }

    return apiRequest("/auth/me")
      .then((data) => {
        applyTheme(data.user?.theme);
        const applyUser = () => {
          setUser(data.user);
          localStorage.setItem(storageKeys.user, JSON.stringify(data.user));
        };
        if (useTransition) {
          startTransition(applyUser);
        } else {
          applyUser();
        }
        return data.user;
      })
      .catch(() => {
        localStorage.removeItem(storageKeys.token);
        localStorage.removeItem(storageKeys.user);
        setUser(null);
        return null;
      });
  };

  useEffect(() => {
    fetchAndSetUser().finally(() => setLoading(false));
  }, []);

  // Re-validates whenever this tab regains focus -- catches a trial/
  // subscription that lapsed while it sat in the background, which the
  // initial mount-only fetch above would otherwise never notice.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchAndSetUser({ useTransition: true });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Precisely flips a still-open, still-focused tab's premium badge the
  // moment a time-limited plan (Trial) actually expires, instead of waiting
  // for a refocus/reload to notice. No-op for permanent plans
  // (premiumExpiresAt is null there).
  useEffect(() => {
    if (!user?.premiumExpiresAt) {
      return undefined;
    }
    const msUntilExpiry = new Date(user.premiumExpiresAt).getTime() - Date.now();
    if (msUntilExpiry <= 0) {
      return undefined;
    }
    const timer = window.setTimeout(() => fetchAndSetUser({ useTransition: true }), msUntilExpiry + 500);
    return () => window.clearTimeout(timer);
  }, [user?.premiumExpiresAt]);

  const persistAuth = ({ token, user: nextUser }) => {
    localStorage.setItem(storageKeys.token, token);
    localStorage.setItem(storageKeys.user, JSON.stringify(nextUser));
    applyTheme(nextUser?.theme);
    setUser(nextUser);
  };

  const persistUser = (nextUser) => {
    localStorage.setItem(storageKeys.user, JSON.stringify(nextUser));
    applyTheme(nextUser?.theme);
    setUser(nextUser);
  };

  const register = async (payload) => {
    const data = await apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    persistAuth(data);
    return data;
  };

  const login = async (payload) => {
    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    persistAuth(data);
    return data;
  };

  const logout = async () => {
    await apiRequest("/auth/logout", { method: "POST" }).catch(() => null);
    localStorage.removeItem(storageKeys.token);
    localStorage.removeItem(storageKeys.user);
    setUser(null);
  };

  const completeGoogleLogin = ({ token, user: nextUser }) => {
    persistAuth({ token, user: nextUser });
  };

  const completeOnboarding = async (payload) => {
    const data = await apiRequest("/auth/onboarding/complete", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    persistUser(data.user);
    return data;
  };

  const updateProfile = async (payload) => {
    const data = await apiRequest("/auth/profile", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    persistUser(data.user);
    return data;
  };

  const setTheme = async (theme) => {
    applyTheme(theme);
    try {
      const data = await apiRequest("/auth/theme", {
        method: "PUT",
        body: JSON.stringify({ theme }),
      });
      persistUser(data.user);
      return data;
    } catch (error) {
      applyTheme(user?.theme);
      throw error;
    }
  };

  const changePassword = async (payload) =>
    apiRequest("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(payload),
    });

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        register,
        login,
        logout,
        completeGoogleLogin,
        completeOnboarding,
        updateProfile,
        setTheme,
        changePassword,
        persistUser,
        isAuthenticated: Boolean(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
