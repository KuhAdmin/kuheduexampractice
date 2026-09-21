import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addTeacherLessonPlanEntry,
  cloneTeacherSharedLessonPlan,
  deleteTeacherLessonPlanEntry,
  downloadTeacherLessonPlanExcel,
  downloadTeacherLessonPlanPdf,
  duplicateTeacherLessonPlanEntry,
  reorderTeacherLessonPlanEntries,
  getTeacherBatches,
  getTeacherLessonPlanColleagues,
  getTeacherLessonPlanDetail,
  getTeacherLessonPlanFilterOptions,
  getTeacherSharedLessonPlanDetail,
  publishTeacherLessonPlan,
  rateTeacherSharedLessonPlan,
  shareTeacherLessonPlan,
  updateTeacherLessonPlan,
  updateTeacherLessonPlanEntry,
} from "../api/client";
import { BLOOM_LEVELS, BLOOM_LABELS } from "../constants/bloomLevels";
import { TeacherLessonPlanAssistantPanel } from "../components/TeacherLessonPlanAssistantPanel";
import { MobileAssistantOverlay } from "../components/MobileAssistantOverlay";
import { AutoSizeTextarea } from "../components/AutoSizeTextarea";

const emptyEntry = {
  entryDate: "",
  topic: "",
  activities: "",
  chapterLabel: "",
  preConcept: "",
  subtopic: "",
  teachingApproach: "",
  teachingMethod: {},
  learningAid: "",
  learningOutcome: "",
};

