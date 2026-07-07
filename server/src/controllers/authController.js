import {
  changeUserPassword,
  createAuthPayload,
  loginWithEmail,
  registerWithEmail,
} from "../services/authService.js";
import { updateUserOnboarding, updateUserProfile } from "../services/userService.js";
import { env } from "../config/env.js";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const trimmedName = String(name || "").trim();

    if (!trimmedName || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required." });
    }

    if (trimmedName.length < 2) {
      return res.status(400).json({ message: "Name must be at least 2 characters long." });
    }

    if (trimmedName.length > 80) {
      return res.status(400).json({ message: "Name must be 80 characters or fewer." });
    }

    if (password.length < 8 || password.length > 15) {
      return res
        .status(400)
        .json({ message: "Password must be 8-15 characters long." });
    }

    const payload = await registerWithEmail({ name: trimmedName, email, password });
    return res.status(201).json(payload);
  } catch (error) {
    if (error.message.includes("already exists")) {
      return res.status(409).json({ message: error.message });
    }

    return next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    const payload = await loginWithEmail({ email, password });
    return res.json(payload);
  } catch (error) {
    if (error.message.includes("Invalid email or password")) {
      return res.status(401).json({ message: error.message });
    }

    return next(error);
  }
};

export const currentUser = async (req, res) => {
  return res.json({ user: req.user });
};

export const logout = async (_req, res) => {
  return res.status(204).send();
};

export const completeOnboarding = async (req, res, next) => {
  try {
    const board = String(req.body?.board || "").trim();
    const studentClass = String(req.body?.studentClass || "").trim();
    const subject = String(req.body?.subject || "").trim();

    if (!board || !studentClass || !subject) {
      return res.status(400).json({
        message: "Board, class, and subject are required.",
      });
    }

    const user = await updateUserOnboarding({
      id: req.user.id,
      board,
      studentClass,
      subject,
    });

    return res.json({ user });
  } catch (error) {
    return next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const trimmedName = String(req.body?.name || "").trim();
    const avatarDataUrl = req.body?.avatarDataUrl || null;

    if (trimmedName.length < 2) {
      return res.status(400).json({ message: "Name must be at least 2 characters long." });
    }

    if (trimmedName.length > 80) {
      return res.status(400).json({ message: "Name must be 80 characters or fewer." });
    }

    if (avatarDataUrl) {
      if (!String(avatarDataUrl).startsWith("data:image/")) {
        return res.status(400).json({ message: "A valid image is required." });
      }

      const approxBytes = Math.ceil((avatarDataUrl.length * 3) / 4);
      if (approxBytes > MAX_IMAGE_BYTES) {
        return res.status(400).json({
          message: "Image is too large. Please upload a smaller or more compressed photo.",
        });
      }
    }

    const user = await updateUserProfile({
      id: req.user.id,
      name: trimmedName,
      avatarUrl: avatarDataUrl,
    });

    return res.json({ user });
  } catch (error) {
    return next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({ message: "Current password is required." });
    }

    if (!newPassword || newPassword.length < 8 || newPassword.length > 15) {
      return res.status(400).json({ message: "New password must be 8-15 characters long." });
    }

    await changeUserPassword({ id: req.user.id, currentPassword, newPassword });

    return res.json({ ok: true });
  } catch (error) {
    if (error.message.includes("incorrect")) {
      return res.status(401).json({ message: error.message });
    }

    if (error.message.includes("Google")) {
      return res.status(400).json({ message: error.message });
    }

    return next(error);
  }
};

export const googleCallbackSuccess = async (req, res) => {
  const { token, user } = createAuthPayload(req.user);
  const intent = req.query.state === "register" ? "register" : "login";
  const search = new URLSearchParams({
    token,
    user: JSON.stringify(user),
    intent,
  });

  return res.redirect(`${env.clientUrl}/auth/success?${search.toString()}`);
};
