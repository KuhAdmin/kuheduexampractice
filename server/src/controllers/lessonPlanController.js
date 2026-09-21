import {
  addLessonPlanEntriesBulk,
  addLessonPlanEntry,
  createLessonPlan,
  deleteLessonPlan,
  deleteLessonPlanEntry,
  duplicateLessonPlanEntry,
  getLessonPlanDetail,
  listLessonPlans,
  publishLessonPlan,
  reorderLessonPlanEntries,
  updateLessonPlan,
  updateLessonPlanEntry,
} from "../services/lessonPlanService.js";
import { generateLessonPlanWithAI } from "../services/lessonPlanAiService.js";
import {
  cloneSharedLessonPlan,
  getSharedLessonPlanDetail,
  listMyInstitutionColleagues,
  listSharedWithMe,
  rateSharedLessonPlan,
  shareLessonPlan,
} from "../services/lessonPlanShareService.js";
import { answerLessonPlanQuestion } from "../services/lessonPlanAssistantService.js";
import { listAssistantHistory, recordAssistantHistory } from "../services/lessonPlanAssistantHistoryService.js";
import { getTeacherCurriculumProgress, getTeacherLessonPlanImpactStats } from "../services/lessonPlanDashboardService.js";
import { renderLessonPlanPdf } from "../services/pdfExportService.js";
import { buildLessonPlanWorkbook } from "../services/excelExportService.js";
import { assertTeacherOwnsBatch } from "../services/teacherContentContext.js";
import { getChaptersForClassSubjectSelection } from "../services/studentDashboardService.js";
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

export const postPlanEntryDuplicate = async (req, res, next) => {
  try {
    const entry = await duplicateLessonPlanEntry(req.params.planId, req.params.entryId, req.user.id);
    return res.status(201).json({ entry });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const postPlanEntriesReorder = async (req, res, next) => {
  try {
    const entries = await reorderLessonPlanEntries(req.params.planId, req.user.id, req.body.orderedEntryIds);
    return res.json({ entries });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const postPlanEntriesBulk = async (req, res, next) => {
  try {
    const entries = await addLessonPlanEntriesBulk(req.params.planId, req.user.id, req.body.entries);
    return res.status(201).json({ entries });
  } catch (error) {
    return handleError(error, res, next);
  }
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

export const getPlanPdf = async (req, res, next) => {
  try {
    const plan = await getLessonPlanDetail(req.params.planId, req.user.id);
    const batchInfo = await batchInfoQuery(plan.batchId);
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

export const getPlanExcel = async (req, res, next) => {
  try {
    const plan = await getLessonPlanDetail(req.params.planId, req.user.id);
    const workbookBuffer = await buildLessonPlanWorkbook({ plan, entries: plan.entries });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${plan.title.replace(/[^\w-]+/g, "_")}.xlsx"`);
    res.send(workbookBuffer);
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getPlanFilterOptions = async (req, res, next) => {
  try {
    const context = await assertTeacherOwnsBatch(req.query.batchId, req.user.id);
    if (!context.isContentConfigured) {
      return res.json({ chapters: [], contentConfigured: false });
    }
    const { chapters } = await getChaptersForClassSubjectSelection({
      userId: req.user.id,
      examGoalCode: context.examGoalCode,
      levelCode: context.levelCode,
      subjectCode: context.subjectCode,
    });
    // Lesson planning is inherently sequential (Day 1, Day 2, ...), so this
    // picker sorts strictly by chapter number -- unlike the Dashboard/Chapters
    // list this data is shared with, which orders by display_order (usually
    // but not always identical to chapter number).
    const sortedChapters = [...chapters].sort((a, b) => Number(a.chapterNumber) - Number(b.chapterNumber));
    return res.json({ chapters: sortedChapters, board: context.board, className: context.className, subjectName: context.subjectName, contentConfigured: true });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const postGeneratePlan = async (req, res, next) => {
  try {
    const preview = await generateLessonPlanWithAI({ ...req.body, teacherUserId: req.user.id });
    return res.json(preview);
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const postAssistantQuestion = async (req, res, next) => {
  try {
    const result = await answerLessonPlanQuestion({ ...req.body, teacherUserId: req.user.id });
    return res.json(result);
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const postAssistantHistoryEntry = async (req, res, next) => {
  try {
    const entry = await recordAssistantHistory({ ...req.body, teacherUserId: req.user.id });
    return res.status(201).json({ entry });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const getAssistantHistoryList = async (req, res, next) => {
  try {
    const entries = await listAssistantHistory({ teacherUserId: req.user.id, batchId: req.query.batchId });
    return res.json({ entries });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const getColleagues = async (req, res, next) => {
  try {
    res.json({ colleagues: await listMyInstitutionColleagues(req.user.id) });
  } catch (error) {
    next(error);
  }
};

export const postSharePlan = async (req, res, next) => {
  try {
    const result = await shareLessonPlan({ planId: req.params.planId, teacherUserId: req.user.id, shareWithUserIds: req.body.shareWithUserIds });
    return res.json(result);
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const getSharedWithMePlans = async (req, res, next) => {
  try {
    res.json({ shares: await listSharedWithMe(req.user.id) });
  } catch (error) {
    next(error);
  }
};

export const getSharedPlanDetail = async (req, res, next) => {
  try {
    res.json(await getSharedLessonPlanDetail({ shareId: req.params.shareId, teacherUserId: req.user.id }));
  } catch (error) {
    handleError(error, res, next);
  }
};

export const postCloneSharedPlan = async (req, res, next) => {
  try {
    const planId = await cloneSharedLessonPlan({
      shareId: req.params.shareId,
      teacherUserId: req.user.id,
      targetBatchId: req.body.targetBatchId,
      title: req.body.title,
    });
    return res.status(201).json({ planId });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const postRateSharedPlan = async (req, res, next) => {
  try {
    const result = await rateSharedLessonPlan({ shareId: req.params.shareId, teacherUserId: req.user.id, rating: req.body.rating });
    return res.json(result);
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const getDashboardSummary = async (req, res, next) => {
  try {
    const teacherUserId = req.user.id;
    const [impactStats, curriculumProgress] = await Promise.all([
      getTeacherLessonPlanImpactStats(teacherUserId),
      req.query.batchId ? getTeacherCurriculumProgress({ teacherUserId, batchId: req.query.batchId }) : null,
    ]);
    return res.json({ impactStats, curriculumProgress });
  } catch (error) {
    return handleError(error, res, next);
  }
};
