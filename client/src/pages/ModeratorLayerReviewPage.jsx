import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getModerationTaskDetail, submitModeratorDecision } from "../api/client";
import { MathPreview } from "../components/MathPreview";

// Renders a per-layer honest completeness signal (real counts of what's
// present, not a fabricated quality percentage) plus the actual content, so a
// moderator can judge quality themselves rather than trust an invented score.
const renderUnitContent = (layerNumber, content) => {
  if (!content) {
    return <p className="admin-bulk-pipeline-hint">No content generated for this unit yet.</p>;
  }

  if (layerNumber === 1) {
    const knowledge = content.knowledge || {};
    return (
      <>
        <p className="admin-bulk-pipeline-hint">
          Core concepts: {knowledge.core_concepts?.length || 0} · Memory hooks:{" "}
          {knowledge.memory_hooks?.length || 0} · Context summary:{" "}
          {knowledge.context_summary ? "present" : "missing"}
        </p>
        <p>{knowledge.context_summary}</p>
        <MathPreview text={knowledge.context_summary || ""} />
        {knowledge.core_concepts?.length > 0 && (
          <ul>
            {knowledge.core_concepts.map((concept) => (
              <li key={concept}>{concept}</li>
            ))}
          </ul>
        )}
      </>
    );
  }

  if (layerNumber === 2) {
    const fields = ["story", "analogy", "visualHook", "realWorldConnection", "memoryTrick"];
    const presentCount = fields.filter((field) => content[field]).length;
    return (
      <>
        <p className="admin-bulk-pipeline-hint">
          {presentCount}/{fields.length} memory fields present · {content.retrievalCues?.length || 0} retrieval cues
        </p>
        {content.formula && (
          <p>
            <strong>Formula:</strong> {content.formula}
            <MathPreview text={content.formula} />
          </p>
        )}
        {content.story && <p><strong>Story:</strong> {content.story}</p>}
        {content.analogy && <p><strong>Analogy:</strong> {content.analogy}</p>}
        {content.memoryTrick && <p><strong>Memory trick:</strong> {content.memoryTrick}</p>}
      </>
    );
  }

  if (layerNumber === 3 || layerNumber === 4) {
    return (
      <>
        <p className="admin-bulk-pipeline-hint">
          {content.output_json ? "Output present" : "No output captured"}
        </p>
        <pre className="moderation-json-preview">{JSON.stringify(content.output_json || {}, null, 2)}</pre>
      </>
    );
  }

  if (layerNumber === 5) {
    return (
      <>
        <p className="admin-bulk-pipeline-hint">
          {content.question_family || "unknown family"} · {content.interaction_type || "unknown type"} ·{" "}
          {content.marks ?? 0} marks · {content.estimated_time_seconds ?? 0}s
        </p>
        {content.success_criteria && <p>{content.success_criteria}</p>}
      </>
    );
  }

  if (layerNumber === 6) {
    const items = Array.isArray(content) ? content : [];
    const withQuestion = items.filter((item) => item.question).length;
    const withAnswer = items.filter((item) => item.correct_answer).length;
    return (
      <>
        <p className="admin-bulk-pipeline-hint">
          {items.length} items · {withQuestion} with question text · {withAnswer} with a correct answer
        </p>
        {items.map((item) => (
          <div key={item.item_id} className="moderation-item-card">
            <strong>{item.question || "(no question text)"}</strong>
            <MathPreview text={item.question || ""} />
            {item.diagram_instruction && (
              <p className="student-diagram-instruction">{item.diagram_instruction}</p>
            )}
            {item.interaction_type === "ordering" && item.interaction_data?.sequence?.length > 0 ? (
              <ol>
                {item.interaction_data.sequence.map((value, index) => (
                  <li key={`${value}-${index}`} className="is-correct">
                    {index + 1}. {value}
                  </li>
                ))}
              </ol>
            ) : item.interaction_type === "matching" && item.interaction_data?.pairs?.length > 0 ? (
              <ul>
                {item.interaction_data.pairs.map((pair, index) => (
                  <li key={`${pair.left}-${index}`} className="is-correct">
                    {pair.left} &rarr; {pair.right}
                  </li>
                ))}
              </ul>
            ) : (
              item.options?.length > 0 && (
                <ul>
                  {item.options.map((option) => (
                    <li key={option} className={option === item.correct_answer ? "is-correct" : ""}>
                      {option}
                      <MathPreview text={option} />
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
        ))}
      </>
    );
  }

  if (layerNumber === 7) {
    return (
      <>
        <p className="admin-bulk-pipeline-hint">
          Explanation: {content.conceptExplanation ? "present" : "missing"} · Distractors:{" "}
          {content.distractorAnalysis?.length || 0} · Hints: {content.progressiveHints?.length || 0}
        </p>
        {content.conceptExplanation && (
          <>
            <p>{content.conceptExplanation}</p>
            <MathPreview text={content.conceptExplanation} />
          </>
        )}
        {content.correctAnswerReasoning && (
          <>
            <p><strong>Why correct:</strong> {content.correctAnswerReasoning}</p>
            <MathPreview text={content.correctAnswerReasoning} />
          </>
        )}
      </>
    );
  }

  return <pre className="moderation-json-preview">{JSON.stringify(content, null, 2)}</pre>;
};

export const ModeratorLayerReviewPage = () => {
  const navigate = useNavigate();
  const { reviewQueueId } = useParams();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getModerationTaskDetail(reviewQueueId);
      setTask(result);
    } catch (loadError) {
      setError(loadError.message || "Failed to load task.");
    } finally {
      setLoading(false);
    }
  }, [reviewQueueId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDecision = async (decision) => {
    setSubmitting(true);
    setError("");
    try {
      await submitModeratorDecision(reviewQueueId, decision, notes);
      navigate("/moderator");
    } catch (decisionError) {
      setError(decisionError.message || "Failed to submit decision.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <section className="admin-bulk-pipeline-page"><p>Loading task...</p></section>;
  }

  if (error && !task) {
    return <section className="admin-bulk-pipeline-page"><p className="error-text">{error}</p></section>;
  }

  if (!task) {
    return null;
  }

  const canDecide = task.status === "assigned";

  return (
    <section className="admin-bulk-pipeline-page">
      <div className="admin-bulk-pipeline-header">
        <div>
          <span className="eyebrow">Moderator review</span>
          <h1>
            {task.chapterName} · {task.sectionNumber} · {task.layerName}
          </h1>
          <p>{task.topicName}</p>
        </div>
      </div>

      <div className="admin-bulk-pipeline-grid-shell">
        {task.units.map((unit) => (
          <article key={unit.assessmentUnitId} className="admin-moderation-task-card">
            <header>
              <strong>{unit.assessmentUnitId}</strong>
              <span>{unit.approvalStatus}</span>
            </header>
            {renderUnitContent(task.layerNumber, unit.content)}
          </article>
        ))}
      </div>

      {task.decisions.length > 0 && (
        <section className="admin-bulk-pipeline-grid-shell">
          <h2>Decision History</h2>
          {task.decisions.map((decision, index) => (
            <p key={index}>
              <strong>{decision.decision}</strong> by {decision.decidedByName} —{" "}
              {new Date(decision.decidedAt).toLocaleString()}
              {decision.notes && `: ${decision.notes}`}
            </p>
          ))}
        </section>
      )}

      {canDecide && (
        <section className="admin-add-user-form">
          <h2>Your Decision</h2>
          <textarea
            placeholder="Notes for the admin (required for request changes/reject)"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          {error && <p className="error-text">{error}</p>}
          <div className="admin-moderation-task-actions">
            <button
              type="button"
              className="primary-button"
              disabled={submitting}
              onClick={() => handleDecision("approve")}
            >
              Approve
            </button>
            <button
              type="button"
              className="ghost-button"
              disabled={submitting || !notes.trim()}
              onClick={() => handleDecision("request_changes")}
            >
              Request Changes
            </button>
            <button
              type="button"
              className="ghost-button admin-pipeline-runs-danger"
              disabled={submitting || !notes.trim()}
              onClick={() => handleDecision("reject")}
            >
              Reject
            </button>
          </div>
        </section>
      )}
    </section>
  );
};
