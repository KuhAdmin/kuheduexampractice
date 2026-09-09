import { MathPreview } from "./MathPreview";

const normalizeForCompare = (value) => String(value ?? "").trim().toLowerCase();

// Pre-warmup's `reorder` format stores the correct order as an arrow-joined
// string ("A → B"), not a structured array like the assessment engine's
// `ordering` interaction_data.sequence -- this mirrors the server-side
// parseReorderSequence in studentPreWarmupService.js so the client can
// highlight rows against the same parsed sequence once feedback returns.
export const parseArrowSequence = (value) =>
  String(value || "")
    .split(/\s*(?:→|->)\s*/)
    .map((step) => step.trim())
    .filter(Boolean);

const MoveIcon = ({ direction }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d={direction === "up" ? "m6 14 6-6 6 6" : "m6 10 6 6 6-6"}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    />
  </svg>
);

// Extracted from StudentAssessmentPage.jsx's renderOrdering()/
// moveOrderingRow() for reuse by `reorder`-format Story Anchor Questions in
// StudentPostLessonPage.jsx.
export const OrderingList = ({ rows, disabled, correctSequence, onReorder }) => {
  const moveRow = (index, targetIndex) => {
    if (targetIndex < 0 || targetIndex >= rows.length) return;
    const next = [...rows];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    onReorder(next);
  };

  return (
    <ol className="student-ordering-list">
      {rows.map((value, index) => {
        const isCorrectRow =
          correctSequence?.[index] !== undefined
            ? normalizeForCompare(value) === normalizeForCompare(correctSequence[index])
            : false;
        const isIncorrectRow = correctSequence?.[index] !== undefined && !isCorrectRow;

        const className = [
          "student-ordering-row",
          isCorrectRow ? "is-correct" : "",
          isIncorrectRow ? "is-incorrect" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <li key={value} className={className}>
            <span className="student-concept-practice-badge">{index + 1}</span>
            <span className="student-concept-practice-text">
              {value}
              <MathPreview text={value} />
            </span>
            <div className="student-ordering-controls">
              <button
                type="button"
                className="student-ordering-move"
                aria-label={`Move ${value} up`}
                disabled={disabled || index === 0}
                onClick={() => moveRow(index, index - 1)}
              >
                <MoveIcon direction="up" />
              </button>
              <button
                type="button"
                className="student-ordering-move"
                aria-label={`Move ${value} down`}
                disabled={disabled || index === rows.length - 1}
                onClick={() => moveRow(index, index + 1)}
              >
                <MoveIcon direction="down" />
              </button>
            </div>
          </li>
        );
      })}
    </ol>
  );
};
