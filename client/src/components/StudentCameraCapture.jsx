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

const SAMPLE_INTERVAL_MS = 150;
const DOWNSCALE_WIDTH = 48;
const DOWNSCALE_HEIGHT = 36;
// Mean absolute luminance difference (0-255 scale) between consecutive
// downscaled frames, below which the frame counts as "steady".
const MOTION_THRESHOLD = 6;
// How long the frame must stay steady before we auto-fire the capture.
const STEADY_REQUIRED_MS = 900;
// Ignore motion/steadiness for this long after the stream starts, so the
// very first (often blank/dark, camera-still-focusing) frame can't
// immediately read as "steady" and fire before the student raises the phone.
const MIN_WARMUP_MS = 600;
// Minimum luminance standard deviation across the sampled frame -- guards
// against auto-firing on a blank wall/ceiling with no note in view.
const MIN_CONTENT_VARIANCE = 12;
const JPEG_QUALITY = 0.85;

// Live camera capture for the "AI Feedback" handwritten-note workflow.
// Opens the back camera and watches the live frame; once the frame has been
// steady and in view (not blank) for STEADY_REQUIRED_MS, it captures
// automatically -- no shutter tap required, though a manual shutter button
// is always available as an override. Falls back to a plain camera-first
// file input if getUserMedia is unavailable or permission is denied, so the
// caller's onCapture(dataUrl) always eventually fires either way.
export const StudentCameraCapture = ({ onCapture, onCancel }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const sampleCanvasRef = useRef(null);
  const previousFrameRef = useRef(null);
  const steadyStartRef = useRef(null);
  const streamStartedAtRef = useRef(null);
  const intervalRef = useRef(null);
  const capturedRef = useRef(false);

  const [status, setStatus] = useState("requesting"); // requesting | live | capturing | unsupported
  const [errorMessage, setErrorMessage] = useState("");

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
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
        sampleCanvasRef.current = document.createElement("canvas");
        sampleCanvasRef.current.width = DOWNSCALE_WIDTH;
        sampleCanvasRef.current.height = DOWNSCALE_HEIGHT;
        streamStartedAtRef.current = Date.now();
        setStatus("live");

        intervalRef.current = window.setInterval(() => {
          const video = videoRef.current;
          if (!video || !video.videoWidth) return;

          const canvas = sampleCanvasRef.current;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          context.drawImage(video, 0, 0, DOWNSCALE_WIDTH, DOWNSCALE_HEIGHT);
          const frame = context.getImageData(0, 0, DOWNSCALE_WIDTH, DOWNSCALE_HEIGHT).data;

          const pixelCount = DOWNSCALE_WIDTH * DOWNSCALE_HEIGHT;
          const luminances = new Array(pixelCount);
          let sum = 0;
          for (let i = 0, p = 0; i < frame.length; i += 4, p += 1) {
            const luminance = 0.299 * frame[i] + 0.587 * frame[i + 1] + 0.114 * frame[i + 2];
            luminances[p] = luminance;
            sum += luminance;
          }
          const mean = sum / pixelCount;
          const variance = luminances.reduce((acc, value) => acc + (value - mean) ** 2, 0) / pixelCount;
          const stdDev = Math.sqrt(variance);

          const previous = previousFrameRef.current;
          previousFrameRef.current = luminances;

          const warmedUp = Date.now() - streamStartedAtRef.current >= MIN_WARMUP_MS;

          if (!previous || !warmedUp || stdDev < MIN_CONTENT_VARIANCE) {
            steadyStartRef.current = null;
            return;
          }

          let diffSum = 0;
          for (let p = 0; p < pixelCount; p += 1) {
            diffSum += Math.abs(luminances[p] - previous[p]);
          }
          const motionScore = diffSum / pixelCount;

          if (motionScore > MOTION_THRESHOLD) {
            steadyStartRef.current = null;
            return;
          }

          if (steadyStartRef.current === null) {
            steadyStartRef.current = Date.now();
            return;
          }

          if (Date.now() - steadyStartRef.current >= STEADY_REQUIRED_MS) {
            capturePhoto();
          }
        }, SAMPLE_INTERVAL_MS);
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
            {status === "capturing" ? "Capturing..." : "Hold your note steady in the frame..."}
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
