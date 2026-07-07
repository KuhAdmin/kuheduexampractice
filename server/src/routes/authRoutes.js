import { Router } from "express";
import passport from "passport";
import { env } from "../config/env.js";
import {
  changePassword,
  completeOnboarding,
  currentUser,
  googleCallbackSuccess,
  login,
  logout,
  register,
  updateProfile,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, currentUser);
router.post("/onboarding/complete", requireAuth, completeOnboarding);
router.put("/profile", requireAuth, updateProfile);
router.post("/change-password", requireAuth, changePassword);
router.post("/logout", logout);

if (env.googleClientId && env.googleClientSecret) {
  router.get("/google", (req, res, next) => {
    const state = req.query.intent === "register" ? "register" : "login";

    return passport.authenticate("google", {
      scope: ["profile", "email"],
      session: true,
      prompt: "select_account",
      state,
    })(req, res, next);
  });

  router.get(
    "/google/callback",
    passport.authenticate("google", {
      failureRedirect: `${env.clientUrl}?error=google_auth_failed`,
      session: true,
    }),
    googleCallbackSuccess
  );
} else {
  router.get("/google", (_req, res) => {
    res.status(503).json({ message: "Google authentication is not configured." });
  });
}

export default router;
