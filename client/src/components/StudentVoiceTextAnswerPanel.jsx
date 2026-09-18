import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { EquationDisplay } from "./EquationDisplay";

const MAX_RECORD_SECONDS = 5;

const getSpeechRecognitionCtor = () =>
  (typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)) || null;

const isRecordingSupported = () =>
  typeof window !== "undefined" &&
  typeof navigator !== "undefined" &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  typeof window.MediaRecorder !== "undefined";

const MicIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
    <path
      d="M6 11a6 6 0 0 0 12 0M12 17v3.5M9 20.5h6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.7"
    />
  </svg>
);

const StopIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
  </svg>
);

// Replaces StudentMultiPageAnswerInput's "Snap and AI Check" for Story
// Anchor Questions' free-text formats only (see StudentPostLessonPage.jsx) --
// FreeTextAnswerPanel/StudentMultiPageAnswerInput stay untouched everywhere
// else in the app (Section Assessment etc. still want photo capture).
//
// Records up to MAX_RECORD_SECONDS of the learner's own voice (MediaRecorder,
// kept purely client-side for playback -- never uploaded or stored anywhere)
// while simultaneously transcribing it live via the browser's native Web
// Speech API (same SpeechRecognition setup StudentVivaMode.jsx already uses),
// then fills the transcript into the answer box for the learner to review/
// edit before submitting. No server-side transcription is used.
//
// SpeechRecognition manages its own microphone access internally (the Web
// Speech API spec has no way to hand it an existing MediaStream), so this
// necessarily requests the mic twice -- once via getUserMedia for
// MediaRecorder, once implicitly via recognition.start() -- both running
// concurrently off the same physical mic, which every evergreen browser that
// supports both APIs (Chrome, Edge) allows.
export const StudentVoiceTextAnswerPanel = forwardRef(function StudentVoiceTextAnswerPanel(
  {
    value,
    onChange,
    resetKey,
    disabled = false,
    statusClassName = "",
    placeholder = "Type your answer, or record it and we'll fill it in for you",
    // Overridable per caller -- Sensory Warm-Up wants a much longer window
    // (StudentPreLessonWarmupPage.jsx) than Story Anchor Questions' quick
    // 5-second answers (StudentPostLessonPage.jsx, which leaves this unset).
    maxSeconds = MAX_RECORD_SECONDS,
    // Optional -- mirrors stage/countdown out to a parent so a sibling
    // outside this panel (the "Start Recording" button/countdown overlaid on
    // StudentMediaViewer's expanded image, see StudentPreLessonWarmupPage.jsx)
    // can display the same state this panel does. No-ops for every other
    // caller.
    onStageChange,
    onCountdownChange,
  },
  ref
) {
  const [stage, setStage] = useState("idle"); // idle | recording | recorded
  const [countdown, setCountdown] = useState(maxSeconds);
  const [audioUrl, setAudioUrl] = useState(null);
  const [transcriptFailed, setTranscriptFailed] = useState(false);

  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const chunksRef = useRef([]);

  const recordingSupported = isRecordingSupported();
  const speechSupported = Boolean(getSpeechRecognitionCtor());

  useEffect(() => {
    onStageChange?.(stage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  useEffect(() => {
    onCountdownChange?.(countdown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  const cleanupStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const stopRecording = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* already stopped */
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const discardAudio = () => {
    setAudioUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  };

  // New question -- discard any recorded clip from the previous one, same as
  // StudentMultiPageAnswerInput's own resetKey-triggered reset.
  useEffect(() => {
    stopRecording();
    cleanupStream();
    discardAudio();
    setStage("idle");
    setCountdown(maxSeconds);
    setTranscriptFailed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(
    () => () => {
      stopRecording();
      cleanupStream();
      discardAudio();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const startRecording = async () => {
    setTranscriptFailed(false);
    discardAudio();

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return; // permission denied/unavailable -- stay in "idle", plain typing still works
    }
    streamRef.current = stream;

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      setAudioUrl(URL.createObjectURL(blob));
      cleanupStream();
      setStage("recorded");
    };
    mediaRecorderRef.current = recorder;
    recorder.start();

    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (SpeechRecognitionCtor) {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = "en-IN";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      // Continuous so a longer recording (e.g. Sensory Warm-Up's 120s) keeps
      // transcribing across pauses instead of ending after the first phrase;
      // harmless for a short 5s answer too. Results accumulate across calls,
      // so rebuild the full transcript from all finalized results each time.
      recognition.continuous = true;
      recognition.onresult = (event) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i += 1) {
          transcript += `${event.results[i][0].transcript} `;
        }
        transcript = transcript.trim();
        if (transcript) onChange(transcript);
        else setTranscriptFailed(true);
      };
      recognition.onerror = () => setTranscriptFailed(true);
      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        setTranscriptFailed(true);
      }
    } else {
      setTranscriptFailed(true);
    }

    setStage("recording");
    let secondsLeft = maxSeconds;
    setCountdown(secondsLeft);
    countdownIntervalRef.current = setInterval(() => {
      secondsLeft -= 1;
      setCountdown(secondsLeft);
      if (secondsLeft <= 0) stopRecording();
    }, 1000);
  };

  useImperativeHandle(ref, () => ({ startRecording }));

  return (
    <div className="student-free-text-panel">
      {recordingSupported && stage === "idle" && !disabled && (
        <button type="button" className="student-ocr-upload-button" onClick={startRecording}>
          <MicIcon />
          <span>Record Answer</span>
        </button>
      )}

      {stage === "recording" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* .student-countdown-pill (not the fixed-width .student-viva-countdown
              circle) since maxSeconds can run into 3 digits (e.g. Sensory
              Warm-Up's 120s), which would overflow a 56px circle. */}
          <span className="student-countdown-pill">{countdown}s</span>
          <button type="button" className="student-ocr-upload-button" onClick={stopRecording}>
            <StopIcon />
            <span>Stop</span>
          </button>
        </div>
      )}

      {stage === "recorded" && audioUrl && (
        <div style={{ display: "grid", gap: 6 }}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- learner's own just-recorded speech, no captions to source */}
          <audio controls src={audioUrl} style={{ width: "100%" }} />
          {!disabled && (
            <button type="button" className="student-ocr-upload-button" onClick={startRecording}>
              <MicIcon />
              <span>Record Again</span>
            </button>
          )}
        </div>
      )}

      {transcriptFailed && (
        <p className="student-ocr-hint">
          {speechSupported
            ? "We couldn't catch that -- please type your answer below."
            : "Speech-to-text isn't supported in this browser -- please type your answer after listening back."}
        </p>
      )}

      <EquationDisplay
        value={value || ""}
        onChange={disabled ? undefined : onChange}
        placeholder={placeholder}
        className={statusClassName}
      />
    </div>
  );
});
