import { useState } from "react";
import {
  captureConceptPracticeAnswer,
  captureConceptPracticeQuestion,
  submitConceptPracticeGrading,
} from "../api/client";
import { StudentCameraCapture } from "./StudentCameraCapture";
import { AdminImageCropEditor } from "./AdminImageCropEditor";
import { EquationDisplay } from "./EquationDisplay";

const emptyState = () => ({
  stage: "intro",
  rawImageDataUrl: "",
  questionImageDataUrl: "",
  questionText: "",
  blockReason: "",
  answerImageDataUrl: "",
  answerText: "",
  submission: null,
  error: "",
});

// Beneath AI Tutor on the concept Explore tab: the same camera -> crop (two
// pins) -> OCR -> capture workflow as Admin > AI Assessment Demo, scoped to
// this one concept. Question/answer capture always runs through Gemini
// Vision (server-side pinned, not the admin per-subject model config);
// grading always runs through DeepSeek Pro. A captured question that isn't
// actually about this concept is flagged with a reason and answer capture
// is blocked entirely.
export const StudentConceptPracticeCapture = ({ assessmentUnitId }) => {
  const [state, setState] = useState(emptyState);

  const set = (patch) => setState((current) => ({ ...current, ...patch }));

  const startOver = () => setState(emptyState());

  const runQuestionOcr = async (imageDataUrl) => {
    set({ stage: "question-loading", error: "" });
    try {
      const result = await captureConceptPracticeQuestion(assessmentUnitId, imageDataUrl);
      if (!result.isRelated) {
        set({
          stage: "question-blocked",
          blockReason: result.reason || "This question doesn't look related to this concept.",
        });
        return;
      }
      set({ questionText: result.text, stage: "question-ready" });
    } catch (error) {
      set({ stage: "question-error", error: error.message || "Failed to read the question photo." });
    }
  };

  const runAnswerOcr = async (imageDataUrl) => {
    set({ stage: "answer-loading", error: "" });
    try {
      const result = await captureConceptPracticeAnswer(assessmentUnitId, imageDataUrl);
      set({
        answerText: result.text || "",
        stage: "answer-ready",
        error: result.text ? "" : "We couldn't find any text in that photo -- you can edit it below.",
      });
    } catch (error) {
      set({ stage: "answer-error", error: error.message || "Failed to read the answer photo." });
    }
  };

  const handleSubmitForGrading = async () => {
    set({ stage: "grading", error: "" });
    try {
      const result = await submitConceptPracticeGrading(assessmentUnitId, {
        questionText: state.questionText,
        answerText: state.answerText,
      });
      set({ submission: result, stage: "feedback" });
    } catch (error) {
      set({ stage: "grading-error", error: error.message || "Failed to grade this answer." });
    }
  };

  return (
    <section className="student-concept-practice-capture" aria-label="Practice with a real question">
      <header className="student-ai-tutor-header">
        <h2>Practice with a Real Question</h2>
        <p>Photograph a question from your book or worksheet, then your handwritten answer, for instant AI feedback.</p>
      </header>

      {state.stage === "intro" && (
        <div className="admin-ai-demo-actions">
          <button type="button" className="primary-button" onClick={() => set({ stage: "question-camera" })}>
            Capture Question
          </button>
        </div>
      )}

      {state.stage === "question-camera" && (
        <StudentCameraCapture
          onCapture={(dataUrl) => set({ rawImageDataUrl: dataUrl, stage: "question-crop" })}
          onCancel={() => set({ stage: "intro" })}
        />
      )}

      {state.stage === "question-crop" && (
        <div className="modal-backdrop" onClick={() => set({ stage: "question-camera" })}>
          <div className="modal-panel is-wide" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="close-button"
              aria-label="Close"
              onClick={() => set({ stage: "question-camera" })}
            >
              &times;
            </button>
            <h2>Crop the Question</h2>
            <AdminImageCropEditor
              imageDataUrl={state.rawImageDataUrl}
              onSave={(croppedDataUrl) => {
                set({ questionImageDataUrl: croppedDataUrl });
                runQuestionOcr(croppedDataUrl);
              }}
              onCancel={() => set({ stage: "question-camera" })}
            />
          </div>
        </div>
      )}

      {state.stage === "question-loading" && (
        <p className="admin-workbench-muted">Reading the question and checking it matches this concept...</p>
      )}

      {state.stage === "question-error" && (
        <div className="admin-ai-demo-panel">
          <p className="error-text">{state.error}</p>
          <div className="admin-ai-demo-actions">
            <button type="button" className="ghost-button" onClick={() => set({ stage: "question-camera" })}>
              Retake Photo
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => runQuestionOcr(state.questionImageDataUrl)}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {state.stage === "question-blocked" && (
        <div className="admin-ai-demo-panel student-concept-practice-capture-blocked">
          <img src={state.questionImageDataUrl} alt="Captured question" className="admin-ai-demo-review-image" />
          <p className="error-text">Not related to this concept -- {state.blockReason}</p>
          <div className="admin-ai-demo-actions">
            <button type="button" className="primary-button" onClick={() => set({ stage: "question-camera" })}>
              Retake Photo
            </button>
          </div>
        </div>
      )}

      {state.stage === "question-ready" && (
        <div className="admin-ai-demo-panel">
          <div className="admin-ai-demo-review-grid">
            <img src={state.questionImageDataUrl} alt="Captured question" className="admin-ai-demo-review-image" />
            <div>
              <strong>Question</strong>
              <EquationDisplay value={state.questionText} placeholder="(no transcribed text)" />
            </div>
          </div>
          <div className="admin-ai-demo-actions">
            <button type="button" className="ghost-button" onClick={() => set({ stage: "question-camera" })}>
              Retake
            </button>
            <button type="button" className="primary-button" onClick={() => set({ stage: "answer-camera" })}>
              Capture Answer
            </button>
          </div>
        </div>
      )}

      {state.stage === "answer-camera" && (
        <StudentCameraCapture
          onCapture={(dataUrl) => set({ rawImageDataUrl: dataUrl, stage: "answer-crop" })}
          onCancel={() => set({ stage: "question-ready" })}
        />
      )}

      {state.stage === "answer-crop" && (
        <div className="modal-backdrop" onClick={() => set({ stage: "answer-camera" })}>
          <div className="modal-panel is-wide" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="close-button"
              aria-label="Close"
              onClick={() => set({ stage: "answer-camera" })}
            >
              &times;
            </button>
            <h2>Crop the Answer</h2>
            <AdminImageCropEditor
              imageDataUrl={state.rawImageDataUrl}
              onSave={(croppedDataUrl) => {
                set({ answerImageDataUrl: croppedDataUrl });
                runAnswerOcr(croppedDataUrl);
              }}
              onCancel={() => set({ stage: "answer-camera" })}
            />
          </div>
        </div>
      )}

      {state.stage === "answer-loading" && <p className="admin-workbench-muted">Reading your answer...</p>}

      {state.stage === "answer-error" && (
        <div className="admin-ai-demo-panel">
          <p className="error-text">{state.error}</p>
          <div className="admin-ai-demo-actions">
            <button type="button" className="ghost-button" onClick={() => set({ stage: "answer-camera" })}>
              Retake Photo
            </button>
            <button type="button" className="primary-button" onClick={() => runAnswerOcr(state.answerImageDataUrl)}>
              Retry
            </button>
          </div>
        </div>
      )}

      {state.stage === "answer-ready" && (
        <div className="admin-ai-demo-panel">
          <div className="admin-ai-demo-review-grid">
            <img src={state.answerImageDataUrl} alt="Captured answer" className="admin-ai-demo-review-image" />
            <div>
              <strong>Answer</strong>
              <EquationDisplay
                value={state.answerText}
                onChange={(next) => set({ answerText: next })}
                placeholder="(no transcribed text -- use the menu to add it)"
              />
            </div>
          </div>
          {state.error && <p className="error-text">{state.error}</p>}
          <div className="admin-ai-demo-actions">
            <button type="button" className="ghost-button" onClick={() => set({ stage: "answer-camera" })}>
              Retake
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={!state.answerText.trim()}
              onClick={handleSubmitForGrading}
            >
              Submit for AI Grading
            </button>
          </div>
        </div>
      )}

      {state.stage === "grading" && <p className="admin-workbench-muted">Grading with AI...</p>}

      {state.stage === "grading-error" && (
        <div className="admin-ai-demo-panel">
          <p className="error-text">{state.error}</p>
          <div className="admin-ai-demo-actions">
            <button type="button" className="ghost-button" onClick={() => set({ stage: "answer-ready" })}>
              Back
            </button>
            <button type="button" className="primary-button" onClick={handleSubmitForGrading}>
              Retry
            </button>
          </div>
        </div>
      )}

      {state.stage === "feedback" && state.submission && (
        <div className="admin-ai-demo-panel">
          <span
            className={`admin-bulk-pipeline-status-badge ${
              state.submission.isCorrect ? "is-completed" : "is-failed"
            }`}
          >
            {state.submission.isCorrect ? "Correct" : "Needs Work"}
          </span>
          <div className="admin-ai-demo-feedback-block">
            <strong>Ideal answer</strong>
            <EquationDisplay value={state.submission.idealAnswerSummary} />
          </div>
          <div className="admin-ai-demo-feedback-block">
            <strong>Feedback</strong>
            <EquationDisplay value={state.submission.feedback} />
          </div>
          <div className="admin-ai-demo-actions">
            <button type="button" className="primary-button" onClick={startOver}>
              Practice Another Question
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
