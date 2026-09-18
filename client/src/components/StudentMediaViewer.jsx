import { useEffect, useRef, useState } from "react";
import { applyPreferredVoice } from "../utils/speechVoice";

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

const ZoomInIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M10.5 7.5v6M7.5 10.5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="m15.5 15.5 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const ZoomOutIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M7.5 10.5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="m15.5 15.5 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.5;

// Small image/video wrapper with a maximize button (opens the media
// full-viewport) and, when speechText is provided, a read-aloud button that
// uses the browser's built-in speech synthesis to narrate the paired text --
// pairs the visual with a spoken story rather than requiring silent reading.
export const StudentMediaViewer = ({ mediaType, src, alt, speechText, className = "", expandedOverlay }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  // Only meaningful for images -- a <video>'s native controls already cover
  // playback, and scaling its box via transform would just crop the native
  // control bar rather than usefully zooming the video itself.
  const [zoomLevel, setZoomLevel] = useState(1);
  // Drag-to-pan offset, in pixels, applied on top of the zoom scale.
  // Deliberately NOT relying on the container's `overflow: auto` for this --
  // a transform-scaled child's post-transform bounds are unreliable across
  // browsers for scrollable-overflow purposes, so scrollbars either don't
  // appear or don't let you reach the rest of the image. Dragging with
  // pointer events works the same everywhere.
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const overlayInnerRef = useRef(null);
  const overlayImageRef = useRef(null);
  const panDragRef = useRef(null);

  const openMaximized = () => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
    setIsMaximized(true);
  };

  const closeMaximized = () => {
    setIsMaximized(false);
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  };

  const zoomIn = () => {
    setZoomLevel((current) => Math.min(ZOOM_MAX, current + ZOOM_STEP));
    setPan({ x: 0, y: 0 });
  };

  const zoomOut = () => {
    setZoomLevel((current) => Math.max(ZOOM_MIN, current - ZOOM_STEP));
    setPan({ x: 0, y: 0 });
  };

  // How far the image can be dragged before its edge would pull away from
  // the container's edge and reveal empty space -- measured from the actual
  // rendered (post-zoom) boxes rather than computed from zoomLevel, so it
  // stays correct regardless of the image's real aspect ratio/size.
  const getPanBounds = () => {
    const container = overlayInnerRef.current?.getBoundingClientRect();
    const image = overlayImageRef.current?.getBoundingClientRect();
    if (!container || !image) return { x: 0, y: 0 };
    return {
      x: Math.max(0, (image.width - container.width) / 2),
      y: Math.max(0, (image.height - container.height) / 2),
    };
  };

  const handlePanPointerDown = (event) => {
    if (zoomLevel <= ZOOM_MIN) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    panDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPan: pan,
      bounds: getPanBounds(),
    };
  };

  const handlePanPointerMove = (event) => {
    const drag = panDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const nextX = drag.startPan.x + (event.clientX - drag.startX);
    const nextY = drag.startPan.y + (event.clientY - drag.startY);
    setPan({
      x: Math.min(drag.bounds.x, Math.max(-drag.bounds.x, nextX)),
      y: Math.min(drag.bounds.y, Math.max(-drag.bounds.y, nextY)),
    });
  };

  const handlePanPointerUp = (event) => {
    if (panDragRef.current?.pointerId === event.pointerId) {
      panDragRef.current = null;
    }
  };

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
    const utterance = applyPreferredVoice(new SpeechSynthesisUtterance(speechText));
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
            onClick={openMaximized}
          >
            <MaximizeIcon />
          </button>
        </div>
      </div>

      {isMaximized && (
        <div className="student-media-viewer-overlay" onClick={closeMaximized}>
          <button
            type="button"
            className="student-media-viewer-close"
            aria-label="Exit full screen"
            onClick={closeMaximized}
          >
            <MinimizeIcon />
          </button>
          {mediaType !== "video" && (
            <div className="student-media-viewer-zoom-controls" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className="student-media-viewer-toggle"
                aria-label="Zoom out"
                onClick={zoomOut}
                disabled={zoomLevel <= ZOOM_MIN}
              >
                <ZoomOutIcon />
              </button>
              <span className="student-media-viewer-zoom-level">{Math.round(zoomLevel * 100)}%</span>
              <button
                type="button"
                className="student-media-viewer-toggle"
                aria-label="Zoom in"
                onClick={zoomIn}
                disabled={zoomLevel >= ZOOM_MAX}
              >
                <ZoomInIcon />
              </button>
            </div>
          )}
          <div
            className="student-media-viewer-overlay-inner"
            ref={overlayInnerRef}
            onClick={(event) => event.stopPropagation()}
          >
            {mediaType === "video" ? (
              <video
                src={src}
                controls
                autoPlay
                className="student-media-viewer-overlay-media"
              />
            ) : (
              <img
                src={src}
                alt={alt}
                ref={overlayImageRef}
                className={`student-media-viewer-overlay-media ${zoomLevel > ZOOM_MIN ? "is-pannable" : ""}`}
                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})` }}
                onPointerDown={handlePanPointerDown}
                onPointerMove={handlePanPointerMove}
                onPointerUp={handlePanPointerUp}
                onPointerCancel={handlePanPointerUp}
                draggable={false}
              />
            )}
            {expandedOverlay && <div className="student-media-viewer-expanded-overlay">{expandedOverlay}</div>}
          </div>
        </div>
      )}
    </>
  );
};
