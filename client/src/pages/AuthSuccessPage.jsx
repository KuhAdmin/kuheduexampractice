import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const isStudentOnboardingComplete = (user) => {
  if (!user || user.role === "admin") {
    return true;
  }

  return Boolean(user.board && user.studentClass && user.subject);
};

export const AuthSuccessPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { completeGoogleLogin } = useAuth();

  useEffect(() => {
    const token = params.get("token");
    const userParam = params.get("user");

    if (!token || !userParam) {
      navigate("/");
      return;
    }

    try {
      const nextUser = JSON.parse(userParam);
      const intent = params.get("intent");
      completeGoogleLogin({
        token,
        user: nextUser,
      });

      if (nextUser.role === "admin") {
        navigate("/admin");
        return;
      }

      if (intent === "register") {
        navigate("/", {
          replace: true,
          state: { googleOnboarding: true },
        });
        return;
      }

      if (!isStudentOnboardingComplete(nextUser)) {
        navigate("/", {
          replace: true,
          state: { resumeOnboarding: true },
        });
        return;
      }

      navigate("/dashboard");
    } catch (_error) {
      navigate("/");
    }
  }, [completeGoogleLogin, navigate, params]);

  return (
    <main className="auth-success-screen">
      <p>Completing your Google sign-in...</p>
    </main>
  );
};
