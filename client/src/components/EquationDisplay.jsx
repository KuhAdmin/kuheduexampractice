import { useState } from "react";
import { parseMathSegments, renderMathSegments } from "./MathPreview";
import { MathEquationEditorDialog } from "./MathEquationEditorDialog";

const KebabMenuIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="5.5" r="1.8" fill="currentColor" />
    <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    <circle cx="12" cy="18.5" r="1.8" fill="currentColor" />
  </svg>
);

// Replaces every raw-text-plus-MathPreview pair on this page/component with
// a single rendered-only view -- raw LaTeX source (dollar signs, backslash
// commands) never shows. When onChange is provided, a "..." menu opens
// MathEquationEditorDialog for editing; otherwise this is pure read-only
// display. Unlike MathPreview (debounced, live-typing textarea underneath),
// this only re-renders when value actually changes (dialog save), so no
// debounce is needed.
export const EquationDisplay = ({ value, onChange, placeholder = "", className = "" }) => {
  const [editorOpen, setEditorOpen] = useState(false);
  const isEditable = typeof onChange === "function";
  const hasContent = Boolean(value && value.trim());
  const segments = hasContent ? parseMathSegments(value) : [];

  return (
    <div className={`admin-equation-display ${className}`.trim()}>
      {isEditable && (
        <button
          type="button"
          className="admin-equation-display-menu"
          aria-label="Edit equation"
          onClick={() => setEditorOpen(true)}
        >
          <KebabMenuIcon />
        </button>
      )}
      <div className="admin-equation-display-content">
        {hasContent ? (
          renderMathSegments(segments)
        ) : (
          <span className="admin-equation-display-placeholder">{placeholder}</span>
        )}
      </div>

      {editorOpen && (
        <MathEquationEditorDialog
          initialValue={value || ""}
          onSave={(next) => {
            onChange(next);
            setEditorOpen(false);
          }}
          onCancel={() => setEditorOpen(false)}
        />
      )}
    </div>
  );
};
