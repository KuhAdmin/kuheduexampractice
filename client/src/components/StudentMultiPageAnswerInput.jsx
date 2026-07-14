import { useEffect, useRef, useState } from "react";
import { ocrHandwrittenNote } from "../api/client";
import { MathPreview } from "./MathPreview";
import { StudentCameraCapture } from "./StudentCameraCapture";

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l.9-1.5A1.5 1.5 0 0 1 9.7 4.75h4.6a1.5 1.5 0 0 1 1.3.75L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    />
    <circle cx="12" cy="12.5" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

const MoveIcon = ({ direction }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d={direction === "up" ? "m6 14 6-6 6 6" : "m6 10 6 6 6-6"}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    />
  </svg>
);

const RemoveIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const MAX_PAGES = 5;

// Callers wire this into their onChange(text, pages) to get the shape the
// submit endpoints expect: only pages that actually came from a photo,
// numbered by their own relative order, everything else (typed-only
// answers) stays an empty array -- same as not persisting anything, exactly
// like today's photo-less flow.
export const extractSourcePageImages = (pages) =>
  pages
    .filter((page) => page.imageDataUrl)
    .map((page, index) => ({ order: index + 1, imageData: page.imageDataUrl }));

// The OCR capture itself stays full quality (best transcription accuracy),
// but the copy kept for later grader review doesn't need that resolution --
// downscale it so persisting up to 5 pages doesn't multiply storage the way
// keeping 5 full-res captures would (today's OCR flow keeps no photo at all,
// so this is new storage cost worth controlling from the start).
const STORED_IMAGE_MAX_DIMENSION = 1000;
const STORED_IMAGE_QUALITY = 0.6;

const compressImageForStorage = (dataUrl) =>
  new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, STORED_IMAGE_MAX_DIMENSION / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", STORED_IMAGE_QUALITY));
    };
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });

// Lets a student build an answer from up to MAX_PAGES handwritten-photo
// captures (each OCR'd into its own editable textarea) plus/instead of
// typing directly, with up/down reordering and per-page removal -- e.g. for
// a multi-page handwritten note where pages might get captured out of
// order. Calls onChange(joinedText, pages) on every edit: joinedText is the
// pages' text joined with blank lines (what callers already store as their
// single answer string, unchanged contract), pages is the raw per-page list
// for callers that also want it (e.g. to attach source photos later).
export const StudentMultiPageAnswerInput = ({
  value,
  onChange,
  resetKey,
  disabled = false,
  statusClassName = "",
  placeholder = "Type your answer, or capture a photo of your handwritten answer above",
  rows = 6,
}) => {
  const idCounterRef = useRef(0);
  const makeId = () => `page-${idCounterRef.current++}`;

  const [pages, setPages] = useState(() => [{ id: makeId(), text: value || "" }]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [ocrAppliedId, setOcrAppliedId] = useState(null);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setPages([{ id: makeId(), text: value || "" }]);
    setOcrError("");
    setOcrAppliedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const updatePages = (updater) => {
    setPages((current) => {
      const next = updater(current);
      onChange(
        next.map((page) => page.text).join("\n\n"),
        next
      );
      return next;
    });
  };

  const updatePageText = (id, text) => {
    updatePages((current) => current.map((page) => (page.id === id ? { ...page, text } : page)));
  };

  const movePage = (id, direction) => {
    updatePages((current) => {
      const index = current.findIndex((page) => page.id === id);
      const targetIndex = index + direction;
      if (index === -1 || targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const removePage = (id) => {
    updatePages((current) => (current.length <= 1 ? current : current.filter((page) => page.id !== id)));
  };

  const handleCapturedPhoto = async (dataUrl) => {
    setOcrError("");
    setOcrLoading(true);
    try {
      const result = await ocrHandwrittenNote(dataUrl);
      if (!result?.text) {
        setOcrError("We couldn't find any text in that photo. Try a clearer photo, or type your answer instead.");
      }
      const compressedImage = await compressImageForStorage(dataUrl);
      const newPage = { id: makeId(), text: result?.text || "", imageDataUrl: compressedImage || undefined };
      updatePages((current) => [...current, newPage]);
      setOcrAppliedId(newPage.id);
    } catch (ocrFailure) {
      setOcrError(ocrFailure.message || "Failed to read that photo. Please try again or type your answer.");
    } finally {
      setOcrLoading(false);
    }
  };

  if (disabled) {
    return (
      <div className="student-ocr-pages-panel">
        <textarea
          rows={rows}
          className={`student-assessment-text-input ${statusClassName}`}
          value={value || ""}
          readOnly
          disabled
        />
        <MathPreview text={value || ""} />
      </div>
    );
  }

  const canAddPage = pages.length < MAX_PAGES;

  return (
    <div className="student-ocr-pages-panel">
      <button
        type="button"
        className={`student-ocr-upload-button ${ocrLoading || !canAddPage ? "is-disabled" : ""}`}
        disabled={ocrLoading || !canAddPage}
        onClick={() => setCameraOpen(true)}
      >
        <CameraIcon />
        <span>{ocrLoading ? "Reading your photo..." : "Capture Photo"}</span>
      </button>
      {!canAddPage && (
        <p className="student-ocr-hint">
          You've reached the {MAX_PAGES}-page limit. Remove a page below to capture another.
        </p>
      )}

      {cameraOpen && (
        <StudentCameraCapture
          onCapture={(dataUrl) => {
            setCameraOpen(false);
            handleCapturedPhoto(dataUrl);
          }}
          onCancel={() => setCameraOpen(false)}
        />
      )}

      <ol className="student-ocr-page-list">
        {pages.map((page, index) => (
          <li key={page.id} className="student-ocr-page-row">
            <div className="student-ocr-page-row-head">
              <span className="student-concept-practice-badge">{index + 1}</span>
              <div className="student-ocr-page-controls">
                <button
                  type="button"
                  className="student-ordering-move"
                  aria-label={`Move page ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => movePage(page.id, -1)}
                >
                  <MoveIcon direction="up" />
                </button>
                <button
                  type="button"
                  className="student-ordering-move"
                  aria-label={`Move page ${index + 1} down`}
                  disabled={index === pages.length - 1}
                  onClick={() => movePage(page.id, 1)}
                >
                  <MoveIcon direction="down" />
                </button>
                <button
                  type="button"
                  className="student-ordering-move is-danger"
                  aria-label={`Remove page ${index + 1}`}
                  disabled={pages.length === 1}
                  onClick={() => removePage(page.id)}
                >
                  <RemoveIcon />
                </button>
              </div>
            </div>
            <textarea
              rows={rows}
              className="student-assessment-text-input"
              placeholder={pages.length === 1 ? placeholder : `Page ${index + 1}`}
              value={page.text}
              onChange={(event) => updatePageText(page.id, event.target.value)}
            />
            <MathPreview text={page.text} />
            {ocrAppliedId === page.id && (
              <p className="student-ocr-hint">
                We've filled this in from your photo — please check it reads correctly and fix anything before
                submitting.
              </p>
            )}
          </li>
        ))}
      </ol>

      {ocrError && <p className="error-text">{ocrError}</p>}
    </div>
  );
};
