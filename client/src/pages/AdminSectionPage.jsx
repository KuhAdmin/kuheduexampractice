export const AdminSectionPage = ({ title, eyebrow, description }) => (
  <section className="admin-section-page">
    <div className="admin-section-hero">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>

    <div className="admin-section-placeholder">
      <strong>{title}</strong>
      <p>
        This section is part of the Phase 1 admin shell and is ready for the next
        workflow-specific implementation pass.
      </p>
    </div>
  </section>
);
