import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTeacherCustomQuestions } from "../api/client";

export const TeacherCustomQuestionsPage = () => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getTeacherCustomQuestions()
      .then((result) => setQuestions(result?.questions || []))
      .catch((loadError) => setError(loadError.message || "Failed to load your questions."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="teacher-page">
      <div className="teacher-page-header">
        <div>
          <button type="button" className="teacher-back-link" onClick={() => navigate("/teacher/tests")}>
            &larr; Tests
          </button>
          <h1>My Custom Questions</h1>
          <p>Every question you&apos;ve authored, and whether it has joined the shared question bank yet.</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : questions.length === 0 ? (
        <div className="admin-panel">
          <p>You haven&apos;t authored any custom questions yet -- add one from the Test Builder.</p>
        </div>
      ) : (
        <div className="admin-bulk-pipeline-grid-shell">
          <table className="admin-exam-types-table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Chapter</th>
                <th>Type</th>
                <th>Marks</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((question) => (
                <tr key={question.id}>
                  <td>{question.question}</td>
                  <td>{question.chapterName || "-"}</td>
                  <td>{question.questionFamily}</td>
                  <td>{question.marks}</td>
                  <td>
                    <span className={`teacher-badge tone-${question.reviewStatus}`}>{question.reviewStatus}</span>
                  </td>
                  <td>{question.reviewNotes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
