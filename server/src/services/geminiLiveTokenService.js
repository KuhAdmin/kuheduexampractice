import { GoogleGenAI, Modality } from "@google/genai";
import { env } from "../config/env.js";
import { getConceptCard } from "./studentContentService.js";

// Mints a short-lived, LOCKED ephemeral Gemini Live token so the browser can
// connect DIRECTLY to Google's Live WebSocket without ever seeing
// GEMINIAPI_KEY. SECURITY: ephemeral tokens minted WITHOUT
// liveConnectConstraints are "unlocked" and let a malicious client send its
// own setup frame to override the model/system instruction/tools -- every
// token minted here is locked to this app's own model + system instruction +
// an explicit empty tools array, so nothing the client sends can change what
// the session actually does. See https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens
//
// Only "ask" and "coach" modes are supported here -- see tutorChatService.js
// for why Interview/Viva/Debate aren't ported.

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 min to send messages on a started session
const SESSION_START_TTL_MS = 2 * 60 * 1000; // 2 min to actually start the session

const describeCard = (card) => {
  const lines = [`Concept: ${card.primaryConcept}`];
  if (card.learningObjective) lines.push(`Learning objective: ${card.learningObjective}`);
  if (card.contextSummary) lines.push(`Summary: ${card.contextSummary}`);
  if (card.analogy) lines.push(`Analogy: ${card.analogy}`);
  if (card.story) lines.push(`Story: ${card.story}`);
  if (card.curiosityHook) lines.push(`Curiosity hook: ${card.curiosityHook}`);
  if (card.misconceptionAlert) lines.push(`Common misconception: ${card.misconceptionAlert}`);
  return lines.join("\n");
};

const buildLiveSystemInstruction = (mode, card) => {
  const base =
    `You are a friendly, encouraging AI tutor having a real-time SPOKEN conversation with a ` +
    `student about the concept "${card.primaryConcept}". Keep responses short and ` +
    `conversational -- a sentence or two at a time, like real speech, not a written document.\n\n` +
    describeCard(card);

  if (mode === "coach") {
    return `${base}\n\nCoach the student through this concept encouragingly and conversationally, starting from the analogy/story above if available. Check in with short spoken questions to see if they're following.`;
  }

  // "ask" (default) -- open spoken Q&A, grounded in the concept.
  return `${base}\n\nAnswer whatever questions the student asks about this concept, directly and conversationally.`;
};

export const mintTutorVoiceToken = async ({ assessmentUnitId, mode }) => {
  if (mode !== "ask" && mode !== "coach") {
    const error = new Error('mode must be "ask" or "coach".');
    error.statusCode = 422;
    throw error;
  }

  if (!env.geminiApiKey || !env.geminiVoiceModel) {
    const error = new Error("This feature isn't available right now. Please contact support.");
    error.statusCode = 503;
    throw error;
  }

  const card = await getConceptCard({ assessmentUnitId });
  if (!card) {
    const error = new Error("This concept has not been generated yet.");
    error.statusCode = 404;
    throw error;
  }

  const systemInstruction = buildLiveSystemInstruction(mode, card);

  const client = new GoogleGenAI({ apiKey: env.geminiApiKey, httpOptions: { apiVersion: "v1alpha" } });
  const expireTime = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  const newSessionExpireTime = new Date(Date.now() + SESSION_START_TTL_MS).toISOString();

  const token = await client.authTokens.create({
    config: {
      uses: 1,
      expireTime,
      newSessionExpireTime,
      liveConnectConstraints: {
        model: env.geminiVoiceModel,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: env.geminiVoiceName } },
            ...(env.geminiVoiceLanguage ? { languageCode: env.geminiVoiceLanguage } : {}),
          },
          tools: [], // explicit empty array -- closes the tool-injection vector, see file header
        },
      },
    },
  });

  if (!token.name) {
    const error = new Error("Something went wrong generating this content. Please try again.");
    error.statusCode = 502;
    throw error;
  }

  return { token: token.name, model: env.geminiVoiceModel, expiresAt: expireTime };
};
