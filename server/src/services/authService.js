import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import {
  createGoogleUser,
  createLocalUser,
  findUserByEmail,
  findUserByGoogleId,
  findUserById,
  linkGoogleAccount,
  toPublicUser,
  updateUserPassword,
} from "./userService.js";

const signToken = (user) =>
  jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      role: user.role,
    },
    env.jwtSecret,
    { expiresIn: "7d" }
  );

export const registerWithEmail = async ({ name, email, password }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await findUserByEmail(normalizedEmail);

  if (existing) {
    throw new Error("An account with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createLocalUser({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
  });

  return {
    token: signToken(user),
    user,
  };
};

export const loginWithEmail = async ({ email, password }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await findUserByEmail(normalizedEmail);

  if (!user?.password_hash) {
    throw new Error("Invalid email or password.");
  }

  const matches = await bcrypt.compare(password, user.password_hash);

  if (!matches) {
    throw new Error("Invalid email or password.");
  }

  const publicUser = toPublicUser(user);

  return {
    token: signToken(publicUser),
    user: publicUser,
  };
};

export const upsertGoogleUser = async (profile) => {
  const googleId = profile.id;
  const email = profile.emails?.[0]?.value?.toLowerCase();
  const avatarUrl = profile.photos?.[0]?.value || null;
  const name = profile.displayName || "Google User";

  if (!email) {
    throw new Error("Google account did not provide an email address.");
  }

  const byGoogleId = await findUserByGoogleId(googleId);
  if (byGoogleId) {
    return toPublicUser(byGoogleId);
  }

  const byEmail = await findUserByEmail(email);
  if (byEmail) {
    return linkGoogleAccount({
      id: byEmail.id,
      googleId,
      avatarUrl,
      name,
    });
  }

  return createGoogleUser({
    name,
    email,
    googleId,
    avatarUrl,
  });
};

export const createAuthPayload = (user) => ({
  token: signToken(user),
  user,
});

export const changeUserPassword = async ({ id, currentPassword, newPassword }) => {
  const user = await findUserById(id);

  if (!user?.password_hash) {
    throw new Error("This account signs in with Google and has no password to change.");
  }

  const matches = await bcrypt.compare(currentPassword, user.password_hash);
  if (!matches) {
    throw new Error("Current password is incorrect.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await updateUserPassword({ id, passwordHash });
};
