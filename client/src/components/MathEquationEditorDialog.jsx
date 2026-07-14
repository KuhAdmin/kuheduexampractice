import { useRef, useState } from "react";
import { parseMathSegments, renderMathSegments } from "./MathPreview";

const TOOLBAR_GROUPS = [
  {
    label: "Structures",
    buttons: [
      { label: "Fraction", display: "a/b", snippet: "\\frac{}{}" },
      { label: "Square root", display: "√", snippet: "\\sqrt{}" },
      { label: "nth root", display: "ⁿ√", snippet: "\\sqrt[]{}" },
      { label: "Superscript", display: "x²", snippet: "^{}" },
      { label: "Subscript", display: "x₂", snippet: "_{}" },
    ],
  },
  {
    label: "Big operators",
    buttons: [
      { label: "Sum", display: "Σ", snippet: "\\sum" },
      { label: "Product", display: "Π", snippet: "\\prod" },
      { label: "Integral", display: "∫", snippet: "\\int" },
      { label: "Limit", display: "lim", snippet: "\\lim" },
    ],
  },
  {
    label: "Greek letters",
    buttons: [
      { label: "alpha", display: "α", snippet: "\\alpha" },
      { label: "beta", display: "β", snippet: "\\beta" },
      { label: "gamma", display: "γ", snippet: "\\gamma" },
      { label: "delta", display: "δ", snippet: "\\delta" },
      { label: "theta", display: "θ", snippet: "\\theta" },
      { label: "lambda", display: "λ", snippet: "\\lambda" },
      { label: "mu", display: "μ", snippet: "\\mu" },
      { label: "pi", display: "π", snippet: "\\pi" },
      { label: "sigma", display: "σ", snippet: "\\sigma" },
      { label: "phi", display: "φ", snippet: "\\phi" },
      { label: "omega", display: "ω", snippet: "\\omega" },
      { label: "Delta", display: "Δ", snippet: "\\Delta" },
      { label: "Sigma", display: "Σ", snippet: "\\Sigma" },
      { label: "Omega", display: "Ω", snippet: "\\Omega" },
    ],
  },
  {
    label: "Symbols",
    buttons: [
      { label: "plus-minus", display: "±", snippet: "\\pm" },
      { label: "times", display: "×", snippet: "\\times" },
      { label: "divide", display: "÷", snippet: "\\div" },
      { label: "less-equal", display: "≤", snippet: "\\le" },
      { label: "greater-equal", display: "≥", snippet: "\\ge" },
      { label: "not-equal", display: "≠", snippet: "\\ne" },
      { label: "approx", display: "≈", snippet: "\\approx" },
      { label: "infinity", display: "∞", snippet: "\\infty" },
      { label: "arrow", display: "→", snippet: "\\rightarrow" },
      { label: "equilibrium", display: "⇌", snippet: "\\rightleftharpoons" },
      { label: "therefore", display: "∴", snippet: "\\therefore" },
    ],
  },
  {
    label: "Functions",
    buttons: [
      { label: "sin", display: "sin", snippet: "\\sin" },
      { label: "cos", display: "cos", snippet: "\\cos" },
      { label: "tan", display: "tan", snippet: "\\tan" },
      { label: "log", display: "log", snippet: "\\log" },
      { label: "ln", display: "ln", snippet: "\\ln" },
    ],
  },
  {
    label: "Accents",
    buttons: [
      { label: "vector", display: "v⃗", snippet: "\\vec{}" },
      { label: "hat", display: "â", snippet: "\\hat{}" },
      { label: "bar", display: "ā", snippet: "\\overline{}" },
    ],
  },
];

// A small Microsoft-Equation-Editor-style toolbar: structure templates and
// symbols insert LaTeX at the cursor (landing inside the first empty {} so
// the admin can type the argument immediately); the Math wrapper buttons
// separately wrap the current selection in $...$/$$...$$ since a symbol
// button has no way to know whether the cursor is already inside a math
// span or not.
export const MathEquationEditorDialog = ({ initialValue, onSave, onCancel }) => {
  const [draft, setDraft] = useState(initialValue || "");
  const textareaRef = useRef(null);

  const insertAtCursor = (snippet) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextValue = draft.slice(0, start) + snippet + draft.slice(end);
    setDraft(nextValue);

    const placeholderIndex = snippet.indexOf("{}");
    const cursorOffset = placeholderIndex >= 0 ? placeholderIndex + 1 : snippet.length;
    const nextCursor = start + cursorOffset;

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const wrapSelection = (prefix, suffix) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = draft.slice(start, end);
    const nextValue = draft.slice(0, start) + prefix + selected + suffix + draft.slice(end);
    setDraft(nextValue);

    const nextCursor = selected
      ? start + prefix.length + selected.length + suffix.length
      : start + prefix.length;

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const previewSegments = draft.trim() ? parseMathSegments(draft) : [];

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-panel is-wide" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="close-button" aria-label="Close" onClick={onCancel}>
          &times;
        </button>
        <h2>Equation Editor</h2>

        <div className="admin-equation-editor-preview">
          {previewSegments.length > 0 ? (
            renderMathSegments(previewSegments)
          ) : (
            <span className="admin-equation-display-placeholder">Preview will appear here</span>
          )}
        </div>

        <div className="admin-equation-editor-toolbar">
          {TOOLBAR_GROUPS.map((group) => (
            <div key={group.label} className="admin-equation-editor-toolbar-group">
              <span className="admin-equation-editor-toolbar-label">{group.label}</span>
              <div className="admin-equation-editor-toolbar-buttons">
                {group.buttons.map((button) => (
                  <button
                    key={button.label}
                    type="button"
                    className="admin-equation-editor-button"
                    title={button.label}
                    onClick={() => insertAtCursor(button.snippet)}
                  >
                    {button.display}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="admin-equation-editor-toolbar-group">
            <span className="admin-equation-editor-toolbar-label">Math wrapper</span>
            <div className="admin-equation-editor-toolbar-buttons">
              <button
                type="button"
                className="admin-equation-editor-button is-wide"
                title="Wrap selection as inline math"
                onClick={() => wrapSelection("$", "$")}
              >
                Inline $...$
              </button>
              <button
                type="button"
                className="admin-equation-editor-button is-wide"
                title="Wrap selection as display math"
                onClick={() => wrapSelection("$$", "$$")}
              >
                Display $$...$$
              </button>
            </div>
          </div>
        </div>

        <textarea
          ref={textareaRef}
          className="admin-equation-editor-textarea"
          rows={6}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type here, or use the toolbar above to insert equation structures"
        />

        <div className="admin-equation-editor-actions">
          <button type="button" className="ghost-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={() => onSave(draft.trim())}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
