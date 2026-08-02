import { AnimatePresence, motion } from "framer-motion";

// status: "processing" | "success" | "error". Parent controls `open` and
// unmounts/resets status once the purchase flow is fully done.
export const PaymentStatusModal = ({ open, status, errorMessage, onClose, onRetry }) => {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="modal-panel"
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.98, opacity: 0 }}
          >
            {status === "processing" ? null : (
              <button className="close-button" onClick={onClose}>
                x
              </button>
            )}
            <p className="eyebrow" id="payment-status">
              Kuhedu Study Buddy Premium
            </p>
            {status === "processing" ? (
              <>
                <h2>Processing your payment...</h2>
                <p>Please don&apos;t close this window while we confirm your purchase.</p>
              </>
            ) : null}
            {status === "success" ? (
              <>
                <h2>Welcome to Premium</h2>
                <p>Your purchase is confirmed and Premium access is now active on your account.</p>
                <button className="primary-button payment-success-cta" onClick={onClose} type="button">
                  Continue
                </button>
              </>
            ) : null}
            {status === "error" ? (
              <>
                <h2>Payment didn&apos;t go through</h2>
                {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
                <button className="primary-button" onClick={onRetry} type="button">
                  Try again
                </button>
              </>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
