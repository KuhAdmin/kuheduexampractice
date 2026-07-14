import { useEffect, useMemo, useState } from "react";
import katex from "katex";

// Matches $$...$$ (display/block math, can span lines) or $...$ (inline
// math, single line, no nested $) -- block pattern first so it's preferred
// over reading a "$$" as two empty inline matches.
const MATH_SEGMENT_REGEX = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

export const parseMathSegments = (text) => {
  const segments = [];
  let lastIndex = 0;
  const regex = new RegExp(MATH_SEGMENT_REGEX);
  let match = regex.exec(text);
  while (match !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      segments.push({ type: "block", value: match[1] });
    } else {
      segments.push({ type: "inline", value: match[2] });
    }
    lastIndex = regex.lastIndex;
    match = regex.exec(text);
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }
  return segments;
};

const renderMathHtml = (expression, displayMode) => {
  try {
    return katex.renderToString(expression, { throwOnError: false, displayMode });
  } catch {
    return expression;
  }
};

// Shared by MathPreview (below) and EquationDisplay.jsx, so both render
// $...$/$$...$$ segments identically instead of duplicating this mapping.
export const renderMathSegments = (segments) =>
  segments.map((segment, index) =>
    segment.type === "text" ? (
      <span key={index} className="student-math-preview-text">
        {segment.value}
      </span>
    ) : (
      <span
        key={index}
        className={segment.type === "block" ? "student-math-preview-block" : "student-math-preview-inline"}
        // KaTeX's own deterministic output for the LaTeX we pass it --
        // not raw user/OCR text.
        dangerouslySetInnerHTML={{ __html: renderMathHtml(segment.value, segment.type === "block") }}
      />
    )
  );

// Live-renders any $...$/$$...$$ LaTeX spans in a page's OCR'd/typed text so
// a student can visually confirm an equation reads correctly, without
// replacing the plain textarea they're editing. Debounced so KaTeX doesn't
// re-parse on every keystroke of a long answer. Renders nothing if the text
// has no math delimiters at all.
export const MathPreview = ({ text }) => {
  const [debouncedText, setDebouncedText] = useState(text);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedText(text), 200);
    return () => clearTimeout(timer);
  }, [text]);

  const segments = useMemo(() => parseMathSegments(debouncedText || ""), [debouncedText]);
  const hasMath = segments.some((segment) => segment.type !== "text");

  if (!hasMath) {
    return null;
  }

  return <div className="student-math-preview">{renderMathSegments(segments)}</div>;
};
