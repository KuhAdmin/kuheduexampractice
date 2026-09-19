import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createTeacherGradebookExam, getTeacherBatches, getTeacherTestPapers } from "../api/client";

const emptyManualQuestion = () => ({ questionLabel: "", maxMarks: "5" });

export const TeacherGradingNewPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state || {};

  const [batches, setBatches] = useState([]);
  const [papers, setPapers] = useState([]);
  const [batchId, setBatchId] = useState(prefill.batchId || "");
  const [title, setTitle] = useState("");
  const [examDate, setExamDate] = useState(new Date().toISOString().slice(0, 10));
  const [sourceType, setSourceType] = useState(prefill.teacherTestPaperId ? "test_paper" : "manual");
  const [teacherTestPaperId, setTeacherTestPaperId] = useState(prefill.teacherTestPaperId || "");
  const [manualQuestions, setManualQuestions] = useState([emptyManualQuestion(), emptyManualQuestion()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getTeacherBatches().then((result) => setBatches(result?.batches || []));
    getTeacherTestPapers().then((result) => setPapers((result?.papers || []).filter((p) => p.status === "finalized")));
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = { batchId, title, examDate, sourceType };
      if (sourceType === "test_paper") {
        payload.teacherTestPaperId = teacherTestPaperId;
      } else {
        payload.manualQuestions = manualQuestions
          .filter((q) => q.questionLabel.trim())
          .map((q) => ({ questionLabel: q.questionLabel, maxMarks: Number(q.maxMarks) || 1 }));
      }
      const exam = await createTeacherGradebookExam(payload);
      navigate(`/teacher/grading/${exam.id}`, { replace: true });
    } catch (submitError) {
      setError(submitError.message || "Failed to create exam.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="teacher-page">
      <div className="teacher-page-header">
        <div>
          <button type="button" className="teacher-back-link" onClick={() => navigate("/teacher/grading")}>
            &larr; Grading
          </button>
          <h1>New Exam</h1>
        </div>
      </div>

      <form className="admin-panel" onSubmit={handleSubmit}>
        <div className="admin-studio-form-grid">
          <label className="admin-studio-field">
            <span>Batch</span>
            <select value={batchId} onChange={(e) => setBatchId(e.target.value)} required>
              <option value="">Select a class...</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.className}-{batch.sectionName} &middot; {batch.subjectName}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-studio-field">
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Unit Test 1" required />
          </label>
          <label className="admin-studio-field">
            <span>Exam Date</span>
            <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} required />
          </label>
        </div>

        <div className="admin-studio-field">
          <span style={{ fontWeight: 700 }}>Source</span>
          <div className="admin-users-scope-checklist">
            <label>
              <input type="radio" name="sourceType" checked={sourceType === "manual"} onChange={() => setSourceType("manual")} />
              Manual entry
            </label>
            <label>
              <input type="radio" name="sourceType" checked={sourceType === "test_paper"} onChange={() => setSourceType("test_paper")} />
              From a finalized test paper
            </label>
          </div>
        </div>

        {sourceType === "test_paper" ? (
          <label className="admin-studio-field">
            <span>Test Paper</span>
            <select value={teacherTestPaperId} onChange={(e) => setTeacherTestPaperId(e.target.value)} required>
              <option value="">Select a paper...</option>
              {papers.map((paper) => (
                <option key={paper.id} value={paper.id}>
                  {paper.title} ({paper.questionCount} questions, {paper.totalMarks} marks)
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="admin-studio-field">
            <span style={{ fontWeight: 700 }}>Questions</span>
            {manualQuestions.map((q, index) => (
              <div key={index} style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <input
                  placeholder={`Q${index + 1}`}
                  value={q.questionLabel}
                  onChange={(e) =>
                    setManualQuestions((current) => current.map((row, i) => (i === index ? { ...row, questionLabel: e.target.value } : row)))
                  }
                />
                <input
                  type="number"
                  min="1"
                  style={{ width: "80px" }}
                  value={q.maxMarks}
                  onChange={(e) =>
                    setManualQuestions((current) => current.map((row, i) => (i === index ? { ...row, maxMarks: e.target.value } : row)))
                  }
                />
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setManualQuestions((current) => current.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              </div>
            ))}
            <button type="button" className="ghost-button" style={{ marginTop: "8px" }} onClick={() => setManualQuestions((c) => [...c, emptyManualQuestion()])}>
              + Add question
            </button>
          </div>
        )}

        {error && <p className="error-text">{error}</p>}
        <div className="admin-bulk-pipeline-dialog-actions">
          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? "Creating..." : "Create Gradebook"}
          </button>
        </div>
      </form>
    </div>
  );
};
