import {
  authorCustomQuestion,
  finalizeTeacherTestPaper,
  generateTeacherTestPaper,
  getTeacherTestFilterOptions,
  getTeacherTestPaper,
  listMyCustomQuestions,
  listTeacherTestPapers,
  removeTeacherTestPaperItem,
  setTeacherTestPaperAssignment,
  swapTeacherTestPaperItem,
  updateTeacherTestPaperItemMarks,
} from "../services/teacherTestService.js";
import { buildTestPaperWorkbook } from "../services/excelExportService.js";
import { renderTestPaperPdf } from "../services/pdfExportService.js";
import { pool } from "../db/pool.js";

const handleError = (error, res, next) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  return next(error);
};

export const getFilterOptions = async (req, res, next) => {
  try {
    res.json(await getTeacherTestFilterOptions({ batchId: req.query.batchId, teacherUserId: req.user.id }));
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getPapers = async (req, res, next) => {
  try {
    res.json({ papers: await listTeacherTestPapers(req.user.id) });
  } catch (error) {
    next(error);
  }
};

export const getPaper = async (req, res, next) => {
  try {
    res.json(await getTeacherTestPaper(req.params.paperId, req.user.id));
  } catch (error) {
    handleError(error, res, next);
  }
};

export const postPaper = async (req, res, next) => {
  try {
    const paper = await generateTeacherTestPaper({ ...req.body, teacherUserId: req.user.id });
    return res.status(201).json(paper);
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const deletePaperItem = async (req, res, next) => {
  try {
    res.json(await removeTeacherTestPaperItem(req.params.paperId, req.params.itemId, req.user.id));
  } catch (error) {
    handleError(error, res, next);
  }
};

export const postSwapPaperItem = async (req, res, next) => {
  try {
    res.json(await swapTeacherTestPaperItem(req.params.paperId, req.params.itemId, req.user.id));
  } catch (error) {
    handleError(error, res, next);
  }
};

export const putPaperItemMarks = async (req, res, next) => {
  try {
    res.json(await updateTeacherTestPaperItemMarks(req.params.paperId, req.params.itemId, req.body.marks, req.user.id));
  } catch (error) {
    handleError(error, res, next);
  }
};

export const putPaperAssignment = async (req, res, next) => {
  try {
    res.json(await setTeacherTestPaperAssignment(req.params.paperId, req.user.id, req.body));
  } catch (error) {
    handleError(error, res, next);
  }
};

export const postFinalizePaper = async (req, res, next) => {
  try {
    res.json(await finalizeTeacherTestPaper(req.params.paperId, req.user.id));
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getPaperPdf = async (req, res, next) => {
  try {
    const paper = await getTeacherTestPaper(req.params.paperId, req.user.id);
    const batchResult = await pool.query(
      `
        SELECT inst.name AS "institutionName", lvl.name AS "className", subj.name AS "subjectName"
        FROM batches b
        JOIN teacher_class_assignment ta ON ta.id = b.fk_teacher_class_assignment_id
        JOIN institution_teacher it ON it.id = ta.fk_institution_teacher_id
        JOIN institutions inst ON inst.id = it.fk_institution_id
        JOIN institution_section sec ON sec.id = ta.fk_institution_section_id
        JOIN institution_class ic ON ic.id = sec.fk_institution_class_id
        JOIN mst_level lvl ON lvl.id = ic.fk_mst_level_id
        JOIN mst_subject subj ON subj.id = ta.fk_mst_subject_id
        WHERE b.id = $1
      `,
      [paper.batchId]
    );
    const batchInfo = batchResult.rows[0] || {};
    const pdfBuffer = await renderTestPaperPdf({
      title: paper.title,
      institutionName: batchInfo.institutionName,
      className: batchInfo.className,
      subjectName: batchInfo.subjectName,
      totalMarks: paper.totalMarks,
      items: paper.items,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${paper.title.replace(/[^\w-]+/g, "_")}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getPaperExcel = async (req, res, next) => {
  try {
    const paper = await getTeacherTestPaper(req.params.paperId, req.user.id);
    const buffer = await buildTestPaperWorkbook(paper);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${paper.title.replace(/[^\w-]+/g, "_")}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    handleError(error, res, next);
  }
};

export const postCustomQuestion = async (req, res, next) => {
  try {
    const question = await authorCustomQuestion({ ...req.body, teacherUserId: req.user.id });
    return res.status(201).json({ question });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const getMyCustomQuestions = async (req, res, next) => {
  try {
    res.json({ questions: await listMyCustomQuestions(req.user.id) });
  } catch (error) {
    next(error);
  }
};
