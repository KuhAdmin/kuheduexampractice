import { useRef, useState } from "react";
import { getSectionPreWarmupContent, uploadPreWarmupImport } from "../api/client";
import { useAuth } from "../context/authHooks";
import { isAdmin } from "../roles";

const STEP_ICON = { pending: "○", active: "●", done: "✓", error: "✕" };

const readFileAsText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Failed to read the selected file."));
    reader.readAsText(file);
  });

const REQUIRED_ROOT_FIELDS = [
  "board",
  "classNum",
  "subject",
  "book",
  "chapterNum",
  "chapterName",
  "sectionNo",
  "sectionName",
];

// Older files use a single flat "prewarmup" object instead of
// preLessonWarmup/postLesson -- the server auto-upgrades that shape (see
// normalizePreWarmupPayload), so it's accepted here too rather than
// rejected before it even reaches the server.
const isLegacyPayloadShape = (payload) =>
  Boolean(payload) && typeof payload === "object" && Boolean(payload.prewarmup) && typeof payload.prewarmup === "object";

const validatePayloadShape = (payload) => {
  if (!payload || typeof payload !== "object") {
    return "The file does not contain a JSON object.";
  }
  const missing = REQUIRED_ROOT_FIELDS.filter((field) => {
    const value = payload[field];
    return value === undefined || value === null || String(value).trim() === "";
  });
  if (missing.length) {
    return `Missing required root field(s): ${missing.join(", ")}.`;
  }
  if (isLegacyPayloadShape(payload)) {
    return null;
  }
  if (!payload.preLessonWarmup || typeof payload.preLessonWarmup !== "object") {
    return 'Missing "preLessonWarmup" object.';
  }
  if (!payload.postLesson || typeof payload.postLesson !== "object") {
    return 'Missing "postLesson" object.';
  }
  return null;
};

// The server reports a missing Micro Learning Unit Import as a 409 with this
// phrase in its message (see preWarmupImportService.js) -- apiRequest
// collapses every non-2xx into a plain Error with just that message, so
// matching on it is how this distinguishes "expected precondition" from
// "something broke".
const isMissingConceptImportError = (message) => Boolean(message) && message.includes("Micro Learning Unit Import");

export const AdminPreWarmupImportPage = () => {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [needsConceptImport, setNeedsConceptImport] = useState(false);
  const [result, setResult] = useState(null);
  const [fileName, setFileName] = useState("");
  // There's no server-side progress stream to show here, unlike Concept
  // Import's NDJSON log -- this is a single-row upsert, not a multi-item
  // pipeline, so there's nothing to stream progress *of*. This step list is
  // purely client-side, so the admin still sees something happen instead of
  // a silent spinner, and the final "Verified in database" step re-fetches
  // the row (rather than trusting the write response alone) so a genuine
  // silent failure would show up here instead of a false "Created".
  const [steps, setSteps] = useState([]);

  const setStepStatus = (label, status) => {
    setSteps((current) => {
      const next = current.filter((step) => step.label !== label);
      next.push({ label, status });
      return next;
    });
  };

  if (!isAdmin(user)) {
    return (
      <section className="admin-bulk-pipeline-page">
        <header className="admin-bulk-pipeline-header">
          <div>
            <span className="eyebrow">Admin module</span>
            <h1>Pre-Warmup Import</h1>
          </div>
        </header>
        <p className="error-text">Admins only. This page isn't available to your role.</p>
      </section>
    );
  }

  const handleFileSelected = async (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setUploadError("");
    setNeedsConceptImport(false);
    setResult(null);
    setFileName(file.name);
    setSteps([]);

    try {
      setStepStatus("Reading and parsing file", "active");
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
      setStepStatus("Reading and parsing file", "done");

      setStepStatus("Uploading and resolving chapter/section", "active");
      const response = await uploadPreWarmupImport(payload);
      setStepStatus("Uploading and resolving chapter/section", "done");

      (response.summary?.tablesTouched || []).forEach(({ table, operation }) => {
        setStepStatus(`Table: ${table} — ${operation}`, "done");
      });

      setStepStatus("Verifying it was actually saved", "active");
      const verifyResult = await getSectionPreWarmupContent(response.summary.sectionId);
      if (verifyResult?.preWarmup?.contentKey !== response.summary.contentKey) {
        setStepStatus("Verifying it was actually saved", "error");
        throw new Error(
          "The server reported success, but re-reading it back did not find a matching record. Please retry."
        );
      }
      setStepStatus("Verifying it was actually saved", "done");

      setResult({ ...response.summary, verifiedUpdatedAt: verifyResult.preWarmup.updatedAt });
    } catch (err) {
      const message = err.message || "Failed to import the file.";
      if (isMissingConceptImportError(message)) {
        setNeedsConceptImport(true);
      }
      setUploadError(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="admin-bulk-pipeline-page">
      <header className="admin-bulk-pipeline-header">
        <div>
          <span className="eyebrow">Admin module</span>
          <h1>Pre-Warmup Import</h1>
          <p>
            Upload a pre-lesson/post-lesson warm-up JSON: root board/classNum/subject/book/chapterNum/
            chapterName/sectionNo/sectionName metadata, plus <code>preLessonWarmup</code> (vocabulary,
            sensory, and experiential warm-up) and <code>postLesson</code> (holistic assessment,
            transferable patterns, story anchor questions) objects. The section must already have
            content from Micro Learning Unit Import -- this attaches to that section's existing content key rather
            than creating a new one. Older exports (a single flat <code>prewarmup</code> object) are
            still accepted and upgraded automatically.
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

      {fileName && <p className="admin-bulk-pipeline-concurrency">File: {fileName}</p>}

      {steps.length > 0 && (
        <div className="admin-concept-import-log">
          {steps.map((step) => (
            <p key={step.label} className={`admin-concept-import-log-line is-${step.status === "error" ? "error" : "info"}`}>
              <span className="admin-concept-import-log-icon">{STEP_ICON[step.status] || "○"}</span>
              {step.label}
            </p>
          ))}
        </div>
      )}

      {needsConceptImport ? (
        <div className="admin-bulk-pipeline-failure-banner">
          {uploadError}{" "}
          <a href="/admin/concept-import">Go to Micro Learning Unit Import</a>
        </div>
      ) : (
        uploadError && <p className="error-text">{uploadError}</p>
      )}

      {result && (
        <div className="modal-backdrop" onClick={() => setResult(null)}>
          <div className="modal-panel is-wide" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close-button" aria-label="Close" onClick={() => setResult(null)}>
              &times;
            </button>
            <h2>Import Result</h2>
            <div className="admin-bulk-pipeline-summary">
              <span>Section: {result.sectionName}</span>
              <span>Chapter #{result.chapterId} / Section #{result.sectionId}</span>
              <span>Content key: {result.contentKey}</span>
              <span>Action: {result.action === "created" ? "Created" : "Updated"}</span>
              <span>
                ✓ Verified in database (re-read back, last updated {new Date(result.verifiedUpdatedAt).toLocaleString()})
              </span>
            </div>
            {result.tablesTouched?.length > 0 && (
              <div className="admin-bulk-pipeline-summary">
                {result.tablesTouched.map(({ table, operation }) => (
                  <span key={table}>
                    {table}: {operation}
                  </span>
                ))}
              </div>
            )}
            <p>
              <a href="/admin/content-editor">Open this section in Content Editor</a> to see the stored content
              (select the same book, then this section -- the "Pre-Warmup Content" panel below the tree shows it).
            </p>
          </div>
        </div>
      )}
    </section>
  );
};
