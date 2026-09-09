import { useLayoutEffect, useRef, useState } from "react";

// Shrinks an element's font-size (in whole pixels) just enough that its text
// content fits its own box on one line, re-measuring whenever the text
// changes or the box is resized. Caps at maxFontSizePx (the "full"/desired
// size, used whenever there's room) and never goes below minFontSizePx --
// a static font-size can't satisfy both "stand out" (large) and "never
// wraps" (small enough for the narrowest viewport + longest string) at
// once, so this measures the real rendered width instead of guessing via a
// CSS clamp().
export const useFitTextToWidth = (text, { maxFontSizePx, minFontSizePx = 11 } = {}) => {
  const ref = useRef(null);
  const [fontSize, setFontSize] = useState(maxFontSizePx);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !maxFontSizePx) return undefined;

    const fit = () => {
      el.style.fontSize = `${maxFontSizePx}px`;
      let size = maxFontSizePx;
      while (el.scrollWidth > el.clientWidth && size > minFontSizePx) {
        size -= 1;
        el.style.fontSize = `${size}px`;
      }
      setFontSize(size);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, maxFontSizePx, minFontSizePx]);

  return { ref, fontSize };
};
