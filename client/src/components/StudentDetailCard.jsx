// 8-slot categorical chip palette (fixed hue order -- blue/orange/aqua/
// yellow/magenta/green/violet/red), matching the app's data-viz color
// standard. Label text varies per content source (admin-imported JSON has
// its own label vocabulary, not a known enum), so the slot is picked by
// hashing the label rather than a hardcoded lookup -- the same label always
// lands on the same chip color, including across different concepts/imports.
const CHIP_SLOT_COUNT = 8;

const hashLabelToChipSlot = (label) => {
  let hash = 0;
  for (let index = 0; index < label.length; index += 1) {
    hash = (hash * 31 + label.charCodeAt(index)) >>> 0;
  }
  return (hash % CHIP_SLOT_COUNT) + 1;
};

// Friendlier display text for label(s) whose source-JSON wording reads more
// like an internal field name than student-facing copy. Chip color still
// hashes off the original label (below), so this is purely cosmetic and
// doesn't affect color assignment or matching against the raw data.
const LABEL_DISPLAY_OVERRIDES = {
  output: "In a nutshell",
};

const displayLabel = (label) => LABEL_DISPLAY_OVERRIDES[label.trim().toLowerCase()] || label;

// Generic label/value content card, reused by Revision, Tutor Notes, and the
// Challenges tab -- every one of those features stores its content as
// {title, summary, details: [{label, value}]}, and until this component
// there was no shared renderer for that shape (each existing feature hand-
// rolls its own display for its own, differently-shaped data).
export const StudentDetailCard = ({ title, summary, details = [], className = "", children }) => (
  <article className={`student-detail-card ${className}`.trim()}>
    {title && <h3 className="student-detail-card-title">{title}</h3>}
    {summary && <p className="student-detail-card-summary">{summary}</p>}
    {details.length > 0 && (
      <dl className="student-detail-card-list">
        {details.map((detail, index) => (
          <div className="student-detail-card-row" key={`${detail.label}-${index}`}>
            <dt className={`student-detail-chip student-detail-chip-${hashLabelToChipSlot(detail.label || "")}`}>
              {displayLabel(detail.label || "")}
            </dt>
            <dd>{Array.isArray(detail.value) ? detail.value.join(", ") : detail.value}</dd>
          </div>
        ))}
      </dl>
    )}
    {children}
  </article>
);
