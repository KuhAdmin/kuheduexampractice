import { useState } from "react";
import { parseMathSegments, renderMathSegments } from "./MathPreview";
import { MathEquationEditorDialog } from "./MathEquationEditorDialog";
import { useAuth } from "../context/AuthContext";

// Equation notation (fractions, integrals, Greek letters, etc.) only ever
// comes up for these subjects -- students in Biology/English/etc. never need
// it, so the edit trigger is hidden for them rather than offering a tool
// that's irrelevant to their subject. Admins/moderators (no personal
// `subject`, e.g. previewing/authoring content on AdminAiAssessmentDemoPage)
// aren't students, so this restriction doesn't apply to them.
const EQUATION_EDITOR_SUBJECTS = ["physics", "chemistry", "mathematics"];

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
  const { user } = useAuth();
  const [editorOpen, setEditorOpen] = useState(false);
  const wantsEditing = typeof onChange === "function";
  const canUseEquationEditor =
    user?.role !== "student" || EQUATION_EDITOR_SUBJECTS.includes(String(user?.subject || "").toLowerCase());
  const isEditable = wantsEditing && canUseEquationEditor;
  // Non-STEM students still need to type an answer -- they just don't get
  // the math toolbar/dialog, since equation notation never applies to their
  // subject. A plain always-on textarea replaces the rendered display
  // entirely here (no "..." menu, no modal) rather than leaving them with a
  // read-only view and no way to answer at all.
  const showPlainTextarea = wantsEditing && !canUseEquationEditor;
  const hasContent = Boolean(value && value.trim());
  const segments = hasContent ? parseMathSegments(value) : [];

  return (
    <div className={`admin-equation-display ${showPlainTextarea ? "is-plain-input" : ""} ${className}`.trim()}>
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
      {showPlainTextarea ? (
        <textarea
          className="admin-equation-display-textarea"
          rows={5}
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <div className="admin-equation-display-content">
          {hasContent ? (
            renderMathSegments(segments)
          ) : (
            <span className="admin-equation-display-placeholder">{placeholder}</span>
          )}
        </div>
      )}

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
