import { MathPreview } from "./MathPreview";

// Shared by TestLab's session screen for every one of the four
// interaction_type values the rest of the app already renders in
// StudentAssessmentPage.jsx -- same CSS classes reused deliberately so a
// TestLab question looks and behaves identically to a regular assessment
// question. Kept as its own component (not extracted from
// StudentAssessmentPage.jsx) so this session's build carries zero risk to
// that already-working, heavily-used flow.
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

const normalizeForCompare = (value) => String(value ?? "").trim().toLowerCase();

// TestLab items never carry interaction_data (matching pairs), so a
// "matching" item -- which the server-side isAnswerableItem check already
// excludes from every practice pool app-wide today (see
// studentPracticeService.js's hasSufficientOptions) -- is handled with a
// graceful placeholder rather than a fully wired-up UI for a path that can
// never actually be served yet.
export const resolveInteractionType = (item) => {
  const type = item?.interactionType;
  if (type === "ordering" || type === "matching" || type === "free_text" || type === "single_select") {
    return type;
  }
  return (item?.options?.length ?? 0) > 0 ? "single_select" : "free_text";
};

export const INTERACTION_HANDLERS = {
  single_select: {
    initialState: () => "",
    isReady: (state) => Boolean(state),
    serialize: (state) => state,
  },
  free_text: {
    initialState: () => "",
    isReady: (state) => Boolean(state?.trim()),
    serialize: (state) => state,
  },
  ordering: {
    initialState: (item) => [...(item.options || [])],
    isReady: (state) => Array.isArray(state) && state.length > 1,
    serialize: (state) => JSON.stringify(state),
  },
  matching: {
    initialState: () => null,
    isReady: () => false,
    serialize: () => "",
  },
};

// Correct-answer display strings differ by source: Question Bank ordering
// answers are ";"-joined, while HOTS reorder answers are joined with "->"/"→"
// (see server's parseReorderSequence) -- try arrow-splitting first since a
// semicolon never appears in either format.
const parseCorrectSequence = (correctAnswer) => {
  const text = String(correctAnswer || "");
  if (/→|->/.test(text)) {
    return text
      .split(/\s*(?:→|->)\s*/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return text
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
};

const moveRow = (rows, from, to) => {
  if (to < 0 || to >= rows.length) return rows;
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

export const QuestionInteractionRenderer = ({ item, interactionType, value, onChange, phase, feedback }) => {
  if (interactionType === "single_select") {
    return (
      <div className="student-concept-practice-options">
        {(item.options || []).map((option, index) => {
          const optionId = String.fromCharCode(65 + index);
          const isSelected = value === option;
          const isRevealedCorrect =
            phase === "feedback" && feedback && normalizeForCompare(option) === normalizeForCompare(feedback.correctAnswer);
          const isRevealedIncorrect = phase === "feedback" && isSelected && feedback && !feedback.isCorrect;

          const className = [
            "student-concept-practice-option",
            isSelected ? "is-selected" : "",
            isRevealedCorrect ? "is-correct" : "",
            isRevealedIncorrect ? "is-incorrect" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={option}
              type="button"
              className={className}
              disabled={phase === "feedback"}
              onClick={() => phase === "question" && onChange(option)}
            >
              <span className="student-concept-practice-badge">{optionId}</span>
              <span className="student-concept-practice-text">
                {option}
                <MathPreview text={option} />
              </span>
              <span className="student-concept-practice-radio" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    );
  }

  if (interactionType === "free_text") {
    return (
      <div className="student-free-text-panel">
        <textarea
          className={`student-testlab-textarea ${
            phase === "feedback" ? (feedback?.isCorrect ? "is-correct" : "is-incorrect") : ""
          }`}
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          disabled={phase === "feedback"}
          placeholder="Type your answer"
          rows={6}
        />
      </div>
    );
  }

  if (interactionType === "ordering") {
    const correctSequence = phase === "feedback" && feedback ? parseCorrectSequence(feedback.correctAnswer) : [];
    const rows = Array.isArray(value) ? value : [];

    return (
      <ol className="student-ordering-list">
        {rows.map((rowValue, index) => {
          const isCorrectRow =
            phase === "feedback" && correctSequence[index] !== undefined
              ? normalizeForCompare(rowValue) === normalizeForCompare(correctSequence[index])
              : false;
          const isIncorrectRow = phase === "feedback" && correctSequence[index] !== undefined && !isCorrectRow;

          const className = [
            "student-ordering-row",
            isCorrectRow ? "is-correct" : "",
            isIncorrectRow ? "is-incorrect" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <li key={rowValue} className={className}>
              <span className="student-concept-practice-badge">{index + 1}</span>
              <span className="student-concept-practice-text">
                {rowValue}
                <MathPreview text={rowValue} />
              </span>
              <div className="student-ordering-controls">
                <button
                  type="button"
                  className="student-ordering-move"
                  aria-label={`Move ${rowValue} up`}
                  disabled={phase === "feedback" || index === 0}
                  onClick={() => onChange(moveRow(rows, index, index - 1))}
                >
                  <MoveIcon direction="up" />
                </button>
                <button
                  type="button"
                  className="student-ordering-move"
                  aria-label={`Move ${rowValue} down`}
                  disabled={phase === "feedback" || index === rows.length - 1}
                  onClick={() => onChange(moveRow(rows, index, index + 1))}
                >
                  <MoveIcon direction="down" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  // "matching" -- see the comment on resolveInteractionType above.
  return <p className="student-empty-state">This question type isn't available yet -- it'll be skipped from scoring.</p>;
};
