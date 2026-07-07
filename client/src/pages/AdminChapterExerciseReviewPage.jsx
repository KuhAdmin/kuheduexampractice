import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPendingChapterExerciseQuestions, reviewChapterExerciseQuestion } from "../api/client";

export const AdminChapterExerciseReviewPage = () => {
  const { bookId, chapterNumber } = useParams();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getPendingChapterExerciseQuestions(bookId, chapterNumber);
      setQuestions(result?.questions || []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load pending chapter exercise questions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, chapterNumber]);

  const handleReview = async (questionId, decision) => {
    setBusyId(questionId);
    setError("");
    try {
      await reviewChapterExerciseQuestion(questionId, decision);
      setQuestions((current) => current.filter((question) => question.id !== questionId));
    } catch (reviewError) {
      setError(reviewError.message || "Failed to record review decision.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="admin-bulk-pipeline-page">
      <div className="admin-bulk-pipeline-header">
        <div>
          <span className="eyebrow">Admin module</span>
          <h1>Chapter Exercise Review</h1>
          <p>Approve or reject AI-extracted chapter-end exercise questions before students see them.</p>
        </div>
        <button type="button" className="ghost-button" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="admin-bulk-pipeline-grid-shell">
        {loading ? (
          <div className="admin-bulk-pipeline-empty">Loading pending questions...</div>
        ) : questions.length === 0 ? (
          <div className="admin-bulk-pipeline-empty">
            No pending chapter-exercise questions for this chapter.
          </div>
        ) : (
          <div className="admin-chapter-exercise-review-list">
            {questions.map((question) => (
              <div key={question.id} className="admin-chapter-exercise-review-card">
                <div className="admin-chapter-exercise-review-card-head">
                  <strong>{question.questionNumber ? `Q${question.questionNumber}` : "Question"}</strong>
                  <span className="admin-bulk-pipeline-section-label">{question.interactionType}</span>
                </div>
                <p>{question.questionText}</p>

                {question.interactionType === "single_select" && (
                  <ul className="admin-chapter-exercise-review-options">
                    {(question.options || []).map((option) => (
                      <li key={option} className={option === question.correctAnswer ? "is-correct" : ""}>
                        {option}
                      </li>
                    ))}
                  </ul>
                )}

                {question.interactionType === "matching" && (
                  <ul className="admin-chapter-exercise-review-options">
                    {(question.interactionData?.pairs || []).map((pair, index) => (
                      <li key={index}>
                        {pair.left} &rarr; {pair.right}
                      </li>
                    ))}
                  </ul>
                )}

                {question.interactionType === "free_text" && question.correctAnswer && (
                  <p className="admin-chapter-exercise-review-answer">
                    <strong>Model answer:</strong> {question.correctAnswer}
                  </p>
                )}

                <div className="admin-bulk-pipeline-dialog-actions">
                  <button
                    type="button"
                    className="ghost-button admin-pipeline-runs-danger"
                    disabled={busyId === question.id}
                    onClick={() => handleReview(question.id, "rejected")}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={busyId === question.id}
                    onClick={() => handleReview(question.id, "approved")}
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
