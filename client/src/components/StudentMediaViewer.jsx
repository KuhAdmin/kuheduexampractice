import { useEffect, useState } from "react";

const MaximizeIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const MinimizeIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SpeakerIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 9.5v5h3.2L12 19V5L7.2 9.5H4Z" fill="currentColor" />
    <path
      d="M16 8.5a5 5 0 0 1 0 7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
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

// Small image/video wrapper with a maximize button (opens the media
// full-viewport) and, when speechText is provided, a read-aloud button that
// uses the browser's built-in speech synthesis to narrate the paired text --
// pairs the visual with a spoken story rather than requiring silent reading.
export const StudentMediaViewer = ({ mediaType, src, alt, speechText, className = "" }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Stop any in-progress narration if the underlying text/media changes out
  // from under this instance (e.g. navigating to a different concept) or the
  // component unmounts, so speech never keeps playing for content no longer
  // on screen.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [speechText, src]);

  const handleToggleSpeech = () => {
    if (typeof window === "undefined" || !window.speechSynthesis || !speechText) {
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  return (
    <>
      <div className={`student-media-viewer ${className}`.trim()}>
        {mediaType === "video" ? (
          <video src={src} controls className="student-media-viewer-media" />
        ) : (
          <img src={src} alt={alt} className="student-media-viewer-media" />
        )}
        <div className="student-media-viewer-actions">
          {speechText && (
            <button
              type="button"
              className="student-media-viewer-toggle"
              aria-label={isSpeaking ? "Stop reading" : "Read text aloud"}
              onClick={handleToggleSpeech}
            >
              {isSpeaking ? <StopIcon /> : <SpeakerIcon />}
            </button>
          )}
          <button
            type="button"
            className="student-media-viewer-toggle"
            aria-label="View full screen"
            onClick={() => setIsMaximized(true)}
          >
            <MaximizeIcon />
          </button>
        </div>
      </div>

      {isMaximized && (
        <div className="student-media-viewer-overlay" onClick={() => setIsMaximized(false)}>
          <button
            type="button"
            className="student-media-viewer-close"
            aria-label="Exit full screen"
            onClick={() => setIsMaximized(false)}
          >
            <MinimizeIcon />
          </button>
          <div className="student-media-viewer-overlay-inner" onClick={(event) => event.stopPropagation()}>
            {mediaType === "video" ? (
              <video
                src={src}
                controls
                autoPlay
                className="student-media-viewer-overlay-media"
              />
            ) : (
              <img src={src} alt={alt} className="student-media-viewer-overlay-media" />
            )}
          </div>
        </div>
      )}
    </>
  );
};
