import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  createTeacherMasterLessonPlan,
  downloadTeacherMasterLessonPlanPdf,
  generateTeacherMasterLessonPlan,
  getTeacherBatches,
  getTeacherLessonPlanColleagues,
  getTeacherLessonPlanFilterOptions,
  getTeacherMasterLessonPlanByChapter,
  publishTeacherMasterLessonPlan,
  shareTeacherMasterLessonPlan,
  updateTeacherMasterLessonPlan,
} from "../api/client";
import { BLOOM_LEVELS, BLOOM_LABELS } from "../constants/bloomLevels";
import { AutoSizeTextarea } from "../components/AutoSizeTextarea";

const TEACHING_AID_FIELDS = [
  { key: "boardChalk", label: "Board / Chalk / Textbook" },
  { key: "concreteObjects", label: "Concrete / Real Objects" },
  { key: "visualAids", label: "Visual Aids" },
  { key: "laboratoryAids", label: "Laboratory Aids" },
  { key: "digitalAiAids", label: "Digital / AI Aids" },
];

const emptyTeachingAids = { boardChalk: "", concreteObjects: "", visualAids: "", laboratoryAids: "", digitalAiAids: "" };
const emptyObjectives = {};

const emptyForm = {
  classTransactionTime: 10,
  previousKnowledge: "",
  teachingAids: emptyTeachingAids,
  objectives: emptyObjectives,
  skillsCompetencies: [],
  transactionMethodology: "",
  interDisciplinaryLinkage: [],
  assessmentQuestions: [],
  extraQuestions: [],
  subjectTeacherName: "",
  hodName: "",
  principalName: "",
};

export const TeacherMasterLessonPlanPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [batches, setBatches] = useState([]);
  // Arriving from the lessons inventory passes the batch+chapter of an
  // already-saved master plan so it opens pre-selected instead of blank.
  const [batchId, setBatchId] = useState(location.state?.batchId || "");
  const [filterOptions, setFilterOptions] = useState({ chapters: [], contentConfigured: false });
  const [chapterNumber, setChapterNumber] = useState("");
  const [pendingChapterNumber, setPendingChapterNumber] = useState(location.state?.chapterNumber || "");

  const [existingPlanId, setExistingPlanId] = useState(null);
  const [mstChapterId, setMstChapterId] = useState(null);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [planStatus, setPlanStatus] = useState("draft");
  const [form, setForm] = useState(emptyForm);
  // Snapshot of the last-saved values -- Cancel restores this instead of
  // re-fetching, so an aborted edit never loses the in-memory draft state.
  const [savedForm, setSavedForm] = useState(emptyForm);
  // A saved plan opens read-only -- editing it is an explicit action (the
  // Edit CTA below), not the default, since accidentally typing into a
  // shared/published chapter plan is easy to do by mistake otherwise.
  const [isEditing, setIsEditing] = useState(true);

  const [lookingUp, setLookingUp] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [shareOpen, setShareOpen] = useState(false);
  const [colleagues, setColleagues] = useState([]);
  const [selectedColleagueIds, setSelectedColleagueIds] = useState([]);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    getTeacherBatches().then((result) => setBatches(result?.batches || []));
  }, []);

  useEffect(() => {
    if (!batchId) {
      setFilterOptions({ chapters: [], contentConfigured: false });
      return;
    }
    getTeacherLessonPlanFilterOptions(batchId).then((result) => {
      const options = result || { chapters: [], contentConfigured: false };
      setFilterOptions(options);
      const matchesPending = options.chapters?.some((chapter) => String(chapter.chapterNumber) === String(pendingChapterNumber));
      setChapterNumber(matchesPending ? pendingChapterNumber : "");
      setPendingChapterNumber("");
    });
  }, [batchId]);

  useEffect(() => {
    setExistingPlanId(null);
    setMstChapterId(null);
    setAiGenerated(false);
    setPlanStatus("draft");
    setForm(emptyForm);
    setSavedForm(emptyForm);
    setIsEditing(true);
    setError("");
    setNotice("");
    if (!batchId || !chapterNumber) return;

    setLookingUp(true);
    getTeacherMasterLessonPlanByChapter(batchId, chapterNumber)
      .then((result) => {
        const plan = result?.plan;
        if (!plan) return;
        setExistingPlanId(plan.id);
        setMstChapterId(plan.mstChapterId);
        setAiGenerated(Boolean(plan.aiGenerated));
        setPlanStatus(plan.status || "draft");
        setIsEditing(false);
        const loadedForm = {
          classTransactionTime: plan.classTransactionTime || 10,
          previousKnowledge: plan.previousKnowledge || "",
          teachingAids: { ...emptyTeachingAids, ...(plan.teachingAids || {}) },
          objectives: { ...(plan.objectives || {}) },
          skillsCompetencies: plan.skillsCompetencies || [],
          transactionMethodology: plan.transactionMethodology || "",
          interDisciplinaryLinkage: plan.interDisciplinaryLinkage || [],
          assessmentQuestions: plan.assessmentQuestions || [],
          extraQuestions: plan.extraQuestions || [],
          subjectTeacherName: plan.subjectTeacherName || "",
          hodName: plan.hodName || "",
          principalName: plan.principalName || "",
        };
        setForm(loadedForm);
        setSavedForm(loadedForm);
      })
      .finally(() => setLookingUp(false));
  }, [batchId, chapterNumber]);

  const selectedChapter = useMemo(
    () => filterOptions.chapters?.find((chapter) => String(chapter.chapterNumber) === String(chapterNumber)),
    [filterOptions.chapters, chapterNumber]
  );

  const handleGenerate = async () => {
    if (!batchId || !chapterNumber) return;
    setGenerating(true);
    setError("");
    try {
      const result = await generateTeacherMasterLessonPlan({
        batchId,
        chapterNumber,
        classTransactionTime: form.classTransactionTime,
      });
      setMstChapterId(result.mstChapterId);
      setAiGenerated(true);
      setForm({
        classTransactionTime: result.classTransactionTime,
        previousKnowledge: result.previousKnowledge || "",
        teachingAids: { ...emptyTeachingAids, ...(result.teachingAids || {}) },
        objectives: { ...(result.objectives || {}) },
        skillsCompetencies: result.skillsCompetencies || [],
        transactionMethodology: result.transactionMethodology || "",
        interDisciplinaryLinkage: result.interDisciplinaryLinkage || [],
        assessmentQuestions: result.assessmentQuestions || [],
        extraQuestions: result.extraQuestions || [],
        subjectTeacherName: form.subjectTeacherName,
        hodName: form.hodName,
        principalName: form.principalName,
      });
      setNotice("Draft generated -- review and edit below, then Save.");
    } catch (generateError) {
      setError(generateError.message || "Failed to generate the master lesson plan.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    const payload = { ...form, chapterLabel: selectedChapter?.title || "Untitled Chapter" };
    try {
      if (existingPlanId) {
        await updateTeacherMasterLessonPlan(existingPlanId, payload);
      } else {
        const result = await createTeacherMasterLessonPlan({
          batchId,
          chapterNumber,
          mstChapterId,
          aiGenerated,
          ...payload,
        });
        setExistingPlanId(result.plan.id);
      }
      setSavedForm(form);
      setIsEditing(false);
      setNotice("Master lesson plan saved.");
    } catch (saveError) {
      setError(saveError.message || "Failed to save the master lesson plan.");
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = () => {
    setIsEditing(true);
    setNotice("");
  };

  const handleCancel = () => {
    setForm(savedForm);
    setIsEditing(false);
    setError("");
    setNotice("");
  };

  const handlePublish = async () => {
    if (!existingPlanId) return;
    setPublishing(true);
    setError("");
    try {
      await publishTeacherMasterLessonPlan(existingPlanId);
      setPlanStatus("published");
      setNotice("Master lesson plan published.");
    } catch (publishError) {
      setError(publishError.message || "Failed to publish the master lesson plan.");
    } finally {
      setPublishing(false);
    }
  };

  const openShareModal = async () => {
    setShareOpen(true);
    setSelectedColleagueIds([]);
    try {
      const result = await getTeacherLessonPlanColleagues();
      setColleagues(result?.colleagues || []);
    } catch {
      setColleagues([]);
    }
  };

  const handleShare = async () => {
    if (!existingPlanId || selectedColleagueIds.length === 0) return;
    setSharing(true);
    try {
      await shareTeacherMasterLessonPlan(existingPlanId, selectedColleagueIds);
      setShareOpen(false);
      setNotice("Master lesson plan shared with the selected teachers.");
    } catch (shareError) {
      setError(shareError.message || "Failed to share the master lesson plan.");
    } finally {
      setSharing(false);
    }
  };

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const updateTeachingAid = (key, value) => setForm((prev) => ({ ...prev, teachingAids: { ...prev.teachingAids, [key]: value } }));
  const updateObjective = (stage, value) => setForm((prev) => ({ ...prev, objectives: { ...prev.objectives, [stage]: value } }));

  const addListItem = (key, item) => setForm((prev) => ({ ...prev, [key]: [...prev[key], item] }));
  const removeListItem = (key, index) => setForm((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));
  const updateListItem = (key, index, field, value) =>
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].map((item, i) => (i === index ? (field ? { ...item, [field]: value } : value) : item)),
    }));

  return (
    <div className="teacher-page teacher-master-lesson-plan-page">
      <div className="teacher-page-header">
        <div>
          <button type="button" className="teacher-back-link" onClick={() => navigate("/teacher/lessons")}>
            &larr; Lessons
          </button>
          <span className="eyebrow">Teacher module</span>
          <h1>Master Lesson Plan</h1>
          <p>Build the chapter-level plan -- Previous Knowledge, Teaching Aids, Objectives, Skills, Methodology and Assessment Questions for the whole chapter.</p>
        </div>
        {existingPlanId && (
          <div>
            <span className={`teacher-badge tone-${planStatus}`}>{planStatus}</span>
            {!isEditing && (
              <button type="button" className="ghost-button" onClick={handleEditClick}>
                ✏️ Edit
              </button>
            )}
            {planStatus === "draft" && (
              <button type="button" className="ghost-button" onClick={handlePublish} disabled={publishing}>
                {publishing ? "Publishing..." : "Publish"}
              </button>
            )}
            <button
              type="button"
              className="ghost-button"
              onClick={() => downloadTeacherMasterLessonPlanPdf(existingPlanId, `${selectedChapter?.title || "master-lesson-plan"}.pdf`)}
            >
              Download PDF
            </button>
            <button type="button" className="ghost-button" onClick={openShareModal}>
              Share
            </button>
          </div>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}
      {notice && <div className="admin-bulk-pipeline-concurrency">{notice}</div>}

      <div className="teacher-lesson-create-main">
        <div className="teacher-ai-generate-grid">
          <div className="teacher-ai-generate-panel">
            <div className="teacher-ai-panel-head">
              <span className="teacher-ai-step-badge">1</span>
              <div className="teacher-ai-panel-head-text">
                <h2>Chapter Details</h2>
                <p>Select the class and chapter, then generate the whole master plan with AI or fill it in yourself.</p>
              </div>
            </div>

            <div className="admin-studio-form-grid">
              <label className="admin-studio-field">
                <span>Class *</span>
                <select value={batchId} onChange={(e) => setBatchId(e.target.value)} required disabled={Boolean(existingPlanId)}>
                  <option value="">Select a class...</option>
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.className}-{batch.sectionName} &middot; {batch.subjectName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-studio-field">
                <span>Board</span>
                <input value={filterOptions.board || ""} disabled />
              </label>
              <label className="admin-studio-field">
                <span>Subject</span>
                <input value={filterOptions.subjectName || ""} disabled />
              </label>
            </div>

            <label className="admin-studio-field">
              <span>Chapter *</span>
              <select
                value={chapterNumber}
                onChange={(e) => setChapterNumber(e.target.value)}
                disabled={!filterOptions.contentConfigured || Boolean(existingPlanId)}
              >
                <option value="">Select a chapter...</option>
                {(filterOptions.chapters || []).map((chapter) => (
                  <option key={chapter.chapterNumber} value={chapter.chapterNumber}>
                    {chapter.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="admin-studio-field">
              <span>Class Transaction Time (number of classes)</span>
              <input
                type="number"
                min="1"
                max="60"
                value={form.classTransactionTime}
                onChange={(e) => updateField("classTransactionTime", Number(e.target.value))}
                disabled={Boolean(existingPlanId)}
              />
            </label>

            {lookingUp && <p>Checking for an existing master lesson plan...</p>}

            {!lookingUp && (!batchId || !chapterNumber) && <p className="teacher-ai-panel-hint">{!batchId ? "Select a class to continue." : "Select a chapter to continue."}</p>}

            {!lookingUp && batchId && chapterNumber && !existingPlanId && (
              <div className="teacher-ai-panel-actions">
                <button type="button" className="primary-button" onClick={handleGenerate} disabled={generating}>
                  {generating ? (
                    <>
                      <span className="teacher-button-spinner" aria-hidden="true" /> Generating...
                    </>
                  ) : (
                    <>
                      ✨ Generate with AI <span className="teacher-cta-arrow">→</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {!lookingUp && batchId && chapterNumber && (
              <>
                <h3>Previous Knowledge</h3>
                <label className="admin-studio-field">
                  <AutoSizeTextarea
                    rows={5}
                    value={form.previousKnowledge}
                    onChange={(e) => updateField("previousKnowledge", e.target.value)}
                    placeholder="Prerequisite knowledge students already have before this chapter..."
                    disabled={!isEditing}
                  />
                </label>

                <h3>Teaching Aids</h3>
                <div className="teacher-lesson-bloom-fields">
                  {TEACHING_AID_FIELDS.map((field) => (
                    <label key={field.key} className="admin-studio-field teacher-lesson-bloom-field">
                      <span>{field.label}</span>
                      <AutoSizeTextarea
                        rows={3}
                        value={form.teachingAids[field.key] || ""}
                        onChange={(e) => updateTeachingAid(field.key, e.target.value)}
                        disabled={!isEditing}
                      />
                    </label>
                  ))}
                </div>

                <h3>Objectives (by Bloom's Level)</h3>
                <div className="teacher-lesson-bloom-fields">
                  {BLOOM_LEVELS.map((stage) => (
                    <label key={stage} className="admin-studio-field teacher-lesson-bloom-field">
                      <span>{BLOOM_LABELS[stage]}</span>
                      <AutoSizeTextarea
                        rows={3}
                        value={form.objectives[stage] || ""}
                        onChange={(e) => updateObjective(stage, e.target.value)}
                        disabled={!isEditing}
                      />
                    </label>
                  ))}
                </div>

                <div className="admin-panel-head">
                  <h3>Skills and Competencies</h3>
                  {isEditing && (
                    <button
                      type="button"
                      className="ghost-button"
                      aria-label="Add Skill"
                      onClick={() => addListItem("skillsCompetencies", { title: "", description: "" })}
                    >
                      + <span className="teacher-master-plan-btn-label">Add Skill</span>
                    </button>
                  )}
                </div>
                {form.skillsCompetencies.map((skill, index) => (
                  <div key={index} className="teacher-lesson-row-grid teacher-lesson-row-grid-2 teacher-master-plan-list-row">
                    <label className="admin-studio-field">
                      <span>Title</span>
                      <input
                        value={skill.title}
                        onChange={(e) => updateListItem("skillsCompetencies", index, "title", e.target.value)}
                        disabled={!isEditing}
                      />
                    </label>
                    <label className="admin-studio-field">
                      <span>Description</span>
                      <AutoSizeTextarea
                        rows={2}
                        value={skill.description}
                        onChange={(e) => updateListItem("skillsCompetencies", index, "description", e.target.value)}
                        disabled={!isEditing}
                      />
                    </label>
                    {isEditing && (
                      <button
                        type="button"
                        className="ghost-button admin-pipeline-runs-danger"
                        aria-label="Remove"
                        onClick={() => removeListItem("skillsCompetencies", index)}
                      >
                        🗑 <span className="teacher-master-plan-btn-label">Remove</span>
                      </button>
                    )}
                  </div>
                ))}

                <h3>Transaction Methodology</h3>
                <label className="admin-studio-field">
                  <AutoSizeTextarea
                    rows={5}
                    value={form.transactionMethodology}
                    onChange={(e) => updateField("transactionMethodology", e.target.value)}
                    placeholder="How the whole chapter will be taught..."
                    disabled={!isEditing}
                  />
                </label>

                <div className="admin-panel-head">
                  <h3>Inter-Disciplinary Linkage</h3>
                  {isEditing && (
                    <button
                      type="button"
                      className="ghost-button"
                      aria-label="Add Linkage"
                      onClick={() => addListItem("interDisciplinaryLinkage", { subjectPair: "", description: "" })}
                    >
                      + <span className="teacher-master-plan-btn-label">Add Linkage</span>
                    </button>
                  )}
                </div>
                {form.interDisciplinaryLinkage.map((link, index) => (
                  <div key={index} className="teacher-lesson-row-grid teacher-lesson-row-grid-2 teacher-master-plan-list-row">
                    <label className="admin-studio-field">
                      <span>Subject Pair</span>
                      <input
                        value={link.subjectPair}
                        placeholder="e.g. Science and Mathematics"
                        onChange={(e) => updateListItem("interDisciplinaryLinkage", index, "subjectPair", e.target.value)}
                        disabled={!isEditing}
                      />
                    </label>
                    <label className="admin-studio-field">
                      <span>Description</span>
                      <AutoSizeTextarea
                        rows={2}
                        value={link.description}
                        onChange={(e) => updateListItem("interDisciplinaryLinkage", index, "description", e.target.value)}
                        disabled={!isEditing}
                      />
                    </label>
                    {isEditing && (
                      <button
                        type="button"
                        className="ghost-button admin-pipeline-runs-danger"
                        aria-label="Remove"
                        onClick={() => removeListItem("interDisciplinaryLinkage", index)}
                      >
                        🗑 <span className="teacher-master-plan-btn-label">Remove</span>
                      </button>
                    )}
                  </div>
                ))}

                <div className="admin-panel-head">
                  <h3>Assessment Questions</h3>
                  {isEditing && (
                    <button type="button" className="ghost-button" aria-label="Add Question" onClick={() => addListItem("assessmentQuestions", "")}>
                      + <span className="teacher-master-plan-btn-label">Add Question</span>
                    </button>
                  )}
                </div>
                {form.assessmentQuestions.map((question, index) => (
                  <div key={index} className="teacher-master-plan-list-row teacher-master-plan-question-row">
                    <label className="admin-studio-field">
                      <AutoSizeTextarea
                        rows={1}
                        value={question}
                        onChange={(e) => updateListItem("assessmentQuestions", index, null, e.target.value)}
                        disabled={!isEditing}
                      />
                    </label>
                    {isEditing && (
                      <button
                        type="button"
                        className="ghost-button admin-pipeline-runs-danger"
                        aria-label="Remove"
                        onClick={() => removeListItem("assessmentQuestions", index)}
                      >
                        🗑 <span className="teacher-master-plan-btn-label">Remove</span>
                      </button>
                    )}
                  </div>
                ))}

                <div className="admin-panel-head">
                  <h3>Extra Questions (Other Than Textual)</h3>
                  {isEditing && (
                    <button type="button" className="ghost-button" aria-label="Add Question" onClick={() => addListItem("extraQuestions", "")}>
                      + <span className="teacher-master-plan-btn-label">Add Question</span>
                    </button>
                  )}
                </div>
                {form.extraQuestions.map((question, index) => (
                  <div key={index} className="teacher-master-plan-list-row teacher-master-plan-question-row">
                    <label className="admin-studio-field">
                      <AutoSizeTextarea
                        rows={1}
                        value={question}
                        onChange={(e) => updateListItem("extraQuestions", index, null, e.target.value)}
                        disabled={!isEditing}
                      />
                    </label>
                    {isEditing && (
                      <button
                        type="button"
                        className="ghost-button admin-pipeline-runs-danger"
                        aria-label="Remove"
                        onClick={() => removeListItem("extraQuestions", index)}
                      >
                        🗑 <span className="teacher-master-plan-btn-label">Remove</span>
                      </button>
                    )}
                  </div>
                ))}

                <h3>Sign-off</h3>
                <div className="teacher-lesson-row-grid teacher-lesson-row-grid-3">
                  <label className="admin-studio-field">
                    <span>Subject Teacher (Name)</span>
                    <input value={form.subjectTeacherName} onChange={(e) => updateField("subjectTeacherName", e.target.value)} disabled={!isEditing} />
                  </label>
                  <label className="admin-studio-field">
                    <span>H.O.D.</span>
                    <input value={form.hodName} onChange={(e) => updateField("hodName", e.target.value)} disabled={!isEditing} />
                  </label>
                  <label className="admin-studio-field">
                    <span>Principal</span>
                    <input value={form.principalName} onChange={(e) => updateField("principalName", e.target.value)} disabled={!isEditing} />
                  </label>
                </div>

                <div className="teacher-ai-panel-actions">
                  {existingPlanId && isEditing && (
                    <button type="button" className="ghost-button" onClick={handleCancel} disabled={saving}>
                      Cancel
                    </button>
                  )}
                  <button type="button" className="primary-button" onClick={handleSave} disabled={saving || !isEditing}>
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {shareOpen && (
        <div className="modal-backdrop" onClick={() => !sharing && setShareOpen(false)}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close-button" onClick={() => setShareOpen(false)} disabled={sharing}>
              &times;
            </button>
            <h2>Share with Teachers</h2>
            {colleagues.length === 0 ? (
              <p>No colleagues found at your institution yet.</p>
            ) : (
              <ul className="teacher-colleague-picker-list">
                {colleagues.map((colleague) => (
                  <li key={colleague.userId} className="teacher-colleague-picker-item">
                    <input
                      type="checkbox"
                      id={`master-colleague-${colleague.userId}`}
                      checked={selectedColleagueIds.includes(colleague.userId)}
                      onChange={(e) =>
                        setSelectedColleagueIds((prev) =>
                          e.target.checked ? [...prev, colleague.userId] : prev.filter((id) => id !== colleague.userId)
                        )
                      }
                    />
                    <label htmlFor={`master-colleague-${colleague.userId}`}>
                      {colleague.name} <span className="teacher-card-meta">({colleague.email})</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <div className="admin-bulk-pipeline-dialog-actions">
              <button type="button" className="ghost-button" onClick={() => setShareOpen(false)} disabled={sharing}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={handleShare} disabled={sharing || selectedColleagueIds.length === 0}>
                {sharing ? "Sharing..." : "Share"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
