import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  addTeacherLessonPlanEntriesBulk,
  createTeacherLessonPlan,
  downloadTeacherLessonPlanExcel,
  downloadTeacherLessonPlanPdf,
  generateTeacherLessonPlan,
  getTeacherBatches,
  getTeacherLessonPlanColleagues,
  getTeacherLessonPlanFilterOptions,
  getTeacherMasterLessonPlanByChapter,
  shareTeacherLessonPlan,
} from "../api/client";
import { BLOOM_LEVELS, BLOOM_LABELS } from "../constants/bloomLevels";
import { TeacherLessonPlanAssistantPanel } from "../components/TeacherLessonPlanAssistantPanel";
import { MobileAssistantOverlay } from "../components/MobileAssistantOverlay";
import { AutoSizeTextarea } from "../components/AutoSizeTextarea";
import { getSubjectActivityExample } from "../utils/subjectExamples";

const emptyDay = {
  entryDate: "",
  chapterLabel: "",
  topic: "",
  preConcept: "",
  subtopic: "",
  teachingApproach: "",
  teachingMethod: {},
  learningAid: "",
  learningOutcome: "",
  activities: "",
};

const STEPS = ["Set Context", "AI Generation", "Review & Edit", "Save & Use"];

const TONE_OPTIONS = [
  { key: "standard", label: "Standard (Balanced)" },
  { key: "activityRich", label: "Activity Rich" },
  { key: "conceptFocused", label: "Concept Focused" },
  { key: "examOriented", label: "Exam Oriented" },
];

const INCLUDE_OPTIONS = [
  { key: "learningOutcomes", label: "Learning Outcomes" },
  { key: "teachingMethods", label: "Teaching Methods" },
  { key: "learningAids", label: "Learning Aids / Resources" },
];

const OUTPUT_TABS = [
  { key: "table", label: "Table View", icon: "▦" },
  { key: "structured", label: "Structured View", icon: "☰" },
  { key: "notes", label: "Teaching Notes", icon: "📝" },
  { key: "resources", label: "Resources", icon: "📎" },
];

const DEFAULT_BLOOM_FOCUS = { remember: true, understand: true, apply: true, analyse: true, evaluate: true, create: false };
const DEFAULT_INCLUDE_FLAGS = { learningOutcomes: true, teachingMethods: true, learningAids: true };

const BloomMethodOutput = ({ teachingMethod }) => (
  <div className="teacher-lesson-bloom-output">
    {BLOOM_LEVELS.filter((stage) => teachingMethod?.[stage]).map((stage) => (
      <div key={stage} className="teacher-lesson-bloom-output-item">
        <b>{BLOOM_LABELS[stage]}</b>
        <p>{teachingMethod[stage]}</p>
      </div>
    ))}
  </div>
);

