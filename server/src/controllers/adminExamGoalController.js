import {
  createExamGoal,
  deleteExamGoal,
  listExamGoalFormOptions,
  listExamGoals,
  updateExamGoal,
} from "../services/examGoalService.js";

export const getExamGoals = async (_req, res, next) => {
  try {
    const examGoals = await listExamGoals();
    return res.json({ examGoals });
  } catch (error) {
    return next(error);
  }
};

export const getExamGoalOptions = async (_req, res, next) => {
  try {
    const options = await listExamGoalFormOptions();
    return res.json(options);
  } catch (error) {
    return next(error);
  }
};

const parseExamGoalBody = (body) => {
  const goalId = String(body?.goalId || "").trim();
  const name = String(body?.name || "").trim();
  const examTypeId = Number(body?.examTypeId);
  const stateId = Number(body?.stateId);
  const isActive = body?.isActive !== false;

  if (!goalId || !name || !Number.isInteger(examTypeId) || !Number.isInteger(stateId)) {
    return null;
  }

  return { goalId, name, examTypeId, stateId, isActive };
};

export const postExamGoal = async (req, res, next) => {
  try {
    const payload = parseExamGoalBody(req.body);
    if (!payload) {
      return res.status(400).json({ message: "goalId, name, examTypeId, and stateId are required." });
    }

    const examGoal = await createExamGoal(payload);
    return res.status(201).json({ examGoal });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const putExamGoal = async (req, res, next) => {
  try {
    const payload = parseExamGoalBody(req.body);
    if (!payload) {
      return res.status(400).json({ message: "goalId, name, examTypeId, and stateId are required." });
    }

    const examGoal = await updateExamGoal(req.params.examGoalId, payload);
    if (!examGoal) {
      return res.status(404).json({ message: "Exam goal not found." });
    }

    return res.json({ examGoal });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const deleteExamGoalHandler = async (req, res, next) => {
  try {
    const deleted = await deleteExamGoal(req.params.examGoalId);
    if (!deleted) {
      return res.status(404).json({ message: "Exam goal not found." });
    }

    return res.status(204).send();
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};
