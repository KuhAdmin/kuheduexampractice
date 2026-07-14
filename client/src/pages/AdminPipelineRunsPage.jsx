import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  deleteAssessmentStudioPipelineRun,
  getCompletedAssessmentStudioRuns,
  getSourceDocumentPdf,
  getSourceSectionDraft,
  initializeAssessmentStudioDatabase,
  uploadChapterExercise,
} from "../api/client";
import { LayerVersionsModal } from "../components/LayerVersionsModal";
import { AdminPdfPageLightbox } from "../components/AdminPdfPageLightbox";

const openDataUrlInNewTab = (dataUrl) => {
  const [, base64] = dataUrl.split(",");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: "application/pdf" });
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Failed to read the selected image."));
    reader.readAsDataURL(file);
  });

export const AdminPipelineRunsPage = () => {
  const [layers, setLayers] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyJobId, setBusyJobId] = useState("");
  const [initBusy, setInitBusy] = useState(false);
  const [versionsModal, setVersionsModal] = useState(null);
  const [exerciseModalRun, setExerciseModalRun] = useState(null);
  const [exerciseModalImage, setExerciseModalImage] = useState(null);
  const [exerciseModalBusy, setExerciseModalBusy] = useState(false);
  const [exerciseModalError, setExerciseModalError] = useState("");
  const [exerciseResults, setExerciseResults] = useState({});
  const [sourceModalRun, setSourceModalRun] = useState(null);
  const [sourceModalData, setSourceModalData] = useState(null);
  const [sourceModalLoading, setSourceModalLoading] = useState(false);
  const [sourceModalError, setSourceModalError] = useState("");
  const [sourceLightboxImage, setSourceLightboxImage] = useState(null);

  const openSourceModal = async (run) => {
    setSourceModalRun(run);
    setSourceModalData(null);
    setSourceModalError("");
    setSourceModalLoading(true);
    try {
      const [draft, pdf] = await Promise.all([
        getSourceSectionDraft(run.sourceSectionId),
        run.sourceDocumentId ? getSourceDocumentPdf(run.sourceDocumentId).catch(() => null) : Promise.resolve(null),
      ]);
      setSourceModalData({ draft, pdf: pdf?.pdf || null });
    } catch (error) {
      setSourceModalError(error.message || "Failed to load the source content for this run.");
    } finally {
      setSourceModalLoading(false);
    }
  };

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getCompletedAssessmentStudioRuns();
      setLayers(data?.layers || []);
      setRuns(data?.runs || []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load completed pipelines.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const handleInitializeSchema = async () => {
    setInitBusy(true);
    setNotice("");
    setError("");
    try {
      const result = await initializeAssessmentStudioDatabase({});
      setNotice(result?.message || "Database schema initialized.");
      await loadRuns();
    } catch (initError) {
      setError(initError.message || "Failed to initialize schema.");
    } finally {
      setInitBusy(false);
    }
  };

  const handleResetSchema = async () => {
    const confirmed = window.confirm(
      "Reset re-creates the pipeline schema and DROPS all persisted pipeline data. This cannot be undone. Continue?"
    );
    if (!confirmed) return;

    setInitBusy(true);
    setNotice("");
    setError("");
    try {
      const result = await initializeAssessmentStudioDatabase({ reset: true, confirm: "RESET" });
      setNotice(result?.message || "Database schema reset.");
      await loadRuns();
    } catch (resetError) {
      setError(resetError.message || "Failed to reset schema.");
    } finally {
      setInitBusy(false);
    }
  };

  const handleDelete = async (run) => {
    const confirmed = window.confirm(
      `Delete this completed pipeline run for "${run.chapter || "section"} ${run.sectionNumber}"? All generated data for this run will be removed.`
    );
    if (!confirmed) return;

    setBusyJobId(run.jobId);
    setNotice("");
    setError("");
    try {
      const result = await deleteAssessmentStudioPipelineRun(run.jobId);
      setNotice(
        `Deleted pipeline run (${result?.deletedGenerations ?? 0} generations removed).`
      );
      setRuns((current) => current.filter((item) => item.jobId !== run.jobId));
    } catch (deleteError) {
      setError(deleteError.message || "Failed to delete pipeline run.");
    } finally {
      setBusyJobId("");
    }
  };

  const handleExerciseUpload = async () => {
    if (!exerciseModalRun || !exerciseModalImage) return;
    const [bookId, chapterNumber] = exerciseModalRun.chapterKey.split(":");

    setExerciseModalBusy(true);
    setExerciseModalError("");
    try {
      const result = await uploadChapterExercise(bookId, chapterNumber, {
        dataUrl: exerciseModalImage.dataUrl,
        mimeType: exerciseModalImage.type,
        chapterName: exerciseModalRun.chapter,
      });
      setExerciseResults((current) => ({
        ...current,
        [exerciseModalRun.jobId]: {
          status: "completed",
          questionCount: result?.questionCount || 0,
          bookId,
          chapterNumber,
        },
      }));
      setExerciseModalRun(null);
      setExerciseModalImage(null);
    } catch (uploadError) {
      setExerciseModalError(uploadError.message || "Chapter exercise extraction failed.");
    } finally {
      setExerciseModalBusy(false);
    }
  };

  const summary = useMemo(() => {
    const totalTokens = runs.reduce((sum, run) => sum + (run.totalTokens || 0), 0);
    return { total: runs.length, totalTokens };
  }, [runs]);

  return (
    <section className="admin-bulk-pipeline-page">
      <div className="admin-bulk-pipeline-header">
        <div>
          <span className="eyebrow">Admin module</span>
          <h1>Completed Pipeline Runs</h1>
          <p>
            Review every completed generation run, delete runs selectively, and compare or re-run a
            single layer's versions.
          </p>
        </div>
        <div className="admin-pipeline-runs-actions">
          <button type="button" className="ghost-button" onClick={loadRuns} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={handleInitializeSchema}
            disabled={initBusy}
          >
            {initBusy ? "Working..." : "Initialize Schema"}
          </button>
          <button
            type="button"
            className="ghost-button admin-pipeline-runs-danger"
            onClick={handleResetSchema}
            disabled={initBusy}
          >
            Reset Schema
          </button>
        </div>
      </div>

      {notice && <div className="admin-bulk-pipeline-concurrency">{notice}</div>}
      {error && <p className="error-text">{error}</p>}

      {runs.length > 0 && (
        <div className="admin-bulk-pipeline-summary">
          <span>{summary.total} completed runs</span>
          <span>{summary.totalTokens.toLocaleString()} tokens</span>
        </div>
      )}

      <div className="admin-bulk-pipeline-grid-shell">
        {loading ? (
          <div className="admin-bulk-pipeline-empty">Loading completed pipelines...</div>
        ) : runs.length === 0 ? (
          <div className="admin-bulk-pipeline-empty">
            No completed pipeline runs yet.
          </div>
        ) : (
          <table className="admin-bulk-pipeline-grid">
            <thead>
              <tr>
                <th>Section</th>
                <th>Completed</th>
                {layers.map((layer) => (
                  <th key={layer}>{layer}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const rowBusy = busyJobId === run.jobId;
                return (
                  <tr key={run.jobId}>
                    <td>
                      <strong>{run.chapter || "(chapter)"}</strong>
                      <span className="admin-bulk-pipeline-section-label">
                        {run.sectionNumber ? `${run.sectionNumber} · ` : ""}
                        {run.subject} {run.className ? `· Class ${run.className}` : ""}
                      </span>
                      {run.practiceType && (
                        <span className="admin-bulk-pipeline-section-label">
                          {run.practiceType}
                          {run.targetDifficulty ? ` · ${run.targetDifficulty}` : ""}
                        </span>
                      )}
                      {exerciseResults[run.jobId]?.status === "completed" && (
                        <span className="admin-bulk-pipeline-section-label">
                          Chapter exercises: {exerciseResults[run.jobId].questionCount} question
                          {exerciseResults[run.jobId].questionCount === 1 ? "" : "s"} extracted, pending review.{" "}
                          <Link
                            to={`/admin/ai-assessment-studio/chapter-exercises/${exerciseResults[run.jobId].bookId}/${exerciseResults[run.jobId].chapterNumber}`}
                          >
                            Review now
                          </Link>
                        </span>
                      )}
                    </td>
                    <td className="admin-pipeline-runs-datetime">
                      {formatDateTime(run.updatedAt)}
                    </td>
                    {layers.map((layerName, index) => {
                      const layerNumber = index + 1;
                      const layerStatus = run.layerStatuses[index];
                      const tokens = run.tokenRows[index] || 0;
                      const canOpenVersions = layerNumber > 1 && layerStatus === "completed";
                      return (
                        <td key={layerName} className="admin-bulk-pipeline-layer-cell">
                          {layerStatus === "completed" ? (
                            <button
                              type="button"
                              className="admin-pipeline-runs-layer-button"
                              title={
                                canOpenVersions
                                  ? `View ${layerName} versions`
                                  : "Layer 1 defines assessment units and has no version history"
                              }
                              disabled={!canOpenVersions || rowBusy}
                              onClick={() =>
                                setVersionsModal({ jobId: run.jobId, layerNumber, layerName })
                              }
                            >
                              <span className="admin-bulk-pipeline-token-count">
                                {tokens.toLocaleString()}
                              </span>
                              {canOpenVersions && <span className="admin-pipeline-runs-rerun-glyph">⋯</span>}
                            </button>
                          ) : (
                            <span className="admin-bulk-pipeline-dot is-idle" />
                          )}
                        </td>
                      );
                    })}
                    <td className="admin-bulk-pipeline-actions">
                      <a
                        className="ghost-button"
                        href={`/admin/ai-assessment-studio/workbench/${run.jobId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View
                      </a>
                      <button
                        type="button"
                        className="ghost-button"
                        disabled={!run.sourceSectionId}
                        title={
                          run.sourceSectionId
                            ? "View the original PDF/images used for this run"
                            : "No source section is linked to this run"
                        }
                        onClick={() => openSourceModal(run)}
                      >
                        View Source
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        disabled={!run.chapterKey}
                        title={
                          run.chapterKey
                            ? "Upload a chapter-end exercise photo for this chapter"
                            : "This chapter could not be resolved for exercise upload"
                        }
                        onClick={() => {
                          setExerciseModalRun(run);
                          setExerciseModalImage(null);
                          setExerciseModalError("");
                        }}
                      >
                        Upload Chapter Exercises
                      </button>
                      <button
                        type="button"
                        className="ghost-button admin-pipeline-runs-danger"
                        disabled={rowBusy}
                        onClick={() => handleDelete(run)}
                      >
                        {rowBusy ? "Working..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {versionsModal && (
        <LayerVersionsModal
          jobId={versionsModal.jobId}
          layerNumber={versionsModal.layerNumber}
          layerName={versionsModal.layerName}
          onClose={() => setVersionsModal(null)}
          onDefaultChanged={loadRuns}
        />
      )}

      {exerciseModalRun && (
        <div className="modal-backdrop">
          <div className="modal-panel admin-bulk-pipeline-dialog">
            <button className="close-button" onClick={() => setExerciseModalRun(null)}>
              x
            </button>
            <p className="eyebrow">Chapter-end Exercises</p>
            <h2>Upload for {exerciseModalRun.chapter || "this chapter"}</h2>

            <label className="admin-studio-field admin-studio-field-wide">
              <span>Chapter-end exercise photo</span>
              <label className="admin-studio-file-upload">
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (event) => {
                    const file = event.target.files?.[0] || null;
                    if (!file) {
                      setExerciseModalImage(null);
                      return;
                    }

                    try {
                      const dataUrl = await readFileAsDataUrl(file);
                      setExerciseModalImage({ name: file.name, type: file.type, dataUrl });
                    } catch (readError) {
                      setExerciseModalError(readError.message || "Failed to read the selected image.");
                      setExerciseModalImage(null);
                    }
                  }}
                />
                <strong>{exerciseModalImage ? "Replace exercise photo" : "Upload exercise photo"}</strong>
                <small>
                  {exerciseModalImage
                    ? exerciseModalImage.name
                    : "Photograph the textbook's chapter-end exercise/question page."}
                </small>
              </label>
            </label>

            {exerciseModalError && <p className="error-text">{exerciseModalError}</p>}

            <div className="admin-bulk-pipeline-dialog-actions">
              <button type="button" className="ghost-button" onClick={() => setExerciseModalRun(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={!exerciseModalImage || exerciseModalBusy}
                onClick={handleExerciseUpload}
              >
                {exerciseModalBusy ? "Extracting..." : "Extract Questions"}
              </button>
            </div>
          </div>
        </div>
      )}

      {sourceModalRun && (
        <div className="modal-backdrop" onClick={() => setSourceModalRun(null)}>
          <div className="modal-panel is-wide" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" onClick={() => setSourceModalRun(null)}>
              x
            </button>
            <p className="eyebrow">Source Content</p>
            <h2>{sourceModalRun.chapter || "This run"}'s original PDF/images</h2>

            {sourceModalLoading && <p className="admin-empty-state">Loading source content...</p>}
            {sourceModalError && <p className="error-text">{sourceModalError}</p>}

            {sourceModalData && (
              <div className="admin-workbench-stack">
                {sourceModalData.pdf ? (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => openDataUrlInNewTab(sourceModalData.pdf.pdfData)}
                  >
                    Open {sourceModalData.pdf.originalFileName || "original PDF"} (
                    {sourceModalData.pdf.pageCount || "?"} pages)
                  </button>
                ) : (
                  <p className="admin-workbench-muted">
                    No original PDF was uploaded for this section (it may have used the paste-text flow
                    instead).
                  </p>
                )}

                {sourceModalData.draft?.adminNotes && (
                  <p>
                    <strong>Admin notes:</strong> {sourceModalData.draft.adminNotes}
                  </p>
                )}

                {sourceModalData.draft?.images?.length > 0 ? (
                  <div className="admin-source-builder-section-images">
                    {sourceModalData.draft.images.map((image) => (
                      <button
                        key={image.id}
                        type="button"
                        className="admin-source-builder-assigned-thumb"
                        onClick={() =>
                          setSourceLightboxImage({ pageNumber: image.sourcePageNumber, dataUrl: image.mediaData })
                        }
                      >
                        <img src={image.mediaData} alt={`Page ${image.sourcePageNumber || ""}`} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="admin-workbench-muted">No page images were attached to this section.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {sourceLightboxImage && (
        <AdminPdfPageLightbox
          pageNumber={sourceLightboxImage.pageNumber}
          dataUrl={sourceLightboxImage.dataUrl}
          onClose={() => setSourceLightboxImage(null)}
        />
      )}
    </section>
  );
};
