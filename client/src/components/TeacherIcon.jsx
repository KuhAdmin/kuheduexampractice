export const TeacherIcon = ({ type, className = "", style }) => {
  const classes = `teacher-icon ${className}`.trim();

  if (type === "copy") {
    return (
      <svg viewBox="0 0 24 24" className={classes} style={style} aria-hidden="true">
        <rect x="8.5" y="8.5" width="11" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="M6 15.5H5.5A2 2 0 0 1 3.5 13.5v-8A2 2 0 0 1 5.5 3.5h8a2 2 0 0 1 2 2V6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      </svg>
    );
  }

  if (type === "refresh") {
    return (
      <svg viewBox="0 0 24 24" className={classes} style={style} aria-hidden="true">
        <path
          d="M4.5 12a7.5 7.5 0 0 1 12.6-5.5M19.5 12a7.5 7.5 0 0 1-12.6 5.5M17.5 4.5V8h-3.5M6.5 19.5V16H10"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
    );
  }

  if (type === "person") {
    return (
      <svg viewBox="0 0 24 24" className={classes} style={style} aria-hidden="true">
        <circle cx="12" cy="8.5" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="M5.5 19a6.5 6.5 0 0 1 13 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      </svg>
    );
  }

  if (type === "person-add") {
    return (
      <svg viewBox="0 0 24 24" className={classes} style={style} aria-hidden="true">
        <circle cx="10" cy="8.5" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="M4 19a6 6 0 0 1 12 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
        <path d="M18 8v5m-2.5-2.5h5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      </svg>
    );
  }

  if (type === "book") {
    return (
      <svg viewBox="0 0 24 24" className={classes} style={style} aria-hidden="true">
        <path
          d="M5 6.5A2.5 2.5 0 0 1 7.5 4H19v15H7.5A2.5 2.5 0 0 0 5 21V6.5Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
    );
  }

  if (type === "building") {
    return (
      <svg viewBox="0 0 24 24" className={classes} style={style} aria-hidden="true">
        <path d="M5 21V6l7-3 7 3v15" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
        <path d="M9 21v-5h6v5M9 10h1m4 0h1M9 14h1m4 0h1" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      </svg>
    );
  }

  if (type === "document") {
    return (
      <svg viewBox="0 0 24 24" className={classes} style={style} aria-hidden="true">
        <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
        <path d="M14 3.5V8h4" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
        <path d="M9 13h6m-6 3.5h6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
      </svg>
    );
  }

  if (type === "star") {
    return (
      <svg viewBox="0 0 24 24" className={classes} style={style} aria-hidden="true">
        <path
          d="m12 4 2.5 5.1 5.6.8-4 3.9.9 5.5L12 16.8 7 19.3l.9-5.5-4-3.9 5.6-.8Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
      </svg>
    );
  }

  if (type === "clock") {
    return (
      <svg viewBox="0 0 24 24" className={classes} style={style} aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      </svg>
    );
  }

  if (type === "chart") {
    return (
      <svg viewBox="0 0 24 24" className={classes} style={style} aria-hidden="true">
        <path d="M5 19V10m6.5 9V5M18 19v-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      </svg>
    );
  }

  if (type === "bulb") {
    return (
      <svg viewBox="0 0 24 24" className={classes} style={style} aria-hidden="true">
        <path
          d="M9 17.5h6M9.5 21h5M12 3.5a5.5 5.5 0 0 0-3 10.1c.6.4 1 1.1 1 1.9v.5h4v-.5c0-.8.4-1.5 1-1.9A5.5 5.5 0 0 0 12 3.5Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
    );
  }

  if (type === "check") {
    return (
      <svg viewBox="0 0 24 24" className={classes} style={style} aria-hidden="true">
        <path d="m5 12.5 4.5 4.5L19 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </svg>
    );
  }

  if (type === "bell") {
    return (
      <svg viewBox="0 0 24 24" className={classes} style={style} aria-hidden="true">
        <path
          d="M12 4a4 4 0 0 0-4 4v2.1c0 .8-.2 1.6-.7 2.3L6 14.5h12l-1.3-2.1a4.5 4.5 0 0 1-.7-2.3V8a4 4 0 0 0-4-4Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
        <path d="M10.2 17a2 2 0 0 0 3.6 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      </svg>
    );
  }

  if (type === "grid") {
    return (
      <svg viewBox="0 0 24 24" className={classes} style={style} aria-hidden="true">
        <rect x="4" y="4" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <rect x="13" y="4" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <rect x="4" y="13" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <rect x="13" y="13" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    );
  }

  if (type === "people") {
    return (
      <svg viewBox="0 0 24 24" className={classes} style={style} aria-hidden="true">
        <circle cx="9" cy="8.5" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3.8 19a5.2 5.2 0 0 1 10.4 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
        <path
          d="M15.5 9.5a2.4 2.4 0 1 0 0-4.8M17 19a4.7 4.7 0 0 0-3-4.4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.6"
        />
      </svg>
    );
  }

  if (type === "bolt") {
    return (
      <svg viewBox="0 0 24 24" className={classes} style={style} aria-hidden="true">
        <path d="M13 3 5 13.5h5.5L11 21l8-10.8h-5.5L13 3Z" fill="currentColor" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.3" />
      </svg>
    );
  }

  if (type === "chevron-right") {
    return (
      <svg viewBox="0 0 24 24" className={classes} style={style} aria-hidden="true">
        <path d="m9.5 6 6 6-6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (type === "help-circle") {
    return (
      <svg viewBox="0 0 24 24" className={classes} style={style} aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M9.8 9.5a2.2 2.2 0 1 1 3.2 2c-.8.5-1 .9-1 1.8"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
        <circle cx="12" cy="16.5" r="0.9" fill="currentColor" />
      </svg>
    );
  }

  return null;
};
