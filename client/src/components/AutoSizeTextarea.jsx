import { useLayoutEffect, useRef } from "react";

// Grows to fit its full content (AI-generated text especially can run long)
// instead of clipping/scrolling inside a fixed-height box. Resize handle is
// disabled since the height is already driven by content.
export const AutoSizeTextarea = ({ value, ...rest }) => {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return <textarea ref={ref} value={value} style={{ resize: "none", overflow: "hidden" }} {...rest} />;
};
