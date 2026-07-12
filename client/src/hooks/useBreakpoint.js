import { useEffect, useState } from "react";

export const BREAKPOINT_TABLET = 640;
export const BREAKPOINT_DESKTOP = 920;

const resolveTier = () => {
  if (typeof window === "undefined") {
    return "mobile";
  }
  if (window.innerWidth >= BREAKPOINT_DESKTOP) {
    return "desktop";
  }
  if (window.innerWidth >= BREAKPOINT_TABLET) {
    return "tablet";
  }
  return "mobile";
};

export const useBreakpoint = () => {
  const [tier, setTier] = useState(resolveTier);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const tabletQuery = window.matchMedia(`(min-width: ${BREAKPOINT_TABLET}px)`);
    const desktopQuery = window.matchMedia(`(min-width: ${BREAKPOINT_DESKTOP}px)`);

    const update = () => setTier(resolveTier());
    update();

    tabletQuery.addEventListener("change", update);
    desktopQuery.addEventListener("change", update);

    return () => {
      tabletQuery.removeEventListener("change", update);
      desktopQuery.removeEventListener("change", update);
    };
  }, []);

  return tier;
};

export const useIsDesktop = () => useBreakpoint() === "desktop";
export const useIsTablet = () => useBreakpoint() === "tablet";
