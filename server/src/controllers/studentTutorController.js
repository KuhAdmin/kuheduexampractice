import { answerTutorQuestion } from "../services/tutorChatService.js";
import { mintTutorVoiceToken } from "../services/geminiLiveTokenService.js";
import { mintAvatarSessionToken } from "../services/avatarTokenService.js";

export const postConceptTutorMessage = async (req, res, next) => {
  try {
    const result = await answerTutorQuestion({
      assessmentUnitId: req.params.assessmentUnitId,
      mode: req.body?.mode,
      question: req.body?.question,
    });
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
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
