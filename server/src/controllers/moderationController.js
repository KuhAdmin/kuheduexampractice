import {
  assignReviewTask,
  getReviewTaskDetail,
  listAllTasksForAdmin,
  listAssignableSections,
  listTasksForModerator,
  submitAdminFinalDecision,
  submitModeratorDecision,
} from "../services/moderationService.js";

export const postTask = async (req, res, next) => {
  try {
    const { sourceSectionId, layerNumber, moderatorUserId, dueAt } = req.body || {};
    if (!sourceSectionId || !layerNumber || !moderatorUserId) {
      return res.status(400).json({ message: "sourceSectionId, layerNumber, and moderatorUserId are required." });
    }

    const result = await assignReviewTask({
      sourceSectionId,
      layerNumber,
      moderatorUserId,
      adminUserId: req.user.id,
      dueAt: dueAt || null,
    });
    return res.status(201).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const getMyTasks = async (req, res, next) => {
  try {
    const tasks = await listTasksForModerator(req.user.id);
    return res.json({ tasks });
  } catch (error) {
    return next(error);
  }
};

export const getAllTasks = async (_req, res, next) => {
  try {
    const tasks = await listAllTasksForAdmin();
    return res.json({ tasks });
  } catch (error) {
    return next(error);
  }
};

export const getAssignableSections = async (req, res, next) => {
  try {
    const { levelCode, subjectCode, chapterKey, layerNumber } = req.query || {};
    const result = await listAssignableSections({ levelCode, subjectCode, chapterKey, layerNumber });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const getTaskDetail = async (req, res, next) => {
  try {
    const task = await getReviewTaskDetail(req.params.reviewQueueId);

    if (!task) {
      return res.status(404).json({ message: "Task not found." });
    }

    if (req.user.role === "moderator" && String(task.assignedTo) !== String(req.user.id)) {
      return res.status(403).json({ message: "This task is not assigned to you." });
    }

    return res.json(task);
  } catch (error) {
    return next(error);
  }
};

export const postModeratorDecision = async (req, res, next) => {
  try {
    const { decision, notes } = req.body || {};
    const result = await submitModeratorDecision({
      reviewQueueId: req.params.reviewQueueId,
      moderatorUserId: req.user.id,
      decision,
      notes,
    });

    if (!result) {
      return res.status(404).json({ message: "Task not found or not assigned to you." });
    }

    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const postAdminDecision = async (req, res, next) => {
  try {
    const { decision, notes } = req.body || {};
    const result = await submitAdminFinalDecision({
      reviewQueueId: req.params.reviewQueueId,
      adminUserId: req.user.id,
      decision,
      notes,
    });

    if (!result) {
      return res.status(404).json({ message: "Task not found." });
    }

    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};
