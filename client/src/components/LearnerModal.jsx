import { AnimatePresence, motion } from "framer-motion";
import { FeatureCard } from "./FeatureCard";
import {
  PERSONALIZATION_FEATURES,
  AI_TOOLS_HOWTO,
  EXPLORE_STYLES,
  REVISION_TOOLS,
} from "../content/learnerContent";

const EXPLORE_ACCENTS = ["var(--green)", "var(--blue)", "var(--warning)", "var(--indigo)"];

export const LearnerModal = ({ open, onClose, onGetStarted }) => (
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
            <div className="study-buddy-hero">
              <h2>Learning, Built for You</h2>
              <p>A personalized journey through every concept, your way — and the tools to make it stick.</p>
            </div>

            <h3 className="study-buddy-section-title-center">Learning Built Around You</h3>
            <div className="study-buddy-features-grid">
              {PERSONALIZATION_FEATURES.map((feature, index) => (
                <FeatureCard
                  key={feature.id}
                  title={feature.title}
                  description={feature.description}
                  accent={feature.accent}
                  delay={index * 0.05}
                />
              ))}
            </div>

            <h3>AI Help, One Tap Away</h3>
            <p className="study-buddy-section-intro">
              All four live on the Smart Tutor tab of any concept — here's how to use each one.
            </p>
            <div className="study-buddy-features-grid">
              {AI_TOOLS_HOWTO.map((tool, index) => (
                <FeatureCard
                  key={tool.id}
                  title={tool.title}
                  description={tool.description}
                  accent={tool.accent}
                  delay={index * 0.05}
                />
              ))}
            </div>

            <h3>Explore Every Concept, Your Way</h3>
            <div className="study-buddy-assessment-chips">
              {EXPLORE_STYLES.map((style, index) => (
                <div
                  className="study-buddy-chip"
                  style={{ "--accent": EXPLORE_ACCENTS[index % EXPLORE_ACCENTS.length] }}
                  key={style.id}
                >
                  <span className="study-buddy-chip-label">{style.label}</span>
                  <span className="study-buddy-chip-description">{style.description}</span>
                </div>
              ))}
            </div>

            <h3>Your Revision Toolkit</h3>
            <div className="study-buddy-features-grid">
              {REVISION_TOOLS.map((tool, index) => (
                <FeatureCard
                  key={tool.id}
                  title={tool.title}
                  description={tool.description}
                  accent={tool.accent}
                  delay={index * 0.05}
                />
              ))}
            </div>
          </div>
          <div className="study-buddy-cta-footer">
            <span>Ready to start your personalized learning journey?</span>
            <button type="button" className="study-buddy-cta-button" onClick={onGetStarted}>
              Get Started
            </button>
          </div>
        </motion.div>
      </motion.div>
    ) : null}
  </AnimatePresence>
);
