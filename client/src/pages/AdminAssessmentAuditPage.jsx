import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  downloadAssessmentStudioPipelineAudit,
  getAssessmentStudioPipelineAudit,
} from "../api/client";

const formatJson = (value) => JSON.stringify(value ?? null, null, 2);

const downloadTextFile = (fileName, text) => {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(objectUrl);
};

export const AdminAssessmentAuditPage = () => {
  const { jobId = "" } = useParams();
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  const loadAudit = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getAssessmentStudioPipelineAudit(jobId);
      setAudit(data);
    } catch (loadError) {
      setError(loadError.message || "Failed to load pipeline audit log.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudit();
  }, [jobId]);

  useEffect(() => {
    if (!audit || audit.job?.status !== "running") {
      return undefined;
    }

    const timer = window.setInterval(() => {
      loadAudit();
    }, 2000);

    return () => window.clearInterval(timer);
  }, [audit?.job?.status, jobId]);

  const handleDownload = async () => {
    setDownloading(true);
    setError("");

    try {
      const text = await downloadAssessmentStudioPipelineAudit(jobId);
      downloadTextFile(`${jobId}.txt`, text);
    } catch (downloadError) {
      setError(downloadError.message || "Failed to download pipeline audit log.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="admin-studio-page admin-audit-page">
      <div className="admin-studio-header">
        <div>
          <span className="eyebrow">Pipeline audit</span>
          <h1>Assessment Run Audit Log</h1>
          <p>Review every layer input and output for this pipeline execution.</p>
        </div>
        <div className="admin-studio-draft">
          <strong>{audit?.job?.status || "Loading"}</strong>
          <span>{jobId}</span>
          <small>{audit?.fileName || "Text file will be generated on demand."}</small>
        </div>
      </div>

      <section className="admin-studio-panel admin-audit-toolbar">
        <div className="admin-panel-head">
          <h2>Audit Controls</h2>
          <span>Open during the run, refresh it live, or download the `.txt` report.</span>
        </div>
        <div className="admin-audit-actions">
          <Link
            className="ghost-button"
            to={`/admin/ai-assessment-studio?step=1&jobId=${encodeURIComponent(jobId)}`}
          >
            Back to Pipeline
          </Link>
          <button className="ghost-button" type="button" onClick={loadAudit} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? "Preparing .txt..." : "Download .txt"}
          </button>
        </div>
        {error ? <p className="admin-studio-pipeline-error">{error}</p> : null}
      </section>

      <section className="admin-studio-panel">
        <div className="admin-panel-head">
          <h2>Run Summary</h2>
          <span>The persisted pipeline execution header for this job id.</span>
        </div>
        {audit ? (
          <div className="admin-audit-summary-grid">
            <div className="admin-studio-context-pill">
              <span>Status</span>
              <strong>{audit.job.status}</strong>
            </div>
            <div className="admin-studio-context-pill">
              <span>Source Section</span>
              <strong>{audit.job.sourceSectionId || "Pending"}</strong>
            </div>
            <div className="admin-studio-context-pill">
              <span>Source Document</span>
              <strong>{audit.job.sourceDocumentId || "Pending"}</strong>
            </div>
            <div className="admin-studio-context-pill">
              <span>MST Chapter</span>
              <strong>{audit.job.fkMstChapterId || "Pending"}</strong>
            </div>
          </div>
        ) : null}
        <div className="admin-audit-json-card">
          <strong>Request Payload</strong>
          <pre>{formatJson(audit?.job?.requestPayload)}</pre>
        </div>
      </section>

      <section className="admin-studio-panel">
        <div className="admin-panel-head">
          <h2>Layer Audit</h2>
          <span>Each persisted layer entry for this job, including cached reuses.</span>
        </div>
        {loading && !audit ? <p>Loading audit log...</p> : null}
        {!loading && audit?.layers?.length === 0 ? (
          <p>No layer audit rows are available yet for this job.</p>
        ) : null}
        <div className="admin-audit-layer-list">
          {audit?.layers?.map((layer) => (
            <article key={layer.id} className="admin-audit-layer-card">
              <div className="admin-audit-layer-head">
                <div>
                  <strong>
                    Layer {layer.layerNumber}: {layer.layerName}
                  </strong>
                  <span>
                    {layer.assessmentUnitId
                      ? `Assessment Unit ${layer.assessmentUnitId}`
                      : "Section-wide"}
                  </span>
                </div>
                <div className="admin-audit-layer-meta">
                  <span>{layer.status}</span>
                  <span>{layer.isCached ? "Cached" : "Fresh"}</span>
                  <span>{layer.modelName || "Model pending"}</span>
                </div>
              </div>

              <div className="admin-audit-layer-summary">
                <div className="admin-studio-balance-row">
                  <span>Generation ID</span>
                  <strong>{layer.generationId || "Pending"}</strong>
                </div>
                <div className="admin-studio-balance-row">
                  <span>Generation Source Job ID</span>
                  <strong>{layer.generationPipelineJobId || "Current job"}</strong>
                </div>
                <div className="admin-studio-balance-row">
                  <span>OpenAI Response ID</span>
                  <strong>{layer.openAiResponseId || "Not available"}</strong>
                </div>
                <div className="admin-studio-balance-row">
                  <span>Tokens</span>
                  <strong>
                    In {layer.tokenInput ?? 0} / Out {layer.tokenOutput ?? 0}
                  </strong>
                </div>
              </div>

              <div className="admin-audit-json-grid">
                <div className="admin-audit-json-card">
                  <strong>Input JSON</strong>
                  <pre>{formatJson(layer.inputJson)}</pre>
                </div>
                <div className="admin-audit-json-card">
                  <strong>Output JSON</strong>
                  <pre>{formatJson(layer.outputJson)}</pre>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
};
