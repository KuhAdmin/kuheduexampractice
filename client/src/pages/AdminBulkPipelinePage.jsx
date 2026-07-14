import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  getAssessmentStudioBootstrap,
  getAssessmentStudioChapters,
  getAssessmentStudioPipelineConcurrency,
  getAssessmentStudioPipelineStatusBatch,
  getAssessmentStudioSections,
  runAssessmentStudioPipeline,
  abortAssessmentStudioPipeline,
  uploadChapterExercise,
} from "../api/client";

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Failed to read the selected image."));
    reader.readAsDataURL(file);
  });

const FAILURE_CATEGORY_LABELS = {
  rate_limit: "Rate limited",
  quota_exceeded: "API quota/billing issue",
  network: "Network error",
  provider_error: "Provider outage",
  configuration: "Configuration issue",
  validation: "Output validation failed",
  unknown: "Unknown error",
};

const PIPELINE_LAYERS = [
  "Knowledge Extraction",
  "Concept Memory",
  "Assessment Capability",
  "Assessment Strategy",
  "Blueprint Generation",
  "Item Generation",
  "Learning Support",
];

// Table column headers only -- PIPELINE_LAYERS above stays the internal
// identifier list (used for the "run through layer" dialog select and the
// failure banner's "at Layer N" text), this is purely a display relabel so
// the grid reads the same as the rest of the redesigned page.
const LAYER_COLUMN_LABELS = [
  "Development Framework",
  "Concept Maturity",
  "Assessment Capability",
  "Assessment Stability",
  "Blueprint Generation",
  "Item Generation",
  "Learning Support",
];

// layerStatuses uses "paused" for a layer not yet reached (see row creation
// below) -- everything here is a real, already-tracked state, no invented
// per-layer percentage.
const LAYER_STATUS_META = {
  completed: { label: "Completed", className: "is-completed" },
  running: { label: "Running", className: "is-running" },
  queued: { label: "Queued", className: "is-queued" },
  failed: { label: "Failed", className: "is-failed" },
  aborted: { label: "Aborted", className: "is-aborted" },
  paused: { label: "Not Started", className: "is-not-started" },
  idle: { label: "Not Started", className: "is-not-started" },
};

const ROW_STATUS_META = {
  idle: { label: "Idle", className: "is-idle" },
  queued: { label: "Queued", className: "is-queued" },
  running: { label: "Running", className: "is-running" },
  completed: { label: "Completed", className: "is-completed" },
  failed: { label: "Failed", className: "is-failed" },
  aborted: { label: "Aborted", className: "is-aborted" },
};

const PRACTICE_TYPES = [
  "Concept Builder",
  "Rapid Revision",
  "Board Pattern",
  "Full Mock",
  "Weak Area Retry",
  "Memory Booster",
];

const DIFFICULTIES = ["Foundational", "Balanced", "Challenging"];

const POLL_INTERVAL_MS = 1500;
const ACTIVE_JOB_STATUSES = new Set(["queued", "running"]);

const initialDialogState = {
  levelCode: "",
  subjectCode: "",
  subjectName: "",
  chapterKey: "",
  chapterName: "",
  practiceType: PRACTICE_TYPES[0],
  targetDifficulty: "Balanced",
  duration: "25",
  blueprint: "Understand -> recall -> apply -> retry",
  sourceLanguage: "en",
  outputLanguage: "en",
  targetLayerNumber: 7,
};

const makeRowId = (chapterKey, sectionNumber) => `${chapterKey}::${sectionNumber}`;

