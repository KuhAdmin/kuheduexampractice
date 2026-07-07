import { motion } from "framer-motion";

export const Footer = ({ onAuthOpen }) => (
  <footer className="site-footer">
    <motion.section
      className="footer-cta"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
    >
      <div className="footer-cta-copy">
        <h2>Ready to remember more before your next exam?</h2>
        <p>
          Start with chapter-wise practice. Build retention, sharpen recall, and
          walk into exams with more confidence.
        </p>
      </div>
      <button className="footer-cta-button" onClick={onAuthOpen}>
        Practice a Chapter
      </button>
    </motion.section>

    <div className="footer-meta">
      <p>© 2026 KUHEDU Practice. All rights reserved.</p>
      <nav className="footer-links" aria-label="Footer">
        <a href="#">Privacy</a>
        <a href="#">Terms</a>
        <a href="#">Disclaimer</a>
        <a href="#">Contact</a>
      </nav>
    </div>
  </footer>
);
