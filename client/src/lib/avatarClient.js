// Browser-only wrapper around @spatialwalk/avatarkit's SDK-level singletons
// (AvatarSDK init, avatar loading, session-token refresh). React lifecycle
// and per-voice-session binding live in components/AiTutorAvatarProvider.jsx
// -- this file only knows how to talk to AvatarKit and the token endpoint.
//
// SpatialReal does no STT/TTS/dialogue of its own -- it only renders/lip-syncs
// whatever PCM16 audio it's handed. The audio itself keeps coming from Gemini
// Live exactly as before (see lib/voiceClient.js); this is purely a face.

import { AvatarSDK, AvatarManager, AvatarView, Environment, DrivingServiceMode } from "@spatialwalk/avatarkit";
import { getTutorAvatarToken } from "../api/client";

// Matches Gemini's OUTPUT_SAMPLE_RATE in lib/voiceClient.js exactly, so PCM
// chunks can be handed to the avatar controller with zero resampling.
export const AVATAR_AUDIO_SAMPLE_RATE = 24000;

// Module-level memoization -- AvatarSDK is a set of static singletons, so
// initialize() only ever needs to run once for the whole app regardless of
// how many voice panels/avatars end up asking for it.
let sdkPromise = null;

function initAvatarSdk() {
  if (!sdkPromise) {
    sdkPromise = (async () => {
      const { sessionToken, appId, avatarId } = await getTutorAvatarToken();
      const configuration = {
        environment: Environment.intl,
        drivingServiceMode: DrivingServiceMode.sdk,
        audioFormat: { channelCount: 1, sampleRate: AVATAR_AUDIO_SAMPLE_RATE },
      };
      await AvatarSDK.initialize(appId, configuration);
      AvatarSDK.setSessionToken(sessionToken);
      return avatarId;
    })();
  }
  return sdkPromise;
}

// Mints and applies a fresh session token on the already-initialized SDK --
// used to recover from sessionTokenExpired/sessionTokenInvalid AvatarErrors
// without re-running AvatarSDK.initialize().
export async function refreshAvatarSessionToken() {
  const { sessionToken } = await getTutorAvatarToken();
  AvatarSDK.setSessionToken(sessionToken);
}

// Initializes the SDK (once) and mounts the configured avatar into the given
// container as a new AvatarView. Intended to be called once, for the single
// shared floating container in components/AiTutorAvatarProvider.jsx.
export async function createAvatarView(container) {
  const avatarId = await initAvatarSdk();
  const avatar = await AvatarManager.shared.load(avatarId);
  return new AvatarView(avatar, container);
}
