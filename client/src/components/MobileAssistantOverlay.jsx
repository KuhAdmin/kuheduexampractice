import { useState } from "react";

// On mobile, the AI Teaching Assistant sits below the day cards, so reaching
// it means scrolling past everything else. This wraps it in ONE element
// (never duplicated -- the assistant keeps its own question/history state,
// so two mounted copies would silently diverge) that a fixed, always-visible
// trigger on the right edge can pop open as a right-side drawer while
// scrolling the cards underneath. Desktop is untouched: past the mobile
// breakpoint this renders exactly like a plain wrapper around its children.
export const MobileAssistantOverlay = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="teacher-ai-assistant-fab"
        onClick={() => setIsOpen(true)}
        aria-label="Open AI Teaching Assistant"
      >
        ✨
      </button>
      {isOpen && <div className="teacher-ai-assistant-overlay-backdrop" onClick={() => setIsOpen(false)} />}
      <div className={`teacher-ai-assistant-mobile-wrap ${isOpen ? "is-open" : ""}`}>
        <button
          type="button"
          className="close-button teacher-ai-assistant-overlay-close"
          onClick={() => setIsOpen(false)}
          aria-label="Close AI Teaching Assistant"
        >
          &times;
        </button>
        {children}
      </div>
    </>
  );
};
