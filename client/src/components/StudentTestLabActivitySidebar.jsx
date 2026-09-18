import { useNavigate } from "react-router-dom";

const formatDate = (isoString) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const summarizeFilters = (attempt) => {
  const chapterCount = Array.isArray(attempt.chapterNumbers) ? attempt.chapterNumbers.length : 0;
  const chapterLabel = chapterCount === 1 ? "1 chapter" : `${chapterCount} chapters`;
  const typeCount = Array.isArray(attempt.interactionTypes) ? attempt.interactionTypes.length : 0;
  return typeCount ? `${chapterLabel} · ${typeCount} type${typeCount === 1 ? "" : "s"}` : chapterLabel;
};

// Presented three ways depending on screen width (see StudentTestLabPage.jsx):
// a persistent sticky rail on desktop, a slide-over panel on tablet/mobile
// triggered by a "History" button. This component only renders the list
// content -- the wrapping chrome (rail vs. slide-over) lives in the caller so
// the same list markup works in both contexts.
export const StudentTestLabActivitySidebar = ({ attempts, loading }) => {
  const navigate = useNavigate();

  return (
    <div className="student-testlab-activity">
      <h3>Recent Sessions</h3>
      {loading ? (
        <p className="student-empty-state">Loading recent sessions...</p>
      ) : !attempts.length ? (
        <p className="student-empty-state">No TestLab sessions yet -- start your first set!</p>
      ) : (
        <ul className="student-testlab-activity-list">
          {attempts.map((attempt) => (
            <li key={attempt.attemptId}>
              <button
                type="button"
                className="student-testlab-activity-row"
                onClick={() =>
                  attempt.status === "completed"
                    ? navigate(`/test-lab/attempts/${attempt.attemptId}/result`)
                    : navigate(`/test-lab/attempts/${attempt.attemptId}`)
                }
              >
                <span className="student-testlab-activity-copy">
                  <strong>{summarizeFilters(attempt)}</strong>
                  <small>{formatDate(attempt.startedAt)}</small>
                </span>
                {attempt.status === "completed" ? (
                  <span className="student-testlab-activity-score">{attempt.score ?? 0}%</span>
                ) : (
                  <span className="student-testlab-activity-score is-in-progress">Resume</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
