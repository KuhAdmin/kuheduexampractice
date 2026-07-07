import { useCallback, useEffect, useState } from "react";
import {
  assignModerationTask,
  getAdminUsers,
  getAllModerationTasks,
  getAssessmentStudioBootstrap,
  getAssessmentStudioChapters,
  getModerationAssignableSections,
  submitAdminModerationDecision,
} from "../api/client";

const LAYER_OPTIONS = [
  { value: 1, label: "1. Knowledge Extraction" },
  { value: 2, label: "2. Concept Memory" },
  { value: 3, label: "3. Assessment Capability" },
  { value: 4, label: "4. Assessment Strategy" },
  { value: 5, label: "5. Blueprint Generation" },
  { value: 6, label: "6. Item Generation" },
  { value: 7, label: "7. Learning Support" },
];

const emptyForm = {
  board: "CBSE",
  subjectCode: "",
  subjectName: "",
  levelCode: "",
  layerNumber: 2,
  chapterKey: "",
  chapterName: "",
  sectionNumber: "",
  sourceSectionId: "",
  moderatorUserId: "",
  dueAt: "",
};

export const AdminModerationPage = () => {
  const [bootstrap, setBootstrap] = useState({ boards: [], levels: [], subjects: [] });
  const [moderators, setModerators] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [assigning, setAssigning] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState("");
  const [decisionNotes, setDecisionNotes] = useState({});

  const [chapterOptions, setChapterOptions] = useState([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [sectionOptions, setSectionOptions] = useState([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [usersResult, tasksResult, bootstrapResult] = await Promise.all([
        getAdminUsers(),
        getAllModerationTasks(),
        getAssessmentStudioBootstrap({}),
      ]);
      setModerators((usersResult?.users || []).filter((user) => user.role === "moderator"));
      setTasks(tasksResult?.tasks || []);
      setBootstrap({
        boards: bootstrapResult?.boards || [],
        levels: bootstrapResult?.levels || [],
        subjects: bootstrapResult?.subjects || [],
      });
    } catch (loadError) {
      setError(loadError.message || "Failed to load moderation data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Chapters depend on subject + class + which layer is being moderated (a
  // chapter is only useful here once it has generated content for that layer).
  useEffect(() => {
    if (!form.levelCode || !form.subjectCode || !form.layerNumber) {
      setChapterOptions([]);
      return undefined;
    }

    let cancelled = false;
    setChaptersLoading(true);
    getAssessmentStudioChapters({
      levelCode: form.levelCode,
      subjectCode: form.subjectCode,
      targetLayerNumber: form.layerNumber,
    })
      .then((data) => {
        if (cancelled) return;
        setChapterOptions((data?.chapters || []).filter((chapter) => chapter.completedSections > 0));
      })
      .catch((chaptersError) => {
        if (!cancelled) setError(chaptersError.message || "Failed to load chapters.");
      })
      .finally(() => {
        if (!cancelled) setChaptersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.levelCode, form.subjectCode, form.layerNumber]);

  // Sections are only the ones whose target layer has finished generating and
  // that are not already assigned to a moderator for that layer.
  useEffect(() => {
    if (!form.chapterKey || !form.layerNumber) {
      setSectionOptions([]);
      return undefined;
    }

    let cancelled = false;
    setSectionsLoading(true);
    getModerationAssignableSections({
      levelCode: form.levelCode,
      subjectCode: form.subjectCode,
      chapterKey: form.chapterKey,
      layerNumber: form.layerNumber,
    })
      .then((data) => {
        if (!cancelled) setSectionOptions(data?.sections || []);
      })
      .catch((sectionsError) => {
        if (!cancelled) setError(sectionsError.message || "Failed to load sections.");
      })
      .finally(() => {
        if (!cancelled) setSectionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.chapterKey, form.layerNumber, form.levelCode, form.subjectCode]);

  const updateForm = (patch) => setForm((current) => ({ ...current, ...patch }));

  const handleSubjectChange = (event) => {
    const subjectCode = event.target.value;
    const subject = bootstrap.subjects.find((item) => item.code === subjectCode);
    updateForm({
      subjectCode,
      subjectName: subject?.name || "",
      chapterKey: "",
      chapterName: "",
      sectionNumber: "",
      sourceSectionId: "",
    });
  };

  const handleLevelChange = (event) => {
    updateForm({ levelCode: event.target.value, chapterKey: "", chapterName: "", sectionNumber: "", sourceSectionId: "" });
  };

  const handleLayerChange = (event) => {
    updateForm({
      layerNumber: Number(event.target.value),
      chapterKey: "",
      chapterName: "",
      sectionNumber: "",
      sourceSectionId: "",
    });
  };

  const handleChapterChange = (event) => {
    const chapterKey = event.target.value;
    const chapter = chapterOptions.find((item) => item.key === chapterKey);
    updateForm({
      chapterKey,
      chapterName: chapter?.chapterName || "",
      sectionNumber: "",
      sourceSectionId: "",
    });
  };

  const handleSectionChange = (event) => {
    const sectionNumber = event.target.value;
    const section = sectionOptions.find((item) => item.sectionNumber === sectionNumber);
    updateForm({ sectionNumber, sourceSectionId: section?.sourceSectionId || "" });
  };

  const handleAssign = async (event) => {
    event.preventDefault();
    if (!form.sourceSectionId) {
      setError("Choose a section to continue.");
      return;
    }

    setAssigning(true);
    setError("");
    setNotice("");
    try {
      await assignModerationTask({
        sourceSectionId: Number(form.sourceSectionId),
        layerNumber: Number(form.layerNumber),
        moderatorUserId: Number(form.moderatorUserId),
        dueAt: form.dueAt || null,
      });
      setNotice("Task assigned.");
      setForm(emptyForm);
      await load();
    } catch (assignError) {
      setError(assignError.message || "Failed to assign task.");
    } finally {
      setAssigning(false);
    }
  };

  const handleAdminDecision = async (reviewQueueId, decision) => {
    setBusyTaskId(reviewQueueId);
    setError("");
    setNotice("");
    try {
      await submitAdminModerationDecision(reviewQueueId, decision, decisionNotes[reviewQueueId] || "");
      setNotice(`Task ${decision === "admin_approve" ? "approved" : "rejected"}.`);
      await load();
    } catch (decisionError) {
      setError(decisionError.message || "Failed to record decision.");
    } finally {
      setBusyTaskId("");
    }
  };

  const pendingApprovalTasks = tasks.filter((task) => task.status === "moderator_reviewed");
  const otherTasks = tasks.filter((task) => task.status !== "moderator_reviewed");

  return (
    <section className="admin-bulk-pipeline-page">
      <div className="admin-bulk-pipeline-header">
        <div>
          <span className="eyebrow">Admin module</span>
          <h1>Moderation</h1>
          <p>Assign content for moderator review and give final approval before it reaches students.</p>
        </div>
      </div>

      <form className="admin-add-user-form" onSubmit={handleAssign}>
        <h2>Assign Review Task</h2>
        <p className="admin-bulk-pipeline-hint">
          Board, subject, class, and layer narrow down the chapter list; chapter narrows down the section
          list to only sections that have generated content for that layer and are not already assigned.
        </p>
        <div className="admin-studio-form-grid">
          <label className="admin-studio-field">
            <span>Board</span>
            <select value={form.board} onChange={(event) => updateForm({ board: event.target.value })}>
              {(bootstrap.boards.length ? bootstrap.boards : [{ code: "CBSE", name: "CBSE" }]).map((board) => (
                <option key={board.code} value={board.code}>
                  {board.name}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-studio-field">
            <span>Subject</span>
            <select value={form.subjectCode} onChange={handleSubjectChange} required>
              <option value="">Select subject</option>
              {bootstrap.subjects.map((subject) => (
                <option key={subject.code} value={subject.code}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-studio-field">
            <span>Class</span>
            <select value={form.levelCode} onChange={handleLevelChange} required>
              <option value="">Select class</option>
              {bootstrap.levels.map((level) => (
                <option key={level.code} value={level.code}>
                  {level.name}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-studio-field">
            <span>Layer</span>
            <select value={form.layerNumber} onChange={handleLayerChange}>
              {LAYER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-studio-field">
            <span>Chapter {chaptersLoading ? "(loading...)" : ""}</span>
            <select
              value={form.chapterKey}
              disabled={!form.levelCode || !form.subjectCode || chaptersLoading}
              onChange={handleChapterChange}
              required
            >
              <option value="">Select chapter</option>
              {chapterOptions.map((chapter) => (
                <option key={chapter.key} value={chapter.key}>
                  {chapter.chapterName} ({chapter.completedSections}/{chapter.totalSections} generated)
                </option>
              ))}
            </select>
            {form.levelCode && form.subjectCode && !chaptersLoading && chapterOptions.length === 0 && (
              <span className="admin-bulk-pipeline-hint">
                No chapter has generated content for this layer yet.
              </span>
            )}
          </label>

          <label className="admin-studio-field">
            <span>Section {sectionsLoading ? "(loading...)" : ""}</span>
            <select
              value={form.sectionNumber}
              disabled={!form.chapterKey || sectionsLoading}
              onChange={handleSectionChange}
              required
            >
              <option value="">Select section</option>
              {sectionOptions.map((section) => (
                <option key={section.sectionNumber} value={section.sectionNumber}>
                  {section.sectionNumber} {section.topicName ? `· ${section.topicName}` : ""}
                </option>
              ))}
            </select>
            {form.chapterKey && !sectionsLoading && sectionOptions.length === 0 && (
              <span className="admin-bulk-pipeline-hint">
                Every generated section in this chapter is already assigned for this layer.
              </span>
            )}
          </label>

          <label className="admin-studio-field">
            <span>Moderator</span>
            <select
              value={form.moderatorUserId}
              onChange={(event) => updateForm({ moderatorUserId: event.target.value })}
              required
            >
              <option value="">Select moderator</option>
              {moderators.map((moderator) => (
                <option key={moderator.id} value={moderator.id}>
                  {moderator.name} ({moderator.email})
                </option>
              ))}
            </select>
          </label>

          <label className="admin-studio-field">
            <span>Due Date</span>
            <input
              type="date"
              value={form.dueAt}
              onChange={(event) => updateForm({ dueAt: event.target.value })}
            />
          </label>
        </div>
        {error && <p className="error-text">{error}</p>}
        {notice && <div className="admin-bulk-pipeline-concurrency">{notice}</div>}
        <button
          type="submit"
          className="primary-button"
          disabled={assigning || moderators.length === 0 || !form.sourceSectionId}
        >
          {assigning ? "Assigning..." : "Assign Task"}
        </button>
        {moderators.length === 0 && !loading && (
          <p className="admin-bulk-pipeline-hint">No moderator accounts yet — add one on the Users page.</p>
        )}
      </form>

      <section className="admin-bulk-pipeline-grid-shell">
        <h2>Final Approval Queue</h2>
        {loading ? (
          <div className="admin-bulk-pipeline-empty">Loading tasks...</div>
        ) : pendingApprovalTasks.length === 0 ? (
          <div className="admin-bulk-pipeline-empty">Nothing is awaiting your final approval.</div>
        ) : (
          <div className="admin-moderation-task-list">
            {pendingApprovalTasks.map((task) => (
              <article key={task.reviewQueueId} className="admin-moderation-task-card">
                <header>
                  <strong>
                    {task.chapterName} · {task.sectionNumber} · {task.layerName}
                  </strong>
                  <span>Reviewed by {task.assignedToName}</span>
                </header>
                <textarea
                  placeholder="Optional notes"
                  value={decisionNotes[task.reviewQueueId] || ""}
                  onChange={(event) =>
                    setDecisionNotes((current) => ({ ...current, [task.reviewQueueId]: event.target.value }))
                  }
                />
                <div className="admin-moderation-task-actions">
                  <button
                    type="button"
                    className="primary-button"
                    disabled={busyTaskId === task.reviewQueueId}
                    onClick={() => handleAdminDecision(task.reviewQueueId, "admin_approve")}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="ghost-button admin-pipeline-runs-danger"
                    disabled={busyTaskId === task.reviewQueueId}
                    onClick={() => handleAdminDecision(task.reviewQueueId, "admin_reject")}
                  >
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="admin-bulk-pipeline-grid-shell">
        <h2>All Tasks</h2>
        {otherTasks.length === 0 ? (
          <div className="admin-bulk-pipeline-empty">No other tasks yet.</div>
        ) : (
          <table className="admin-bulk-pipeline-grid">
            <thead>
              <tr>
                <th>Section</th>
                <th>Layer</th>
                <th>Moderator</th>
                <th>Status</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {otherTasks.map((task) => (
                <tr key={task.reviewQueueId}>
                  <td>
                    {task.chapterName} · {task.sectionNumber}
                  </td>
                  <td>{task.layerName}</td>
                  <td>{task.assignedToName}</td>
                  <td>
                    {task.status}
                    {task.isRunningLate && <span className="admin-pipeline-runs-danger"> · running late</span>}
                  </td>
                  <td className="admin-pipeline-runs-datetime">
                    {task.dueAt ? new Date(task.dueAt).toLocaleDateString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </section>
  );
};
