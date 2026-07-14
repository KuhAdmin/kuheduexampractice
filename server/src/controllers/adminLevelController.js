import { createLevel, deleteLevel, listLevels, updateLevel } from "../services/levelService.js";

export const getLevels = async (_req, res, next) => {
  try {
    const levels = await listLevels();
    return res.json({ levels });
  } catch (error) {
    return next(error);
  }
};

const parseLevelBody = (body) => {
  const nameCode = String(body?.nameCode || "").trim();
  const name = String(body?.name || "").trim();
  const displayOrder = Number.isInteger(Number(body?.displayOrder)) ? Number(body.displayOrder) : 0;

  if (!nameCode || !name) {
    return null;
  }

  return { nameCode, name, displayOrder };
};

export const postLevel = async (req, res, next) => {
  try {
    const payload = parseLevelBody(req.body);
    if (!payload) {
      return res.status(400).json({ message: "nameCode and name are required." });
    }

    const level = await createLevel(payload);
    return res.status(201).json({ level });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const putLevel = async (req, res, next) => {
  try {
    const payload = parseLevelBody(req.body);
    if (!payload) {
      return res.status(400).json({ message: "nameCode and name are required." });
    }

    const level = await updateLevel(req.params.levelId, payload);
    if (!level) {
      return res.status(404).json({ message: "Level not found." });
    }

    return res.json({ level });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const deleteLevelHandler = async (req, res, next) => {
  try {
    const deleted = await deleteLevel(req.params.levelId);
    if (!deleted) {
      return res.status(404).json({ message: "Level not found." });
    }

    return res.status(204).send();
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};
