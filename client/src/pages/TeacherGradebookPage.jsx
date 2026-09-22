import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { downloadTeacherGradebookExcel, getTeacherGradebookExam, requestAiGradeAssist, saveTeacherGradebookMarks } from "../api/client";

export const TeacherGradebookPage = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [draftMarks, setDraftMarks] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [aiModal, setAiModal] = useState(null);
  const [aiAnswerText, setAiAnswerText] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiSuggestionIsAuto, setAiSuggestionIsAuto] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");

  const cellKey = (questionId, userId) => `${questionId}|${userId}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getTeacherGradebookExam(examId);
      setExam(result);
      const initialDraft = {};
      result.students.forEach((student) => {
        result.questions.forEach((question) => {
          const cell = student.marks[question.id];
          initialDraft[cellKey(question.id, student.id)] = cell?.marksAwarded ?? "";
        });
      });
      setDraftMarks(initialDraft);
    } catch (loadError) {
      setError(loadError.message || "Failed to load this exam.");
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    load();
  }, [load]);

  const hasUnsavedChanges = () => {
    if (!exam) return false;
    return exam.students.some((student) =>
      exam.questions.some((question) => {
        const key = cellKey(question.id, student.id);
        const original = student.marks[question.id]?.marksAwarded ?? "";
        return String(draftMarks[key] ?? "") !== String(original ?? "");
      })
    );
  };

  const handleCellChange = (questionId, userId, value) => {
    setDraftMarks((current) => ({ ...current, [cellKey(questionId, userId)]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const marks = [];
      exam.students.forEach((student) => {
        exam.questions.forEach((question) => {
          marks.push({ gradebookExamQuestionId: question.id, userId: student.id, marksAwarded: draftMarks[cellKey(question.id, student.id)] });
        });
      });
      const updated = await saveTeacherGradebookMarks(examId, marks);
      setExam(updated);
      setNotice("Marks saved.");
    } catch (saveError) {
      setError(saveError.message || "Failed to save marks.");
    } finally {
      setSaving(false);
    }
  };

  const totalFor = (student) =>
    exam.questions.reduce((sum, question) => sum + (Number(draftMarks[cellKey(question.id, student.id)]) || 0), 0);

  const openAiAssist = (question, student) => {
    const mark = student.marks[question.id] || {};
    setAiModal({ question, student });
    setAiAnswerText(mark.studentAnswerText || "");
    // Digital test-taking already ran this same AI grading at submit time
    // (studentTestPaperService.js) -- if it's on record, show it straight
    // away instead of making the teacher click "Get AI Suggestion" again for
    // an answer they never had to transcribe in the first place.
    const hasAutoSuggestion = Boolean(mark.studentAnswerText) && mark.aiSuggestedMarks != null;
    setAiSuggestion(hasAutoSuggestion ? { suggestedMarks: mark.aiSuggestedMarks, feedback: mark.aiSuggestedFeedback } : null);
    setAiSuggestionIsAuto(hasAutoSuggestion);
    setAiError("");
  };

  const handleAiSuggest = async () => {
    setAiBusy(true);
    setAiError("");
    try {
      const suggestion = await requestAiGradeAssist(examId, aiModal.question.id, aiModal.student.id, aiAnswerText);
      setAiSuggestion(suggestion);
      setAiSuggestionIsAuto(false);
    } catch (aiRequestError) {
      setAiError(aiRequestError.message || "AI grading is unavailable right now -- enter the mark manually.");
    } finally {
      setAiBusy(false);
    }
  };

  const handleAcceptAiSuggestion = () => {
    handleCellChange(aiModal.question.id, aiModal.student.id, aiSuggestion.suggestedMarks);
    setAiModal(null);
  };

  if (loading) {
    return (
      <div className="teacher-page">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="teacher-page">
      <div className="teacher-page-header">
        <div>
          <button type="button" className="teacher-back-link" onClick={() => navigate("/teacher/grading")}>
            &larr; Grading
          </button>
          <h1>{exam?.title}</h1>
        </div>
        <div>
          <button type="button" className="ghost-button" onClick={() => downloadTeacherGradebookExcel(examId, `${exam.title}.xlsx`)}>
            Export Excel
          </button>
          <button type="button" className="primary-button" disabled={saving} onClick={handleSave}>
            {saving ? "Saving..." : "Save Marks"}
          </button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {notice && <div className="admin-bulk-pipeline-concurrency">{notice}</div>}
      {hasUnsavedChanges() && <p className="teacher-alert-line">Unsaved changes</p>}

      {exam && (
        <div className="admin-bulk-pipeline-grid-shell">
          <table className="admin-exam-types-table">
            <thead>
              <tr>
                <th>Student</th>
                {exam.questions.map((question) => (
                  <th key={question.id}>
                    {question.questionLabel} ({question.maxMarks})
                  </th>
                ))}
                <th>Total ({exam.totalMarks})</th>
              </tr>
            </thead>
            <tbody>
              {exam.students.map((student) => (
                <tr key={student.id}>
                  <td>{student.name}</td>
                  {exam.questions.map((question) => (
                    <td key={question.id}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <input
                          type="number"
                          min="0"
                          max={question.maxMarks}
                          className="teacher-gradebook-input"
                          value={draftMarks[cellKey(question.id, student.id)] ?? ""}
                          onChange={(event) => handleCellChange(question.id, student.id, event.target.value)}
                        />
                        <button type="button" className="ghost-button" title="AI Grading Assist" onClick={() => openAiAssist(question, student)}>
                          AI
                        </button>
                      </div>
                    </td>
                  ))}
                  <td>{totalFor(student)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aiModal && (
        <div className="modal-backdrop" onClick={() => setAiModal(null)}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close-button" onClick={() => setAiModal(null)}>
              &times;
            </button>
            <h2>AI Grading Assist</h2>
            <p className="teacher-card-meta">
              {aiModal.student.name} &middot; {aiModal.question.questionLabel} ({aiModal.question.maxMarks} marks)
            </p>
            {aiSuggestionIsAuto && (
              <p className="teacher-card-meta">✨ Auto-graded from the student's digital submission -- review before accepting.</p>
            )}
            <div className="teacher-ai-assist-grid">
              <div>
                <span style={{ fontWeight: 700 }}>Student Answer</span>
                <textarea rows={6} value={aiAnswerText} onChange={(e) => setAiAnswerText(e.target.value)} style={{ width: "100%", marginTop: "6px" }} />
              </div>
              <div>
                <span style={{ fontWeight: 700 }}>AI Suggestion</span>
                {aiError && <p className="error-text">{aiError}</p>}
                {aiSuggestion ? (
                  <div style={{ marginTop: "6px" }}>
                    <p>
                      Suggested score: <strong>{aiSuggestion.suggestedMarks} / {aiModal.question.maxMarks}</strong>
                    </p>
                    <p className="teacher-card-meta">{aiSuggestion.feedback}</p>
                  </div>
                ) : (
                  <p className="teacher-card-meta" style={{ marginTop: "6px" }}>
                    Get a suggested score for reference. You always control the final mark.
                  </p>
                )}
              </div>
            </div>
            <div className="admin-bulk-pipeline-dialog-actions">
              <button type="button" className="ghost-button" onClick={handleAiSuggest} disabled={aiBusy || !aiAnswerText.trim()}>
                {aiBusy ? "Thinking..." : "Get AI Suggestion"}
              </button>
              {aiSuggestion && (
                <button type="button" className="primary-button" onClick={handleAcceptAiSuggestion}>
                  Accept {aiSuggestion.suggestedMarks}/{aiModal.question.maxMarks}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
