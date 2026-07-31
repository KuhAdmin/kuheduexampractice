import { AnimatePresence, motion } from "framer-motion";
import { FeatureCard } from "./FeatureCard";
import { PEDAGOGY_PILLARS, AI_FEATURES, ASSESSMENT_TYPES } from "../content/studyBuddyContent";

const ASSESSMENT_ACCENTS = ["var(--green)", "var(--blue)", "var(--warning)", "var(--indigo)"];

export const StudyBuddyModal = ({ open, onClose, onGetStarted }) => (
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
          className="modal-panel legal-modal-panel study-buddy-modal-panel"
          initial={{ scale: 0.97, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.98, opacity: 0 }}
          onClick={(event) => event.stopPropagation()}
        >
          <button className="close-button" onClick={onClose} aria-label="Close">
            x
          </button>
          <div className="legal-modal-scroll">
            <div className="study-buddy-hero">
              <h2>Kuhedu Study Buddy App</h2>
              <p>Your Classroom Teaching Companion &amp; Student&apos;s Competency-Based Learning App</p>
            </div>

            <h3>Classroom Transformations</h3>
            <div className="study-buddy-pillars-grid">
              {PEDAGOGY_PILLARS.map((pillar) => (
                <div className="study-buddy-pillar-card" style={{ "--accent": pillar.accent }} key={pillar.id}>
                  <h4>{pillar.title}</h4>
                  {pillar.comparison.map((row) => (
                    <div className="study-buddy-pillar-row" key={row.label}>
                      <span className="study-buddy-pillar-row-label">{row.label}</span>
                      <p>{row.text}</p>
                    </div>
                  ))}
                  <p className="study-buddy-pillar-tagline">{pillar.tagline}</p>
                </div>
              ))}
            </div>

            <h3>AI-Powered Features</h3>
            <div className="study-buddy-features-grid">
              {AI_FEATURES.map((feature, index) => (
                <FeatureCard
                  key={feature.id}
                  title={feature.title}
                  description={feature.description}
                  accent={feature.accent}
                  delay={index * 0.05}
                />
              ))}
            </div>

            <h3>Assessment Types</h3>
            <div className="study-buddy-assessment-chips">
              {ASSESSMENT_TYPES.map((assessment, index) => (
                <div
                  className="study-buddy-chip"
                  style={{ "--accent": ASSESSMENT_ACCENTS[index % ASSESSMENT_ACCENTS.length] }}
                  key={assessment.id}
                >
                  <span className="study-buddy-chip-label">{assessment.label}</span>
                  <span className="study-buddy-chip-description">{assessment.description}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="study-buddy-cta-footer">
            <span>Ready to start learning smarter?</span>
            <button type="button" className="study-buddy-cta-button" onClick={onGetStarted}>
              Get Started
            </button>
          </div>
        </motion.div>
      </motion.div>
    ) : null}
  </AnimatePresence>
);