export const AdminBulkPipelinePage = () => {
  const [bootstrap, setBootstrap] = useState({ levels: [], subjects: [] });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialog, setDialog] = useState(initialDialogState);
  const [chapterOptions, setChapterOptions] = useState([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [chapterExerciseImage, setChapterExerciseImage] = useState(null);
  const [chapterExerciseSummary, setChapterExerciseSummary] = useState(null);

  const [rows, setRows] = useState([]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const [concurrency, setConcurrency] = useState(null);

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  useEffect(() => {
    getAssessmentStudioBootstrap({}).then(setBootstrap).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      getAssessmentStudioPipelineConcurrency()
        .then(setConcurrency)
        .catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!dialogOpen || !dialog.levelCode || !dialog.subjectCode) {
      setChapterOptions([]);
      return undefined;
    }

    let cancelled = false;
    setChaptersLoading(true);
    getAssessmentStudioChapters({
      levelCode: dialog.levelCode,
      subjectCode: dialog.subjectCode,
      excludeCompleted: true,
      targetLayerNumber: dialog.targetLayerNumber,
    })
      .then((data) => {
        if (cancelled) return;
        setChapterOptions(data?.chapters || []);
      })
      .catch((error) => {
        if (!cancelled) setDialogError(error.message || "Failed to load chapters.");
      })
      .finally(() => {
        if (!cancelled) setChaptersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dialogOpen, dialog.levelCode, dialog.subjectCode, dialog.targetLayerNumber]);

  // Single consolidated poller for every active job in the grid, instead of one interval per row.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const activeJobIds = rowsRef.current
        .filter((row) => row.jobId && ACTIVE_JOB_STATUSES.has(row.status))
        .map((row) => row.jobId);

      if (!activeJobIds.length) {
        return;
      }

      getAssessmentStudioPipelineStatusBatch(activeJobIds)
        .then((result) => {
          const byJobId = new Map((result?.jobs || []).map((job) => [job.jobId, job]));
          setRows((current) =>
            current.map((row) => {
              const update = row.jobId ? byJobId.get(row.jobId) : null;
              if (!update) return row;
              return {
                ...row,
                status: update.status,
                layerStatuses: update.layerStatuses || row.layerStatuses,
                tokenRows: update.tokenRows || row.tokenRows,
                error: update.error || "",
                errorCategory: update.errorCategory || "",
                errorRetryable: update.errorRetryable !== false,
                failedLayerNumber: update.failedLayerNumber ?? null,
              };
            })
          );
        })
        .catch(() => {});
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, []);

  const openDialog = () => {
    setDialog(initialDialogState);
    setDialogError("");
    setChapterExerciseImage(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setDialogError("");
    setChapterExerciseImage(null);
  };

  const updateDialog = (patch) => setDialog((current) => ({ ...current, ...patch }));

  const confirmDialog = async () => {
    if (!dialog.chapterKey) {
      setDialogError("Choose a chapter to continue.");
      return;
    }

    setConfirming(true);
    setDialogError("");

    try {
      const { sections } = await getAssessmentStudioSections({
        levelCode: dialog.levelCode,
        subjectCode: dialog.subjectCode,
        chapterKey: dialog.chapterKey,
        targetLayerNumber: dialog.targetLayerNumber,
      });

      const pendingSections = (sections || []).filter((section) => !section.completed);

      if (!pendingSections.length) {
        setDialogError("Every section in this chapter is already generated through the selected layer.");
        setConfirming(false);
        return;
      }

      const sharedParameters = {
        board: "CBSE",
        className: dialog.levelCode,
        subject: dialog.subjectName,
        subjectCode: dialog.subjectCode,
        chapter: dialog.chapterName,
        chapterKey: dialog.chapterKey,
        practiceType: dialog.practiceType,
        targetDifficulty: dialog.targetDifficulty,
        duration: dialog.duration,
        blueprint: dialog.blueprint,
        sourceLanguage: dialog.sourceLanguage,
        outputLanguage: dialog.outputLanguage,
        targetLayerNumber: dialog.targetLayerNumber,
      };

      const levelName =
        bootstrap.levels.find((level) => level.code === dialog.levelCode)?.name || dialog.levelCode;

      setRows((current) => {
        const existingIds = new Set(current.map((row) => row.id));
        const newRows = pendingSections
          .map((section) => ({
            id: makeRowId(dialog.chapterKey, section.sectionNumber),
            chapterKey: dialog.chapterKey,
            chapterName: dialog.chapterName,
            sectionNumber: section.sectionNumber,
            topicName: section.topicName || "",
            levelName,
            subjectName: dialog.subjectName,
            sharedParameters,
            sectionText: "",
            jobId: null,
            status: "idle",
            layerStatuses: PIPELINE_LAYERS.map(() => "paused"),
            tokenRows: PIPELINE_LAYERS.map(() => 0),
            error: "",
            errorCategory: "",
            errorRetryable: true,
            failedLayerNumber: null,
          }))
          .filter((row) => !existingIds.has(row.id));

        return [...current, ...newRows];
      });

      // Chapter-end exercise extraction runs independently of section-row
      // creation -- if no image was attached, nothing here fires at all, and
      // if it fails, the section pipeline rows above are unaffected.
      if (chapterExerciseImage) {
        const [bookId, chapterNumber] = dialog.chapterKey.split(":");
        const chapterName = dialog.chapterName;
        setChapterExerciseSummary({ chapterName, status: "extracting" });
        uploadChapterExercise(bookId, chapterNumber, {
          dataUrl: chapterExerciseImage.dataUrl,
          mimeType: chapterExerciseImage.type,
          chapterName,
        })
          .then((result) => {
            setChapterExerciseSummary({
              chapterName,
              status: "completed",
              questionCount: result?.questionCount || 0,
              bookId,
              chapterNumber,
            });
          })
          .catch((error) => {
            setChapterExerciseSummary({
              chapterName,
              status: "failed",
              error: error.message || "Chapter exercise extraction failed.",
            });
          });
      }

      setChapterExerciseImage(null);
      setDialogOpen(false);
    } catch (error) {
      setDialogError(error.message || "Failed to load chapter sections.");
    } finally {
      setConfirming(false);
    }
  };

  const updateRowText = (rowId, sectionText) => {
    setRows((current) => current.map((row) => (row.id === rowId ? { ...row, sectionText } : row)));
  };

  const startRow = async (rowId) => {
    const row = rowsRef.current.find((item) => item.id === rowId);
    if (!row || !row.sectionText.trim()) {
      return;
    }

    setRows((current) =>
      current.map((item) =>
        item.id === rowId
          ? { ...item, status: "queued", error: "", errorCategory: "", failedLayerNumber: null }
          : item
      )
    );

    try {
      const result = await runAssessmentStudioPipeline({
        ...row.sharedParameters,
        sectionNumber: row.sectionNumber,
        sectionOcrText: row.sectionText,
        sectionImageName: "",
        sectionImageMimeType: "",
        sectionImageDataUrl: "",
      });

      setRows((current) =>
        current.map((item) =>
          item.id === rowId
            ? {
                ...item,
                jobId: result.jobId,
                status: result.status || "queued",
                layerStatuses: PIPELINE_LAYERS.map((_, index) => (index === 0 ? "queued" : "paused")),
                tokenRows: PIPELINE_LAYERS.map(() => 0),
              }
            : item
        )
      );
    } catch (error) {
      setRows((current) =>
        current.map((item) =>
          item.id === rowId
            ? { ...item, status: "failed", error: error.message || "Failed to start pipeline." }
            : item
        )
      );
    }
  };

  const stopRow = async (rowId) => {
    const row = rowsRef.current.find((item) => item.id === rowId);
    if (!row?.jobId) return;

    try {
      await abortAssessmentStudioPipeline(row.jobId);
      setRows((current) =>
        current.map((item) => (item.id === rowId ? { ...item, status: "aborted" } : item))
      );
    } catch (error) {
      setRows((current) =>
        current.map((item) =>
          item.id === rowId ? { ...item, error: error.message || "Failed to stop pipeline." } : item
        )
      );
    }
  };

  const summary = useMemo(() => {
    const total = rows.length;
    const completed = rows.filter((row) => row.status === "completed").length;
    const running = rows.filter((row) => row.status === "running").length;
    const queued = rows.filter((row) => row.status === "queued").length;
    const failed = rows.filter((row) => row.status === "failed").length;
    const aborted = rows.filter((row) => row.status === "aborted").length;
    const totalTokens = rows.reduce(
      (sum, row) => sum + row.tokenRows.reduce((rowSum, value) => rowSum + value, 0),
      0
    );
    const overallProgressPercent = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, running, queued, failed, aborted, totalTokens, overallProgressPercent };
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const clampedPage = Math.min(page, totalPages);
  const pagedRows = rows.slice((clampedPage - 1) * rowsPerPage, clampedPage * rowsPerPage);
  const pageStart = rows.length ? (clampedPage - 1) * rowsPerPage + 1 : 0;
  const pageEnd = Math.min(clampedPage * rowsPerPage, rows.length);

  const goToPage = (nextPage) => setPage(Math.max(1, Math.min(nextPage, totalPages)));

  return (
    <section className="admin-bulk-pipeline-page">
      <nav className="admin-bulk-pipeline-breadcrumb" aria-label="Breadcrumb">
        <span className="admin-bulk-pipeline-breadcrumb-icon" aria-hidden="true">
          ◇
        </span>
        <span>AI Assessment Studio</span>
      </nav>

      <div className="admin-bulk-pipeline-header">
        <div>
          <h1>Content Generation Inventory</h1>
          <p>Run the 7-layer pipeline across many sections in parallel and watch every layer live.</p>
        </div>
        <div className="admin-bulk-pipeline-header-actions">
          <Link to="/admin/ai-assessment-studio/source-builder" className="ghost-button">
            Upload Chapter PDF
          </Link>
          <button type="button" className="primary-button" onClick={openDialog}>
            + New Pipeline
          </button>
          <button type="button" className="ghost-button" disabled title="Coming soon">
            Filter
          </button>
          <button type="button" className="ghost-button" disabled title="Coming soon">
            Export
          </button>
        </div>
      </div>

      {concurrency && (
        <div className="admin-bulk-pipeline-concurrency">
          {concurrency.active}/{concurrency.max} pipeline slots busy
          {concurrency.queued > 0 ? ` · ${concurrency.queued} waiting for a slot` : ""}
        </div>
      )}

      {rows.length > 0 && (
        <div className="admin-bulk-pipeline-stats">
          <div className="admin-bulk-pipeline-stat-cards">
            <div className="admin-bulk-pipeline-stat-card">
              <span>Total sections</span>
              <strong>{summary.total}</strong>
            </div>
            <div className="admin-bulk-pipeline-stat-card is-completed">
              <span>Completed</span>
              <strong>{summary.completed}</strong>
            </div>
            <div className="admin-bulk-pipeline-stat-card is-running">
              <span>Running</span>
              <strong>{summary.running}</strong>
            </div>
            <div className="admin-bulk-pipeline-stat-card is-queued">
              <span>Queued</span>
              <strong>{summary.queued}</strong>
            </div>
            <div className="admin-bulk-pipeline-stat-card is-failed">
              <span>Failed</span>
              <strong>{summary.failed}</strong>
            </div>
            <div className="admin-bulk-pipeline-stat-card is-aborted">
              <span>Aborted</span>
              <strong>{summary.aborted}</strong>
            </div>
          </div>
          <div
            className="admin-bulk-pipeline-progress-ring"
            style={{ "--progress": `${summary.overallProgressPercent}%` }}
          >
            <strong>{summary.overallProgressPercent}%</strong>
            <span>Overall progress</span>
          </div>
        </div>
      )}

      {chapterExerciseSummary && (
        <div className="admin-bulk-pipeline-summary admin-bulk-pipeline-exercise-summary">
          {chapterExerciseSummary.status === "extracting" && (
            <span>Chapter exercises: extracting questions for {chapterExerciseSummary.chapterName}...</span>
          )}
          {chapterExerciseSummary.status === "completed" && (
            <span>
              Chapter exercises: {chapterExerciseSummary.questionCount} question
              {chapterExerciseSummary.questionCount === 1 ? "" : "s"} extracted for{" "}
              {chapterExerciseSummary.chapterName}, pending review.{" "}
              <Link
                to={`/admin/ai-assessment-studio/chapter-exercises/${chapterExerciseSummary.bookId}/${chapterExerciseSummary.chapterNumber}`}
              >
                Review now
              </Link>
            </span>
          )}
          {chapterExerciseSummary.status === "failed" && (
            <span>
              Chapter exercises: extraction failed for {chapterExerciseSummary.chapterName} —{" "}
              {chapterExerciseSummary.error}
            </span>
          )}
        </div>
      )}

      <div className="admin-bulk-pipeline-grid-shell">
        {rows.length === 0 ? (
          <div className="admin-bulk-pipeline-empty">
            No pipelines yet. Click "New Pipeline" to select a chapter and start generating.
          </div>
        ) : (
          <>
            <table className="admin-bulk-pipeline-grid">
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Curriculum Level</th>
                  {LAYER_COLUMN_LABELS.map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row) => {
                  const needsSourceText =
                    row.status === "idle" || row.status === "failed" || row.status === "aborted";
                  const rowStatusMeta = ROW_STATUS_META[row.status] || ROW_STATUS_META.idle;
                  return (
                    <Fragment key={row.id}>
                      <tr>
                        <td>
                          <strong>{row.chapterName}</strong>
                          <span className="admin-bulk-pipeline-section-label">
                            {row.sectionNumber} {row.topicName ? `· ${row.topicName}` : ""}
                          </span>
                          {row.subjectName && (
                            <span className="admin-bulk-pipeline-subject-badge">{row.subjectName}</span>
                          )}
                        </td>
                        <td>
                          <strong>{row.levelName || "—"}</strong>
                        </td>
                        {PIPELINE_LAYERS.map((_, index) => {
                          const layerStatus = row.layerStatuses[index];
                          const tokens = row.tokenRows[index];
                          const meta = LAYER_STATUS_META[layerStatus] || LAYER_STATUS_META.paused;
                          const title =
                            layerStatus === "failed"
                              ? `${FAILURE_CATEGORY_LABELS[row.errorCategory] || "Failed"}: ${row.error}`
                              : undefined;
                          return (
                            <td key={index} className="admin-bulk-pipeline-layer-cell">
                              <span className={`admin-bulk-pipeline-status-badge ${meta.className}`} title={title}>
                                {meta.label}
                              </span>
                              {layerStatus === "completed" && tokens > 0 && (
                                <span className="admin-bulk-pipeline-token-count">
                                  {tokens.toLocaleString()} tokens
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="admin-bulk-pipeline-actions">
                          {row.status === "running" || row.status === "queued" ? (
                            <button type="button" className="ghost-button" onClick={() => stopRow(row.id)}>
                              Stop
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="ghost-button"
                              disabled={!row.sectionText.trim()}
                              onClick={() => startRow(row.id)}
                            >
                              {row.status === "failed" || row.status === "aborted" ? "Retry" : "Start"}
                            </button>
                          )}
                          <a
                            className={`ghost-button ${!row.jobId ? "is-disabled" : ""}`}
                            href={row.jobId ? `/admin/ai-assessment-studio/workbench/${row.jobId}` : undefined}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View
                          </a>
                        </td>
                      </tr>
                      {needsSourceText && (
                        <tr className="admin-bulk-pipeline-source-row">
                          <td colSpan={LAYER_COLUMN_LABELS.length + 3}>
                            {row.status === "failed" && (
                              <div className="admin-bulk-pipeline-failure-banner">
                                <strong>
                                  {FAILURE_CATEGORY_LABELS[row.errorCategory] || "Failed"}
                                  {row.failedLayerNumber
                                    ? ` at Layer ${row.failedLayerNumber} (${PIPELINE_LAYERS[row.failedLayerNumber - 1]})`
                                    : ""}
                                </strong>
                                <span>{row.error}</span>
                              </div>
                            )}
                            <textarea
                              className="admin-bulk-pipeline-source-text"
                              rows={3}
                              placeholder="Paste section OCR text to enable Start"
                              value={row.sectionText}
                              onChange={(event) => updateRowText(row.id, event.target.value)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>

            <div className="admin-bulk-pipeline-pagination">
              <span>
                Showing {pageStart} to {pageEnd} of {rows.length} sections
              </span>
              <div className="admin-bulk-pipeline-pagination-pages">
                <button
                  type="button"
                  className="admin-bulk-pipeline-page-button"
                  onClick={() => goToPage(clampedPage - 1)}
                  disabled={clampedPage <= 1}
                  aria-label="Previous page"
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    className={`admin-bulk-pipeline-page-button ${pageNumber === clampedPage ? "is-active" : ""}`}
                    onClick={() => goToPage(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button
                  type="button"
                  className="admin-bulk-pipeline-page-button"
                  onClick={() => goToPage(clampedPage + 1)}
                  disabled={clampedPage >= totalPages}
                  aria-label="Next page"
                >
                  ›
                </button>
              </div>
              <label className="admin-bulk-pipeline-rows-per-page">
                Rows per page:
                <select
                  value={rowsPerPage}
                  onChange={(event) => {
                    setRowsPerPage(Number(event.target.value));
                    setPage(1);
                  }}
                >
                  {[5, 10, 25, 50].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        )}
      </div>

      {dialogOpen && (
        <div className="modal-backdrop">
          <div className="modal-panel admin-bulk-pipeline-dialog">
            <button className="close-button" onClick={closeDialog}>
              x
            </button>
            <p className="eyebrow">New Pipeline</p>
            <h2>Select a chapter to generate</h2>

            <div className="admin-studio-form-grid">
              <label className="admin-studio-field">
                <span>Subject</span>
                <select
                  value={dialog.subjectCode}
                  onChange={(event) => {
                    const subject = bootstrap.subjects.find((item) => item.code === event.target.value);
                    updateDialog({
                      subjectCode: event.target.value,
                      subjectName: subject?.name || "",
                      chapterKey: "",
                      chapterName: "",
                    });
                  }}
                >
                  <option value="">Select subject</option>
                  {bootstrap.subjects.map((subject) => (
                    <option key={subject.code} value={subject.code}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-studio-field">
                <span>Class</span>
                <select
                  value={dialog.levelCode}
                  onChange={(event) =>
                    updateDialog({ levelCode: event.target.value, chapterKey: "", chapterName: "" })
                  }
                >
                  <option value="">Select class</option>
                  {bootstrap.levels.map((level) => (
                    <option key={level.code} value={level.code}>
                      {level.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-studio-field admin-studio-field-wide">
                <span>Chapter {chaptersLoading ? "(loading...)" : ""}</span>
                <select
                  value={dialog.chapterKey}
                  disabled={!dialog.levelCode || !dialog.subjectCode || chaptersLoading}
                  onChange={(event) => {
                    const chapter = chapterOptions.find((item) => item.key === event.target.value);
                    updateDialog({
                      chapterKey: event.target.value,
                      chapterName: chapter?.chapterName || "",
                    });
                  }}
                >
                  <option value="">Select chapter</option>
                  {chapterOptions.map((chapter) => (
                    <option key={chapter.key} value={chapter.key}>
                      {chapter.chapterName} ({chapter.completedSections}/{chapter.totalSections} done)
                    </option>
                  ))}
                </select>
                {dialog.levelCode && dialog.subjectCode && !chaptersLoading && chapterOptions.length === 0 && (
                  <span className="admin-bulk-pipeline-hint">
                    Every chapter here is already fully generated.
                  </span>
                )}
              </label>

              <label className="admin-studio-field">
                <span>Practice type</span>
                <select
                  value={dialog.practiceType}
                  onChange={(event) => updateDialog({ practiceType: event.target.value })}
                >
                  {PRACTICE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-studio-field">
                <span>Target difficulty</span>
                <select
                  value={dialog.targetDifficulty}
                  onChange={(event) => updateDialog({ targetDifficulty: event.target.value })}
                >
                  {DIFFICULTIES.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-studio-field">
                <span>Duration (minutes)</span>
                <input
                  value={dialog.duration}
                  onChange={(event) => updateDialog({ duration: event.target.value })}
                />
              </label>

              <label className="admin-studio-field">
                <span>Run through layer</span>
                <select
                  value={dialog.targetLayerNumber}
                  onChange={(event) => updateDialog({ targetLayerNumber: Number(event.target.value) })}
                >
                  {PIPELINE_LAYERS.map((layer, index) => (
                    <option key={layer} value={index + 1}>
                      {index + 1}. {layer}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-studio-field admin-studio-field-wide">
                <span>Blueprint hint</span>
                <input
                  value={dialog.blueprint}
                  onChange={(event) => updateDialog({ blueprint: event.target.value })}
                />
              </label>

              <label className="admin-studio-field admin-studio-field-wide">
                <span>Chapter-end exercises (optional)</span>
                <label className="admin-studio-file-upload">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (event) => {
                      const file = event.target.files?.[0] || null;
                      if (!file) {
                        setChapterExerciseImage(null);
                        return;
                      }

                      try {
                        const dataUrl = await readFileAsDataUrl(file);
                        setChapterExerciseImage({ name: file.name, type: file.type, dataUrl });
                      } catch (error) {
                        setDialogError(error.message || "Failed to read the selected image.");
                        setChapterExerciseImage(null);
                      }
                    }}
                  />
                  <strong>
                    {chapterExerciseImage ? "Replace exercise photo" : "Upload chapter-end exercise photo"}
                  </strong>
                  <small>
                    {chapterExerciseImage
                      ? chapterExerciseImage.name
                      : "If left empty, no chapter-exercise extraction happens."}
                  </small>
                </label>
              </label>
            </div>

            {dialogError && <p className="error-text">{dialogError}</p>}

            <div className="admin-bulk-pipeline-dialog-actions">
              <button type="button" className="ghost-button" onClick={closeDialog}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={!dialog.chapterKey || confirming}
                onClick={confirmDialog}
              >
                {confirming ? "Loading sections..." : "Add sections to grid"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
