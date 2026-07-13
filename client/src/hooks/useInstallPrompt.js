import { useCallback, useEffect, useRef, useState } from "react";

// "already-installed": app is already running standalone (no browser chrome).
// "android": Chrome/Edge/etc. fired beforeinstallprompt -- promptInstall()
//   will show the real native install dialog.
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

export const useInstallPrompt = () => {
  const deferredEventRef = useRef(null);
  const [platform, setPlatform] = useState(() => {
    if (isStandalone()) return "already-installed";
    if (isIos()) return "ios";
    return "unsupported";
  });

  useEffect(() => {
    if (isStandalone() || typeof window === "undefined") {
      return undefined;
    }

    const handleBeforeInstallPrompt = (event) => {
      // Suppress Chrome's own automatic mini-infobar -- installation is
      // triggered manually from the Profile page, not on page load.
      event.preventDefault();
      deferredEventRef.current = event;
      setPlatform("android");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      deferredEventRef.current = null;
      setPlatform("already-installed");
    };
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const event = deferredEventRef.current;
    if (!event) {
      return null;
    }
    // A captured beforeinstallprompt event can only be prompted once.
    deferredEventRef.current = null;
    event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") {
      setPlatform("already-installed");
    }
    return choice;
  }, []);

  return {
    platform,
    canInstall: platform === "android" && Boolean(deferredEventRef.current),
    promptInstall,
  };
};
