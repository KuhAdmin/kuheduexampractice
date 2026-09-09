import { useCallback, useEffect, useState } from "react";
import { getSectionPreWarmupContent, updateSectionPreWarmupContent } from "../api/client";
import { PreWarmupContentPreview } from "./PreWarmupContentPreview";

// Section-scoped, not concept-scoped -- there's exactly one pre-warmup blob
// per section (see pre_warmup_content in init.sql), unlike MemoryHookPanel
// above which renders once per concept. Rendered once per selected section,
// not per concept, mirroring how AdminContentEditorPage already keys
// loadCards off selectedSection.sourceSectionId.
export const SectionPreWarmupPanel = ({ sourceSectionId, canEdit }) => {
  const [preWarmup, setPreWarmup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setJsonMode(false);
    try {
      const result = await getSectionPreWarmupContent(sourceSectionId);
      setPreWarmup(result?.preWarmup || null);
    } catch (loadError) {
      setError(loadError.message || "Failed to load pre-warmup content.");
    } finally {
      setLoading(false);
    }
  }, [sourceSectionId]);

  useEffect(() => {
    load();
  }, [load]);

  const openJsonMode = () => {
    setJsonText(JSON.stringify(preWarmup.payload, null, 2));
    setJsonError("");
    setJsonMode(true);
  };

  const saveJson = async () => {
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setJsonError("Payload must be valid JSON.");
      return;
    }
    setSaving(true);
    setJsonError("");
    try {
      const result = await updateSectionPreWarmupContent(sourceSectionId, parsed);
      setPreWarmup(result?.preWarmup || null);
      setJsonMode(false);
    } catch (saveError) {
      setJsonError(saveError.message || "Failed to save pre-warmup content.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-bulk-pipeline-grid-shell" style={{ padding: 16, marginTop: 12 }}>
        <p>Loading pre-warmup content...</p>
      </div>
    );
  }

  return (
    <div className="admin-bulk-pipeline-grid-shell" style={{ padding: 16, marginTop: 12 }}>
      <h3 style={{ marginTop: 0 }}>Pre-Warmup Content</h3>
      {error && <p className="error-text">{error}</p>}

      {!error && !preWarmup && (
        <p className="admin-bulk-pipeline-empty">No pre-warmup content uploaded yet for this section.</p>
      )}

      {preWarmup && !jsonMode && (
        <>
          <div className="admin-bulk-pipeline-summary">
            <span>Content key: {preWarmup.contentKey}</span>
            <span>Last updated: {new Date(preWarmup.updatedAt).toLocaleString()}</span>
          </div>
          <div style={{ marginTop: 8 }}>
            <PreWarmupContentPreview
              payload={preWarmup.payload}
              sourceSectionId={sourceSectionId}
              onUpdated={setPreWarmup}
            />
          </div>
          {canEdit && (
            <div className="admin-bulk-pipeline-dialog-actions">
              <button type="button" className="ghost-button" onClick={openJsonMode}>
                Edit as JSON
              </button>
            </div>
          )}
        </>
      )}

      {preWarmup && jsonMode && (
        <div className="admin-studio-field">
          <span>Payload (JSON)</span>
          <textarea
            rows={16}
            value={jsonText}
            onChange={(event) => setJsonText(event.target.value)}
            style={{ fontFamily: "monospace", fontSize: 13 }}
          />
          {jsonError && <p className="error-text">{jsonError}</p>}
          <div className="admin-bulk-pipeline-dialog-actions">
            <button type="button" className="ghost-button" onClick={() => setJsonMode(false)} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="primary-button" onClick={saveJson} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
