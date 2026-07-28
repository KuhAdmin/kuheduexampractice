import { AnimatePresence, motion } from "framer-motion";

// doc: { title, sections: [{ heading?, paragraphs: string[] }] }
export const LegalDocumentModal = ({ open, doc, onClose }) => (
  <AnimatePresence>
    {open && doc ? (
      <motion.div
        className="modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="modal-panel legal-modal-panel"
          initial={{ scale: 0.97, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.98, opacity: 0 }}
          onClick={(event) => event.stopPropagation()}
        >
          <button className="close-button" onClick={onClose} aria-label="Close">
            x
          </button>
          <div className="legal-modal-scroll">
            <h2>{doc.title}</h2>
            {doc.sections.map((section, index) => (
              <div className="legal-modal-section" key={section.heading || index}>
                {section.heading ? <h3>{section.heading}</h3> : null}
                {section.paragraphs.map((paragraph, paragraphIndex) => (
                  <p key={paragraphIndex}>{paragraph}</p>
                ))}
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    ) : null}
  </AnimatePresence>
);
