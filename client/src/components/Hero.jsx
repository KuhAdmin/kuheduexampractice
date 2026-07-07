import { motion } from "framer-motion";

const loopSteps = [
  { label: "Learn", detail: "Understand the chapter." },
  { label: "Remember", detail: "Lock concepts into memory." },
  { label: "Practice", detail: "Test your understanding." },
  { label: "Improve", detail: "Return to weak topics." },
];

export const Hero = ({ onAuthOpen, user }) => (
  <section className="hero-grid">
    <motion.div
      className="hero-copy"
      initial={{ opacity: 0, x: -32 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6 }}
    >
      <span className="eyebrow">For CBSE Class 11 & 12</span>
      <h1>
        Remember longer.
        <br />
        Practice smarter.
      </h1>
      <p>
        Master Physics, Chemistry, Mathematics and Biology with chapter-wise
        practice sets, memory techniques and targeted revision.
      </p>
      <div className="hero-actions">
        <button className="primary-button" onClick={onAuthOpen}>
          {user ? "Practice a Chapter" : "Practice a Chapter"}
        </button>
      </div>
      <div className="hero-support-copy">
        <strong>1000+ Chapter-wise Practice Sets</strong>
        <span>Built for CBSE Class 11 & 12</span>
      </div>
    </motion.div>

    <motion.div
      className="hero-panel"
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7 }}
    >
      <div className="metric-card">
        <p>Learning Loop</p>
        <div className="loop-rail">
          {loopSteps.map((step, index) => (
            <div key={step.label} className={`loop-node loop-node-${index + 1}`}>
              <em>{index + 1}</em>
              <strong>{step.label}</strong>
              <span>{step.detail}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="hero-summary-card">
        <div className="hero-summary-copy">
          <p>Why it works</p>
          <strong>Study less. Remember more.</strong>
        </div>
        <div className="hero-summary-points">
          {[
            "Chapter-wise practice",
            "Short focused sessions",
            "Find weak topics instantly",
            "Improve with targeted retry",
          ].map((item) => (
            <div key={item} className="summary-point">
              <span className="summary-dot" aria-hidden="true" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  </section>
);
