import { env } from "../config/env.js";

// Mints a short-lived SpatialReal session token so the browser can drive the
// AI Tutor's avatar face without ever seeing SPATIALREAL_API_KEY.
// SpatialReal itself does no STT/TTS/dialogue -- this token only authorizes
// the browser's AvatarKit connection to render/lip-sync whatever PCM audio
// the client feeds it (the Gemini Live audio already produced by
// geminiLiveTokenService.js's sessions).

const TOKEN_TTL_SECONDS = 50 * 60; // AvatarKit's setSessionToken docs cap validity at "max 1 hour"

export const mintAvatarSessionToken = async () => {
  if (!env.spatialRealApiKey || !env.spatialRealAppId || !env.spatialRealAvatarId) {
    const error = new Error("This feature isn't available right now. Please contact support.");
    error.statusCode = 503;
    throw error;
  }

  const expireAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;

  let response;
  try {
    response = await fetch(`https://console.${env.spatialRealRegion}.spatialwalk.cloud/v1/console/session-tokens`, {
      method: "POST",
      headers: { "X-Api-Key": env.spatialRealApiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ expireAt, modelVersion: "" }),
    });
  } catch {
    const error = new Error("Something went wrong processing this request. Please try again.");
    error.statusCode = 502;
    throw error;
  }

  if (!response.ok) {
    const error = new Error("Something went wrong processing this request. Please try again.");
    error.statusCode = 502;
    throw error;
  }

  const data = await response.json();
  if (!data.sessionToken) {
    const error = new Error("Something went wrong generating this content. Please try again.");
    error.statusCode = 502;
    throw error;
  }

  return { sessionToken: data.sessionToken, appId: env.spatialRealAppId, avatarId: env.spatialRealAvatarId };
};
