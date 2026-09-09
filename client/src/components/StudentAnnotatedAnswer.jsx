// AI-flagged spelling/grammar issues for a submitted free-text answer (see
// aiTextIssueUtils.js server-side). Mirrors MathPreview.jsx's segment-parse/
// segment-render split, but offset-based (issue.start/end already located
// server-side) instead of regex-based.
export const buildIssueSegments = (text, issues) => {
  const source = text || "";
  const validIssues = (issues || [])
    .filter((issue) => Number.isInteger(issue.start) && Number.isInteger(issue.end) && issue.end > issue.start)
    .sort((a, b) => a.start - b.start);

  const segments = [];
  let cursor = 0;
  for (const issue of validIssues) {
    if (issue.start < cursor) continue; // overlapping with a previous span -- skip defensively
    if (issue.start > cursor) {
      segments.push({ type: "text", value: source.slice(cursor, issue.start) });
    }
    segments.push({ type: "issue", value: source.slice(issue.start, issue.end), issue });
    cursor = issue.end;
  }
  if (cursor < source.length) {
    segments.push({ type: "text", value: source.slice(cursor) });
  }
  return segments;
};

export const StudentAnnotatedAnswer = ({ text, issues }) => {
  if (!issues?.length) return null;

  const segments = buildIssueSegments(text, issues);

  return (
    <div className="student-answer-issues">
      <p className="student-answer-issues-text">
        {segments.map((segment, index) =>
          segment.type === "issue" ? (
            <mark
              key={index}
              className={`student-answer-issue is-${segment.issue.type}`}
              title={`${segment.issue.type === "grammar" ? "Grammar" : "Spelling"}: ${segment.issue.suggestion}`}
            >
              {segment.value}
            </mark>
          ) : (
            <span key={index}>{segment.value}</span>
          )
        )}
      </p>
      <ul className="student-answer-issues-list">
        {issues.map((issue, index) => (
          <li key={index} className="student-answer-issues-row">
            <span className={`student-concept-explore-tag is-${issue.type}`}>
              {issue.type === "grammar" ? "Grammar" : "Spelling"}
            </span>
            <span className="student-answer-issues-correction">
              <s>{issue.original}</s> {"→"} <strong>{issue.suggestion}</strong>
            </span>
            {issue.note && <span className="student-answer-issues-note">{issue.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};
