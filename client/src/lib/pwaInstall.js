// beforeinstallprompt fires once, early in the page lifecycle, at the
// `window` level -- as soon as Chrome finishes evaluating installability
// (manifest + service worker), which can happen well before a user ever
// navigates to whatever page contains the "Install App" button. A listener
// attached lazily inside that page's own component (e.g. only when
// StudentProfilePage mounts) reliably misses the event, since by the time
// a student clicks through login -> dashboard -> profile, it has usually
// already fired to a `window` with no listener on it.
//
// This module is imported once, at the very top of main.jsx, so the
// listener is attached as early as this app can possibly attach it --
// before React even renders -- and the captured event is kept in a
// module-level variable (not React state) so it survives regardless of
// which components are mounted when it arrives.

let deferredEvent = null;
let installed = false;
const listeners = new Set();

const notify = () => {
  listeners.forEach((listener) => listener());
};

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Suppress Chrome's own automatic mini-infobar -- installation is
    // triggered manually from the Profile page, not on page load.
    event.preventDefault();
    deferredEvent = event;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredEvent = null;
    installed = true;
    notify();
  });
}

export const getInstallState = () => ({
  canInstall: Boolean(deferredEvent),
  installed,
});

export const subscribeToInstallState = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const promptInstall = async () => {
  if (!deferredEvent) {
    return null;
  }
  // A captured beforeinstallprompt event can only be prompted once.
  const event = deferredEvent;
  deferredEvent = null;
  event.prompt();
  const choice = await event.userChoice;
  if (choice.outcome === "accepted") {
    installed = true;
  }
  notify();
  return choice;
};
