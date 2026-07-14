import { useEffect, useState } from "react";
import { getMicroActivityResponse, submitMicroActivityResponse } from "../api/client";
import { extractSourcePageImages, StudentMultiPageAnswerInput } from "./StudentMultiPageAnswerInput";

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

// Caps both typed input and OCR'd text at MAX_WORDS -- a micro-activity
// response is meant to be a quick reflection, not a long essay, and this
// also bounds the size/cost of the AI feedback call.
const truncateToWordLimit = (text) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= MAX_WORDS) {
    return text;
  }
  return words.slice(0, MAX_WORDS).join(" ");
};

// Lets a student answer a Layer 2 "Try This" micro-activity prompt by typing
// or capturing up to 5 photos of a handwritten answer (each OCR'd into its
// own editable, reorderable page -- see StudentMultiPageAnswerInput), then
// get qualitative AI feedback. Reused on both the section-level Memory
// Booster carousel and the per-concept Explore tab -- same prompt, same
// interaction either place.
export const StudentMicroActivityPanel = ({ assessmentUnitId, prompt }) => {
  const [responseText, setResponseText] = useState("");
  const [sourcePageImages, setSourcePageImages] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speakFeedback = (text) => {
    if (typeof window === "undefined" || !window.speechSynthesis || !text) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
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
    setResponseText("");
    setSourcePageImages([]);
    setSubmitError("");

    getMicroActivityResponse(assessmentUnitId)
      .then((result) => {
        if (cancelled) return;
        if (result) {
          setResponseText(result.responseText || "");
          setFeedback(result.feedback || null);
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
  }, [assessmentUnitId]);

  const handleSubmit = async () => {
    if (!responseText.trim()) return;

    setSubmitting(true);
    setSubmitError("");
    try {
      const result = await submitMicroActivityResponse(assessmentUnitId, responseText, sourcePageImages);
      setFeedback(result.feedback);
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
      {prompt && <p className="student-micro-activity-prompt">{prompt}</p>}

      <StudentMultiPageAnswerInput
        value={responseText}
        onChange={(text, pages) => {
          setResponseText(truncateToWordLimit(text));
          setSourcePageImages(extractSourcePageImages(pages));
        }}
        resetKey={assessmentUnitId}
        placeholder="Type your answer, or capture a photo of your handwritten answer above"
        rows={6}
      />

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
        </div>
      )}
    </div>
  );
};
