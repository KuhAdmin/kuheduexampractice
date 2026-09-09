import { extractSourcePageImages, StudentMultiPageAnswerInput } from "./StudentMultiPageAnswerInput";

// Extracted from StudentAssessmentPage.jsx's renderFreeText() for reuse by
// fill_in_blank/short_answer/hots_* Story Anchor Questions in
// StudentPostLessonPage.jsx.
export const FreeTextAnswerPanel = ({
  value,
  onChange,
  onSourcePageImagesChange,
  resetKey,
  disabled,
  statusClassName,
  placeholder,
}) => (
  <div className="student-free-text-panel">
    <StudentMultiPageAnswerInput
      value={value || ""}
      onChange={(text, pages) => {
        onChange(text);
        onSourcePageImagesChange?.(extractSourcePageImages(pages));
      }}
      resetKey={resetKey}
      disabled={disabled}
      statusClassName={statusClassName || ""}
      placeholder={placeholder || "Type your answer, or capture a photo of your handwritten answer above"}
      rows={8}
    />
  </div>
);
