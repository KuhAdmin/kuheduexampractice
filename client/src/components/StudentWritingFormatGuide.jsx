// Renders a category's "Standard CBSE Format" reference (format_template:
// [{label, guidance}]) as a numbered stepper card rather than the raw
// plaintext skeleton the source workbook uses -- friendlier for an 11-14
// year old learner. Reused on both the sub-category list page and the
// question-detail page (shown again there since that's when the learner
// actually needs it while composing their answer).
export const StudentWritingFormatGuide = ({ steps, title = "Format Guide" }) => {
  if (!steps?.length) return null;

  return (
    <div className="student-writing-format-guide">
      <h3>{title}</h3>
      <ol className="student-writing-format-guide-steps">
        {steps.map((step, index) => (
          <li key={index} className="student-writing-format-guide-step">
            <span className="student-writing-format-guide-step-number">{index + 1}</span>
            <span className="student-writing-format-guide-step-copy">
              <strong>{step.label}</strong>
              {step.guidance && <p>{step.guidance}</p>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
};
