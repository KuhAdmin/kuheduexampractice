import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const CORPORATE_SITE_URL = "https://kuhedu.com";
const SPLASH_DURATION_MS = 1400;

// kuhedu.com sends X-Frame-Options: DENY (clickjacking protection), so it
// cannot be embedded in an iframe -- every browser refuses that connection
// regardless of anything we do here. We still keep the app on this page: show
// the "redirecting" splash, then open the corporate site in a new tab so the
// homepage (the "source") stays put behind it.
export const CorporateSiteModal = ({ open, onClose }) => {
  const [phase, setPhase] = useState("splash");

  useEffect(() => {
    if (!open) {
      setPhase("splash");
      return undefined;
    }
    const timer = setTimeout(() => {
      window.open(CORPORATE_SITE_URL, "_blank", "noopener,noreferrer");
      setPhase("opened");
    }, SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal-panel corporate-site-modal-panel"
            initial={{ scale: 0.97, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.98, opacity: 0 }}
            onClick={(event) => event.stopPropagation()}
          >
            <button className="close-button" onClick={onClose} aria-label="Close">
              x
            </button>
            {phase === "splash" ? (
              <div className="corporate-site-splash">
                <div className="corporate-site-splash-spinner" aria-hidden="true" />
                <p>You are being redirected to Kuhedu Corporate site</p>
              </div>
            ) : (
              <div className="corporate-site-splash">
                <p>Kuhedu Corporate site opened in a new tab.</p>
                <p className="corporate-site-splash-subtext">
                  Didn&apos;t see it?{" "}
                  <a href={CORPORATE_SITE_URL} target="_blank" rel="noopener noreferrer">
                    Open kuhedu.com
                  </a>
                </p>
                <button type="button" className="corporate-site-back-button" onClick={onClose}>
                  Back to Home
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
