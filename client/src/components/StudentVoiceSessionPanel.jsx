import { useCallback, useEffect, useId, useRef, useState } from "react";
import { VoiceSession } from "../lib/voiceClient";
import { useAiTutorAvatar } from "./AiTutorAvatarProvider";

const STATUS_LABEL = {
  idle: "Idle",
  connecting: "Connecting…",
  listening: "Listening…",
  speaking: "Speaking…",
  error: "Error",
  closed: "Session ended",
};

const SESSION_CAP_SECONDS = 5 * 60; // soft cap -- Live sessions bill per minute of audio

export const StudentVoiceSessionPanel = ({ mode, label, assessmentUnitId }) => {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const sessionRef = useRef(null);
  const timerRef = useRef(null);
  const avatar = useAiTutorAvatar();
  const avatarSessionId = useId();

  const stop = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setStatus("idle");
    avatar.releaseSession(avatarSessionId);
  }, [avatar, avatarSessionId]);

  useEffect(() => stop, [stop]);

  const start = async () => {
    setError(null);
    setElapsed(0);
    // Must happen before the session's own audio starts flowing -- also
    // what triggers the avatar's audio-context init inside this click's
    // user gesture. Resolves false when the avatar is off/not ready, in
    // which case VoiceSession falls back to its own local audio playback.
    const avatarBound = await avatar.bindSession(avatarSessionId);
    const session = new VoiceSession(
      { onStatusChange: setStatus, onError: setError },
      avatarBound
        ? {
            sendAudioChunk: (pcm, end) => avatar.sendAudioChunk(avatarSessionId, pcm, end),
            interrupt: () => avatar.interrupt(avatarSessionId),
          }
        : undefined,
    );
    sessionRef.current = session;
    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= SESSION_CAP_SECONDS) stop();
        return next;
      });
    }, 1000);
    await session.start({ assessmentUnitId, mode });
  };

  const active = status === "connecting" || status === "listening" || status === "speaking";
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="student-ai-tutor-voice">
      <div className="student-ai-tutor-voice-row">
        <div className="student-ai-tutor-voice-status">
          <span className={`student-ai-tutor-voice-dot is-${status}`} />
          <span>
            {label} — Live Voice {active && `(${minutes}:${seconds})`}
          </span>
        </div>
        {active ? (
          <button type="button" className="student-ai-tutor-voice-stop" onClick={stop}>
            End session
          </button>
        ) : (
          <button type="button" className="student-ai-tutor-voice-start" onClick={start}>
            🎙 Start talking
          </button>
        )}
      </div>
      <p className="student-ai-tutor-voice-label">{STATUS_LABEL[status]}</p>
      {error && <p className="student-ai-tutor-error">{error}</p>}
    </div>
  );
};
