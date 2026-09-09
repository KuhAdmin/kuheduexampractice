import { MathPreview } from "./MathPreview";

const normalizeForCompare = (value) => String(value ?? "").trim().toLowerCase();

// Extracted from StudentAssessmentPage.jsx's renderSingleSelect() so
// closed-option questions (mcq/true_false/assertion_reason-style, and the
// AVS Assessment A/B picker) can be answered outside the assessment page's
// own state machine -- see StudentPreLessonWarmupPage.jsx/
// StudentPostLessonPage.jsx.
export const SingleSelectOptions = ({ options, answerState, disabled, feedback, onSelect }) => (
  <div className="student-concept-practice-options">
    {options.map((option, index) => {
      const optionId = String.fromCharCode(65 + index);
      const isSelected = answerState === option;
      const isRevealedCorrect =
        feedback && normalizeForCompare(option) === normalizeForCompare(feedback.correctAnswer);
      const isRevealedIncorrect = isSelected && feedback && !feedback.isCorrect;

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
          disabled={disabled}
          onClick={() => !disabled && onSelect(option)}
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
