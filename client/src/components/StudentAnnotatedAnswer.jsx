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

const ISSUE_TYPE_LABELS = {
  grammar: "Grammar",
  phrasing: "Phrasing",
  spelling: "Spelling",
};

const issueTypeLabel = (type) => ISSUE_TYPE_LABELS[type] || ISSUE_TYPE_LABELS.spelling;

// contentFeedback is optional -- only writing-practice submissions
// (StudentWritingQuestionDetailPage.jsx via StudentOpenResponsePanel) pass
// it. Whole-answer observations, not spans located inside the text, so
// they're rendered as plain bullet lists rather than inline marks.
export const StudentAnnotatedAnswer = ({ text, issues, contentFeedback }) => {
  const hasIssues = Boolean(issues?.length);
  const hasContentFeedback = Boolean(contentFeedback?.toAdd?.length || contentFeedback?.toOmit?.length);
  if (!hasIssues && !hasContentFeedback) return null;

  const segments = hasIssues ? buildIssueSegments(text, issues) : [];

  return (
    <div className="student-answer-issues">
      {hasIssues && (
        <>
          <p className="student-answer-issues-text">
            {segments.map((segment, index) =>
              segment.type === "issue" ? (
                <mark
                  key={index}
                  className={`student-answer-issue is-${segment.issue.type}`}
                  title={`${issueTypeLabel(segment.issue.type)}: ${segment.issue.suggestion}`}
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
                <span className={`student-concept-explore-tag is-${issue.type}`}>{issueTypeLabel(issue.type)}</span>
                <span className="student-answer-issues-correction">
                  <s>{issue.original}</s> {"→"} <strong>{issue.suggestion}</strong>
                </span>
                {issue.note && <span className="student-answer-issues-note">{issue.note}</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      {hasContentFeedback && (
        <div className="student-answer-content-feedback">
          {contentFeedback.toAdd?.length > 0 && (
            <div className="student-answer-content-feedback-group">
              <strong>Add these</strong>
              <ul>
                {contentFeedback.toAdd.map((point, index) => (
                  <li key={index}>{point}</li>
                ))}
              </ul>
            </div>
          )}
          {contentFeedback.toOmit?.length > 0 && (
            <div className="student-answer-content-feedback-group">
              <strong>Consider removing</strong>
              <ul>
                {contentFeedback.toOmit.map((point, index) => (
                  <li key={index}>{point}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
