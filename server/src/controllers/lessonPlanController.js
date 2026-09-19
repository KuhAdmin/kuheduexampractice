import {
  addLessonPlanEntry,
  createLessonPlan,
  deleteLessonPlan,
  deleteLessonPlanEntry,
  getLessonPlanDetail,
  listLessonPlans,
  publishLessonPlan,
  updateLessonPlan,
  updateLessonPlanEntry,
} from "../services/lessonPlanService.js";
import { renderLessonPlanPdf } from "../services/pdfExportService.js";
import { pool } from "../db/pool.js";

const handleError = (error, res, next) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  return next(error);
};

export const getPlans = async (req, res, next) => {
  try {
    res.json({ plans: await listLessonPlans({ teacherUserId: req.user.id, batchId: req.query.batchId }) });
  } catch (error) {
    next(error);
  }
};

export const postPlan = async (req, res, next) => {
  try {
    const plan = await createLessonPlan({ ...req.body, teacherUserId: req.user.id });
    return res.status(201).json({ plan });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const putPlan = async (req, res, next) => {
  try {
    res.json({ plan: await updateLessonPlan(req.params.planId, req.user.id, req.body) });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const deletePlanHandler = async (req, res, next) => {
  try {
    const deleted = await deleteLessonPlan(req.params.planId, req.user.id);
    if (!deleted) return res.status(404).json({ message: "Lesson plan not found." });
    return res.status(204).send();
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const postPublishPlan = async (req, res, next) => {
  try {
    res.json({ plan: await publishLessonPlan(req.params.planId, req.user.id) });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getPlanDetail = async (req, res, next) => {
  try {
    res.json(await getLessonPlanDetail(req.params.planId, req.user.id));
  } catch (error) {
    handleError(error, res, next);
  }
};

export const postPlanEntry = async (req, res, next) => {
  try {
    const entry = await addLessonPlanEntry(req.params.planId, req.user.id, req.body);
    return res.status(201).json({ entry });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const putPlanEntry = async (req, res, next) => {
  try {
    res.json({ entry: await updateLessonPlanEntry(req.params.planId, req.params.entryId, req.user.id, req.body) });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const deletePlanEntry = async (req, res, next) => {
  try {
    const deleted = await deleteLessonPlanEntry(req.params.planId, req.params.entryId, req.user.id);
    if (!deleted) return res.status(404).json({ message: "Entry not found." });
    return res.status(204).send();
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const getPlanPdf = async (req, res, next) => {
  try {
    const plan = await getLessonPlanDetail(req.params.planId, req.user.id);
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
      [plan.batchId]
    );
    const batchInfo = batchResult.rows[0] || {};
    const pdfBuffer = await renderLessonPlanPdf({
      title: plan.title,
      institutionName: batchInfo.institutionName,
      className: batchInfo.className,
      subjectName: batchInfo.subjectName,
      entries: plan.entries,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${plan.title.replace(/[^\w-]+/g, "_")}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    handleError(error, res, next);
  }
};