export const TeacherLessonPlanDetailPage = ({ sharedView = false }) => {
  const { planId, shareId } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [form, setForm] = useState(emptyEntry);
  const [submitting, setSubmitting] = useState(false);
  const [expandedEntryIds, setExpandedEntryIds] = useState(new Set());

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);

  const startEditingTitle = () => {
    setTitleDraft(plan?.title || "");
    setEditingTitle(true);
  };

  const handleSaveTitle = async () => {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === plan?.title) {
      setEditingTitle(false);
      return;
    }
    setSavingTitle(true);
    try {
      const result = await updateTeacherLessonPlan(planId, { title: trimmed });
      setPlan((prev) => ({ ...prev, title: result.plan.title }));
      setEditingTitle(false);
    } catch (titleError) {
      setError(titleError.message || "Failed to rename the plan.");
    } finally {
      setSavingTitle(false);
    }
  };

  const toggleEntryExpanded = (entryId) => {
    setExpandedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const [shareOpen, setShareOpen] = useState(false);
  const [colleagues, setColleagues] = useState([]);
  const [selectedColleagueIds, setSelectedColleagueIds] = useState([]);
  const [sharing, setSharing] = useState(false);

  const [saveToMyPlansOpen, setSaveToMyPlansOpen] = useState(false);
  const [batches, setBatches] = useState([]);
  const [targetBatchId, setTargetBatchId] = useState("");
  const [cloning, setCloning] = useState(false);
  const [subjectName, setSubjectName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (sharedView) {
        setPlan(await getTeacherSharedLessonPlanDetail(shareId));
      } else {
        setPlan(await getTeacherLessonPlanDetail(planId));
      }
    } catch (loadError) {
      setError(loadError.message || "Failed to load this lesson plan.");
    } finally {
      setLoading(false);
    }
  }, [planId, shareId, sharedView]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (sharedView || !plan?.batchId) return;
    getTeacherLessonPlanFilterOptions(plan.batchId)
      .then((result) => setSubjectName(result?.subjectName || ""))
      .catch(() => {});
  }, [plan?.batchId, sharedView]);

  const openAddForm = () => {
    setEditingEntryId(null);
    setForm({ ...emptyEntry, chapterLabel: plan?.entries?.[0]?.chapterLabel || "" });
    setFormOpen(true);
  };

  const openEditForm = (entry) => {
    setEditingEntryId(entry.id);
    setForm({ ...emptyEntry, ...entry, teachingMethod: { ...entry.teachingMethod } });
    setFormOpen(true);
  };

  const handleSubmitEntry = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (editingEntryId) {
        await updateTeacherLessonPlanEntry(planId, editingEntryId, form);
      } else {
        await addTeacherLessonPlanEntry(planId, form);
      }
      setFormOpen(false);
      await load();
    } catch (submitError) {
      setError(submitError.message || "Failed to save entry.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEntry = async (entryId) => {
    try {
      await deleteTeacherLessonPlanEntry(planId, entryId);
      await load();
    } catch (deleteError) {
      setError(deleteError.message || "Failed to delete entry.");
    }
  };

  const handleDuplicateEntry = async (entryId) => {
    try {
      await duplicateTeacherLessonPlanEntry(planId, entryId);
      await load();
    } catch (duplicateError) {
      setError(duplicateError.message || "Failed to duplicate entry.");
    }
  };

  const handleMoveEntry = async (index, direction) => {
    const targetIndex = index + direction;
    const entries = plan?.entries || [];
    if (targetIndex < 0 || targetIndex >= entries.length) return;

    const reordered = [...entries];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setPlan((prev) => ({ ...prev, entries: reordered }));

    try {
      await reorderTeacherLessonPlanEntries(
        planId,
        reordered.map((entry) => entry.id)
      );
    } catch (reorderError) {
      setError(reorderError.message || "Failed to reorder days.");
      await load();
    }
  };

  const handlePublish = async () => {
    try {
      await publishTeacherLessonPlan(planId);
      setNotice("Lesson plan published.");
      await load();
    } catch (publishError) {
      setError(publishError.message || "Failed to publish.");
    }
  };

  const handleRate = async (rating) => {
    try {
      await rateTeacherSharedLessonPlan(shareId, rating);
      await load();
    } catch (rateError) {
      setError(rateError.message || "Failed to save your rating.");
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
    if (selectedColleagueIds.length === 0) return;
    setSharing(true);
    try {
      await shareTeacherLessonPlan(planId, selectedColleagueIds);
      setShareOpen(false);
      setNotice("Plan shared with the selected teachers.");
    } catch (shareError) {
      setError(shareError.message || "Failed to share the plan.");
    } finally {
      setSharing(false);
    }
  };

  const openSaveToMyPlans = async () => {
    setSaveToMyPlansOpen(true);
    setTargetBatchId("");
    try {
      const result = await getTeacherBatches();
      setBatches(result?.batches || []);
    } catch {
      setBatches([]);
    }
  };

  const handleCloneSharedPlan = async () => {
    if (!targetBatchId) return;
    setCloning(true);
    setError("");
    try {
      const { planId: newPlanId } = await cloneTeacherSharedLessonPlan(shareId, { targetBatchId });
      navigate(`/teacher/lessons/${newPlanId}`);
    } catch (cloneError) {
      setError(cloneError.message || "Failed to save this plan to your plans.");
    } finally {
      setCloning(false);
    }
  };

  const planContextSummary = useMemo(
    () =>
      plan?.entries?.length
        ? `Current day-by-day plan: ${plan.entries.map((entry, index) => `Day ${index + 1}: ${entry.topic}`).join("; ")}`
        : "",
    [plan?.entries]
  );

  const assistantDays = useMemo(
    () => (plan?.entries || []).map((entry, index) => ({ dayNumber: index + 1, topic: entry.topic })),
    [plan?.entries]
  );

  const handleAcceptToDay = async (dayNumber, text) => {
    const entry = plan?.entries?.[dayNumber - 1];
    if (!entry) return false;
    const merged = { ...entry, activities: entry.activities ? `${entry.activities}\n\n${text}` : text };
    // A targeted local merge, not load() -- load() briefly sets loading=true,
    // which swaps this whole page for its early-return "Loading..." branch
    // and unmounts/remounts everything beneath it, including the assistant
    // panel -- wiping its entire local state (the live suggestions list,
    // accepted badges, everything) even though only one field on one entry
    // actually changed.
    const { entry: updatedEntry } = await updateTeacherLessonPlanEntry(planId, entry.id, merged);
    setPlan((prev) => ({
      ...prev,
      entries: prev.entries.map((current, index) => (index === dayNumber - 1 ? updatedEntry : current)),
    }));
    return true;
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
          <button
            type="button"
            className="teacher-back-link"
            onClick={() => navigate(sharedView ? "/teacher/lessons" : "/teacher/lessons")}
          >
            &larr; Lessons
          </button>
          {editingTitle ? (
            <div className="teacher-lesson-title-edit">
              <input
                autoFocus
                className="teacher-lesson-title-input"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                disabled={savingTitle}
              />
              <button type="button" className="primary-button" onClick={handleSaveTitle} disabled={savingTitle}>
                {savingTitle ? "Saving..." : "Save"}
              </button>
              <button type="button" className="ghost-button" onClick={() => setEditingTitle(false)} disabled={savingTitle}>
                Cancel
              </button>
            </div>
          ) : (
            <h1 className="teacher-lesson-title-display">
              {plan?.title}
              {!sharedView && (
                <button type="button" className="teacher-lesson-title-edit-button" aria-label="Rename plan" onClick={startEditingTitle}>
                  ✏️
                </button>
              )}
            </h1>
          )}
          {sharedView && plan?.sharedByName && <p>Shared by {plan.sharedByName}</p>}
          {sharedView && (
            <div className="teacher-lesson-share-rating" role="group" aria-label="Rate this shared plan">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={`teacher-lesson-share-rating-star ${(plan?.rating || 0) >= star ? "is-filled" : ""}`}
                  onClick={() => handleRate(star)}
                  aria-label={`Rate ${star} star${star === 1 ? "" : "s"}`}
                >
                  ★
                </button>
              ))}
              {plan?.rating ? <span>You rated this {plan.rating}/5</span> : <span>Rate this plan</span>}
            </div>
          )}
        </div>
        <div>
          {!sharedView && <span className={`teacher-badge tone-${plan?.status}`}>{plan?.status}</span>}
          {!sharedView && plan?.status === "draft" && (
            <button type="button" className="ghost-button" onClick={handlePublish}>
              Publish
            </button>
          )}
          {!sharedView && (
            <button type="button" className="ghost-button" onClick={() => downloadTeacherLessonPlanPdf(planId, `${plan.title}.pdf`)}>
              Download PDF
            </button>
          )}
          {!sharedView && (
            <button type="button" className="ghost-button" onClick={() => downloadTeacherLessonPlanExcel(planId, `${plan.title}.xlsx`)}>
              Download Excel
            </button>
          )}
          {!sharedView && (
            <button type="button" className="ghost-button" onClick={openShareModal}>
              Share
            </button>
          )}
          {sharedView && (
            <button type="button" className="primary-button" onClick={openSaveToMyPlans}>
              Save to My Plans
            </button>
          )}
          {!sharedView && (
            <button type="button" className="primary-button" onClick={openAddForm}>
              + Add Day
            </button>
          )}
        </div>
      </div>

      {notice && <div className="admin-bulk-pipeline-concurrency">{notice}</div>}
      {error && <p className="error-text">{error}</p>}

      <div className="teacher-lesson-create-layout">
        <div className="teacher-lesson-create-main">
          {plan?.entries.length === 0 ? (
            <div className="admin-panel">
              <p>No lessons added yet{sharedView ? "." : " -- add your first day."}</p>
            </div>
          ) : (
            <div className="teacher-card-list">
              {plan?.entries.map((entry, index) => {
                const isExpanded = expandedEntryIds.has(entry.id);
                return (
                <div key={entry.id} className="admin-panel">
                  <div className="admin-panel-head">
                    <button type="button" className="teacher-lesson-entry-toggle" onClick={() => toggleEntryExpanded(entry.id)} aria-expanded={isExpanded}>
                      <span className="teacher-lesson-entry-toggle-chevron">{isExpanded ? "▾" : "▸"}</span>
                      <h2>
                        Day {index + 1}
                        {entry.entryDate ? ` – ${new Date(entry.entryDate).toLocaleDateString()}` : ""}: {entry.topic}
                      </h2>
                    </button>
                  </div>
                  {!sharedView && (
                    <div className="teacher-lesson-entry-actions">
                      <button type="button" className="ghost-button" onClick={() => openEditForm(entry)}>
                        Edit
                      </button>
                      <button type="button" className="ghost-button" onClick={() => handleDuplicateEntry(entry.id)}>
                        Duplicate
                      </button>
                      <button type="button" className="ghost-button admin-pipeline-runs-danger" onClick={() => handleDeleteEntry(entry.id)}>
                        Delete
                      </button>
                      <button
                        type="button"
                        className="ghost-button teacher-lesson-move-button"
                        aria-label={`Move Day ${index + 1} up`}
                        disabled={index === 0}
                        onClick={() => handleMoveEntry(index, -1)}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        className="ghost-button teacher-lesson-move-button"
                        aria-label={`Move Day ${index + 1} down`}
                        disabled={index === plan.entries.length - 1}
                        onClick={() => handleMoveEntry(index, 1)}
                      >
                        ▼
                      </button>
                    </div>
                  )}
                  {isExpanded && (
                    <>
                  <div className="teacher-lesson-grid">
                    <div className="teacher-lesson-field">
                      <span>Chapter</span>
                      <p>{entry.chapterLabel || "-"}</p>
                    </div>
                    <div className="teacher-lesson-field">
                      <span>Pre Concept</span>
                      <p>{entry.preConcept || "-"}</p>
                    </div>
                    <div className="teacher-lesson-field">
                      <span>Subtopic</span>
                      <p>{entry.subtopic || "-"}</p>
                    </div>
                    <div className="teacher-lesson-field">
                      <span>Teaching Approach</span>
                      <p>{entry.teachingApproach || "-"}</p>
                    </div>
                    <div className="teacher-lesson-field">
                      <span>Learning Aid</span>
                      <p>{entry.learningAid || "-"}</p>
                    </div>
                    <div className="teacher-lesson-field">
                      <span>Learning Outcome</span>
                      <p>{entry.learningOutcome || "-"}</p>
                    </div>
                    <div className="teacher-lesson-field">
                      <span>Activities</span>
                      <p>{entry.activities || "-"}</p>
                    </div>
                  </div>
                  {entry.teachingMethod && BLOOM_LEVELS.some((stage) => entry.teachingMethod[stage]) && (
                    <div className="teacher-lesson-field">
                      <span>Teaching Method (by Bloom's Level)</span>
                      <div className="teacher-lesson-bloom-output">
                        {BLOOM_LEVELS.filter((stage) => entry.teachingMethod[stage]).map((stage) => (
                          <div key={stage} className="teacher-lesson-bloom-output-item">
                            <b>{BLOOM_LABELS[stage]}</b>
                            <p>{entry.teachingMethod[stage]}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {(entry.preConcept || entry.teachingApproach || entry.learningOutcome) && (
                    <div className="teacher-lesson-field">
                      <span>Teaching Notes</span>
                      <div className="teacher-lesson-notes-entry">
                        <p>
                          {entry.preConcept ? `Building on what students already know -- ${entry.preConcept}. ` : ""}
                          {entry.teachingApproach || ""}
                        </p>
                        {entry.learningOutcome && (
                          <p>
                            <b>By the end of this lesson, students will:</b> {entry.learningOutcome}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {!sharedView && (
                    <div className="teacher-callout">
                      <span>Related Practice: build a question-bank test for this class</span>
                      <button type="button" className="ghost-button" onClick={() => navigate("/teacher/tests/new", { state: { batchId: plan.batchId } })}>
                        Assign Practice
                      </button>
                    </div>
                  )}
                    </>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>

        {!sharedView && (
          <div className="teacher-lesson-create-sidebar">
            <MobileAssistantOverlay>
              <TeacherLessonPlanAssistantPanel
                batchId={plan?.batchId || null}
                subjectName={subjectName}
                chapterTitle={plan?.entries?.[0]?.chapterLabel}
                planContext={planContextSummary}
                days={assistantDays}
                onAcceptToDay={handleAcceptToDay}
              />
            </MobileAssistantOverlay>
          </div>
        )}
      </div>

      {formOpen && (
        <div className="modal-backdrop" onClick={() => !submitting && setFormOpen(false)}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close-button" onClick={() => setFormOpen(false)} disabled={submitting}>
              &times;
            </button>
            <h2>{editingEntryId ? "Edit Day" : "Add Day"}</h2>
            <form className="admin-exam-types-form" onSubmit={handleSubmitEntry}>
              <label className="admin-studio-field">
                <span>Chapter</span>
                <input value={form.chapterLabel || ""} onChange={(e) => setForm((c) => ({ ...c, chapterLabel: e.target.value }))} disabled />
              </label>
              <label className="admin-studio-field">
                <span>Date</span>
                <input type="date" value={form.entryDate || ""} onChange={(e) => setForm((c) => ({ ...c, entryDate: e.target.value }))} />
              </label>
              <label className="admin-studio-field">
                <span>Topic</span>
                <input value={form.topic} onChange={(e) => setForm((c) => ({ ...c, topic: e.target.value }))} required />
              </label>
              <label className="admin-studio-field">
                <span>Pre Concept</span>
                <AutoSizeTextarea rows={6} value={form.preConcept || ""} onChange={(e) => setForm((c) => ({ ...c, preConcept: e.target.value }))} />
              </label>
              <label className="admin-studio-field">
                <span>Subtopic</span>
                <AutoSizeTextarea rows={6} value={form.subtopic || ""} onChange={(e) => setForm((c) => ({ ...c, subtopic: e.target.value }))} />
              </label>
              <label className="admin-studio-field">
                <span>Teaching Approach</span>
                <AutoSizeTextarea rows={6} value={form.teachingApproach || ""} onChange={(e) => setForm((c) => ({ ...c, teachingApproach: e.target.value }))} />
              </label>
              <div className="admin-studio-field">
                <span>Teaching Method (by Bloom's Level)</span>
                <div className="teacher-lesson-bloom-fields">
                  {BLOOM_LEVELS.map((stage) => (
                    <label key={stage} className="admin-studio-field teacher-lesson-bloom-field">
                      <span>{BLOOM_LABELS[stage]}</span>
                      <AutoSizeTextarea
                        rows={3}
                        placeholder={"Target Question: ...\nTeaching Approach: ..."}
                        value={form.teachingMethod?.[stage] || ""}
                        onChange={(e) => setForm((c) => ({ ...c, teachingMethod: { ...c.teachingMethod, [stage]: e.target.value } }))}
                      />
                    </label>
                  ))}
                </div>
              </div>
              <label className="admin-studio-field">
                <span>Learning Aid</span>
                <AutoSizeTextarea rows={6} value={form.learningAid || ""} onChange={(e) => setForm((c) => ({ ...c, learningAid: e.target.value }))} />
              </label>
              <label className="admin-studio-field">
                <span>Learning Outcome</span>
                <AutoSizeTextarea rows={6} value={form.learningOutcome || ""} onChange={(e) => setForm((c) => ({ ...c, learningOutcome: e.target.value }))} />
              </label>
              <label className="admin-studio-field">
                <span>Activities</span>
                <AutoSizeTextarea rows={6} value={form.activities || ""} onChange={(e) => setForm((c) => ({ ...c, activities: e.target.value }))} />
              </label>
              <div className="admin-bulk-pipeline-dialog-actions">
                <button type="button" className="ghost-button" onClick={() => setFormOpen(false)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={submitting}>
                  {submitting ? "Saving..." : "Save"}
                </button>
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
                      id={`detail-colleague-${colleague.userId}`}
                      checked={selectedColleagueIds.includes(colleague.userId)}
                      onChange={(e) =>
                        setSelectedColleagueIds((prev) =>
                          e.target.checked ? [...prev, colleague.userId] : prev.filter((id) => id !== colleague.userId)
                        )
                      }
                    />
                    <label htmlFor={`detail-colleague-${colleague.userId}`}>
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

      {saveToMyPlansOpen && (
        <div className="modal-backdrop" onClick={() => !cloning && setSaveToMyPlansOpen(false)}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close-button" onClick={() => setSaveToMyPlansOpen(false)} disabled={cloning}>
              &times;
            </button>
            <h2>Save to My Plans</h2>
            <p>Choose which of your classes this plan should be copied into.</p>
            <label className="admin-studio-field">
              <span>Class</span>
              <select value={targetBatchId} onChange={(e) => setTargetBatchId(e.target.value)}>
                <option value="">Select a class...</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.className}-{batch.sectionName} &middot; {batch.subjectName}
                  </option>
                ))}
              </select>
            </label>
            <div className="admin-bulk-pipeline-dialog-actions">
              <button type="button" className="ghost-button" onClick={() => setSaveToMyPlansOpen(false)} disabled={cloning}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={handleCloneSharedPlan} disabled={cloning || !targetBatchId}>
                {cloning ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
