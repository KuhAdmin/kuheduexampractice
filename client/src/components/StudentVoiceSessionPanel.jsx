import { useCallback, useEffect, useId, useRef, useState } from "react";
import { VoiceSession } from "../lib/voiceClient";
import { useAiTutorAvatar } from "./AiTutorAvatarProvider";
import { postTutorVoiceUsage } from "../api/client";

const STATUS_LABEL = {
  idle: "Idle",
  connecting: "Connecting…",
  listening: "Listening…",
  speaking: "Speaking…",
  error: "Error",
  closed: "Session ended",
};

const SESSION_CAP_SECONDS = 5 * 60; // soft cap -- Live sessions bill per minute of audio

export const StudentVoiceSessionPanel = ({ mode, label, assessmentUnitId, onUsageUpdate }) => {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const sessionRef = useRef(null);
  const timerRef = useRef(null);
  // Mirrors `elapsed` so stop()/handleStatusChange can read the latest value
  // without depending on it (that would tear down and rebuild the interval
  // every second). Gemini Live has no server-visible token count -- this is
  // the only usage signal voice/avatar sessions have, so it's reported to
  // the same 30-hour budget as raw elapsed seconds whenever a session ends.
  const elapsedRef = useRef(0);
  const avatar = useAiTutorAvatar();
  const avatarSessionId = useId();

  const reportElapsedUsage = useCallback(() => {
    const seconds = elapsedRef.current;
    elapsedRef.current = 0;
    if (seconds <= 0) return;
    postTutorVoiceUsage(seconds)
      .then((result) => onUsageUpdate?.(result?.usage))
      .catch(() => {});
  }, [onUsageUpdate]);

  const stop = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setStatus("idle");
    setMuted(false);
    avatar.releaseSession(avatarSessionId);
    reportElapsedUsage();
  }, [avatar, avatarSessionId, reportElapsedUsage]);

  useEffect(() => stop, [stop]);

  // VoiceSession reaches "closed"/"error" on its own too -- an unexpected
  // Gemini-side close, or a failed start() -- not just via the "End
  // session" button. Previously only setStatus ran for those, so the
  // shared avatar slot never got released and a stale sessionRef stuck
  // around, until the student clicked "End session" on a session that had
  // already died. This mirrors that same cleanup for every path a session
  // can end, not just the manual one -- the VoiceSession instance itself
  // already released its own resources (mic/timers) before this fires.
  const handleStatusChange = useCallback(
    (nextStatus) => {
      setStatus(nextStatus);
      if (nextStatus === "closed" || nextStatus === "error") {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        sessionRef.current = null;
        setMuted(false);
        avatar.releaseSession(avatarSessionId);
        reportElapsedUsage();
      }
    },
    [avatar, avatarSessionId, reportElapsedUsage]
  );

  const toggleMute = () => {
    const next = !muted;
    sessionRef.current?.setMuted(next);
    setMuted(next);
  };

  const start = async () => {
    setError(null);
    setElapsed(0);
    elapsedRef.current = 0;
    setMuted(false);

    // Must be the very first await in this click handler -- iOS Safari
    // (especially installed PWAs) only allows getUserMedia while the click's
    // "user activation" is still fresh. The token fetch and WebSocket
    // handshake VoiceSession.start() does next both take real network time;
    // requesting the mic after those (as this used to) silently expires that
    // window on iOS and throws NotAllowedError, even though the identical
    // call works fine on desktop. Acquiring the stream here, before any
    // other await, and handing it down keeps the permission request inside
    // the gesture on every platform.
    let micStream;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Microphone access was denied.");
      return;
    }

    // Must happen before the session's own audio starts flowing -- also
    // what triggers the avatar's audio-context init inside this click's
    // user gesture. Resolves false when the avatar is off/not ready, in
    // which case VoiceSession falls back to its own local audio playback.
    const avatarBound = await avatar.bindSession(avatarSessionId);
    const session = new VoiceSession(
      { onStatusChange: handleStatusChange, onError: setError },
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
        elapsedRef.current = next;
        if (next >= SESSION_CAP_SECONDS) stop();
        return next;
      });
    }, 1000);
    await session.start({ assessmentUnitId, mode, micStream });
  };

  const active = status === "connecting" || status === "listening" || status === "speaking";
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  // "Listening…" is misleading in the gap right after muting -- audio has
  // already stopped and the turn-end signal is already sent, but the model
  // hasn't started its response yet. "Speaking…"/"Connecting…" need no
  // override: being muted while the AI talks is expected, not a stale label.
  const statusText = muted && status === "listening" ? "Muted — waiting for the AI to respond" : STATUS_LABEL[status];

  return (
    <div className="student-ai-tutor-voice">
      <div className="student-ai-tutor-voice-row">
        <div className="student-ai-tutor-voice-status">
          <span className={`student-ai-tutor-voice-dot is-${status}`} />
          <span>
            {label} — Live Voice {active && `(${minutes}:${seconds})`}
          </span>
        </div>
        <div className="student-ai-tutor-voice-actions">
          {active && (
            <button
              type="button"
              className={`student-ai-tutor-voice-mute ${muted ? "is-muted" : ""}`}
              onClick={toggleMute}
            >
              {muted ? "🔇 Unmute to keep talking" : "🎤 Mute — I'm done talking"}
            </button>
          )}
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
      </div>
      <p className="student-ai-tutor-voice-label">{statusText}</p>
      {error && <p className="student-ai-tutor-error">{error}</p>}
    </div>
  );
};
