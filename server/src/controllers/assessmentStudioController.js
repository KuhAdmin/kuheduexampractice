import {
  abortAssessmentStudioPipeline,
  deleteAssessmentStudioPipelineRun,
  getAssessmentStudioPipelineConcurrency,
  getAssessmentStudioPipelineNavigator,
  getAssessmentStudioPipelineStatus,
  getAssessmentStudioPipelineStatusBatch,
  listAssessmentStudioLayerVersions,
  listCompletedAssessmentStudioRuns,
  rerunAssessmentStudioPipelineLayer,
  selectAssessmentStudioLayerVersion,
  startAssessmentStudioPipeline,
} from "../services/assessmentStudioService.js";
import {
  exportAssessmentStudioAuditText,
  getAssessmentStudioAuditSnapshot,
} from "../services/assessmentStudioAuditService.js";
import { initializeDatabase } from "../db/bootstrap.js";
import {
  generateAllMemoryHookImages,
  generateMemoryHookImage,
  getMemoryHookMedia,
  uploadMemoryHookMedia,
} from "../services/memoryHookImageService.js";
import {
  extractChapterExerciseQuestions,
  listPendingChapterExerciseQuestions,
  reviewChapterExerciseQuestion,
} from "../services/chapterExerciseService.js";

export const runAssessmentStudioPipeline = async (req, res, next) => {
  try {
    const result = await startAssessmentStudioPipeline({
      payload: req.body,
      userId: req.user?.id || null,
    });

    return res.status(202).json(result);
  } catch (error) {
    return next(error);
  }
};

