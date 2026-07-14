import { createSubject, deleteSubject, listSubjects, updateSubject } from "../services/subjectService.js";

export const getSubjects = async (_req, res, next) => {
  try {
    const subjects = await listSubjects();
    return res.json({ subjects });
  } catch (error) {
    return next(error);
  }
};

const parseSubjectBody = (body) => {
  const nameCode = String(body?.nameCode || "").trim();
  const name = String(body?.name || "").trim();
  const displayOrder = Number.isInteger(Number(body?.displayOrder)) ? Number(body.displayOrder) : 0;
  const isActive = body?.isActive !== false;

  if (!nameCode || !name) {
    return null;
  }

  return { nameCode, name, displayOrder, isActive };
};

export const postSubject = async (req, res, next) => {
  try {
    const payload = parseSubjectBody(req.body);
    if (!payload) {
      return res.status(400).json({ message: "nameCode and name are required." });
    }

    const subject = await createSubject(payload);
    return res.status(201).json({ subject });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const putSubject = async (req, res, next) => {
  try {
    const payload = parseSubjectBody(req.body);
    if (!payload) {
      return res.status(400).json({ message: "nameCode and name are required." });
    }

    const subject = await updateSubject(req.params.subjectId, payload);
    if (!subject) {
      return res.status(404).json({ message: "Subject not found." });
    }

    return res.json({ subject });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const deleteSubjectHandler = async (req, res, next) => {
  try {
    const deleted = await deleteSubject(req.params.subjectId);
    if (!deleted) {
      return res.status(404).json({ message: "Subject not found." });
    }

    return res.status(204).send();
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};
