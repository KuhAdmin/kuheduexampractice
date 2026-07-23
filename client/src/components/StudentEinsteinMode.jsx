import { useEffect, useState } from "react";
import { getEinsteinChallenge, submitEinsteinRecognition } from "../api/client";
import { StudentCameraCapture } from "./StudentCameraCapture";
import { AdminImageCropEditor } from "./AdminImageCropEditor";

const emptyState = () => ({
  stage: "loading-challenge",
  object: "",
  rawImageDataUrl: "",
  imageDataUrl: "",
  result: null,
  error: "",
});

// At the bottom of the concept Explore tab, beneath AI Tutor and the
// question/answer practice capture: the app invents a real-world object
// related to the concept, the student photographs (camera -> two-pin crop,
// same pipeline as StudentConceptPracticeCapture) an object they believe
// matches it, and Gemini Vision judges the match.
export const StudentEinsteinMode = ({ assessmentUnitId }) => {
  const [state, setState] = useState(emptyState);

  const set = (patch) => setState((current) => ({ ...current, ...patch }));

  const loadChallenge = async () => {
    set({
      stage: "loading-challenge",
      error: "",
      rawImageDataUrl: "",
      imageDataUrl: "",
      result: null,
    });
    try {
      const result = await getEinsteinChallenge(assessmentUnitId);
      set({ object: result.object, stage: "challenge-ready" });
    } catch (error) {
      set({ stage: "challenge-error", error: error.message || "Failed to load a challenge." });
    }
  };

  useEffect(() => {
    loadChallenge();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentUnitId]);

  const runRecognition = async (imageDataUrl) => {
    set({ stage: "recognizing", error: "" });
    try {
      const result = await submitEinsteinRecognition(assessmentUnitId, {
        targetObject: state.object,
        imageDataUrl,
      });
      set({ result, stage: "result" });
    } catch (error) {
      set({ stage: "recognize-error", error: error.message || "Failed to recognize that photo." });
    }
  };

  return (
    <section className="student-einstein-mode" aria-label="Einstein mode">
      <header className="student-ai-tutor-header">
        <h2>Einstein Mode</h2>
        <p>Find a real object that shows this concept in action, and let AI check your eye for it.</p>
      </header>

      {state.stage === "loading-challenge" && (
        <p className="admin-workbench-muted">Thinking of a challenge...</p>
      )}

      {state.stage === "challenge-error" && (
        <div className="admin-ai-demo-panel">
          <p className="error-text">{state.error}</p>
          <div className="admin-ai-demo-actions">
            <button type="button" className="primary-button" onClick={loadChallenge}>
              Retry
            </button>
          </div>
        </div>
      )}

      {state.stage === "challenge-ready" && (
        <div className="admin-ai-demo-panel">
          <p className="student-einstein-mode-prompt">
            <strong>Q:</strong> Identify a random concept-related object: <em>{state.object}</em>
          </p>
          <div className="admin-ai-demo-actions">
            <button type="button" className="student-einstein-mode-cta" onClick={() => set({ stage: "camera" })}>
              Open Camera
            </button>
            <button type="button" className="ghost-button" onClick={loadChallenge}>
              Give Me a Different Object
            </button>
          </div>
        </div>
      )}

      {state.stage === "camera" && (
        <StudentCameraCapture
          onCapture={(dataUrl) => set({ rawImageDataUrl: dataUrl, stage: "crop" })}
          onCancel={() => set({ stage: "challenge-ready" })}
        />
      )}

      {state.stage === "crop" && (
        <div className="modal-backdrop" onClick={() => set({ stage: "camera" })}>
          <div className="modal-panel is-wide" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="close-button"
              aria-label="Close"
              onClick={() => set({ stage: "camera" })}
            >
              &times;
            </button>
            <h2>Crop the Photo</h2>
            <AdminImageCropEditor
              imageDataUrl={state.rawImageDataUrl}
              onSave={(croppedDataUrl) => {
                set({ imageDataUrl: croppedDataUrl });
                runRecognition(croppedDataUrl);
              }}
              onCancel={() => set({ stage: "camera" })}
            />
          </div>
        </div>
      )}

      {state.stage === "recognizing" && <p className="admin-workbench-muted">Looking at your photo...</p>}

      {state.stage === "recognize-error" && (
        <div className="admin-ai-demo-panel">
          <p className="error-text">{state.error}</p>
          <div className="admin-ai-demo-actions">
            <button type="button" className="ghost-button" onClick={() => set({ stage: "camera" })}>
              Retake Photo
            </button>
            <button type="button" className="primary-button" onClick={() => runRecognition(state.imageDataUrl)}>
              Retry
            </button>
          </div>
        </div>
      )}

      {state.stage === "result" && state.result && (
        <div className="admin-ai-demo-panel">
          <div className="admin-ai-demo-review-grid">
            <img src={state.imageDataUrl} alt="Captured object" className="admin-ai-demo-review-image" />
            <div>
              <span
                className={`admin-bulk-pipeline-status-badge ${
                  state.result.isMatch ? "is-completed" : "is-failed"
                }`}
              >
                {state.result.isMatch ? "Correct" : "Not a Match"}
              </span>
              <p>
                <strong>What is it?</strong> {state.result.identifiedAs || "Couldn't identify it"}
              </p>
              <p>{state.result.feedback}</p>
            </div>
          </div>
          <div className="admin-ai-demo-actions">
            <button type="button" className="ghost-button" onClick={() => set({ stage: "camera" })}>
              Retake
            </button>
            <button type="button" className="primary-button" onClick={loadChallenge}>
              Next Object
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
