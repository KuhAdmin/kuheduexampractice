import { useCallback, useEffect, useState } from "react";
import {
  getAiModelSettings,
  getAssessmentStudioLayerVersions,
  rerunAssessmentStudioPipelineLayer,
  selectAssessmentStudioLayerVersion,
} from "../api/client";

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const formatJson = (value) => {
  if (value === null || value === undefined) {
    return "(no output captured)";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export const LayerVersionsModal = ({ jobId, layerNumber, layerName, onClose, onDefaultChanged }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [rerunBusy, setRerunBusy] = useState(false);
  // assessmentUnitId -> array of up to 2 generationIds picked for side-by-side compare
  const [compareByUnit, setCompareByUnit] = useState({});
  const [availableModels, setAvailableModels] = useState([]);
  const [defaultModelId, setDefaultModelId] = useState("");
  const [rerunModelId, setRerunModelId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAssessmentStudioLayerVersions(jobId, layerNumber);
      setData(result);
    } catch (loadError) {
      setError(loadError.message || "Failed to load layer versions.");
    } finally {
      setLoading(false);
    }
  }, [jobId, layerNumber]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getAiModelSettings()
      .then((settings) => {
        setAvailableModels(settings?.availableModels || []);
        const layerDefault = settings?.layerOverrides?.[layerNumber] || settings?.activeModelId || "";
        setDefaultModelId(layerDefault);
      })
      .catch(() => {});
  }, [layerNumber]);

  const toggleCompare = (assessmentUnitId, generationId) => {
    setCompareByUnit((current) => {
      const existing = current[assessmentUnitId] || [];
      const next = existing.includes(generationId)
        ? existing.filter((id) => id !== generationId)
        : [...existing, generationId].slice(-2);
      return { ...current, [assessmentUnitId]: next };
    });
  };

  const handleSetDefault = async (assessmentUnitId, generationId) => {
    const key = `${assessmentUnitId}:${generationId}`;
    setBusyKey(key);
    setNotice("");
    setError("");
    try {
      await selectAssessmentStudioLayerVersion(assessmentUnitId, layerNumber, generationId);
      setNotice(`Set as default for ${assessmentUnitId}.`);
      await load();
      onDefaultChanged?.();
    } catch (selectError) {
      setError(selectError.message || "Failed to set default version.");
    } finally {
      setBusyKey("");
    }
  };

  const handleRerun = async () => {
    const modelLabel =
      availableModels.find((model) => model.id === rerunModelId)?.label ||
      (rerunModelId ? rerunModelId : "the configured default model");
    const confirmed = window.confirm(
      `Re-run "${layerName}" for every assessment unit in this section using ${modelLabel}? This creates a new version for each unit and makes it the default; earlier versions stay available for comparison.`
    );
    if (!confirmed) return;

    setRerunBusy(true);
    setNotice("");
    setError("");
    try {
      const result = await rerunAssessmentStudioPipelineLayer(jobId, layerNumber, rerunModelId || null);
      setNotice(
        `Re-ran ${result?.layerName || layerName} with ${result?.modelName || modelLabel}: ${result?.regeneratedUnits ?? 0} unit(s), ${(result?.totalTokens ?? 0).toLocaleString()} tokens.`
      );
      await load();
      onDefaultChanged?.();
    } catch (rerunError) {
      setError(rerunError.message || "Failed to re-run layer.");
    } finally {
      setRerunBusy(false);
    }
  };

  const assessmentUnits = data?.assessmentUnits || [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel layer-versions-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="close-button" onClick={onClose}>
          x
        </button>
        <p className="eyebrow">Layer versions</p>
        <h2>{layerName}</h2>

        <div className="layer-versions-toolbar">
          <button type="button" className="ghost-button" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <label className="layer-versions-model-select">
            <span>Model for re-run</span>
            <select value={rerunModelId} onChange={(event) => setRerunModelId(event.target.value)}>
              <option value="">
                {availableModels.find((model) => model.id === defaultModelId)?.label
                  ? `Default (${availableModels.find((model) => model.id === defaultModelId).label})`
                  : "Default (configured model)"}
              </option>
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="primary-button"
            onClick={handleRerun}
            disabled={rerunBusy || layerNumber <= 1}
          >
            {rerunBusy ? "Re-running..." : "Re-run this layer"}
          </button>
        </div>

        {notice && <div className="admin-bulk-pipeline-concurrency">{notice}</div>}
        {error && <p className="error-text">{error}</p>}

        <div className="layer-versions-body">
          {loading ? (
            <p>Loading versions...</p>
          ) : assessmentUnits.length === 0 ? (
            <p>No versions recorded for this layer yet.</p>
          ) : (
            assessmentUnits.map((unit) => {
              const compareIds = compareByUnit[unit.assessmentUnitId] || [];
              const compareVersions = unit.versions.filter((version) =>
                compareIds.includes(version.generationId)
              );

              return (
                <div key={unit.assessmentUnitId} className="layer-versions-unit">
                  <h3>{unit.assessmentUnitId}</h3>

                  {unit.versions.length === 0 ? (
                    <p className="admin-bulk-pipeline-hint">No versions yet.</p>
                  ) : (
                    <div className="layer-versions-chip-row">
                      {unit.versions.map((version) => {
                        const key = `${unit.assessmentUnitId}:${version.generationId}`;
                        const isComparing = compareIds.includes(version.generationId);
                        return (
                          <div
                            key={version.generationId}
                            className={`layer-version-chip ${version.isSelected ? "is-selected" : ""} ${isComparing ? "is-comparing" : ""}`}
                          >
                            <button
                              type="button"
                              className="layer-version-chip-main"
                              onClick={() => toggleCompare(unit.assessmentUnitId, version.generationId)}
                              title="Toggle for side-by-side compare"
                            >
                              <strong>v{version.versionNumber}</strong>
                              {version.isSelected && <span className="layer-version-live-badge">Live</span>}
                              <span className="admin-pipeline-runs-datetime">
                                {formatDateTime(version.createdAt)}
                              </span>
                              <span>{version.totalTokens.toLocaleString()} tokens</span>
                              <span className="layer-version-model-name">{version.modelName || "unknown model"}</span>
                            </button>
                            {!version.isSelected && (
                              <button
                                type="button"
                                className="ghost-button layer-version-set-default"
                                disabled={busyKey === key}
                                onClick={() => handleSetDefault(unit.assessmentUnitId, version.generationId)}
                              >
                                {busyKey === key ? "Working..." : "Set as default"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {compareVersions.length > 0 && (
                    <div
                      className="layer-versions-compare-panes"
                      style={{ gridTemplateColumns: `repeat(${compareVersions.length}, 1fr)` }}
                    >
                      {compareVersions.map((version) => (
                        <div key={version.generationId} className="layer-versions-compare-pane">
                          <div className="layer-versions-compare-pane-header">
                            v{version.versionNumber} {version.isSelected ? "(Live)" : ""} · {version.modelName || "unknown model"}
                          </div>
                          <pre>{formatJson(version.outputJson)}</pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
