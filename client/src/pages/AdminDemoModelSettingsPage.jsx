import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDemoModelSettings, updateDemoSubjectModelOverride } from "../api/client";

const emptyOverride = { ocrModelId: null, gradingModelId: null };

export const AdminDemoModelSettingsPage = () => {
  const [subjects, setSubjects] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);
  const [subjectOverrides, setSubjectOverrides] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingSubjectCode, setUpdatingSubjectCode] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getDemoModelSettings()
      .then((data) => {
        if (cancelled) return;
        setSubjects(data?.subjects || []);
        setAvailableModels(data?.availableModels || []);
        setSubjectOverrides(data?.subjectOverrides || {});
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load model settings.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFieldChange = async (subjectCode, field, value) => {
    const previousOverrides = subjectOverrides;
    const currentOverride = subjectOverrides[subjectCode] || emptyOverride;
    const nextOverride = { ...currentOverride, [field]: value || null };

    setSubjectOverrides((current) => ({ ...current, [subjectCode]: nextOverride }));
    setUpdatingSubjectCode(subjectCode);
    setError("");

    try {
      const updated = await updateDemoSubjectModelOverride(subjectCode, nextOverride);
      setSubjectOverrides(updated?.subjectOverrides || nextOverride);
    } catch (err) {
      setSubjectOverrides(previousOverrides);
      setError(err.message || "Failed to update the model setting.");
    } finally {
      setUpdatingSubjectCode(null);
    }
  };

  return (
    <section className="admin-bulk-pipeline-page">
      <header className="admin-bulk-pipeline-header">
        <div>
          <span className="eyebrow">Admin module</span>
          <h1>Demo Model Settings</h1>
          <p>
            Choose which AI model handles OCR and which handles AI grading for each subject in the{" "}
            <Link to="/admin/ai-assessment-studio/demo">AI Assessment Demo</Link>. Leave a subject on
            "Use system default" to keep the built-in routing (Hindi/Bengali OCR uses Gemini; everything
            else uses the provider default).
          </p>
        </div>
      </header>

      {error && <p className="error-text">{error}</p>}

      <div className="admin-bulk-pipeline-grid-shell">
        {loading ? (
          <div className="admin-bulk-pipeline-empty">Loading subjects...</div>
        ) : subjects.length === 0 ? (
          <div className="admin-bulk-pipeline-empty">No subjects found.</div>
        ) : (
          <table className="admin-exam-types-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>OCR Model</th>
                <th>AI Grading Model</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject) => {
                const override = subjectOverrides[subject.nameCode] || emptyOverride;
                const busy = updatingSubjectCode === subject.nameCode;
                return (
                  <tr key={subject.id}>
                    <td>
                      {subject.name} <span className="admin-exam-types-code-badge">{subject.nameCode}</span>
                    </td>
                    <td>
                      <select
                        value={override.ocrModelId || ""}
                        disabled={busy}
                        onChange={(event) =>
                          handleFieldChange(subject.nameCode, "ocrModelId", event.target.value)
                        }
                      >
                        <option value="">Use system default</option>
                        {availableModels.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={override.gradingModelId || ""}
                        disabled={busy}
                        onChange={(event) =>
                          handleFieldChange(subject.nameCode, "gradingModelId", event.target.value)
                        }
                      >
                        <option value="">Use system default</option>
                        {availableModels.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};
