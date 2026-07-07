import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyModerationTasks } from "../api/client";

const STATUS_LABELS = {
  assigned: "Assigned",
  moderator_reviewed: "Submitted",
  admin_approved: "Approved",
  admin_rejected: "Rejected",
};

export const ModeratorConsolePage = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getMyModerationTasks();
      setTasks(result?.tasks || []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load your tasks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => {
    const open = tasks.filter((task) => task.status === "assigned").length;
    const submitted = tasks.filter((task) => task.status === "moderator_reviewed").length;
    const runningLate = tasks.filter((task) => task.isRunningLate).length;
    const done = tasks.filter((task) => task.status === "admin_approved" || task.status === "admin_rejected").length;
    return { open, submitted, runningLate, done };
  }, [tasks]);

  return (
    <section className="admin-bulk-pipeline-page">
      <div className="admin-bulk-pipeline-header">
        <div>
          <span className="eyebrow">Moderator Console</span>
          <h1>My Review Tasks</h1>
          <p>Review assigned content and record your decision. Admin gives final sign-off.</p>
        </div>
      </div>

      {tasks.length > 0 && (
        <div className="admin-bulk-pipeline-summary">
          <span>{summary.open} to review</span>
          <span>{summary.submitted} awaiting admin</span>
          <span>{summary.done} completed</span>
          {summary.runningLate > 0 && (
            <span className="admin-pipeline-runs-danger">{summary.runningLate} running late</span>
          )}
        </div>
      )}

      <div className="admin-bulk-pipeline-grid-shell">
        {loading ? (
          <div className="admin-bulk-pipeline-empty">Loading tasks...</div>
        ) : error ? (
          <div className="admin-bulk-pipeline-empty">{error}</div>
        ) : tasks.length === 0 ? (
          <div className="admin-bulk-pipeline-empty">No tasks assigned to you yet.</div>
        ) : (
          <div className="admin-moderation-task-list">
            {tasks.map((task) => (
              <article key={task.reviewQueueId} className="admin-moderation-task-card">
                <header>
                  <strong>
                    {task.chapterName || "Chapter"} · {task.sectionNumber} · {task.layerName}
                  </strong>
                  <span>
                    {STATUS_LABELS[task.status] || task.status}
                    {task.isRunningLate && " · Running late"}
                    {task.dueAt && ` · Due ${new Date(task.dueAt).toLocaleDateString()}`}
                  </span>
                </header>
                <div className="admin-moderation-task-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => navigate(`/moderator/tasks/${task.reviewQueueId}`)}
                  >
                    {task.status === "assigned" ? "Review" : "View"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
