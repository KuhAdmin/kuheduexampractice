import {
  deleteDemoSubmission,
  getDemoSubmission,
  listDemoSubmissions,
  submitDemoAssessment,
} from "../services/adminDemoService.js";

export const getDemoSubmissions = async (_req, res, next) => {
  try {
    const submissions = await listDemoSubmissions();
    return res.json({ submissions });
  } catch (error) {
    return next(error);
  }
};

export const getDemoSubmissionById = async (req, res, next) => {
  try {
    const submission = await getDemoSubmission(req.params.submissionId);
    if (!submission) {
      return res.status(404).json({ message: "Demo submission not found." });
    }
    return res.json({ submission });
  } catch (error) {
    return next(error);
  }
};

export const postDemoSubmission = async (req, res, next) => {
  try {
    const body = req.body || {};
    const submission = await submitDemoAssessment({
      subjectId: Number(body.subjectId),
      captureMethod: String(body.captureMethod || ""),
      questionImageDataUrl: body.questionImageDataUrl,
      questionText: typeof body.questionText === "string" ? body.questionText : "",
      answerText: typeof body.answerText === "string" ? body.answerText : "",
      answerSourceImages: Array.isArray(body.answerSourceImages) ? body.answerSourceImages : [],
      userId: req.user?.id,
    });
    return res.status(201).json({ submission });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const deleteDemoSubmissionHandler = async (req, res, next) => {
  try {
    const deleted = await deleteDemoSubmission(req.params.submissionId);
    if (!deleted) {
      return res.status(404).json({ message: "Demo submission not found." });
    }
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};
