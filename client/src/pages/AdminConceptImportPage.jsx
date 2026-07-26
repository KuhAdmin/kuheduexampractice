import { useEffect, useRef, useState } from "react";
import { uploadConceptImport } from "../api/client";

const readFileAsText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Failed to read the selected file."));
    reader.readAsText(file);
  });

const REQUIRED_ROOT_FIELDS = ["contentKey", "board", "class", "subject", "chapter", "section", "book", "chapterName", "sectionName"];

// Pre-migration files (board/classNum/subject/book/chapterNum/chapterName/
// sectionNo/sectionName root fields, extraction.concepts[] + a concepts{}
// map) are still accepted -- the server auto-converts them into the new
// flat-cards contract (see conceptImportService.js's normalizeConceptImportPayload).
const isLegacyPayloadShape = (payload) =>
  Boolean(payload) &&
  typeof payload === "object" &&
  !Array.isArray(payload.cards) &&
  Array.isArray(payload?.extraction?.concepts) &&
  payload.extraction.concepts.length > 0 &&
  Boolean(payload?.concepts) &&
  typeof payload.concepts === "object" &&
  !Array.isArray(payload.concepts);

const validatePayloadShape = (payload) => {
  if (!payload || typeof payload !== "object") {
    return "The file does not contain a JSON object.";
  }
  if (isLegacyPayloadShape(payload)) {
    return null;
  }
  const missing = REQUIRED_ROOT_FIELDS.filter((field) => {
    const value = payload[field];
    return value === undefined || value === null || String(value).trim() === "";
  });
  if (missing.length) {
    return `Missing required root field(s): ${missing.join(", ")}.`;
  }
  if (!Array.isArray(payload?.cards) || payload.cards.length === 0) {
    return 'Missing or empty "cards" array.';
  }
  return null;
};

const COUNT_LABELS = {
  teaching: "Teach-me / explain / ELI5 / story / analogy / real-world items",
  assessmentCore: "MCQ / assertion-reason / true-false / short-answer / fill-in-blank / HOTS items",
  assessmentExtra: "Hotspot / case-study / Einstein-mode items",
  revision: "Revision items (flashcards/cheatsheet/mnemonics/exam notes)",
  tutor: "Tutor items (coach/interview/viva/debate)",
  deeplearning: "Deep-learning items (misconceptions/why-chain)",
  visual: "Section visuals (diagrams/mind maps/etc.)",
};

const LOG_EVENT_ICON = {
  info: "•",
  success: "✓",
  warning: "⚠",
  error: "✕",
};

export const AdminConceptImportPage = () => {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [result, setResult] = useState(null);
  const [logEvents, setLogEvents] = useState([]);
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [logEvents]);

  const handleFileSelected = async (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setUploadError("");
    setResult(null);
    setLogEvents([]);

    try {
      const text = await readFileAsText(file);
      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error("The file is not valid JSON.");
      }

      const shapeError = validatePayloadShape(payload);
      if (shapeError) {
        throw new Error(shapeError);
      }

      const response = await uploadConceptImport({
        payload,
        onEvent: (uploadEvent) => {
          if (uploadEvent.type === "summary") return;
          setLogEvents((current) => [...current, uploadEvent]);
        },
      });
      setResult(response.summary);
    } catch (err) {
      setUploadError(err.message || "Failed to import the file.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="admin-bulk-pipeline-page">
      <header className="admin-bulk-pipeline-header">
        <div>
          <span className="eyebrow">Admin module</span>
          <h1>Concept Import</h1>
          <p>
            Upload a JSON export from the content app: a <code>contentKey</code>, root board/class/
            subject/chapter/section/book/chapterName/sectionName metadata, and a flat <code>cards</code>{" "}
            array (concepts, teaching, assessment, revision, tutor, and section-level visuals). The
            root metadata is used to link it to a real chapter and section (creating them if they
            don't exist yet). Imported content goes live immediately. Older exports (root
            board/classNum/subject/chapterNum/sectionNo metadata with an <code>extraction.concepts</code>{" "}
            array and a <code>concepts</code> map) are still accepted and converted automatically.
          </p>
        </div>
        <div className="admin-bulk-pipeline-header-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Importing..." : "Upload JSON"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: "none" }}
            onChange={handleFileSelected}
          />
        </div>
      </header>

      {uploadError && <p className="error-text">{uploadError}</p>}

      {(uploading || logEvents.length > 0) && (
        <div className="admin-concept-import-log">
          {logEvents.length === 0 ? (
            <p className="admin-concept-import-log-empty">Waiting for the server to start processing...</p>
          ) : (
            logEvents.map((logEvent, index) => (
              <p
                key={index}
                className={`admin-concept-import-log-line is-${logEvent.type}`}
              >
                <span className="admin-concept-import-log-icon">{LOG_EVENT_ICON[logEvent.type] || "•"}</span>
                {logEvent.message}
              </p>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      )}

      {result && (
        <div className="modal-backdrop" onClick={() => setResult(null)}>
          <div className="modal-panel is-wide" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close-button" aria-label="Close" onClick={() => setResult(null)}>
              &times;
            </button>
            <h2>Import Results</h2>
            <div className="admin-bulk-pipeline-summary">
              <span>Concepts in file: {result.conceptsProcessed}</span>
              <span>
                {result.catalogTarget
                  ? `Linked to chapter #${result.catalogTarget.fkMstChapterId} / section #${result.catalogTarget.sourceSectionId} (normal chapters -> sections flow)`
                  : "Not linked to a chapter/section (see warnings below)"}
              </span>
            </div>
            <div className="admin-bulk-pipeline-summary">
              {Object.entries(COUNT_LABELS).map(([key, label]) => (
                <span key={key}>
                  {label}: {result.counts?.[key] ?? 0}
                </span>
              ))}
            </div>
            {result.warnings?.length > 0 && (
              <div className="admin-books-bulk-results-list">
                {result.warnings.map((warning) => (
                  <div className="admin-bulk-pipeline-failure-banner" key={warning}>
                    {warning}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
