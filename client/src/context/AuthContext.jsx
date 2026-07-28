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

  useEffect(() => {
    const token = localStorage.getItem(storageKeys.token);

    if (!token) {
      setLoading(false);
      return;
    }

    apiRequest("/auth/me")
      .then((data) => {
        applyTheme(data.user?.theme);
        startTransition(() => {
          setUser(data.user);
          localStorage.setItem(storageKeys.user, JSON.stringify(data.user));
        });
      })
      .catch(() => {
        localStorage.removeItem(storageKeys.token);
        localStorage.removeItem(storageKeys.user);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

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
