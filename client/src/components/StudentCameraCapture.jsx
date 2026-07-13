import { useEffect, useRef, useState } from "react";

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M6 6l12 12M18 6L6 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const ShutterIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="4" fill="currentColor" />
  </svg>
);

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Failed to read the selected image."));
    reader.readAsDataURL(file);
  });

const JPEG_QUALITY = 0.85;

// Live camera capture for the "AI Feedback" handwritten-note workflow.
// Opens the back camera and shows a live preview; capture only happens when
// the student taps the shutter button. (Previously this also auto-fired
// once the frame looked "steady" via a JS motion heuristic, but that
// heuristic has no way to know whether the camera's own hardware
// autofocus/exposure has actually settled -- it was firing on frames that
// looked still to the low-res sampling but were still visually blurry.
// Manual-only avoids that entirely.) Falls back to a plain camera-first
// file input if getUserMedia is unavailable or permission is denied, so the
// caller's onCapture(dataUrl) always eventually fires either way.
export const StudentCameraCapture = ({ onCapture, onCancel }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const capturedRef = useRef(false);

  const [status, setStatus] = useState("requesting"); // requesting | live | capturing | unsupported
  const [errorMessage, setErrorMessage] = useState("");

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const capturePhoto = () => {
    if (capturedRef.current || !videoRef.current) return;
    capturedRef.current = true;
    setStatus("capturing");

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 960;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);

    stopStream();
    onCapture(dataUrl);
  };

  useEffect(() => {
    let cancelled = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return undefined;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setStatus("live");
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus("unsupported");
        setErrorMessage(error.message || "Camera access was denied.");
      });

    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFallbackFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      onCapture(dataUrl);
    } catch (readError) {
      setErrorMessage(readError.message || "Failed to read the selected image.");
    }
  };

  return (
    <div className="student-camera-capture-overlay">
      <button
        type="button"
        className="student-camera-capture-close"
        aria-label="Cancel"
        onClick={onCancel}
      >
        <CloseIcon />
      </button>

      {status === "unsupported" ? (
        <div className="student-camera-capture-fallback">
          <p>Camera unavailable{errorMessage ? ` (${errorMessage})` : ""} -- choose a photo instead.</p>
          <label className="student-ocr-upload-button">
            <ShutterIcon />
            <span>Choose Photo</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={handleFallbackFileChange}
            />
          </label>
        </div>
      ) : (
        <>
          <video ref={videoRef} autoPlay playsInline muted className="student-camera-capture-video" />
          <div className="student-camera-capture-frame-guide" aria-hidden="true" />
          <div className="student-camera-capture-status">
            {status === "capturing" ? "Capturing..." : "Line up your note, then tap the shutter to capture."}
          </div>
          <div className="student-camera-capture-actions">
            <button type="button" className="ghost-button" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className="student-camera-capture-shutter"
              aria-label="Capture now"
              disabled={status !== "live"}
              onClick={capturePhoto}
            >
              <ShutterIcon />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
