// Show/hide toggle for the AI Tutor's avatar face, persisted per-browser in
// localStorage. Shaped as a useSyncExternalStore-compatible store (rather
// than "read in a useEffect and setState") since localStorage can only be
// read on the client, and useSyncExternalStore is the hydration-safe way to
// do that. Defaults to false (hidden) -- the avatar is an opt-in extra, and
// starting hidden means no SpatialReal token is minted until a student
// actually turns it on.

const STORAGE_KEY = "kuhedu-ai-tutor-avatar-visible";

let cachedRaw = null;
let cachedSnapshot = false;
const listeners = new Set();

const readSnapshot = () => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSnapshot = raw === "true";
  }
  return cachedSnapshot;
};

export const getAvatarVisibleSnapshot = () => (typeof window === "undefined" ? false : readSnapshot());

export const getAvatarVisibleServerSnapshot = () => false;

export const subscribeAvatarVisible = (onStoreChange) => {
  listeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
};

export const setAvatarVisible = (visible) => {
  if (typeof window === "undefined") return;
  const raw = String(visible);
  window.localStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedSnapshot = visible;
  listeners.forEach((listener) => listener());
};
