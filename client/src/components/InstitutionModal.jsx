import { AnimatePresence, motion } from "framer-motion";
import { FeatureCard } from "./FeatureCard";
import { SCHOOL_FEATURES, NEP_GOALS } from "../content/institutionContent";
import { PEDAGOGY_PILLARS } from "../content/studyBuddyContent";

const NEP_GOAL_ACCENTS = ["var(--green)", "var(--blue)", "var(--warning)", "var(--indigo)"];

// The 3 pedagogy pillars, folded into the same simple chip shape as
// NEP_GOALS (label + one-line description, from each pillar's own tagline)
// instead of their own elaborate before/after comparison cards -- and
// listed first, ahead of NEP_GOALS, per feedback that they belong at the
// top of this section rather than as a separate one above it.
const CLASSROOM_TRANSFORMATION_CHIPS = PEDAGOGY_PILLARS.map((pillar) => ({
  id: pillar.id,
  label: pillar.title,
  description: pillar.tagline,
}));
const NEP_SECTION_ITEMS = [...CLASSROOM_TRANSFORMATION_CHIPS, ...NEP_GOALS];

export const InstitutionModal = ({ open, onClose }) => (
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
              <h2>Your Technology Partner for Schools</h2>
              <p>A school-centric, AI-powered platform built to help your classrooms operationalize NEP 2020.</p>
            </div>

            <h3>Built for Schools</h3>
            <div className="study-buddy-features-grid">
              {SCHOOL_FEATURES.map((feature, index) => (
                <FeatureCard
                  key={feature.id}
                  title={feature.title}
                  description={feature.description}
                  accent={feature.accent}
                  delay={index * 0.05}
                />
              ))}
            </div>

            <h3>Aligned with NEP 2020</h3>
            <div className="study-buddy-assessment-chips">
              {NEP_SECTION_ITEMS.map((goal, index) => (
                <div
                  className="study-buddy-chip"
                  style={{ "--accent": NEP_GOAL_ACCENTS[index % NEP_GOAL_ACCENTS.length] }}
                  key={goal.id}
                >
                  <span className="study-buddy-chip-label">{goal.label}</span>
                  <span className="study-buddy-chip-description">{goal.description}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="study-buddy-cta-footer">
            <span>Ready to bring Kuhedu to your school?</span>
            <a
              className="study-buddy-cta-button"
              href="mailto:support@kuhedu.com?subject=Interested%20in%20Kuhedu%20for%20Our%20School"
            >
              Get in Touch
            </a>
          </div>
        </motion.div>
      </motion.div>
    ) : null}
  </AnimatePresence>
);
