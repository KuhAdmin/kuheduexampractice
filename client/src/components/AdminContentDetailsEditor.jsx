import { useState } from "react";

// Every content_card.details value observed in the DB is
// Array<{ label: string, value: string | string[] }> regardless of card
// type (assessment/mcq, revision/flashcards, teaching/explain, ...) -- so
// one generic editor covers every card, no per-type forms needed. Default
// mode never shows JSON syntax; `canEditJson` (admin only -- moderators are
// non-technical Office users, see AdminContentEditorPage.jsx) additionally
// reveals a raw-JSON escape hatch for shapes this editor can't represent.
export const AdminContentDetailsEditor = ({ details, onChange, canEditJson }) => {
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");

  const fields = Array.isArray(details) ? details : [];

  const updateField = (index, next) => {
    onChange(fields.map((field, i) => (i === index ? next : field)));
  };

  const removeField = (index) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  const addField = (value) => {
    onChange([...fields, { label: "", value }]);
  };

  const openJsonMode = () => {
    setJsonText(JSON.stringify(fields, null, 2));
    setJsonError("");
    setJsonMode(true);
  };

  const applyJson = () => {
    let parsed;
    try {
      parsed = jsonText.trim() ? JSON.parse(jsonText) : [];
    } catch {
      setJsonError("Details must be valid JSON.");
      return;
    }
    if (!Array.isArray(parsed)) {
      setJsonError("Details must be a JSON array.");
      return;
    }
    onChange(parsed);
    setJsonMode(false);
    setJsonError("");
  };

  if (jsonMode) {
    return (
      <div className="admin-studio-field">
        <span>Details (JSON)</span>
        <textarea
          rows={10}
          value={jsonText}
          onChange={(event) => setJsonText(event.target.value)}
          style={{ fontFamily: "monospace", fontSize: 13 }}
        />
        {jsonError && <p className="error-text">{jsonError}</p>}
        <div className="admin-bulk-pipeline-dialog-actions">
          <button type="button" className="ghost-button" onClick={() => setJsonMode(false)}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={applyJson}>
            Apply JSON
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-studio-field">
      <span>Details</span>
      <div className="admin-content-details-fields">
        {fields.map((field, index) => (
          <div className="admin-content-details-field" key={index}>
            <div className="admin-content-details-field-header">
              <input
                className="admin-content-details-label-input"
                placeholder="Field name (e.g. Question)"
                value={field.label || ""}
                onChange={(event) => updateField(index, { ...field, label: event.target.value })}
              />
              <button type="button" className="ghost-button" onClick={() => removeField(index)}>
                Remove field
              </button>
            </div>
            {Array.isArray(field.value) ? (
              <div className="admin-content-details-list">
                {field.value.map((item, itemIndex) => (
                  <div className="admin-content-details-list-item" key={itemIndex}>
                    <input
                      value={item}
                      onChange={(event) => {
                        const nextValue = field.value.map((v, i) => (i === itemIndex ? event.target.value : v));
                        updateField(index, { ...field, value: nextValue });
                      }}
                    />
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => {
                        const nextValue = field.value.filter((_, i) => i !== itemIndex);
                        updateField(index, { ...field, value: nextValue });
                      }}
                    >
                      Remove item
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => updateField(index, { ...field, value: [...field.value, ""] })}
                >
                  + Add item
                </button>
              </div>
            ) : (
              <textarea
                rows={3}
                value={field.value || ""}
                onChange={(event) => updateField(index, { ...field, value: event.target.value })}
              />
            )}
          </div>
        ))}
      </div>
      <div className="admin-bulk-pipeline-dialog-actions">
        <button type="button" className="ghost-button" onClick={() => addField("")}>
          + Add field
        </button>
        <button type="button" className="ghost-button" onClick={() => addField([""])}>
          + Add list field
        </button>
        {canEditJson && (
          <button type="button" className="ghost-button" onClick={openJsonMode}>
            Edit as JSON
          </button>
        )}
      </div>
    </div>
  );
};
