import { useEffect, useState } from "react";
import { getInstallState, promptInstall as triggerInstallPrompt, subscribeToInstallState } from "../lib/pwaInstall";

// "already-installed": app is already running standalone (no browser chrome),
//   or the beforeinstallprompt flow just completed with an "accepted" choice.
// "android": beforeinstallprompt was captured (client/src/lib/pwaInstall.js,
//   imported at the top of main.jsx so it's listening from page load, not
//   just while this hook happens to be mounted) -- promptInstall() shows
//   the real native install dialog.
// "ios": Safari on iPhone/iPad -- there is no install-prompt API at all on
//   iOS, so the only path is the user manually using the Share sheet.
// "unsupported": neither condition applies (e.g. desktop Chrome without an
//   installable manifest, Firefox, or Android before the event has fired).
const isStandalone = () => {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari's own non-standard flag; not present anywhere else.
    window.navigator?.standalone === true
  );
};

const isIos = () => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  // iPadOS 13+ reports as "MacIntel" in the UA string, not "iPad" --
  // maxTouchPoints is the standard way to still catch those as iOS.
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
};

const resolvePlatform = () => {
  const { canInstall, installed } = getInstallState();
  if (installed || isStandalone()) return "already-installed";
  if (canInstall) return "android";
  if (isIos()) return "ios";
  return "unsupported";
};

export const useInstallPrompt = () => {
  const [platform, setPlatform] = useState(resolvePlatform);

  useEffect(() => {
    // Re-resolve on mount too: the event may have already arrived before
    // this component ever rendered.
    setPlatform(resolvePlatform());
    return subscribeToInstallState(() => setPlatform(resolvePlatform()));
  }, []);

  return {
    platform,
    canInstall: platform === "android",
    promptInstall: triggerInstallPrompt,
  };
};
