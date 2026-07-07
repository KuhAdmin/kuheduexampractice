import { motion } from "framer-motion";

export const FeatureCard = ({ title, description, accent, delay = 0 }) => (
  <motion.article
    className="feature-card"
    style={{ "--accent": accent }}
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.3 }}
    transition={{ duration: 0.45, delay }}
  >
    <h3>{title}</h3>
    <p>{description}</p>
  </motion.article>
);
