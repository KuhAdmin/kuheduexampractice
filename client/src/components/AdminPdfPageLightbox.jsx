const CloseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

// Enlarged single-page view, opened from a thumbnail click. Mirrors
// StudentMediaViewer.jsx's fullscreen-overlay interaction language (dark
// backdrop, maximize-style close button) for visual consistency, rather
// than inventing a new one, even though this is a separate admin-only
// component (StudentMediaViewer also renders video/speech controls this
// page doesn't need).
export const AdminPdfPageLightbox = ({ pageNumber, dataUrl, onClose }) => (
  <div className="admin-source-builder-lightbox-overlay" onClick={onClose}>
    <button type="button" className="admin-source-builder-lightbox-close" aria-label="Close" onClick={onClose}>
      <CloseIcon />
    </button>
    <img src={dataUrl} alt={`Page ${pageNumber}`} onClick={(event) => event.stopPropagation()} />
  </div>
);
