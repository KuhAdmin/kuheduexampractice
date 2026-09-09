import { useEffect, useState } from "react";
import { extractSourcePageImages, StudentMultiPageAnswerInput } from "./StudentMultiPageAnswerInput";
import { StudentVoiceTextAnswerPanel } from "./StudentVoiceTextAnswerPanel";
import { StudentAnnotatedAnswer } from "./StudentAnnotatedAnswer";
import { applyPreferredVoice } from "../utils/speechVoice";

const SpeakerIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 9.5v5h3.2L12 19V5L7.2 9.5H4Z" fill="currentColor" />
    <path d="M16 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path
      d="M18.3 6.2a8.5 8.5 0 0 1 0 11.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </svg>
);

const StopIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
  </svg>
);

const MAX_WORDS = 200;

// Same word cap as StudentMicroActivityPanel.jsx, for the same reasons: a
// quick response, not an essay, and bounds the size/cost of the AI feedback
// call.
const truncateToWordLimit = (text) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= MAX_WORDS) {
    return text;
  }
  return words.slice(0, MAX_WORDS).join(" ");
};

// Generic "type or photograph an open-ended answer, get qualitative AI
// feedback" panel -- same interaction as StudentMicroActivityPanel.jsx, but
// not tied to assessmentUnitId: reused by textbook Exercises/Activities
// (StudentConceptLearningPage.jsx, keyed by activityKey) and Challenges'
// case-study items (StudentChallengesTab.jsx, keyed by responseKey), each
// of which passes its own fetch/submit pair (getTextbookActivityResponse/
// submitTextbookActivityResponse vs getChallengeResponse/
// submitChallengeResponse) since the two features persist responses in
// separate tables keyed by different stable identities. Meant to be
// rendered nested under a card that already shows the activity/question's
// own text, so unlike StudentMicroActivityPanel this never re-displays a
// prompt itself.
export const StudentOpenResponsePanel = ({
  responseKey,
  fetchResponse,
  submitResponse,
  placeholder = "Type your answer, or capture a photo of your handwritten/drawn work above",
  // Optional -- lets a parent gate its own UI (e.g. CaseStudyCard's "Show
  // answer" reveal, only meant to appear once the student has submitted
  // their own attempt) on whether feedback exists yet. Fires both when a
  // prior submission's feedback loads on mount and right after a fresh
  // submit, so "already answered in an earlier session" counts too, not
  // just "just submitted this session."
  onFeedbackChange,
  // Optional -- cue/hint questions shown above the input (e.g. Experiential
  // Warm-Up's "What were you trying to achieve?" style prompts) and a live
  // countdown badge (see responseCapture.countdownTimer in
  // PreWarmupContentPreview.jsx's ResponseCaptureBadges, which this mirrors
  // for real instead of just labelling it). Both no-ops for every other
  // caller of this panel, which don't pass them.
  cues,
  countdownSeconds,
  // Optional -- "photo" (default, StudentMultiPageAnswerInput's Capture
  // Photo/OCR flow) or "voice" (StudentVoiceTextAnswerPanel: record + play
  // back + auto-fill via the Web Speech API, same one Story Anchor
  // Questions uses). Every other caller of this panel keeps "photo"
  // unchanged.
  captureMode = "photo",
  // Controlled, not internal state -- so a sibling outside this panel (the
  // "Start Timer" button/badge overlaid on StudentMediaViewer's expanded
  // image, see StudentPreLessonWarmupPage.jsx) can trigger and display the
  // SAME countdown this panel does, both driven by state the parent owns.
  // Undefined for every caller that doesn't pass countdownSeconds either.
  timerStarted,
  onStartTimer,
  secondsLeft,
  // Passed through to StudentVoiceTextAnswerPanel when captureMode="voice"
  // (undefined elsewhere, letting it keep its own 5s default).
  voiceMaxSeconds,
  // Also passed through when captureMode="voice" -- lets a parent (the
  // "Start Recording" button/countdown overlaid on StudentMediaViewer's
  // expanded image) trigger recording and mirror its stage/countdown.
  voiceRef,
  onVoiceStageChange,
  onVoiceCountdownChange,
}) => {
  const [responseText, setResponseText] = useState("");
  const [sourcePageImages, setSourcePageImages] = useState([]);
  const [feedback, setFeedback] = useState(null);
  // AI-flagged spelling/grammar issues, optional -- only populated when
  // fetchResponse/submitResponse include an `issues` array (Sensory/
  // Experiential Warm-Up today, see StudentPreLessonWarmupPage.jsx). Every
  // other caller of this panel never sets this, so it stays empty for them.
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    onFeedbackChange?.(feedback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback]);

  const speakFeedback = (text) => {
    if (typeof window === "undefined" || !window.speechSynthesis || !text) return;

    window.speechSynthesis.cancel();
    const utterance = applyPreferredVoice(new SpeechSynthesisUtterance(text));
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const handleToggleSpeech = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    speakFeedback(feedback);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFeedback(null);
    setIssues([]);
    setResponseText("");
    setSourcePageImages([]);
    setSubmitError("");

    fetchResponse(responseKey)
      .then((result) => {
        if (cancelled) return;
        if (result) {
          setResponseText(result.responseText || "");
          setFeedback(result.feedback || null);
          setIssues(result.issues || []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responseKey]);

  const handleSubmit = async () => {
    if (!responseText.trim()) return;

    setSubmitting(true);
    setSubmitError("");
    try {
      const result = await submitResponse(responseKey, responseText, sourcePageImages);
      setFeedback(result.feedback);
      setIssues(result.issues || []);
      speakFeedback(result.feedback);
    } catch (error) {
      setSubmitError(error.message || "Failed to get feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="student-empty-state">Loading...</p>;
  }

  return (
    <div className="student-micro-activity-panel">
      {(cues?.length > 0 || countdownSeconds) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
          {countdownSeconds && !timerStarted && !feedback && (
            <button type="button" className="student-ocr-upload-button" onClick={onStartTimer}>
              Start Timer
            </button>
          )}
          {countdownSeconds && timerStarted && secondsLeft !== null && secondsLeft !== undefined && (
            <span className="student-countdown-pill">
              {secondsLeft > 0 ? `${secondsLeft}s` : "Time's up"}
            </span>
          )}
          {cues?.length > 0 && (
            <div className="student-instant-feedback is-neutral">
              <strong>Cues</strong>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {cues.map((cue, index) => (
                  <li key={index}>{cue}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {captureMode === "voice" ? (
        <StudentVoiceTextAnswerPanel
          ref={voiceRef}
          value={responseText}
          onChange={(text) => setResponseText(truncateToWordLimit(text))}
          resetKey={responseKey}
          placeholder={placeholder}
          maxSeconds={voiceMaxSeconds}
          onStageChange={onVoiceStageChange}
          onCountdownChange={onVoiceCountdownChange}
        />
      ) : (
        <StudentMultiPageAnswerInput
          value={responseText}
          onChange={(text, pages) => {
            setResponseText(truncateToWordLimit(text));
            setSourcePageImages(extractSourcePageImages(pages));
          }}
          resetKey={responseKey}
          placeholder={placeholder}
        />
      )}

      <button
        type="button"
        className="student-concept-practice-next"
        disabled={submitting || !responseText.trim()}
        onClick={handleSubmit}
      >
        {submitting ? "Getting feedback..." : "Submit for Feedback"}
      </button>
      {submitError && <p className="error-text">{submitError}</p>}

      {feedback && (
        <div className="student-instant-feedback is-neutral">
          <div className="student-instant-feedback-head">
            <strong>Feedback</strong>
            <button
              type="button"
              className="student-instant-feedback-speak"
              aria-label={isSpeaking ? "Stop reading" : "Read feedback aloud"}
              onClick={handleToggleSpeech}
            >
              {isSpeaking ? <StopIcon /> : <SpeakerIcon />}
            </button>
          </div>
          <p>{feedback}</p>
          {issues.length > 0 && <StudentAnnotatedAnswer text={responseText} issues={issues} />}
        </div>
      )}
    </div>
  );
};
