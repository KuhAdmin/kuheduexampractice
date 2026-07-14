import { createExamType, deleteExamType, listExamTypes, updateExamType } from "../services/examTypeService.js";

export const getExamTypes = async (_req, res, next) => {
  try {
    const examTypes = await listExamTypes();
    return res.json({ examTypes });
  } catch (error) {
    return next(error);
  }
};

export const postExamType = async (req, res, next) => {
  try {
    const typeId = String(req.body?.typeId || "").trim().toUpperCase();
    const name = String(req.body?.name || "").trim();

    if (!typeId || !name) {
      return res.status(400).json({ message: "typeId and name are required." });
    }

    const examType = await createExamType({ typeId, name });
    return res.status(201).json({ examType });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const putExamType = async (req, res, next) => {
  try {
    const typeId = String(req.body?.typeId || "").trim().toUpperCase();
    const name = String(req.body?.name || "").trim();

    if (!typeId || !name) {
      return res.status(400).json({ message: "typeId and name are required." });
    }

    const examType = await updateExamType(req.params.examTypeId, { typeId, name });
    if (!examType) {
      return res.status(404).json({ message: "Exam type not found." });
    }

    return res.json({ examType });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const deleteExamTypeHandler = async (req, res, next) => {
  try {
    const deleted = await deleteExamType(req.params.examTypeId);
    if (!deleted) {
      return res.status(404).json({ message: "Exam type not found." });
    }

    return res.status(204).send();
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};