export const getAssessmentStudioRunStatus = async (req, res, next) => {
  try {
    const result = await getAssessmentStudioPipelineStatus(req.params.jobId);

    if (!result) {
      return res.status(404).json({ message: "Pipeline run not found." });
    }

    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const getAssessmentStudioRunStatusBatch = async (req, res, next) => {
  try {
    const jobIds = String(req.query.jobIds || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const result = await getAssessmentStudioPipelineStatusBatch(jobIds);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const getAssessmentStudioConcurrency = (_req, res) => {
  return res.json(getAssessmentStudioPipelineConcurrency());
};

export const getAssessmentStudioRunNavigator = async (req, res, next) => {
  try {
    const result = await getAssessmentStudioPipelineNavigator(
      req.query.jobId ? String(req.query.jobId) : null
    );

    if (!result) {
      return res.status(404).json({ message: "No pipeline runs found." });
    }

    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const abortAssessmentStudioRun = (req, res) => {
  const result = abortAssessmentStudioPipeline(req.params.jobId);

  if (!result) {
    return res.status(404).json({ message: "Pipeline run not found." });
  }

  return res.json(result);
};

export const getAssessmentStudioRunAudit = async (req, res, next) => {
  try {
    const result = await exportAssessmentStudioAuditText(req.params.jobId);

    if (!result) {
      return res.status(404).json({ message: "Pipeline audit log not found." });
    }

    return res.json({
      ...result.snapshot,
      fileName: result.fileName,
      filePath: result.filePath,
      text: result.text,
    });
  } catch (error) {
    return next(error);
  }
};

export const getAssessmentStudioCompletedRuns = async (_req, res, next) => {
  try {
    const result = await listCompletedAssessmentStudioRuns();
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const deleteAssessmentStudioRun = async (req, res, next) => {
  try {
    const result = await deleteAssessmentStudioPipelineRun(req.params.jobId);

    if (!result) {
      return res.status(404).json({ message: "Pipeline run not found." });
    }

    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const rerunAssessmentStudioLayer = async (req, res, next) => {
  try {
    const result = await rerunAssessmentStudioPipelineLayer({
      jobId: req.params.jobId,
      layerNumber: Number(req.params.layerNumber),
      userId: req.user?.id || null,
      modelId: req.body?.modelId || null,
    });

    if (!result) {
      return res.status(404).json({ message: "Pipeline run not found." });
    }

    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const getAssessmentStudioLayerVersions = async (req, res, next) => {
  try {
    const result = await listAssessmentStudioLayerVersions({
      jobId: req.params.jobId,
      layerNumber: Number(req.params.layerNumber),
    });

    if (!result) {
      return res.status(404).json({ message: "Pipeline run not found." });
    }

    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const selectAssessmentStudioLayerVersionHandler = async (req, res, next) => {
  try {
    const result = await selectAssessmentStudioLayerVersion({
      assessmentUnitId: req.params.assessmentUnitId,
      layerNumber: Number(req.params.layerNumber),
      generationId: req.params.generationId,
    });

    if (!result) {
      return res.status(404).json({ message: "Version not found for this assessment unit and layer." });
    }

    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const getMemoryHookMediaHandler = async (req, res, next) => {
  try {
    const result = await getMemoryHookMedia(req.params.assessmentUnitId);
    return res.json({ assessmentUnitId: req.params.assessmentUnitId, media: result });
  } catch (error) {
    return next(error);
  }
};

export const uploadMemoryHookMediaHandler = async (req, res, next) => {
  try {
    const result = await uploadMemoryHookMedia({
      assessmentUnitId: req.params.assessmentUnitId,
      sectionKey: req.params.sectionKey,
      dataUrl: req.body?.dataUrl,
      fileName: req.body?.fileName || null,
      userId: req.user?.id || null,
    });
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const generateMemoryHookImageHandler = async (req, res, next) => {
  try {
    const result = await generateMemoryHookImage({
      assessmentUnitId: req.params.assessmentUnitId,
      sectionKey: req.params.sectionKey,
      userId: req.user?.id || null,
      modelId: req.body?.modelId || null,
    });
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const generateAllMemoryHookImagesHandler = async (req, res, next) => {
  try {
    const result = await generateAllMemoryHookImages({
      assessmentUnitId: req.params.assessmentUnitId,
      userId: req.user?.id || null,
      modelId: req.body?.modelId || null,
    });
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const initializeAssessmentStudioDatabase = async (req, res, next) => {
  try {
    const reset = req.body?.reset === true && req.body?.confirm === "RESET";

    await initializeDatabase({ reset });

    return res.json({
      ok: true,
      reset,
      message: reset
        ? "Database schema was reset and re-initialized (persisted pipeline data was dropped and recreated)."
        : "Database schema was initialized (missing tables, seeds, and views were created; existing data preserved).",
    });
  } catch (error) {
    return next(error);
  }
};

export const downloadAssessmentStudioRunAudit = async (req, res, next) => {
  try {
    const result = await exportAssessmentStudioAuditText(req.params.jobId);

    if (!result) {
      return res.status(404).json({ message: "Pipeline audit log not found." });
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${result.fileName}"`
    );

    return res.send(result.text);
  } catch (error) {
    return next(error);
  }
};

export const uploadChapterExerciseHandler = async (req, res, next) => {
  try {
    const result = await extractChapterExerciseQuestions({
      fkMstBookId: req.params.bookId,
      chapterNumber: req.params.chapterNumber,
      chapterName: req.body?.chapterName || null,
      imageDataUrl: req.body?.dataUrl,
      mimeType: req.body?.mimeType,
      pipelineJobId: req.body?.pipelineJobId || null,
      userId: req.user?.id || null,
    });
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const getPendingChapterExerciseQuestionsHandler = async (req, res, next) => {
  try {
    const result = await listPendingChapterExerciseQuestions({
      fkMstBookId: req.params.bookId,
      chapterNumber: req.params.chapterNumber,
    });
    return res.json({ questions: result });
  } catch (error) {
    return next(error);
  }
};

export const reviewChapterExerciseQuestionHandler = async (req, res, next) => {
  try {
    const result = await reviewChapterExerciseQuestion({
      questionId: req.params.questionId,
      decision: req.body?.decision,
      reviewerId: req.user?.id || null,
    });
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};
