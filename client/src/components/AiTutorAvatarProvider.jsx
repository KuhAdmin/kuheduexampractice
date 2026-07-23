// One shared, floating AI Tutor avatar for the whole authenticated student
// area -- mounted once in StudentLayout.jsx rather than once per voice
// panel, so Ask/Coach voice sessions read as "one AI tutor" instead of
// separate faces. Whichever voice session last called bindSession() "owns"
// the face; two panels talking at once would just fight over the same
// avatar, same as they'd already fight over the same speakers today.

import { createContext, useContext, useEffect, useRef, useState, useCallback, useSyncExternalStore } from "react";
import { AvatarView, ConnectionState, ErrorCode } from "@spatialwalk/avatarkit";
import { createAvatarView, refreshAvatarSessionToken } from "../lib/avatarClient";
import {
  getAvatarVisibleServerSnapshot,
  getAvatarVisibleSnapshot,
  subscribeAvatarVisible,
} from "../lib/aiTutorAvatarVisibility";

// If the avatar's WebSocket hasn't reached "connected" within this window,
// bindSession gives up and falls back to local audio rather than blocking
// the caller (and therefore the whole voice session) indefinitely.
const AVATAR_CONNECT_TIMEOUT_MS = 8000;

const AiTutorAvatarContext = createContext(null);

export const useAiTutorAvatar = () => {
  const ctx = useContext(AiTutorAvatarContext);
  if (!ctx) throw new Error("useAiTutorAvatar must be used within an AiTutorAvatarProvider");
  return ctx;
};

export const AiTutorAvatarProvider = ({ children }) => {
  const containerRef = useRef(null);
  const viewPromiseRef = useRef(null);
  const connectPromiseRef = useRef(null);
  const activeSessionRef = useRef(null);
  // Set once a connect attempt times out or errors -- avoids paying the full
  // AVATAR_CONNECT_TIMEOUT_MS wait again on every subsequent voice session
  // start if the avatar backend is unreachable/misbehaving for this page
  // load. Reset (see cleanup below) whenever the avatar toggle is turned off
  // and back on, so a real fix on the backend gets picked up without a full
  // page reload.
  const knownBrokenRef = useRef(false);
  const [widgetVisible, setWidgetVisible] = useState(false);
  const avatarEnabled = useSyncExternalStore(
    subscribeAvatarVisible,
    getAvatarVisibleSnapshot,
    getAvatarVisibleServerSnapshot,
  );

  // Kick off SDK init + avatar asset load as soon as the widget exists and
  // the avatar toggle is on -- independent of any click, since AvatarKit's
  // initializeAudioContext() must run inside a user gesture with no
  // significant async gap before it, so all the slow, non-gesture work
  // (token fetch, SDK init, avatar download) has to already be done by the
  // time the student actually presses "Start talking". Toggling the setting
  // off tears this down again -- no token is minted and nothing is loaded
  // while hidden, so hiding the avatar costs nothing.
  useEffect(() => {
    const container = containerRef.current;
    if (!avatarEnabled || !container || viewPromiseRef.current) return;
    viewPromiseRef.current = createAvatarView(container).then((view) => {
      view.controller.onError = (error) => {
        console.warn("[ai-tutor-avatar] AvatarError:", error.code, error.message);
        if (error.code === ErrorCode.sessionTokenExpired || error.code === ErrorCode.sessionTokenInvalid) {
          void refreshAvatarSessionToken();
        }
      };
      return view;
    });
    return () => {
      void viewPromiseRef.current?.then((view) => view.dispose());
      viewPromiseRef.current = null;
      connectPromiseRef.current = null;
      knownBrokenRef.current = false;
    };
  }, [avatarEnabled]);

  const bindSession = useCallback(
    async (sessionId) => {
      if (!avatarEnabled || !viewPromiseRef.current || knownBrokenRef.current) return false;
      // Never let an avatar problem block the underlying Gemini session --
      // every failure path below returns false instead of throwing/hanging,
      // so the caller falls back to local audio exactly like avatar-off.
      try {
        const view = await viewPromiseRef.current;

        // Must run inside this call's user-gesture window (see comment above).
        await view.controller.initializeAudioContext();

        // The underlying WebSocket connection is shared and only opened
        // once; later sessions just reuse it instead of reconnecting.
        if (!connectPromiseRef.current) {
          connectPromiseRef.current = view.controller.start().then(
            () =>
              new Promise((resolve, reject) => {
                view.controller.onConnectionState = (state) => {
                  if (state === ConnectionState.connected) resolve();
                  else if (state === ConnectionState.failed) reject(new Error("Avatar connection failed."));
                };
              }),
          );
          connectPromiseRef.current.catch(() => {
            connectPromiseRef.current = null;
          });
        }

        const timedOut = Symbol("avatar-connect-timeout");
        const outcome = await Promise.race([
          connectPromiseRef.current.then(() => "connected"),
          new Promise((resolve) => setTimeout(() => resolve(timedOut), AVATAR_CONNECT_TIMEOUT_MS)),
        ]);
        if (outcome === timedOut) {
          console.warn(
            `[ai-tutor-avatar] Did not reach "connected" within ${AVATAR_CONNECT_TIMEOUT_MS}ms -- falling back to local audio for this and all later sessions until the avatar is toggled off and back on.`,
          );
          knownBrokenRef.current = true;
          return false;
        }
      } catch (err) {
        console.warn("[ai-tutor-avatar] Failed to bind session, falling back to local audio:", err);
        knownBrokenRef.current = true;
        return false;
      }

      // Only mark the widget visible once actually connected -- showing it
      // earlier risked a static/idle box sitting there while a connection
      // attempt that's about to time out or fail runs in the background.
      activeSessionRef.current = sessionId;
      setWidgetVisible(true);
      return true;
    },
    [avatarEnabled],
  );

  const releaseSession = useCallback((sessionId) => {
    if (activeSessionRef.current !== sessionId) return;
    activeSessionRef.current = null;
    setWidgetVisible(false);
    void viewPromiseRef.current?.then((view) => view.controller.interrupt());
  }, []);

  const sendAudioChunk = useCallback((sessionId, pcm, end) => {
    if (activeSessionRef.current !== sessionId || !viewPromiseRef.current) return;
    void viewPromiseRef.current.then((view) => view.controller.send(pcm, end));
  }, []);

  const interrupt = useCallback((sessionId) => {
    if (activeSessionRef.current !== sessionId || !viewPromiseRef.current) return;
    void viewPromiseRef.current.then((view) => view.controller.interrupt());
  }, []);

  return (
    <AiTutorAvatarContext.Provider value={{ bindSession, releaseSession, sendAudioChunk, interrupt }}>
      {children}
      <div
        ref={containerRef}
        // Fixed, non-zero size at all times (AvatarView requires it) --
        // visibility is toggled with opacity, not display/size, so the
        // canvas never has to re-measure a zero-size container.
        className={`student-ai-tutor-avatar-widget ${widgetVisible ? "is-visible" : ""}`}
      />
    </AiTutorAvatarContext.Provider>
  );
};
