const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" className="student-dashboard-icon" aria-hidden="true">
    <path
      d="m9 6 6 6-6 6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    />
  </svg>
);

export const StudentDrilldownCard = ({
  as = "button",
  onClick,
  className = "",
  leading,
  title,
  subtitle,
  trailing,
  children,
  ...props
}) => {
  const Component = as;
  const resolvedTrailing = trailing === undefined ? <ChevronIcon /> : trailing;
  const classes = `student-drilldown-card ${className}`.trim();

  return (
    <Component type={Component === "button" ? "button" : undefined} className={classes} onClick={onClick} {...props}>
      {leading ? <span className="student-drilldown-card-leading">{leading}</span> : null}
      <span className="student-drilldown-card-copy">
        <strong>{title}</strong>
        {subtitle ? <small>{subtitle}</small> : null}
        {children}
      </span>
      {resolvedTrailing ? <span className="student-drilldown-card-trailing">{resolvedTrailing}</span> : null}
    </Component>
  );
};
