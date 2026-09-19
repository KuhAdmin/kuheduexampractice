import {
  getBatchRosterForTeacher,
  getTeacherHomeSummary,
  listBatchesForTeacher,
  regenerateJoinCodeForTeacher,
  removeStudentFromBatchForTeacher,
} from "../services/batchService.js";
import {
  getBatchActivityFeed,
  getBatchInsightSummariesForTeacher,
  getBatchLearningInsights,
  getStudentInsight,
} from "../services/studentInsightService.js";
import { countPendingGradingForTeacher } from "../services/gradebookService.js";

const handleError = (error, res, next) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  return next(error);
};

const mergeInsightSummaries = (batches, summaries) =>
  batches.map((batch) => ({
    ...batch,
    overallProgress: summaries[batch.id]?.overallProgress ?? 0,
    studentsNeedingSupport: summaries[batch.id]?.studentsNeedingSupport ?? 0,
  }));

export const getTeacherHome = async (req, res, next) => {
  try {
    const [summary, insightSummaries, pendingGradingCount] = await Promise.all([
      getTeacherHomeSummary(req.user.id),
      getBatchInsightSummariesForTeacher(req.user.id),
      countPendingGradingForTeacher(req.user.id),
    ]);
    const batches = mergeInsightSummaries(summary.batches, insightSummaries);
    const needsSupportCount = batches.reduce((sum, batch) => sum + batch.studentsNeedingSupport, 0);
    res.json({ ...summary, batches, needsSupportCount, pendingGradingCount });
  } catch (error) {
    next(error);
  }
};

export const getTeacherBatches = async (req, res, next) => {
  try {
    const [batches, insightSummaries] = await Promise.all([
      listBatchesForTeacher(req.user.id),
      getBatchInsightSummariesForTeacher(req.user.id),
    ]);
    res.json({ batches: mergeInsightSummaries(batches, insightSummaries) });
  } catch (error) {
    next(error);
  }
};

export const getTeacherBatchStudents = async (req, res, next) => {
  try {
    const students = await getBatchRosterForTeacher(req.params.batchId, req.user.id);
    return res.json({ students });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const removeTeacherBatchStudent = async (req, res, next) => {
  try {
    await removeStudentFromBatchForTeacher(req.params.batchId, req.params.userId, req.user.id);
    return res.status(204).send();
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const regenerateTeacherBatchCode = async (req, res, next) => {
  try {
    const batch = await regenerateJoinCodeForTeacher(req.params.batchId, req.user.id);
    return res.json({ batch });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const getBatchInsights = async (req, res, next) => {
  try {
    res.json(await getBatchLearningInsights({ batchId: req.params.batchId, teacherUserId: req.user.id }));
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getBatchActivity = async (req, res, next) => {
  try {
    res.json({ activity: await getBatchActivityFeed({ batchId: req.params.batchId, teacherUserId: req.user.id }) });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getStudentInsightHandler = async (req, res, next) => {
  try {
    res.json(
      await getStudentInsight({
        batchId: req.params.batchId,
        studentUserId: req.params.userId,
        teacherUserId: req.user.id,
      })
    );
  } catch (error) {
    handleError(error, res, next);
  }
};
