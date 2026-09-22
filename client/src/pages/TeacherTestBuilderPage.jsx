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
  setTeacherTestPaperAssignment,
  swapTeacherTestPaperItem,
  updateTeacherTestPaperItemMarks,
} from "../api/client";

const DIFFICULTY_TONE = { easy: "tgreen", medium: "tamber", hard: "tred" };

const emptyFilters = {
  batchId: "",
  chapterNumbers: [],
  questionFamilies: [],
  generationMode: "custom_mix",
  questionCount: "20",
  targetTotalMarks: "40",
  difficultyEasy: "30",
  difficultyMedium: "50",
  difficultyHard: "20",
  typeConfig: {},
};

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
  const [dueAtInput, setDueAtInput] = useState("");

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

  useEffect(() => {
    setDueAtInput(paper?.dueAt ? String(paper.dueAt).slice(0, 10) : "");
  }, [paper?.dueAt]);

  const handleToggleAssignment = async (isOpen) => {
    try {
      setPaper(await setTeacherTestPaperAssignment(paper.id, { isOpen, dueAt: dueAtInput || null }));
    } catch (assignError) {
      setError(assignError.message || "Failed to update assignment.");
    }
  };

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

  // Keeps one { count, marks } row per available question family -- adds
  // rows for newly available families, drops rows for families no longer
  // offered (chapter/class changed), and preserves whatever the teacher
  // already typed for families still present.
  useEffect(() => {
    const families = filterOptions?.questionFamilies || [];
    setFilters((current) => {
      const typeConfig = {};
      families.forEach((family) => {
        typeConfig[family] = current.typeConfig[family] || { count: "0", marks: "1" };
      });
      return { ...current, typeConfig };
    });
  }, [filterOptions?.questionFamilies]);

  const setTypeConfigField = (family, field, value) => {
    setFilters((current) => ({
      ...current,
      typeConfig: { ...current.typeConfig, [family]: { ...current.typeConfig[family], [field]: value } },
    }));
  };

  const typeConfigTotalMarks = Object.values(filters.typeConfig).reduce(
    (sum, cfg) => sum + (Number(cfg.count) || 0) * (Number(cfg.marks) || 0),
    0
  );

  const handleGenerate = async () => {
    if (!filters.batchId || !filters.chapterNumbers.length) {
      setError("Pick a class and at least one chapter.");
      return;
    }
    if (filters.generationMode === "type_mix") {
      const hasAnyCount = Object.values(filters.typeConfig).some((cfg) => Number(cfg.count) > 0);
      if (!hasAnyCount) {
        setError("Set a count greater than 0 for at least one question type.");
        return;
      }
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
      if (filters.generationMode === "type_mix") {
        const typeConfig = Object.fromEntries(
          Object.entries(filters.typeConfig)
            .filter(([, cfg]) => Number(cfg.count) > 0)
            .map(([family, cfg]) => [family, { count: Number(cfg.count), marks: Number(cfg.marks) || 1 }])
        );
        payload.typeConfig = typeConfig;
        payload.questionFamilies = Object.keys(typeConfig);
      } else if (filters.generationMode === "marks_target") {
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

  const handleResetFilters = () => {
    setFilters(emptyFilters);
    setFilterOptions(null);
    setTitle("Untitled Test");
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

  const handleCommitMarks = async (itemId, value) => {
    const numericMarks = Number(value);
    const currentItem = paper.items.find((item) => item.id === itemId);
    if (!Number.isFinite(numericMarks) || numericMarks <= 0 || numericMarks === currentItem?.marks) {
      return;
    }
    try {
      setPaper(await updateTeacherTestPaperItemMarks(paper.id, itemId, numericMarks));
    } catch (marksError) {
      setError(marksError.message || "Failed to update marks.");
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

  const marksMismatch =
    paper?.targetTotalMarks != null && Math.round(paper.totalMarks * 100) !== Math.round(paper.targetTotalMarks * 100);

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
        <div className="teacher-lesson-create-main">
          <div className="teacher-ai-generate-grid">
            <div className="teacher-ai-generate-panel">
              <div className="teacher-ai-panel-head">
                <span className="teacher-ai-step-badge">1</span>
                <div className="teacher-ai-panel-head-text">
                  <h2>Set Your Requirements</h2>
                  <p>Pick a class and chapters, then choose how questions should be selected.</p>
                </div>
              </div>

              <div className="admin-studio-form-grid">
                <label className="admin-studio-field">
                  <span>Title</span>
                  <input value={title} onChange={(event) => setTitle(event.target.value)} />
                </label>
                <label className="admin-studio-field">
                  <span>Class *</span>
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
                      <span style={{ fontWeight: 700 }}>Chapters *</span>
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
                    {filters.generationMode !== "type_mix" && (
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
                    )}
                  </div>

                  <div className="admin-studio-field">
                    <span style={{ fontWeight: 700 }}>Paper Type</span>
                    <div className="teacher-lesson-mode-toggle">
                      {[
                        { id: "custom_mix", label: "Custom Mix", hint: "Pick a total number of questions across all types." },
                        { id: "marks_target", label: "Target Total Marks", hint: "Fill the paper up to a marks budget." },
                        { id: "difficulty_mix", label: "Difficulty Mix", hint: "Split questions by Easy / Medium / Hard percentages." },
                        { id: "type_mix", label: "By Question Type", hint: "Set an exact count and marks for each question type." },
                      ].map((option) => (
                        <button
                          type="button"
                          key={option.id}
                          className={`teacher-lesson-mode-card ${filters.generationMode === option.id ? "is-active" : ""}`}
                          onClick={() => setFilters((current) => ({ ...current, generationMode: option.id }))}
                        >
                          <strong>{option.label}</strong>
                          <span>{option.hint}</span>
                        </button>
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
                  {filters.generationMode === "type_mix" && (
                    <div className="admin-studio-field">
                      <span style={{ fontWeight: 700 }}>Question Types &middot; Count &amp; Marks Each</span>
                      <div className="admin-studio-form-grid">
                        {filterOptions.questionFamilies.map((family) => (
                          <div key={family} style={{ display: "flex", alignItems: "flex-end", gap: "10px" }}>
                            <label className="admin-studio-field" style={{ flex: 1 }}>
                              <span>{family}</span>
                            </label>
                            <label className="admin-studio-field">
                              <span>Count</span>
                              <input
                                type="number"
                                min="0"
                                value={filters.typeConfig[family]?.count ?? "0"}
                                onChange={(e) => setTypeConfigField(family, "count", e.target.value)}
                              />
                            </label>
                            <label className="admin-studio-field">
                              <span>Marks Each</span>
                              <input
                                type="number"
                                min="0.5"
                                step="0.5"
                                value={filters.typeConfig[family]?.marks ?? "1"}
                                onChange={(e) => setTypeConfigField(family, "marks", e.target.value)}
                              />
                            </label>
                          </div>
                        ))}
                      </div>
                      <p className="teacher-card-meta">Total: {typeConfigTotalMarks} marks</p>
                    </div>
                  )}

                  {!filters.chapterNumbers.length && <p className="teacher-ai-panel-hint">Select at least one chapter to continue.</p>}

                  <div className="teacher-ai-panel-actions">
                    <button type="button" className="ghost-button" onClick={handleResetFilters}>
                      ↺ Reset
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={handleGenerate}
                      disabled={generating || !filters.chapterNumbers.length}
                    >
                      {generating ? (
                        <>
                          <span className="teacher-button-spinner" aria-hidden="true" /> Generating...
                        </>
                      ) : (
                        <>
                          ✨ Generate Paper <span className="teacher-cta-arrow">→</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}

              {!filterOptions?.chapters?.length && !filters.batchId && <p className="teacher-ai-panel-hint">Select a class to continue.</p>}
            </div>

            <div className="teacher-ai-generate-panel">
              <div className="teacher-ai-panel-head">
                <span className="teacher-ai-step-badge">2</span>
                <div className="teacher-ai-panel-head-text">
                  <h2>Test Preview</h2>
                  <p>See your paper's shape update as you choose options.</p>
                </div>
              </div>

              {generating && <p className="teacher-ai-output-empty">Generating your test…</p>}
              {!generating && (!filters.batchId || !filters.chapterNumbers.length) && (
                <p className="teacher-ai-output-empty">Pick a class and chapters on the left to preview your test.</p>
              )}
              {!generating && filters.batchId && filters.chapterNumbers.length > 0 && (
                <div style={{ display: "grid", gap: "10px" }}>
                  <p className="teacher-card-meta">
                    {filters.chapterNumbers.length} chapter{filters.chapterNumbers.length === 1 ? "" : "s"} selected
                  </p>
                  {filters.generationMode === "custom_mix" && (
                    <p className="teacher-card-meta">≈ {filters.questionCount || 0} questions (random mix)</p>
                  )}
                  {filters.generationMode === "marks_target" && (
                    <p className="teacher-card-meta">Target: {filters.targetTotalMarks || 0} marks</p>
                  )}
                  {filters.generationMode === "difficulty_mix" && (
                    <p className="teacher-card-meta">
                      ≈ {filters.questionCount || 0} questions &middot; Easy {filters.difficultyEasy}% / Medium {filters.difficultyMedium}%
                      / Hard {filters.difficultyHard}%
                    </p>
                  )}
                  {filters.generationMode === "type_mix" && (
                    <>
                      <div className="teacher-lesson-topics">
                        {Object.entries(filters.typeConfig)
                          .filter(([, cfg]) => Number(cfg.count) > 0)
                          .map(([family, cfg]) => (
                            <span key={family} className="teacher-lesson-topic-chip">
                              {family} × {cfg.count} ({cfg.marks} mk each)
                            </span>
                          ))}
                      </div>
                      <p className="teacher-card-meta">Total: {typeConfigTotalMarks} marks</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {step === 2 && paper && (
        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2>Generated Paper &middot; {paper.items.length} Questions</h2>
            <button type="button" className="ghost-button" onClick={() => setCustomFormOpen(true)}>
              + Add Custom Question
            </button>
          </div>

          <p className={marksMismatch ? "error-text" : "teacher-card-meta"}>
            Total Marks: {paper.totalMarks} / {paper.targetTotalMarks}
            {marksMismatch && " -- adjust marks below so the total matches the target before finalizing."}
          </p>

          <div className="teacher-card-list">
            {paper.items.map((item) => (
              <div key={item.id} className="teacher-question-row">
                <div className="teacher-question-row-main">
                  <span>{item.question}</span>
                  <div className="teacher-question-row-tags">
                    <span className="teacher-badge tone-draft">{item.questionFamily}</span>
                    {item.difficulty && <span className="teacher-badge tone-draft">{item.difficulty}</span>}
                    <label className="teacher-card-meta" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        key={`${item.id}-${item.marks}`}
                        defaultValue={item.marks}
                        onBlur={(e) => handleCommitMarks(item.id, e.target.value)}
                        style={{ width: "60px" }}
                      />
                      marks
                    </label>
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
            <button type="button" className="primary-button" onClick={handleFinalize} disabled={marksMismatch}>
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

      {step === 3 && paper && (
        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2>Assign to Class</h2>
          </div>
          <p className="teacher-card-meta">
            {paper.isOpenForStudents
              ? `Open -- students in this class can take it online${paper.dueAt ? ` until ${new Date(paper.dueAt).toLocaleDateString()}` : ""}.`
              : "Not yet assigned -- open it below to let students take this test digitally, with objective questions graded automatically."}
          </p>
          <label className="admin-studio-field">
            <span>Due Date (optional)</span>
            <input type="date" value={dueAtInput} onChange={(e) => setDueAtInput(e.target.value)} />
          </label>
          <div className="admin-bulk-pipeline-dialog-actions">
            {paper.isOpenForStudents ? (
              <button type="button" className="ghost-button" onClick={() => handleToggleAssignment(false)}>
                Close Test
              </button>
            ) : (
              <button type="button" className="primary-button" onClick={() => handleToggleAssignment(true)}>
                Open for Students →
              </button>
            )}
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
