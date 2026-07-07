import { createUserByAdmin, listUsers, updateUserRole } from "../services/userService.js";

export const getUsers = async (_req, res, next) => {
  try {
    const users = await listUsers();
    return res.json({ users });
  } catch (error) {
    return next(error);
  }
};

export const postUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "name, email, password, and role are required." });
    }

    const user = await createUserByAdmin({ name, email, password, role });
    return res.status(201).json({ user });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const putUserRole = async (req, res, next) => {
  try {
    const { role } = req.body || {};
    const user = await updateUserRole(req.params.userId, role);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.json({ user });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};
