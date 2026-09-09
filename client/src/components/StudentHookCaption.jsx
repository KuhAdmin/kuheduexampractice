import { useFitTextToWidth } from "../hooks/useFitTextToWidth";

// 1.7rem at the default 16px root -- matches .student-hook-caption's CSS
// font-size, kept in sync here since this needs the value in px to measure
// against, not just declare in the stylesheet.
const MAX_FONT_SIZE_PX = 27.2;

// Wraps .student-hook-caption (StudentPreLessonWarmupPage.jsx /
// StudentPostLessonPage.jsx's one-line "hook" subtitle) so it never wraps to
// a second line -- shrinks down from the full "stand out" size only as far
// as the actual rendered text needs, per useFitTextToWidth.
export const StudentHookCaption = ({ text }) => {
  const { ref, fontSize } = useFitTextToWidth(text, { maxFontSizePx: MAX_FONT_SIZE_PX });

  if (!text) return null;

  return (
    <p ref={ref} className="student-hook-caption" style={{ fontSize, whiteSpace: "nowrap", overflow: "hidden" }}>
      {text}
    </p>
  );
};
