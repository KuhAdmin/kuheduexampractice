import {
  createUserByAdmin,
  listUsers,
  updateUserRole,
  setSuperstudentAccess,
  resetUserPassword,
} from "../services/userService.js";

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
    const { name, email, password, role, remarks, scopeType, scopeClasses, scopeSubjects } = req.body || {};
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "name, email, password, and role are required." });
    }

    const user = await createUserByAdmin({
      name,
      email,
      password,
      role,
      remarks,
      grantedByUserId: req.user.id,
      scopeType,
      scopeClasses,
      scopeSubjects,
    });
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

export const putUserPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body || {};
    const result = await resetUserPassword(req.params.userId, newPassword);

    if (!result) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.json({ message: "Password updated." });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const putSuperstudentAccess = async (req, res, next) => {
  try {
    const { isEnabled, remarks } = req.body || {};
    const user = await setSuperstudentAccess(req.params.userId, {
      isEnabled,
      remarks,
      updatedByUserId: req.user.id,
    });

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
