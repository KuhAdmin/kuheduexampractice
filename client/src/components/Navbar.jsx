import { useState } from "react";
import { motion } from "framer-motion";

export const Navbar = ({ onAuthOpen, user, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <motion.header
      className="nav-shell"
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="brand-lockup">
        <img className="brand-logo" src="/kuhedu-logo.png" alt="KUHEDU logo" />
        <div>
          <p>KUHEDU Practice</p>
          <span>A memory-first exam preparation platform for CBSE Class 11 & 12.</span>
        </div>
      </div>

      <button
        type="button"
        className={`menu-toggle ${menuOpen ? "is-open" : ""}`}
        aria-expanded={menuOpen}
        aria-label="Toggle navigation menu"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>

      <nav className={`nav-actions ${menuOpen ? "is-open" : ""}`}>
        <a href="#" onClick={closeMenu}>
          Home
        </a>
        <a href="#test-suites" onClick={closeMenu}>
          Practice
        </a>
        <a href="#pricing" onClick={closeMenu}>
          Pricing
        </a>
        {user ? (
          <button
            className="ghost-button"
            onClick={() => {
              closeMenu();
              onLogout();
            }}
          >
            Logout
          </button>
        ) : (
          <button
            className="ghost-button"
            onClick={() => {
              closeMenu();
              onAuthOpen();
            }}
          >
            Sign In
          </button>
        )}
      </nav>
    </motion.header>
  );
};
