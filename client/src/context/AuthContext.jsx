import {
  createContext,
  useContext,
  useEffect,
  useState,
  startTransition,
} from "react";
import { apiRequest } from "../api/client";
import { applyTheme } from "../lib/theme";

const AuthContext = createContext(null);

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
  const fetchAndSetUser = () => {
    const token = localStorage.getItem(storageKeys.token);
    if (!token) {
      return Promise.resolve(null);
    }

    return apiRequest("/auth/me")
      .then((data) => {
        applyTheme(data.user?.theme);
        startTransition(() => {
          setUser(data.user);
          localStorage.setItem(storageKeys.user, JSON.stringify(data.user));
        });
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
        fetchAndSetUser();
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
    const timer = window.setTimeout(fetchAndSetUser, msUntilExpiry + 500);
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

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
};
