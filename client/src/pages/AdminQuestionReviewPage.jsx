import { useCallback, useEffect, useState } from "react";
import { getAdminPendingQuestions, reviewAdminQuestion } from "../api/client";

export const AdminQuestionReviewPage = () => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [notesDraft, setNotesDraft] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAdminPendingQuestions();
      setQuestions(result?.questions || []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load pending questions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDecision = async (itemId, decision) => {
    setBusyId(itemId);
    setError("");
    try {
      await reviewAdminQuestion(itemId, decision, notesDraft[itemId] || "");
      setNotice(`Question ${decision}.`);
      await load();
    } catch (decisionError) {
      setError(decisionError.message || "Failed to record decision.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="admin-bulk-pipeline-page">
      <header className="admin-bulk-pipeline-header">
        <div>
          <span className="eyebrow">Admin module</span>
          <h1>Question Review</h1>
          <p>Teacher-authored questions waiting to join the shared question bank.</p>
        </div>
      </header>

      {notice && <div className="admin-bulk-pipeline-concurrency">{notice}</div>}
      {error && <p className="error-text">{error}</p>}

      <div className="admin-bulk-pipeline-grid-shell">
        {loading ? (
          <div className="admin-bulk-pipeline-empty">Loading...</div>
        ) : questions.length === 0 ? (
          <div className="admin-bulk-pipeline-empty">No questions waiting for review.</div>
        ) : (
          <table className="admin-exam-types-table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Chapter</th>
                <th>Teacher</th>
                <th>Type</th>
                <th>Notes</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {questions.map((question) => (
                <tr key={question.id}>
                  <td>{question.question}</td>
                  <td>{question.chapterName || "-"}</td>
                  <td>
                    {question.teacherName}
                    <br />
                    <span className="admin-users-scope-label">{question.teacherEmail}</span>
                  </td>
                  <td>{question.question_family}</td>
                  <td>
                    <input
                      placeholder="Optional notes"
                      value={notesDraft[question.id] || ""}
                      onChange={(event) => setNotesDraft((current) => ({ ...current, [question.id]: event.target.value }))}
                    />
                  </td>
                  <td>
                    <div className="table-actions">
                      <button type="button" className="primary-button" disabled={busyId === question.id} onClick={() => handleDecision(question.id, "approved")}>
                        Approve
                      </button>
                      <button
                        type="button"
                        className="ghost-button admin-pipeline-runs-danger"
                        disabled={busyId === question.id}
                        onClick={() => handleDecision(question.id, "rejected")}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};
