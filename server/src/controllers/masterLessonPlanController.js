import {
  createMasterLessonPlan,
  deleteMasterLessonPlan,
  getMasterLessonPlanByChapter,
  getMasterLessonPlanDetail,
  listMasterLessonPlans,
  publishMasterLessonPlan,
  updateMasterLessonPlan,
} from "../services/masterLessonPlanService.js";
import {
  getSharedMasterLessonPlanDetail,
  listSharedMasterLessonPlansWithMe,
  shareMasterLessonPlan,
} from "../services/masterLessonPlanShareService.js";
import { generateMasterLessonPlanWithAI } from "../services/masterLessonPlanAiService.js";
import { renderMasterLessonPlanPdf } from "../services/pdfExportService.js";
import { assertTeacherOwnsBatch, resolveChapterId } from "../services/teacherContentContext.js";
import { pool } from "../db/pool.js";

const handleError = (error, res, next) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  return next(error);
};

const batchInfoQuery = async (batchId) => {
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
    [batchId]
  );
  return batchResult.rows[0] || {};
};

export const getMasterPlans = async (req, res, next) => {
  try {
    res.json({ plans: await listMasterLessonPlans({ teacherUserId: req.user.id, batchId: req.query.batchId }) });
  } catch (error) {
    next(error);
  }
};

export const getMasterPlanByChapterHandler = async (req, res, next) => {
  try {
    const { batchId, chapterNumber } = req.query;
    const context = await assertTeacherOwnsBatch(batchId, req.user.id);
    if (!context.isContentConfigured || !chapterNumber) {
      return res.json({ plan: null });
    }
    const mstChapterId = await resolveChapterId({
      chapterNumber,
      examGoalCode: context.examGoalCode,
      levelCode: context.levelCode,
      subjectCode: context.subjectCode,
    });
    const plan = mstChapterId ? await getMasterLessonPlanByChapter({ teacherUserId: req.user.id, batchId, mstChapterId }) : null;
    res.json({ plan });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const postGenerateMasterPlan = async (req, res, next) => {
  try {
    const preview = await generateMasterLessonPlanWithAI({ ...req.body, teacherUserId: req.user.id });
    return res.json(preview);
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const postMasterPlan = async (req, res, next) => {
  try {
    let { mstChapterId, chapterNumber, batchId, ...rest } = req.body;
    if (!mstChapterId && chapterNumber) {
      const context = await assertTeacherOwnsBatch(batchId, req.user.id);
      mstChapterId = await resolveChapterId({
        chapterNumber,
        examGoalCode: context.examGoalCode,
        levelCode: context.levelCode,
        subjectCode: context.subjectCode,
      });
    }
    const plan = await createMasterLessonPlan({ ...rest, batchId, mstChapterId, teacherUserId: req.user.id });
    return res.status(201).json({ plan });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const getMasterPlanDetail = async (req, res, next) => {
  try {
    res.json({ plan: await getMasterLessonPlanDetail(req.params.planId, req.user.id) });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const putMasterPlan = async (req, res, next) => {
  try {
    res.json({ plan: await updateMasterLessonPlan(req.params.planId, req.user.id, req.body) });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const deleteMasterPlanHandler = async (req, res, next) => {
  try {
    const deleted = await deleteMasterLessonPlan(req.params.planId, req.user.id);
    if (!deleted) return res.status(404).json({ message: "Master lesson plan not found." });
    return res.status(204).send();
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const postPublishMasterPlan = async (req, res, next) => {
  try {
    res.json({ plan: await publishMasterLessonPlan(req.params.planId, req.user.id) });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const postShareMasterPlan = async (req, res, next) => {
  try {
    const result = await shareMasterLessonPlan({ planId: req.params.planId, teacherUserId: req.user.id, shareWithUserIds: req.body.shareWithUserIds });
    return res.json(result);
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const getSharedMasterPlansWithMe = async (req, res, next) => {
  try {
    res.json({ shares: await listSharedMasterLessonPlansWithMe(req.user.id) });
  } catch (error) {
    next(error);
  }
};

export const getSharedMasterPlanDetail = async (req, res, next) => {
  try {
    res.json(await getSharedMasterLessonPlanDetail({ shareId: req.params.shareId, teacherUserId: req.user.id }));
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getMasterPlanPdf = async (req, res, next) => {
  try {
    const plan = await getMasterLessonPlanDetail(req.params.planId, req.user.id);
    const batchInfo = await batchInfoQuery(plan.batchId);
    const pdfBuffer = await renderMasterLessonPlanPdf({
      institutionName: batchInfo.institutionName,
      className: batchInfo.className,
      subjectName: batchInfo.subjectName,
      plan,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${plan.chapterLabel.replace(/[^\w-]+/g, "_")}_Master_Lesson_Plan.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    handleError(error, res, next);
  }
};
