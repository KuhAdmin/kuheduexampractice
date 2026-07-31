import { useEffect, useMemo, useState } from "react";

// 8-slot categorical chip palette (fixed hue order -- blue/orange/aqua/
// yellow/magenta/green/violet/red), matching the app's data-viz color
// standard. Label text varies per content source (admin-imported JSON has
// its own label vocabulary, not a known enum), so the slot is picked by
// hashing the label rather than a hardcoded lookup -- the same label always
// lands on the same chip color, including across different concepts/imports.
const CHIP_SLOT_COUNT = 8;

const hashLabelToChipSlot = (label) => {
  let hash = 0;
  for (let index = 0; index < label.length; index += 1) {
    hash = (hash * 31 + label.charCodeAt(index)) >>> 0;
  }
  return (hash % CHIP_SLOT_COUNT) + 1;
};

// Friendlier display text for label(s) whose source-JSON wording reads more
// like an internal field name than student-facing copy. Chip color still
// hashes off the original label (below), so this is purely cosmetic and
// doesn't affect color assignment or matching against the raw data.
const LABEL_DISPLAY_OVERRIDES = {
  output: "In a nutshell",
};

const displayLabel = (label) => LABEL_DISPLAY_OVERRIDES[label.trim().toLowerCase()] || label;

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

// Flattens title/summary/details into one narration string for speech
// synthesis -- array detail values (e.g. a numbered list of reflection
// questions) are period-joined so the synthesizer pauses between them
// instead of running them together.
const buildSpeechText = (title, summary, details) => {
  const parts = [];
  if (title) parts.push(title);
  if (summary) parts.push(summary);
  details.forEach((detail) => {
    const label = displayLabel(detail?.label || "");
    const value = Array.isArray(detail?.value) ? detail.value.join(". ") : detail?.value;
    if (label && value) parts.push(`${label}. ${value}`);
  });
  return parts.join(". ");
};

// Generic label/value content card, reused by Revision, Tutor Notes, and the
// Challenges tab -- every one of those features stores its content as
// {title, summary, details: [{label, value}]}, and until this component
// there was no shared renderer for that shape (each existing feature hand-
// rolls its own display for its own, differently-shaped data).
export const StudentDetailCard = ({ title, summary, details = [], className = "", children }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechText = useMemo(() => buildSpeechText(title, summary, details), [title, summary, details]);
  const speechSupported = typeof window !== "undefined" && Boolean(window.speechSynthesis);

  // Stops narration if this card's own content changes out from under it, or
  // it unmounts (e.g. switching tabs mid-sentence), so speech never keeps
  // playing for a card no longer on screen -- same cleanup pattern as
  // StudentMediaViewer's read-aloud button.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [speechText]);

  const handleToggleSpeech = () => {
    if (!speechSupported || !speechText) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    // cancel() first clears the browser's single shared speech queue, so
    // toggling "Read for me" on one card also stops any other card's
    // narration still in progress -- that card's own onerror fires with an
    // "interrupted" error and resets its isSpeaking state.
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  return (
    <article className={`student-detail-card ${className}`.trim()}>
      <div className="student-detail-card-header">
        {title && <h3 className="student-detail-card-title">{title}</h3>}
        {speechSupported && speechText && (
          <button
            type="button"
            className={`student-detail-card-speech-toggle ${isSpeaking ? "is-speaking" : ""}`.trim()}
            aria-label={isSpeaking ? "Stop reading" : "Read this card aloud"}
            onClick={handleToggleSpeech}
          >
            {isSpeaking ? <StopIcon /> : <SpeakerIcon />}
            <span>{isSpeaking ? "Stop" : "Read for me"}</span>
          </button>
        )}
      </div>
      {summary && <p className="student-detail-card-summary">{summary}</p>}
      {details.length > 0 && (
        <dl className="student-detail-card-list">
          {details.map((detail, index) => (
            <div className="student-detail-card-row" key={`${detail.label}-${index}`}>
              <dt className={`student-detail-chip student-detail-chip-${hashLabelToChipSlot(detail.label || "")}`}>
                {displayLabel(detail.label || "")}
              </dt>
              <dd>{Array.isArray(detail.value) ? detail.value.join(", ") : detail.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {children}
    </article>
  );
};