const LessonPlanTable = ({ days, savedPlan, onEdit, onDuplicate, onDelete }) => (
  <div className="teacher-lesson-plan-table-wrap">
    <table className="teacher-lesson-plan-table">
      <thead>
        <tr>
          <th>Day</th>
          <th>Date</th>
          <th>Chapter</th>
          <th>Topic</th>
          <th>Pre Concept</th>
          <th>Subtopic</th>
          <th>Teaching Approach</th>
          <th>Teaching Method</th>
          <th>Learning Aid</th>
          <th>Learning Outcome</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {days.map((day, index) => (
          <tr key={index}>
            <td>{index + 1}</td>
            <td>{day.entryDate || "-"}</td>
            <td>{day.chapterLabel || "-"}</td>
            <td>{day.topic}</td>
            <td>{day.preConcept || "-"}</td>
            <td>{day.subtopic || "-"}</td>
            <td>{day.teachingApproach || "-"}</td>
            <td>
              <BloomMethodOutput teachingMethod={day.teachingMethod} />
            </td>
            <td>{day.learningAid || "-"}</td>
            <td>{day.learningOutcome || "-"}</td>
            <td>
              <div className="teacher-lesson-plan-table-actions">
                <button type="button" className="ghost-button" onClick={() => onEdit(index)} disabled={Boolean(savedPlan)}>
                  Edit
                </button>
                <button type="button" className="ghost-button" onClick={() => onDuplicate(index)} disabled={Boolean(savedPlan)}>
                  Duplicate
                </button>
                <button type="button" className="ghost-button admin-pipeline-runs-danger" onClick={() => onDelete(index)} disabled={Boolean(savedPlan)}>
                  Delete
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const StructuredView = ({ days }) => (
  <div className="teacher-card-list">
    {days.map((day, index) => (
      <div key={index} className="admin-panel">
        <h3>
          Day {index + 1}
          {day.entryDate ? ` -- ${day.entryDate}` : ""}: {day.topic}
        </h3>
        <div className="teacher-lesson-grid">
          <div className="teacher-lesson-field">
            <span>Pre Concept</span>
            <p>{day.preConcept || "-"}</p>
          </div>
          <div className="teacher-lesson-field">
            <span>Subtopic</span>
            <p>{day.subtopic || "-"}</p>
          </div>
          <div className="teacher-lesson-field">
            <span>Teaching Approach</span>
            <p>{day.teachingApproach || "-"}</p>
          </div>
          <div className="teacher-lesson-field">
            <span>Learning Aid</span>
            <p>{day.learningAid || "-"}</p>
          </div>
        </div>
        {BLOOM_LEVELS.some((stage) => day.teachingMethod?.[stage]) && (
          <div className="teacher-lesson-field">
            <span>Teaching Method (by Bloom's Level)</span>
            <BloomMethodOutput teachingMethod={day.teachingMethod} />
          </div>
        )}
        <div className="teacher-lesson-field">
          <span>Learning Outcome</span>
          <p>{day.learningOutcome || "-"}</p>
        </div>
        <div className="teacher-lesson-field">
          <span>Activities</span>
          <p style={{ whiteSpace: "pre-wrap" }}>{day.activities || "-"}</p>
        </div>
      </div>
    ))}
  </div>
);

const TeachingNotesView = ({ days }) => (
  <div className="teacher-lesson-notes-list">
    {days.map((day, index) => (
      <div key={index} className="teacher-lesson-notes-entry">
        <h4>
          Day {index + 1}: {day.topic}
        </h4>
        <p>
          {day.preConcept ? `Building on what students already know -- ${day.preConcept}. ` : ""}
          {day.teachingApproach || ""}
        </p>
        {day.learningOutcome && (
          <p>
            <b>By the end of this lesson, students will:</b> {day.learningOutcome}
          </p>
        )}
      </div>
    ))}
  </div>
);

const ResourcesPlaceholder = ({ onComingSoon }) => (
  <div className="teacher-lesson-resources-section">
    <div className="teacher-lesson-resources-grid">
      <div>
        <h4>Add Resources (Images / Files / Links)</h4>
        <div className="teacher-lesson-dropzone" role="button" tabIndex={0} onClick={onComingSoon} onKeyDown={(e) => e.key === "Enter" && onComingSoon()}>
          <span className="teacher-lesson-dropzone-icon" aria-hidden="true">
            ⬆
          </span>
          <strong>Drag &amp; drop files here</strong>
          <span>or click to upload</span>
        </div>
        <p className="teacher-lesson-resources-caption">Supports images, PDFs, videos (Max 10MB each)</p>
      </div>
      <div>
        <h4>Or add from library</h4>
        <div className="teacher-lesson-resources-library">
          <button type="button" className="ghost-button" onClick={onComingSoon}>
            📖 Browse Content Library
          </button>
          <button type="button" className="ghost-button" onClick={onComingSoon}>
            📁 Add from My Resources
          </button>
          <button type="button" className="ghost-button" onClick={onComingSoon}>
            🌐 Search on Web
          </button>
        </div>
      </div>
    </div>
  </div>
);

export const TeacherLessonPlanCreatePage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [batches, setBatches] = useState([]);
  const [batchId, setBatchId] = useState("");
  const [filterOptions, setFilterOptions] = useState({ chapters: [], contentConfigured: false });
  const [chapterNumber, setChapterNumber] = useState("");

  // The dashboard's "Create with AI" / "Create Manually" quick actions both
  // land here, just with a different starting mode passed via navigation
  // state -- same page and flow either way, just pre-selected.
  const [mode, setMode] = useState(location.state?.mode === "manual" ? "manual" : "ai");
  const [topics, setTopics] = useState([]);
  const [topicInputOpen, setTopicInputOpen] = useState(false);
  const [topicInput, setTopicInput] = useState("");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [dayCount, setDayCount] = useState(6);
  const [bloomFocus, setBloomFocus] = useState(DEFAULT_BLOOM_FOCUS);
  const [includeFlags, setIncludeFlags] = useState(DEFAULT_INCLUDE_FLAGS);
  const [tone, setTone] = useState("standard");
  const [generating, setGenerating] = useState(false);
  const [generationSeconds, setGenerationSeconds] = useState(null);
  const [refineOpen, setRefineOpen] = useState(false);
  const [outputTab, setOutputTab] = useState("table");
  const [error, setError] = useState("");

  const [mstChapterId, setMstChapterId] = useState(null);
  const [days, setDays] = useState([]);
  const [title, setTitle] = useState("");

  const [dayFormOpen, setDayFormOpen] = useState(false);
  const [editingDayIndex, setEditingDayIndex] = useState(null);
  const [dayForm, setDayForm] = useState(emptyDay);

  const [saving, setSaving] = useState(false);
  const [savedPlan, setSavedPlan] = useState(null);

  const [shareOpen, setShareOpen] = useState(false);
  const [colleagues, setColleagues] = useState([]);
  const [selectedColleagueIds, setSelectedColleagueIds] = useState([]);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState("");

  // A Daily Lesson Plan is meant to flow from its chapter's Master Lesson
  // Plan (its Assessment/Extra Questions feed the daily Bloom's-level
  // target questions) -- so neither AI generation nor manual day-building
  // is allowed to start until one exists for the selected chapter.
  const [masterPlanExists, setMasterPlanExists] = useState(null); // null = not checked yet
  const [checkingMasterPlan, setCheckingMasterPlan] = useState(false);

  useEffect(() => {
    getTeacherBatches().then((result) => setBatches(result?.batches || []));
  }, []);

  useEffect(() => {
    if (!batchId) {
      setFilterOptions({ chapters: [], contentConfigured: false });
      return;
    }
    getTeacherLessonPlanFilterOptions(batchId).then((result) => setFilterOptions(result || { chapters: [], contentConfigured: false }));
    setChapterNumber("");
  }, [batchId]);

  useEffect(() => {
    if (!batchId || !chapterNumber) {
      setMasterPlanExists(null);
      return;
    }
    setCheckingMasterPlan(true);
    setMasterPlanExists(null);
    getTeacherMasterLessonPlanByChapter(batchId, chapterNumber)
      .then((result) => setMasterPlanExists(Boolean(result?.plan)))
      .catch(() => setMasterPlanExists(null))
      .finally(() => setCheckingMasterPlan(false));
  }, [batchId, chapterNumber]);

  const selectedChapter = useMemo(
    () => filterOptions.chapters?.find((chapter) => String(chapter.chapterNumber) === String(chapterNumber)),
    [filterOptions.chapters, chapterNumber]
  );

  const selectedBatch = useMemo(() => batches.find((batch) => String(batch.id) === String(batchId)), [batches, batchId]);

  const planContextSummary = useMemo(
    () => (days.length ? `Days planned so far: ${days.map((day) => day.topic).join("; ")}` : ""),
    [days]
  );

  const assistantDays = useMemo(() => days.map((day, index) => ({ dayNumber: index + 1, topic: day.topic })), [days]);

  const handleAcceptToDay = async (dayNumber, text) => {
    setDays((prev) =>
      prev.map((day, index) =>
        index === dayNumber - 1 ? { ...day, activities: day.activities ? `${day.activities}\n\n${text}` : text } : day
      )
    );
    return true;
  };

  const phase = savedPlan ? 4 : days.length > 0 ? 3 : generating ? 2 : 1;

  const handleGenerate = async () => {
    if (!batchId || !chapterNumber) return;
    setGenerating(true);
    setError("");
    const startedAt = Date.now();
    try {
      const result = await generateTeacherLessonPlan({
        batchId,
        chapterNumber,
        additionalInstructions: additionalInstructions.trim() || undefined,
        dayCount,
        topics,
        bloomFocus: BLOOM_LEVELS.filter((stage) => bloomFocus[stage]),
        includeSections: INCLUDE_OPTIONS.filter((option) => includeFlags[option.key]).map((option) => option.label),
        tone,
      });
      setMstChapterId(result.mstChapterId);
      setDays(result.days);
      setTitle(`${result.chapterTitle} Daily Lesson Plan`);
      setSavedPlan(null);
      setGenerationSeconds(Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
      setOutputTab("table");
      setRefineOpen(false);
    } catch (generateError) {
      setError(generateError.message || "Failed to generate the lesson plan.");
    } finally {
      setGenerating(false);
    }
  };

  const handleReset = () => {
    setTopics([]);
    setTopicInput("");
    setAdditionalInstructions("");
    setDayCount(6);
    setBloomFocus(DEFAULT_BLOOM_FOCUS);
    setIncludeFlags(DEFAULT_INCLUDE_FLAGS);
    setTone("standard");
    setDays([]);
    setTitle("");
    setSavedPlan(null);
    setGenerationSeconds(null);
    setRefineOpen(false);
    setError("");
  };

  const addTopic = () => {
    const trimmed = topicInput.trim();
    if (trimmed) setTopics((prev) => [...prev, trimmed]);
    setTopicInput("");
    setTopicInputOpen(false);
  };

  const openAddDay = () => {
    setEditingDayIndex(null);
    setDayForm({ ...emptyDay, chapterLabel: selectedChapter?.title || "" });
    setDayFormOpen(true);
  };

  const openEditDay = (index) => {
    setEditingDayIndex(index);
    setDayForm({ ...emptyDay, ...days[index], teachingMethod: { ...days[index].teachingMethod } });
    setDayFormOpen(true);
  };

  const commitDay = () => {
    if (!dayForm.topic.trim()) return false;
    if (editingDayIndex === null) {
      setDays((prev) => [...prev, dayForm]);
      if (!title) setTitle(`${dayForm.chapterLabel || "Lesson"} Daily Lesson Plan`);
    } else {
      setDays((prev) => prev.map((day, index) => (index === editingDayIndex ? dayForm : day)));
    }
    return true;
  };

  const handleSaveDay = (event) => {
    event.preventDefault();
    if (!commitDay()) return;
    setDayFormOpen(false);
  };

  const handleSaveDayAndAddAnother = (event) => {
    event.preventDefault();
    if (!commitDay()) return;
    setEditingDayIndex(null);
    setDayForm({ ...emptyDay, chapterLabel: selectedChapter?.title || "" });
  };

  const handleDeleteDay = (index) => {
    setDays((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDuplicateDay = (index) => {
    setDays((prev) => {
      const copy = { ...prev[index], topic: `${prev[index].topic} (Copy)` };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  };

  const handleSavePlan = async () => {
    if (!batchId || !title.trim() || days.length === 0 || savedPlan) return;
    setSaving(true);
    setError("");
    try {
      const { plan } = await createTeacherLessonPlan({ batchId, title: title.trim(), mstChapterId, aiGenerated: mode === "ai" });
      await addTeacherLessonPlanEntriesBulk(plan.id, days);
      setSavedPlan(plan);
      setNotice("Lesson plan saved.");
    } catch (saveError) {
      setError(saveError.message || "Failed to save the lesson plan.");
    } finally {
      setSaving(false);
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
    if (!savedPlan || selectedColleagueIds.length === 0) return;
    setSharing(true);
    try {
      await shareTeacherLessonPlan(savedPlan.id, selectedColleagueIds);
      setShareOpen(false);
      setNotice("Plan shared with the selected teachers.");
    } catch (shareError) {
      setError(shareError.message || "Failed to share the plan.");
    } finally {
      setSharing(false);
    }
  };

  const includedLabels = INCLUDE_OPTIONS.filter((option) => includeFlags[option.key]).map((option) => option.label);

  return (
    <div className="teacher-page">
      <div className="teacher-page-header">
        <div>
          <button type="button" className="teacher-back-link" onClick={() => navigate("/teacher/lessons")}>
            &larr; Lessons
          </button>
          <span className="eyebrow">Teacher module</span>
          <h1>{mode === "ai" ? "Generate Lesson Plan with AI" : "Create Daily Lesson Plan"}</h1>
          <p>
            {mode === "ai"
              ? "Create a complete, structured lesson plan using AI based on your curriculum and best teaching practices."
              : "Build a day-by-day lesson plan for a chapter, one day at a time."}
          </p>
        </div>
        {filterOptions.contentConfigured && (
          <span className="teacher-lesson-context-pill">
            📘 {filterOptions.board} {selectedBatch?.className} &ndash; {filterOptions.subjectName}
          </span>
        )}
      </div>

      {notice && <div className="admin-bulk-pipeline-concurrency">{notice}</div>}
      {error && <p className="error-text">{error}</p>}

      <div className="teacher-lesson-mode-toggle">
        <button type="button" className={`teacher-lesson-mode-card ${mode === "ai" ? "is-active" : ""}`} onClick={() => setMode("ai")}>
          <strong>Generate with AI</strong>
          <span>Let AI draft a full day-by-day plan from your curriculum.</span>
        </button>
        <button type="button" className={`teacher-lesson-mode-card ${mode === "manual" ? "is-active" : ""}`} onClick={() => setMode("manual")}>
          <strong>Create Manually</strong>
          <span>Add each teaching day yourself.</span>
        </button>
      </div>

      {mode === "ai" && (
        <div className="teacher-ai-stepper">
          {STEPS.map((step, index) => (
            <div key={step} className={`teacher-ai-stepper-item ${phase === index + 1 ? "is-active" : phase > index + 1 ? "is-done" : ""}`}>
              <span className="teacher-ai-stepper-badge">{index + 1}</span>
              <span className="teacher-ai-stepper-label">{step}</span>
              {index < STEPS.length - 1 && <span className="teacher-ai-stepper-line" />}
            </div>
          ))}
        </div>
      )}

      <div className="teacher-lesson-create-layout">
        <div className="teacher-lesson-create-main">
          {mode === "manual" && (
            <>
              <div className="admin-studio-form-grid">
                <label className="admin-studio-field">
                  <span>Class</span>
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
                  <span>Board</span>
                  <input value={filterOptions.board || ""} disabled />
                </label>
                <label className="admin-studio-field">
                  <span>Subject</span>
                  <input value={filterOptions.subjectName || ""} disabled />
                </label>
                <label className="admin-studio-field">
                  <span>Chapter</span>
                  <select value={chapterNumber} onChange={(e) => setChapterNumber(e.target.value)} disabled={!filterOptions.contentConfigured}>
                    <option value="">Select a chapter...</option>
                    {(filterOptions.chapters || []).map((chapter) => (
                      <option key={chapter.chapterNumber} value={chapter.chapterNumber}>
                        {chapter.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {batchId && chapterNumber && !checkingMasterPlan && masterPlanExists === false && (
                <p className="teacher-ai-panel-hint">
                  Create a Master Lesson Plan for this chapter first --{" "}
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => navigate("/teacher/lessons/master-plan", { state: { batchId, chapterNumber } })}
                  >
                    Open Master Plan
                  </button>
                </p>
              )}

              <button
                type="button"
                className="primary-button"
                onClick={openAddDay}
                disabled={!batchId || !chapterNumber || checkingMasterPlan || masterPlanExists !== true}
              >
                + Add Day
              </button>

              {days.length > 0 && (
                <div className="admin-panel">
                  <div className="admin-panel-head">
                    <h2>Lesson Plan</h2>
                    <div>
                      <button type="button" className="ghost-button" onClick={openAddDay}>
                        + Add Day
                      </button>
                      <button type="button" className="primary-button" onClick={handleSavePlan} disabled={saving || Boolean(savedPlan) || !title.trim()}>
                        {savedPlan ? "Saved ✓" : saving ? "Saving..." : "Save Plan"}
                      </button>
                    </div>
                  </div>
                  <label className="admin-studio-field">
                    <span>Plan Title</span>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={Boolean(savedPlan)} />
                  </label>
                  <LessonPlanTable days={days} savedPlan={savedPlan} onEdit={openEditDay} onDuplicate={handleDuplicateDay} onDelete={handleDeleteDay} />
                  {savedPlan && (
                    <button type="button" className="ghost-button" onClick={() => navigate(`/teacher/lessons/${savedPlan.id}`)}>
                      View & Edit Saved Plan →
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {mode === "ai" && (
            <div className="teacher-ai-generate-grid">
              <div className="teacher-ai-generate-panel">
                <div className="teacher-ai-panel-head">
                  <span className="teacher-ai-step-badge">1</span>
                  <div className="teacher-ai-panel-head-text">
                    <h2>Set Your Requirements</h2>
                    <p>Tell us what you need. The more details you provide, the better the plan.</p>
                  </div>
                </div>

                <div className="admin-studio-form-grid">
                  <label className="admin-studio-field">
                    <span>Class *</span>
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
                  <select value={chapterNumber} onChange={(e) => setChapterNumber(e.target.value)} disabled={!filterOptions.contentConfigured}>
                    <option value="">Select a chapter...</option>
                    {(filterOptions.chapters || []).map((chapter) => (
                      <option key={chapter.chapterNumber} value={chapter.chapterNumber}>
                        {chapter.title}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="admin-studio-field">
                  <span>Topics to Include</span>
                  <div className="teacher-lesson-topics">
                    {topics.map((topic, index) => (
                      <span key={index} className="teacher-lesson-topic-chip">
                        {topic}
                        <button type="button" aria-label={`Remove ${topic}`} onClick={() => setTopics((prev) => prev.filter((_, i) => i !== index))}>
                          &times;
                        </button>
                      </span>
                    ))}
                    {topicInputOpen ? (
                      <input
                        autoFocus
                        className="teacher-lesson-topic-input"
                        value={topicInput}
                        onChange={(e) => setTopicInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTopic())}
                        onBlur={addTopic}
                        placeholder="Type a topic and press Enter"
                      />
                    ) : (
                      <button type="button" className="teacher-lesson-topic-add" onClick={() => setTopicInputOpen(true)}>
                        + Add more topics
                      </button>
                    )}
                  </div>
                </div>

                <label className="admin-studio-field">
                  <span>Additional Context (Optional)</span>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                    placeholder="E.g. focus on activity-based learning, include real-life examples, align with NEP 2020..."
                  />
                  <span className="admin-studio-field-hint">{additionalInstructions.length}/500</span>
                </label>

                <label className="admin-studio-field">
                  <span>Number of teaching days</span>
                  <input type="number" min={1} max={30} value={dayCount} onChange={(e) => setDayCount(e.target.value)} />
                </label>

                <details className="teacher-ai-advanced-options" open>
                  <summary>
                    <span>✨ Advanced Options (Optional)</span>
                    <span className="teacher-ai-advanced-subtitle">Customize the lesson plan as per your teaching style and classroom needs.</span>
                  </summary>

                  <div className="teacher-ai-advanced-grid">
                    <div>
                      <h4>Bloom's Levels to Include</h4>
                      <div className="teacher-ai-option-list">
                        {BLOOM_LEVELS.map((stage) => (
                          <label key={stage} className="teacher-ai-option">
                            <input
                              type="checkbox"
                              checked={Boolean(bloomFocus[stage])}
                              onChange={(e) => setBloomFocus((prev) => ({ ...prev, [stage]: e.target.checked }))}
                            />
                            {BLOOM_LABELS[stage]}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4>Include in Plan</h4>
                      <div className="teacher-ai-option-list">
                        {INCLUDE_OPTIONS.map((option) => (
                          <label key={option.key} className="teacher-ai-option">
                            <input
                              type="checkbox"
                              checked={Boolean(includeFlags[option.key])}
                              onChange={(e) => setIncludeFlags((prev) => ({ ...prev, [option.key]: e.target.checked }))}
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4>Tone & Style</h4>
                      <div className="teacher-ai-option-list">
                        {TONE_OPTIONS.map((option) => (
                          <label key={option.key} className="teacher-ai-option">
                            <input type="radio" name="tone" checked={tone === option.key} onChange={() => setTone(option.key)} />
                            {option.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </details>

                {!generating && (!batchId || !chapterNumber) && (
                  <p className="teacher-ai-panel-hint">
                    {!batchId ? "Select a class to continue." : "Select a chapter to continue."}
                  </p>
                )}

                {!generating && batchId && chapterNumber && !checkingMasterPlan && masterPlanExists === false && (
                  <p className="teacher-ai-panel-hint">
                    Create a Master Lesson Plan for this chapter first --{" "}
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => navigate("/teacher/lessons/master-plan", { state: { batchId, chapterNumber } })}
                    >
                      Open Master Plan
                    </button>
                  </p>
                )}

                <div className="teacher-ai-panel-actions">
                  <button type="button" className="ghost-button" onClick={handleReset}>
                    ↺ Reset
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleGenerate}
                    disabled={generating || !batchId || !chapterNumber || checkingMasterPlan || masterPlanExists !== true}
                  >
                    {generating ? (
                      <>
                        <span className="teacher-button-spinner" aria-hidden="true" /> Generating...
                      </>
                    ) : (
                      <>
                        ✨ Generate Lesson Plan <span className="teacher-cta-arrow">→</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="teacher-ai-generate-panel">
                <div className="teacher-ai-panel-head">
                  <span className="teacher-ai-step-badge">2</span>
                  <div className="teacher-ai-panel-head-text">
                    <h2>AI Generated Lesson Plan</h2>
                    <p>Review the AI generated plan. You can edit, regenerate or refine it.</p>
                  </div>
                  {generationSeconds != null && !generating && <span className="teacher-ai-generated-pill">✨ Generated in {generationSeconds}s</span>}
                </div>

                {generating && <p className="teacher-ai-output-empty">Generating your lesson plan…</p>}
                {!generating && days.length === 0 && (
                  <p className="teacher-ai-output-empty">Fill in your requirements on the left and click Generate to see your lesson plan here.</p>
                )}

                {!generating && days.length > 0 && (
                  <>
                    <div className="teacher-ai-output-tabs">
                      {OUTPUT_TABS.map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          className={`teacher-ai-output-tab ${outputTab === tab.key ? "is-active" : ""}`}
                          onClick={() => setOutputTab(tab.key)}
                        >
                          <span aria-hidden="true">{tab.icon}</span> {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="teacher-ai-output-content">
                      {outputTab === "table" && (
                        <LessonPlanTable days={days} savedPlan={savedPlan} onEdit={openEditDay} onDuplicate={handleDuplicateDay} onDelete={handleDeleteDay} />
                      )}
                      {outputTab === "structured" && <StructuredView days={days} />}
                      {outputTab === "notes" && <TeachingNotesView days={days} />}
                      {outputTab === "resources" && <ResourcesPlaceholder onComingSoon={() => setNotice("Resource attachments are coming soon.")} />}
                    </div>

                    <div className="teacher-ai-output-actions">
                      <button type="button" className="ghost-button" onClick={handleGenerate} disabled={generating}>
                        {generating ? (
                          <>
                            <span className="teacher-button-spinner teacher-button-spinner-dark" aria-hidden="true" /> Regenerating...
                          </>
                        ) : (
                          "🔄 Regenerate (Different Version)"
                        )}
                      </button>
                      <button type="button" className="ghost-button" onClick={() => setRefineOpen((open) => !open)}>
                        ☰ Refine with Instructions
                      </button>
                      <button type="button" className="ghost-button" onClick={openAddDay} disabled={Boolean(savedPlan)}>
                        ✏️ Add a Day Manually
                      </button>
                    </div>

                    {refineOpen && (
                      <div className="teacher-ai-refine-box">
                        <textarea
                          rows={2}
                          value={additionalInstructions}
                          onChange={(e) => setAdditionalInstructions(e.target.value)}
                          placeholder={`Add more instructions, e.g. add ${getSubjectActivityExample(filterOptions.subjectName)} on day 3...`}
                        />
                        <button type="button" className="primary-button" onClick={handleGenerate} disabled={generating}>
                          {generating ? (
                            <>
                              <span className="teacher-button-spinner" aria-hidden="true" /> Regenerating...
                            </>
                          ) : (
                            "Apply & Regenerate"
                          )}
                        </button>
                      </div>
                    )}

                    <label className="admin-studio-field">
                      <span>Plan Title</span>
                      <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={Boolean(savedPlan)} />
                    </label>

                    <button type="button" className="primary-button teacher-ai-save-button" onClick={handleSavePlan} disabled={saving || Boolean(savedPlan) || !title.trim()}>
                      {savedPlan ? "Saved ✓" : saving ? "Saving..." : "Save to My Plans"}
                    </button>

                    <div className={`teacher-ai-status-banner ${savedPlan ? "is-success" : ""}`}>
                      {savedPlan ? (
                        <>
                          <p>
                            ✅ This plan follows {filterOptions.board} {selectedBatch?.className} {filterOptions.subjectName} curriculum
                            {includedLabels.length ? ` and includes ${includedLabels.join(", ")}` : ""}. You can now edit, download or share it.
                          </p>
                          <div className="teacher-ai-status-actions">
                            <button type="button" className="ghost-button" onClick={() => downloadTeacherLessonPlanPdf(savedPlan.id, `${savedPlan.title}.pdf`)}>
                              📄 Download PDF
                            </button>
                            <button type="button" className="ghost-button" onClick={() => downloadTeacherLessonPlanExcel(savedPlan.id, `${savedPlan.title}.xlsx`)}>
                              📊 Download Excel
                            </button>
                            <details className="teacher-ai-kebab">
                              <summary aria-label="More actions">⋮</summary>
                              <div className="teacher-ai-kebab-menu">
                                <button type="button" onClick={() => window.print()}>
                                  Print Lesson Plan
                                </button>
                                <button type="button" onClick={openShareModal}>
                                  Share with Teachers
                                </button>
                                <button type="button" onClick={() => navigate(`/teacher/lessons/${savedPlan.id}`)}>
                                  View & Edit Saved Plan
                                </button>
                              </div>
                            </details>
                          </div>
                        </>
                      ) : (
                        <p>💡 Save this plan to unlock PDF/Excel downloads and sharing with other teachers.</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="teacher-lesson-create-sidebar">
          <MobileAssistantOverlay>
            <TeacherLessonPlanAssistantPanel
              batchId={batchId || null}
              subjectName={filterOptions.subjectName}
              chapterTitle={selectedChapter?.title}
              planContext={planContextSummary}
              days={assistantDays}
              onAcceptToDay={handleAcceptToDay}
            />
          </MobileAssistantOverlay>

          <div className="teacher-quick-actions-panel">
            <h3>Quick Actions</h3>
            <button
              type="button"
              className="ghost-button"
              disabled={!savedPlan}
              onClick={() => savedPlan && downloadTeacherLessonPlanPdf(savedPlan.id, `${savedPlan.title}.pdf`)}
            >
              Download PDF
            </button>
            <button
              type="button"
              className="ghost-button"
              disabled={!savedPlan}
              onClick={() => savedPlan && downloadTeacherLessonPlanExcel(savedPlan.id, `${savedPlan.title}.xlsx`)}
            >
              Download Excel
            </button>
            <button type="button" className="ghost-button" onClick={() => window.print()}>
              Print
            </button>
            <button type="button" className="ghost-button" disabled={!savedPlan} onClick={openShareModal}>
              Share with Teachers
            </button>
          </div>

          <div className="teacher-plan-info-panel">
            <h3>Plan Information</h3>
            <dl>
              <dt>Chapter</dt>
              <dd>{selectedChapter?.title || "-"}</dd>
              <dt>Days planned</dt>
              <dd>{days.length}</dd>
              <dt>Status</dt>
              <dd>{savedPlan ? "Saved (draft)" : "Not saved yet"}</dd>
            </dl>
          </div>

          <div className="teacher-tips-panel">
            <h3>Tips</h3>
            <p>Ground each day's Teaching Method in a concrete classroom activity per Bloom's stage -- it makes the plan far easier to actually teach from.</p>
          </div>
        </div>
      </div>

      {dayFormOpen && (
        <div className="modal-backdrop" onClick={() => setDayFormOpen(false)}>
          <div className="modal-panel teacher-lesson-row-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close-button" onClick={() => setDayFormOpen(false)}>
              &times;
            </button>
            <h2>{editingDayIndex === null ? "+ Add Lesson Plan Row (Manual Entry)" : "Edit Lesson Plan Row"}</h2>
            <p className="teacher-lesson-row-modal-subtitle">
              Fill in the details for this lesson plan step. All fields help create a structured and effective plan.
            </p>

            <div className="teacher-lesson-row-context-bar">
              <span>
                <b>Board:</b> {filterOptions.board || "-"}
              </span>
              <span>
                <b>Class:</b> {selectedBatch?.className || "-"}
              </span>
              <span>
                <b>Subject:</b> {filterOptions.subjectName || "-"}
              </span>
              <span>
                <b>Chapter:</b> {selectedChapter?.title || "-"}
              </span>
              <button type="button" className="teacher-lesson-row-change-chapter" onClick={() => setDayFormOpen(false)}>
                ✎ Change Chapter
              </button>
            </div>

            <form className="teacher-lesson-row-form" onSubmit={handleSaveDay}>
              <div className="teacher-lesson-row-grid teacher-lesson-row-grid-4">
                <label className="admin-studio-field">
                  <span>Day *</span>
                  <input type="number" value={editingDayIndex === null ? days.length + 1 : editingDayIndex + 1} disabled />
                </label>
                <label className="admin-studio-field">
                  <span>Date</span>
                  <input type="date" value={dayForm.entryDate || ""} onChange={(e) => setDayForm((c) => ({ ...c, entryDate: e.target.value }))} />
                </label>
                <label className="admin-studio-field">
                  <span>Topic *</span>
                  <AutoSizeTextarea rows={3} maxLength={200} value={dayForm.topic} onChange={(e) => setDayForm((c) => ({ ...c, topic: e.target.value }))} required />
                  <span className="admin-studio-field-hint">{dayForm.topic.length}/200</span>
                </label>
                <label className="admin-studio-field">
                  <span>Pre Concept *</span>
                  <AutoSizeTextarea
                    rows={3}
                    maxLength={500}
                    value={dayForm.preConcept || ""}
                    onChange={(e) => setDayForm((c) => ({ ...c, preConcept: e.target.value }))}
                  />
                  <span className="admin-studio-field-hint">{(dayForm.preConcept || "").length}/500</span>
                </label>
              </div>

              <div className="teacher-lesson-row-grid teacher-lesson-row-grid-2">
                <label className="admin-studio-field">
                  <span>Subtopic *</span>
                  <AutoSizeTextarea rows={4} maxLength={500} value={dayForm.subtopic || ""} onChange={(e) => setDayForm((c) => ({ ...c, subtopic: e.target.value }))} />
                  <span className="admin-studio-field-hint">{(dayForm.subtopic || "").length}/500</span>
                </label>
                <label className="admin-studio-field">
                  <span>Teaching Approach *</span>
                  <AutoSizeTextarea
                    rows={4}
                    maxLength={500}
                    value={dayForm.teachingApproach || ""}
                    onChange={(e) => setDayForm((c) => ({ ...c, teachingApproach: e.target.value }))}
                  />
                  <span className="admin-studio-field-hint">{(dayForm.teachingApproach || "").length}/500</span>
                </label>
              </div>

              <div className="admin-studio-field">
                <span>Teaching Method (by Bloom's Level) *</span>
                <div className="teacher-lesson-bloom-fields">
                  {BLOOM_LEVELS.map((stage) => (
                    <label key={stage} className="admin-studio-field teacher-lesson-bloom-field">
                      <span>{BLOOM_LABELS[stage]}</span>
                      <AutoSizeTextarea
                        rows={3}
                        placeholder={"Target Question: ...\nTeaching Approach: ..."}
                        value={dayForm.teachingMethod?.[stage] || ""}
                        onChange={(e) => setDayForm((c) => ({ ...c, teachingMethod: { ...c.teachingMethod, [stage]: e.target.value } }))}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="teacher-lesson-row-grid teacher-lesson-row-grid-2">
                <label className="admin-studio-field">
                  <span>Learning Aid *</span>
                  <AutoSizeTextarea rows={4} maxLength={500} value={dayForm.learningAid || ""} onChange={(e) => setDayForm((c) => ({ ...c, learningAid: e.target.value }))} />
                  <span className="admin-studio-field-hint">{(dayForm.learningAid || "").length}/500</span>
                </label>
                <label className="admin-studio-field">
                  <span>Learning Outcome *</span>
                  <AutoSizeTextarea
                    rows={4}
                    maxLength={500}
                    value={dayForm.learningOutcome || ""}
                    onChange={(e) => setDayForm((c) => ({ ...c, learningOutcome: e.target.value }))}
                  />
                  <span className="admin-studio-field-hint">{(dayForm.learningOutcome || "").length}/500</span>
                </label>
              </div>

              <label className="admin-studio-field">
                <span>Activities (5 for general learners + 1 for learners needing additional support)</span>
                <AutoSizeTextarea
                  rows={6}
                  value={dayForm.activities || ""}
                  onChange={(e) => setDayForm((c) => ({ ...c, activities: e.target.value }))}
                />
              </label>

              <ResourcesPlaceholder onComingSoon={() => setNotice("File uploads are coming soon.")} />

              <div className="teacher-lesson-row-preview">
                <h4>Preview in Row Format</h4>
                <table className="teacher-lesson-plan-table">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Topic</th>
                      <th>Teaching Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{editingDayIndex === null ? days.length + 1 : editingDayIndex + 1}</td>
                      <td>{dayForm.topic || "-"}</td>
                      <td>
                        <BloomMethodOutput teachingMethod={dayForm.teachingMethod} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="admin-bulk-pipeline-dialog-actions">
                <button type="button" className="ghost-button" onClick={() => setDayFormOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  Save Row
                </button>
                {editingDayIndex === null && (
                  <button type="button" className="primary-button" onClick={handleSaveDayAndAddAnother}>
                    + Save & Add Another
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

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
                      id={`colleague-${colleague.userId}`}
                      checked={selectedColleagueIds.includes(colleague.userId)}
                      onChange={(e) =>
                        setSelectedColleagueIds((prev) =>
                          e.target.checked ? [...prev, colleague.userId] : prev.filter((id) => id !== colleague.userId)
                        )
                      }
                    />
                    <label htmlFor={`colleague-${colleague.userId}`}>
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
