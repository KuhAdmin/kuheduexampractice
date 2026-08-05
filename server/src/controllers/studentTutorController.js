import { answerTutorQuestion } from "../services/tutorChatService.js";
import { mintTutorVoiceToken } from "../services/geminiLiveTokenService.js";
import { mintAvatarSessionToken } from "../services/avatarTokenService.js";
import { getMonthlyUsageSummary, recordTextUsage, recordVoiceUsage } from "../services/tutorUsageService.js";

export const postConceptTutorMessage = async (req, res, next) => {
  try {
    const { answer, tokens } = await answerTutorQuestion({
      assessmentUnitId: req.params.assessmentUnitId,
      mode: req.body?.mode,
      question: req.body?.question,
    });
    const usage = await recordTextUsage({
      userId: req.user.id,
      inputTokens: tokens?.inputTokens,
      outputTokens: tokens?.outputTokens,
    });
    return res.json({ answer, usage });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const getTutorUsageHandler = async (req, res, next) => {
  try {
    const usage = await getMonthlyUsageSummary(req.user.id);
    return res.json({ usage });
  } catch (error) {
    return next(error);
  }
};

export const postTutorVoiceUsageHandler = async (req, res, next) => {
  try {
    const usage = await recordVoiceUsage({ userId: req.user.id, seconds: req.body?.seconds });
    return res.json({ usage });
  } catch (error) {
    return next(error);
  }
};

export const postConceptTutorVoiceToken = async (req, res, next) => {
  try {
    const result = await mintTutorVoiceToken({
      assessmentUnitId: req.params.assessmentUnitId,
      mode: req.body?.mode,
    });
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const postTutorAvatarToken = async (_req, res, next) => {
  try {
    const result = await mintAvatarSessionToken();
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};
