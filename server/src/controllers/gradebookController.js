import {
  bulkSaveGradebookMarks,
  createGradebookExam,
  getGradebookExam,
  listGradebookExams,
  suggestAiGrade,
} from "../services/gradebookService.js";
import { buildGradebookWorkbook } from "../services/excelExportService.js";

const handleError = (error, res, next) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  return next(error);
};

export const getExams = async (req, res, next) => {
  try {
    res.json({ exams: await listGradebookExams({ teacherUserId: req.user.id, batchId: req.query.batchId }) });
  } catch (error) {
    next(error);
  }
};

export const postExam = async (req, res, next) => {
  try {
    const exam = await createGradebookExam({ ...req.body, teacherUserId: req.user.id });
    return res.status(201).json(exam);
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const getExam = async (req, res, next) => {
  try {
    res.json(await getGradebookExam(req.params.examId, req.user.id));
  } catch (error) {
    handleError(error, res, next);
  }
};

export const putExamMarks = async (req, res, next) => {
  try {
    const exam = await bulkSaveGradebookMarks(req.params.examId, req.user.id, req.body?.marks, req.user.id);
    res.json(exam);
  } catch (error) {
    handleError(error, res, next);
  }
};

export const postAiAssist = async (req, res, next) => {
  try {
    const suggestion = await suggestAiGrade({
      examId: req.params.examId,
      questionId: req.params.questionId,
      userId: req.params.userId,
      teacherUserId: req.user.id,
      studentAnswerText: req.body?.studentAnswerText,
    });
    res.json(suggestion);
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getExamExcel = async (req, res, next) => {
  try {
    const exam = await getGradebookExam(req.params.examId, req.user.id);
    const buffer = buildGradebookWorkbook(exam);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${exam.title.replace(/[^\w-]+/g, "_")}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    handleError(error, res, next);
  }
};
