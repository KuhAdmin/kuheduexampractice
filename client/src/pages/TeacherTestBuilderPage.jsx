import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createTeacherCustomQuestion,
  createTeacherTestPaper,
  downloadTeacherTestPaperExcel,
  downloadTeacherTestPaperPdf,
  finalizeTeacherTestPaper,
  getTeacherBatches,
  getTeacherTestFilterOptions,
  getTeacherTestPaper,
  removeTeacherTestPaperItem,
  swapTeacherTestPaperItem,
} from "../api/client";

const DIFFICULTY_TONE = { easy: "tgreen", medium: "tamber", hard: "tred" };

const emptyFilters = { batchId: "", chapterNumbers: [], questionFamilies: [], generationMode: "custom_mix", questionCount: "20", targetTotalMarks: "40", difficultyEasy: "30", difficultyMedium: "50", difficultyHard: "20" };

const emptyCustomForm = { question: "", options: ["", "", "", ""], correctAnswer: "", questionFamily: "mcq", difficulty: "Medium", marks: "1" };

export const TeacherTestBuilderPage = () => {
  const { paperId } = useParams();
  const navigate = useNavigate();
  const isNew = paperId === "new";

  const [step, setStep] = useState(1);
  const [batches, setBatches] = useState([]);
  const [filterOptions, setFilterOptions] = useState(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [title, setTitle] = useState("Untitled Test");
  const [paper, setPaper] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [customFormOpen, setCustomFormOpen] = useState(false);
  const [customForm, setCustomForm] = useState(emptyCustomForm);
  const [customSubmitting, setCustomSubmitting] = useState(false);

  useEffect(() => {
    getTeacherBatches()
      .then((result) => setBatches(result?.batches || []))
      .catch(() => setBatches([]));
  }, []);

  const loadExistingPaper = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getTeacherTestPaper(paperId);
      setPaper(result);
      setTitle(result.title);
      setStep(result.status === "finalized" ? 3 : 2);
    } catch (loadError) {
      setError(loadError.message || "Failed to load this test.");
    } finally {
      setLoading(false);
    }
  }, [paperId]);

  useEffect(() => {
    if (!isNew) {
      loadExistingPaper();
    } else {
      setLoading(false);
    }
  }, [isNew, loadExistingPaper]);

  const loadFilterOptions = async (batchId) => {
    if (!batchId) {
      setFilterOptions(null);
      return;
    }
    try {
      setFilterOptions(await getTeacherTestFilterOptions(batchId));
    } catch (loadError) {
      setError(loadError.message || "Failed to load chapters for this class.");
    }
  };

  const toggleChapter = (chapterNumber) => {
    setFilters((current) => ({
      ...current,
      chapterNumbers: current.chapterNumbers.includes(chapterNumber)
        ? current.chapterNumbers.filter((c) => c !== chapterNumber)
        : [...current.chapterNumbers, chapterNumber],
    }));
  };

  const toggleFamily = (family) => {
    setFilters((current) => ({
      ...current,
      questionFamilies: current.questionFamilies.includes(family)
        ? current.questionFamilies.filter((f) => f !== family)
        : [...current.questionFamilies, family],
    }));
  };

  const handleGenerate = async () => {
    if (!filters.batchId || !filters.chapterNumbers.length) {
      setError("Pick a class and at least one chapter.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const payload = {
        batchId: filters.batchId,
        title,
        generationMode: filters.generationMode,
        chapterNumbers: filters.chapterNumbers,
        questionFamilies: filters.questionFamilies,
      };
      if (filters.generationMode === "marks_target") {
        payload.targetTotalMarks = Number(filters.targetTotalMarks);
      } else if (filters.generationMode === "difficulty_mix") {
        payload.questionCount = Number(filters.questionCount);
        payload.difficultyDistribution = {
          easy: Number(filters.difficultyEasy),
          medium: Number(filters.difficultyMedium),
          hard: Number(filters.difficultyHard),
        };
      } else {
        payload.questionCount = Number(filters.questionCount);
      }
      const created = await createTeacherTestPaper(payload);
      setPaper(created);
      setStep(2);
      navigate(`/teacher/tests/${created.id}`, { replace: true });
    } catch (generateError) {
      setError(generateError.message || "Failed to generate paper.");
    } finally {
      setGenerating(false);
    }
  };

  const handleRemoveItem = async (itemId) => {
    try {
      setPaper(await removeTeacherTestPaperItem(paper.id, itemId));
    } catch (removeError) {
      setError(removeError.message || "Failed to remove question.");
    }
  };

  const handleSwapItem = async (itemId) => {
    try {
      setPaper(await swapTeacherTestPaperItem(paper.id, itemId));
    } catch (swapError) {
      setError(swapError.message || "Failed to swap question.");
    }
  };

  const handleAddCustomQuestion = async (event) => {
    event.preventDefault();
    setCustomSubmitting(true);
    setError("");
    try {
      await createTeacherCustomQuestion({
        batchId: filters.batchId,
        chapterNumber: filters.chapterNumbers[0],
        question: customForm.question,
        options: ["mcq", "truefalse", "assertionreason"].includes(customForm.questionFamily)
          ? customForm.options.filter((o) => o.trim())
          : [],
        correctAnswer: customForm.correctAnswer,
        questionFamily: customForm.questionFamily,
        difficulty: customForm.difficulty,
        marks: customForm.marks,
      });
      setNotice("Question added! It'll be available whenever you generate a new paper for this chapter, and joins the shared bank once approved.");
      setCustomFormOpen(false);
      setCustomForm(emptyCustomForm);
    } catch (customError) {
      setError(customError.message || "Failed to save question.");
    } finally {
      setCustomSubmitting(false);
    }
  };

  const handleFinalize = async () => {
    try {
      setPaper(await finalizeTeacherTestPaper(paper.id));
      setStep(3);
    } catch (finalizeError) {
      setError(finalizeError.message || "Failed to finalize.");
    }
  };

  const difficultyCounts = paper
    ? paper.items.reduce(
        (acc, item) => {
          const bucket = (item.difficulty || "medium").toLowerCase().includes("easy")
            ? "easy"
            : (item.difficulty || "").toLowerCase().includes("hard")
            ? "hard"
            : "medium";
          acc[bucket] += 1;
          return acc;
        },
        { easy: 0, medium: 0, hard: 0 }
      )
    : null;

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
          <button type="button" className="teacher-back-link" onClick={() => navigate("/teacher/tests")}>
            &larr; Tests
          </button>
          <h1>Create Test</h1>
        </div>
      </div>

      <div className="teacher-stepper">
        {[
          { id: 1, label: "Select" },
          { id: 2, label: "Build" },
          { id: 3, label: "Finalize" },
        ].map((s, index) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {index > 0 && <div className="teacher-stepper-divider" />}
            <div className={`teacher-stepper-step ${step === s.id ? "is-active" : step > s.id ? "is-done" : ""}`}>
              <span className="teacher-stepper-badge">{s.id}</span>
              <span>{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}
      {notice && <div className="admin-bulk-pipeline-concurrency">{notice}</div>}

      {step === 1 && (
        <div className="admin-panel">
          <div className="admin-studio-form-grid">
            <label className="admin-studio-field">
              <span>Title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="admin-studio-field">
              <span>Class</span>
              <select
                value={filters.batchId}
                onChange={(event) => {
                  const batchId = event.target.value;
                  setFilters((current) => ({ ...current, batchId, chapterNumbers: [], questionFamilies: [] }));
                  loadFilterOptions(batchId);
                }}
              >
                <option value="">Select a class...</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.className}-{batch.sectionName} &middot; {batch.subjectName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filterOptions && !filterOptions.contentConfigured && (
            <p className="error-text">This institution has no curriculum board configured yet -- ask an admin to set it.</p>
          )}

          {filterOptions?.chapters?.length > 0 && (
            <>
              <div className="admin-studio-form-grid">
                <div>
                  <span style={{ fontWeight: 700 }}>Chapters</span>
                  <div className="admin-users-scope-checklist">
                    {filterOptions.chapters.map((chapter) => (
                      <label key={chapter.chapterNumber}>
                        <input
                          type="checkbox"
                          checked={filters.chapterNumbers.includes(String(chapter.chapterNumber))}
                          onChange={() => toggleChapter(String(chapter.chapterNumber))}
                        />
                        {chapter.title}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <span style={{ fontWeight: 700 }}>Question Types</span>
                  <div className="admin-users-scope-checklist">
                    {filterOptions.questionFamilies.map((family) => (
                      <label key={family}>
                        <input type="checkbox" checked={filters.questionFamilies.includes(family)} onChange={() => toggleFamily(family)} />
                        {family}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="admin-studio-field">
                <span style={{ fontWeight: 700 }}>Paper Type</span>
                <div className="admin-users-scope-checklist">
                  {[
                    { id: "custom_mix", label: "Custom Mix" },
                    { id: "marks_target", label: "Target Total Marks" },
                    { id: "difficulty_mix", label: "Difficulty Mix" },
                  ].map((option) => (
                    <label key={option.id}>
                      <input
                        type="radio"
                        name="generationMode"
                        checked={filters.generationMode === option.id}
                        onChange={() => setFilters((current) => ({ ...current, generationMode: option.id }))}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>

              {filters.generationMode === "custom_mix" && (
                <label className="admin-studio-field">
                  <span>Number of Questions</span>
                  <input type="number" min="1" value={filters.questionCount} onChange={(e) => setFilters((c) => ({ ...c, questionCount: e.target.value }))} />
                </label>
              )}
              {filters.generationMode === "marks_target" && (
                <label className="admin-studio-field">
                  <span>Target Total Marks</span>
                  <input type="number" min="1" value={filters.targetTotalMarks} onChange={(e) => setFilters((c) => ({ ...c, targetTotalMarks: e.target.value }))} />
                </label>
              )}
              {filters.generationMode === "difficulty_mix" && (
                <div className="admin-studio-form-grid">
                  <label className="admin-studio-field">
                    <span>Number of Questions</span>
                    <input type="number" min="1" value={filters.questionCount} onChange={(e) => setFilters((c) => ({ ...c, questionCount: e.target.value }))} />
                  </label>
                  <label className="admin-studio-field">
                    <span>Easy %</span>
                    <input type="number" min="0" max="100" value={filters.difficultyEasy} onChange={(e) => setFilters((c) => ({ ...c, difficultyEasy: e.target.value }))} />
                  </label>
                  <label className="admin-studio-field">
                    <span>Medium %</span>
                    <input type="number" min="0" max="100" value={filters.difficultyMedium} onChange={(e) => setFilters((c) => ({ ...c, difficultyMedium: e.target.value }))} />
                  </label>
                  <label className="admin-studio-field">
                    <span>Hard %</span>
                    <input type="number" min="0" max="100" value={filters.difficultyHard} onChange={(e) => setFilters((c) => ({ ...c, difficultyHard: e.target.value }))} />
                  </label>
                </div>
              )}

              <div className="admin-bulk-pipeline-dialog-actions">
                <button type="button" className="primary-button" disabled={generating} onClick={handleGenerate}>
                  {generating ? "Generating..." : "Generate Paper →"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 2 && paper && (
        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2>
              Generated Paper &middot; {paper.items.length} Questions &middot; {paper.totalMarks} Marks
            </h2>
            <button type="button" className="ghost-button" onClick={() => setCustomFormOpen(true)}>
              + Add Custom Question
            </button>
          </div>

          <div className="teacher-card-list">
            {paper.items.map((item) => (
              <div key={item.id} className="teacher-question-row">
                <div className="teacher-question-row-main">
                  <span>{item.question}</span>
                  <div className="teacher-question-row-tags">
                    <span className="teacher-badge tone-draft">{item.questionFamily}</span>
                    {item.difficulty && <span className="teacher-badge tone-draft">{item.difficulty}</span>}
                    <span className="teacher-card-meta">{item.marks} marks</span>
                  </div>
                </div>
                <div className="teacher-question-row-actions">
                  <button type="button" className="ghost-button" onClick={() => handleSwapItem(item.id)}>
                    Swap
                  </button>
                  <button type="button" className="ghost-button admin-pipeline-runs-danger" onClick={() => handleRemoveItem(item.id)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="admin-bulk-pipeline-dialog-actions">
            <button type="button" className="primary-button" onClick={handleFinalize}>
              Finalize →
            </button>
          </div>
        </div>
      )}

      {step === 3 && paper && (
        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2>Final Review</h2>
          </div>
          <p className="teacher-card-meta">Questions: {paper.items.length}</p>
          <p className="teacher-card-meta">Total Marks: {paper.totalMarks}</p>

          {difficultyCounts && (
            <div style={{ display: "grid", gap: "8px" }}>
              <div className="teacher-distribution-bar">
                {["easy", "medium", "hard"].map((bucket) =>
                  difficultyCounts[bucket] ? (
                    <div
                      key={bucket}
                      style={{
                        width: `${(difficultyCounts[bucket] / paper.items.length) * 100}%`,
                        background: `var(--${DIFFICULTY_TONE[bucket]})`,
                      }}
                    />
                  ) : null
                )}
              </div>
              <div className="teacher-distribution-legend">
                {["easy", "medium", "hard"].map((bucket) => (
                  <span key={bucket}>
                    <i style={{ background: `var(--${DIFFICULTY_TONE[bucket]})` }} />
                    {bucket[0].toUpperCase() + bucket.slice(1)} {Math.round((difficultyCounts[bucket] / paper.items.length) * 100)}%
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="admin-bulk-pipeline-dialog-actions">
            <button type="button" className="ghost-button" onClick={() => downloadTeacherTestPaperPdf(paper.id, `${paper.title}.pdf`)}>
              Download PDF
            </button>
            <button type="button" className="ghost-button" onClick={() => downloadTeacherTestPaperExcel(paper.id, `${paper.title}.xlsx`)}>
              Download Excel
            </button>
            <button type="button" className="primary-button" onClick={() => navigate("/teacher/grading/new", { state: { teacherTestPaperId: paper.id, batchId: paper.batchId } })}>
              Create Gradebook
            </button>
          </div>
        </div>
      )}

      {customFormOpen && (
        <div className="modal-backdrop" onClick={() => !customSubmitting && setCustomFormOpen(false)}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close-button" onClick={() => setCustomFormOpen(false)} disabled={customSubmitting}>
              &times;
            </button>
            <h2>Add Custom Question</h2>
            <form className="admin-exam-types-form" onSubmit={handleAddCustomQuestion}>
              <label className="admin-studio-field">
                <span>Question</span>
                <textarea
                  rows={3}
                  value={customForm.question}
                  onChange={(e) => setCustomForm((c) => ({ ...c, question: e.target.value }))}
                  required
                />
              </label>
              <label className="admin-studio-field">
                <span>Question Type</span>
                <select value={customForm.questionFamily} onChange={(e) => setCustomForm((c) => ({ ...c, questionFamily: e.target.value }))}>
                  <option value="mcq">Multiple Choice</option>
                  <option value="truefalse">True/False</option>
                  <option value="assertionreason">Assertion &amp; Reason</option>
                  <option value="shortanswer">Short Answer</option>
                  <option value="fillintheblank">Fill in the Blank</option>
                </select>
              </label>
              {["mcq", "truefalse", "assertionreason"].includes(customForm.questionFamily) &&
                customForm.options.map((option, index) => (
                  <label className="admin-studio-field" key={index}>
                    <span>Option {index + 1}</span>
                    <input
                      value={option}
                      onChange={(e) =>
                        setCustomForm((c) => ({ ...c, options: c.options.map((o, i) => (i === index ? e.target.value : o)) }))
                      }
                    />
                  </label>
                ))}
              <label className="admin-studio-field">
                <span>Correct Answer</span>
                <input value={customForm.correctAnswer} onChange={(e) => setCustomForm((c) => ({ ...c, correctAnswer: e.target.value }))} required />
              </label>
              <label className="admin-studio-field">
                <span>Difficulty</span>
                <select value={customForm.difficulty} onChange={(e) => setCustomForm((c) => ({ ...c, difficulty: e.target.value }))}>
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                </select>
              </label>
              <label className="admin-studio-field">
                <span>Marks</span>
                <input type="number" min="1" value={customForm.marks} onChange={(e) => setCustomForm((c) => ({ ...c, marks: e.target.value }))} />
              </label>
              <div className="admin-bulk-pipeline-dialog-actions">
                <button type="button" className="ghost-button" onClick={() => setCustomFormOpen(false)} disabled={customSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={customSubmitting}>
                  {customSubmitting ? "Saving..." : "Save Question"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
