import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  deleteAdminDemoSubmission,
  getAdminDemoSubmissions,
  getAdminSubjects,
  ocrHandwrittenNote,
  submitAdminDemoAssessment,
} from "../api/client";
import { splitPdfIntoPages } from "../lib/pdfSplitter";
import { AdminImageCropEditor } from "../components/AdminImageCropEditor";
import { AdminPdfPageLightbox } from "../components/AdminPdfPageLightbox";
import { StudentCameraCapture } from "../components/StudentCameraCapture";
import { StudentMultiPageAnswerInput, extractSourcePageImages } from "../components/StudentMultiPageAnswerInput";
import { EquationDisplay } from "../components/EquationDisplay";

const STEPS = ["subject", "capture", "review-question", "capture-answer", "review", "feedback"];
const STEP_LABELS = {
  subject: "Pick Subject",
  capture: "Capture Question",
  "review-question": "Review Question",
  "capture-answer": "Capture Answer",
  review: "Review",
  feedback: "Feedback",
};

const emptyWizardState = () => ({
  step: "subject",
  subjectId: null,
  subjectName: "",
  captureMethod: null, // 'pdf_page' | 'camera_photo'
  questionImageDataUrl: "",
  questionText: "",
  answerText: "",
  answerPages: [],
  subjectCode: "",
});

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const truncate = (text, max = 90) => {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

export const AdminAiAssessmentDemoPage = () => {
  const [view, setView] = useState("new"); // 'new' | 'list'

  const [subjects, setSubjects] = useState([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [subjectsError, setSubjectsError] = useState("");

  const [wizard, setWizard] = useState(emptyWizardState);
  const [wizardKey, setWizardKey] = useState(0);

  const [pdfPages, setPdfPages] = useState([]);
  const [pdfFileName, setPdfFileName] = useState("");
  const [pdfSplitting, setPdfSplitting] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [lightboxPage, setLightboxPage] = useState(null);
  const [cropPage, setCropPage] = useState(null);

  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const ocrRequestedForRef = useRef("");

  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submission, setSubmission] = useState(null);

  const [submissions, setSubmissions] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [viewingSubmission, setViewingSubmission] = useState(null);
  const [deleteBusyId, setDeleteBusyId] = useState("");

  useEffect(() => {
    let cancelled = false;
    setSubjectsLoading(true);
    getAdminSubjects()
      .then((data) => {
        if (cancelled) return;
        const active = (data?.subjects || []).filter((subject) => subject.isActive);
        setSubjects(active);
      })
      .catch((error) => {
        if (!cancelled) setSubjectsError(error.message || "Failed to load subjects.");
      })
      .finally(() => {
        if (!cancelled) setSubjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSubmissions = () => {
    setListLoading(true);
    setListError("");
    getAdminDemoSubmissions()
      .then((data) => setSubmissions(data?.submissions || []))
      .catch((error) => setListError(error.message || "Failed to load completed demos."))
      .finally(() => setListLoading(false));
  };

  useEffect(() => {
    if (view === "list") {
      loadSubmissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    if (wizard.step !== "review-question" || !wizard.questionImageDataUrl) return;
    if (ocrRequestedForRef.current === wizard.questionImageDataUrl) return;
    ocrRequestedForRef.current = wizard.questionImageDataUrl;

    setOcrLoading(true);
    setOcrError("");
    ocrHandwrittenNote(wizard.questionImageDataUrl, wizard.subjectCode)
      .then((result) => {
        setWizard((current) => ({ ...current, questionText: result?.text || "" }));
        if (!result?.text) {
          setOcrError("We couldn't find any text in that image -- you can still type/edit the question below.");
        }
      })
      .catch((error) => setOcrError(error.message || "Failed to read the question image."))
      .finally(() => setOcrLoading(false));
  }, [wizard.step, wizard.questionImageDataUrl]);

  const goToStep = (step) => setWizard((current) => ({ ...current, step }));

  const startNewDemo = () => {
    setWizard(emptyWizardState());
    setWizardKey((key) => key + 1);
    setPdfPages([]);
    setPdfFileName("");
    setPdfError("");
    setOcrError("");
    ocrRequestedForRef.current = "";
    setSubmitError("");
    setSubmission(null);
    setView("new");
  };

  // Reuses a completed demo's already-captured, already-OCR'd question --
  // skips subject/capture/review-question entirely and drops straight into
  // answer capture, so the same question can be re-demoed with a different
  // answer without recapturing/rescanning it. "Back" from capture-answer
  // still lands on review-question with the reused question pre-filled, so
  // nothing is lost if the admin wants to double-check/edit it first.
  const handleReuse = (row) => {
    setWizard({
      step: "capture-answer",
      subjectId: row.subjectId,
      subjectName: row.subjectName,
      subjectCode: row.subjectCode,
      captureMethod: row.captureMethod,
      questionImageDataUrl: row.questionImageData,
      questionText: row.questionText || "",
      answerText: "",
      answerPages: [],
    });
    setWizardKey((key) => key + 1);
    setPdfPages([]);
    setPdfFileName("");
    setPdfError("");
    setOcrError("");
    // The question was already OCR'd when this demo was originally
    // captured -- pre-arm the guard so backing into review-question
    // doesn't fire a redundant re-OCR of the same image.
    ocrRequestedForRef.current = row.questionImageData;
    setSubmitError("");
    setSubmission(null);
    setViewingSubmission(null);
    setView("new");
  };

  const handlePdfUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setPdfError("");
    setPdfSplitting(true);
    try {
      const result = await splitPdfIntoPages(file);
      setPdfPages(result.pages);
      setPdfFileName(result.fileName);
    } catch (error) {
      setPdfError(error.message || "Failed to read that PDF. Please try a different file.");
    } finally {
      setPdfSplitting(false);
    }
  };

  const handleCropSave = (croppedDataUrl) => {
    setWizard((current) => ({
      ...current,
      captureMethod: "pdf_page",
      questionImageDataUrl: croppedDataUrl,
      step: "review-question",
    }));
    setCropPage(null);
  };

  const handleCameraCapture = (dataUrl) => {
    setCameraOpen(false);
    setWizard((current) => ({
      ...current,
      captureMethod: "camera_photo",
      questionImageDataUrl: dataUrl,
      step: "review-question",
    }));
  };

  const handleAnswerChange = (joinedText, pages) => {
    setWizard((current) => ({ ...current, answerText: joinedText, answerPages: pages }));
  };

  const canContinueAnswer =
    wizard.answerText.trim().length > 0 || extractSourcePageImages(wizard.answerPages).length > 0;

  const handleSubmit = async () => {
    setSubmitBusy(true);
    setSubmitError("");
    try {
      const result = await submitAdminDemoAssessment({
        subjectId: wizard.subjectId,
        captureMethod: wizard.captureMethod,
        questionImageDataUrl: wizard.questionImageDataUrl,
        questionText: wizard.questionText,
        answerText: wizard.answerText,
        answerSourceImages: extractSourcePageImages(wizard.answerPages),
      });
      setSubmission(result?.submission || null);
      goToStep("feedback");
    } catch (error) {
      setSubmitError(error.message || "Failed to submit the demo assessment.");
    } finally {
      setSubmitBusy(false);
    }
  };

  const handleDelete = async (submissionId) => {
    const confirmed = window.confirm("Delete this demo submission? This cannot be undone.");
    if (!confirmed) return;
    setDeleteBusyId(submissionId);
    try {
      await deleteAdminDemoSubmission(submissionId);
      setSubmissions((current) => current.filter((row) => String(row.id) !== String(submissionId)));
    } catch (error) {
      setListError(error.message || "Failed to delete that submission.");
    } finally {
      setDeleteBusyId("");
    }
  };

  const stepIndex = STEPS.indexOf(wizard.step);

  return (
    <section className="admin-bulk-pipeline-page admin-ai-demo-page">
      <header className="admin-bulk-pipeline-header">
        <div>
          <span className="eyebrow">Admin module</span>
          <h1>AI Assessment Demo</h1>
          <p>
            Photograph or scan any question from any subject, capture a handwritten (or typed) answer, and
            run a real, world-class AI assessment -- independent of the curriculum pipeline, for live demos.{" "}
            <Link to="/admin/ai-assessment-studio/demo-model-settings">Configure OCR/grading models per subject</Link>.
          </p>
        </div>
        <div className="admin-bulk-pipeline-header-actions">
          <button
            type="button"
            className={view === "new" ? "primary-button" : "ghost-button"}
            onClick={startNewDemo}
          >
            + New Demo
          </button>
          <button
            type="button"
            className={view === "list" ? "primary-button" : "ghost-button"}
            onClick={() => setView("list")}
          >
            Completed Demos
          </button>
        </div>
      </header>

      {view === "new" && (
        <div className="admin-ai-demo-wizard" key={wizardKey}>
          <ol className="admin-ai-demo-stepper">
            {STEPS.filter((step) => step !== "feedback").map((step, index) => (
              <li
                key={step}
                className={`admin-ai-demo-step ${
                  index === stepIndex ? "is-active" : index < stepIndex ? "is-done" : ""
                }`}
              >
                {STEP_LABELS[step]}
              </li>
            ))}
          </ol>

          {wizard.step === "subject" && (
            <div className="admin-ai-demo-panel">
              <h2>1. Pick a subject</h2>
              {subjectsError && <p className="error-text">{subjectsError}</p>}
              {subjectsLoading ? (
                <p className="admin-workbench-muted">Loading subjects...</p>
              ) : (
                <div className="admin-ai-demo-subject-grid">
                  {subjects.map((subject) => (
                    <button
                      key={subject.id}
                      type="button"
                      className={`admin-ai-demo-subject-card ${
                        wizard.subjectId === subject.id ? "is-selected" : ""
                      }`}
                      onClick={() =>
                        setWizard((current) => ({
                          ...current,
                          subjectId: subject.id,
                          subjectName: subject.name,
                          subjectCode: subject.nameCode,
                        }))
                      }
                    >
                      {subject.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="admin-ai-demo-actions">
                <button
                  type="button"
                  className="primary-button"
                  disabled={!wizard.subjectId}
                  onClick={() => goToStep("capture")}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {wizard.step === "capture" && (
            <div className="admin-ai-demo-panel">
              <h2>2. Capture the question -- {wizard.subjectName}</h2>
              <div className="admin-ai-demo-option-grid">
                <div className="admin-ai-demo-option-card">
                  <h3>Option 1: Upload PDF</h3>
                  <p>Upload a chapter/paper PDF, split into pages, pick a page, then crop it.</p>
                  <label className="admin-studio-file-upload">
                    <input type="file" accept="application/pdf" hidden onChange={handlePdfUpload} disabled={pdfSplitting} />
                    <strong>{pdfSplitting ? "Splitting PDF..." : pdfFileName ? "Replace PDF" : "Choose PDF"}</strong>
                    <small>{pdfFileName || "Splits client-side into page images."}</small>
                  </label>
                  {pdfError && <p className="error-text">{pdfError}</p>}
                </div>
                <div className="admin-ai-demo-option-card">
                  <h3>Option 2: Take Photo</h3>
                  <p>Use the camera to photograph the question directly.</p>
                  <button type="button" className="primary-button" onClick={() => setCameraOpen(true)}>
                    Open Camera
                  </button>
                </div>
              </div>

              {pdfPages.length > 0 && (
                <div className="admin-ai-demo-page-grid">
                  {pdfPages.map((page) => (
                    <button
                      key={page.pageNumber}
                      type="button"
                      className="admin-source-builder-page-thumb"
                      onClick={() => setCropPage(page)}
                    >
                      <span className="admin-source-builder-page-thumb-number">{page.pageNumber}</span>
                      <span
                        className="admin-source-builder-page-thumb-expand"
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          setLightboxPage(page);
                        }}
                      >
                        &#x26F6;
                      </span>
                      <img src={page.dataUrl} alt={`Page ${page.pageNumber}`} />
                    </button>
                  ))}
                </div>
              )}

              {cameraOpen && <StudentCameraCapture onCapture={handleCameraCapture} onCancel={() => setCameraOpen(false)} />}

              <div className="admin-ai-demo-actions">
                <button type="button" className="ghost-button" onClick={() => goToStep("subject")}>
                  Back
                </button>
              </div>
            </div>
          )}

          {wizard.step === "review-question" && (
            <div className="admin-ai-demo-panel">
              <h2>3. Review the question</h2>
              <div className="admin-ai-demo-review-grid">
                <img src={wizard.questionImageDataUrl} alt="Captured question" className="admin-ai-demo-review-image" />
                <div>
                  {ocrLoading ? (
                    <p className="admin-workbench-muted">Reading the question (OCR + LaTeX)...</p>
                  ) : (
                    <>
                      {ocrError && <p className="error-text">{ocrError}</p>}
                      <EquationDisplay
                        value={wizard.questionText}
                        onChange={(next) => setWizard((current) => ({ ...current, questionText: next }))}
                        placeholder="Question text (edit if OCR missed anything)"
                      />
                    </>
                  )}
                </div>
              </div>
              <div className="admin-ai-demo-actions">
                <button type="button" className="ghost-button" onClick={() => goToStep("capture")}>
                  Back
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={ocrLoading}
                  onClick={() => goToStep("capture-answer")}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {wizard.step === "capture-answer" && (
            <div className="admin-ai-demo-panel">
              <h2>4. Capture the answer</h2>
              <p className="admin-workbench-muted">
                Type the answer, and/or capture up to 5 photo pages of a handwritten answer.
              </p>
              <StudentMultiPageAnswerInput
                value={wizard.answerText}
                onChange={handleAnswerChange}
                resetKey={wizardKey}
                subjectCode={wizard.subjectCode}
              />
              <div className="admin-ai-demo-actions">
                <button type="button" className="ghost-button" onClick={() => goToStep("review-question")}>
                  Back
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={!canContinueAnswer}
                  onClick={() => goToStep("review")}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {wizard.step === "review" && (
            <div className="admin-ai-demo-panel">
              <h2>5. Review before submitting</h2>
              <div className="admin-ai-demo-review-summary">
                <p>
                  <strong>Subject:</strong> {wizard.subjectName}
                </p>
                <div className="admin-ai-demo-review-grid">
                  <img src={wizard.questionImageDataUrl} alt="Question" className="admin-ai-demo-review-image" />
                  <div>
                    <strong>Question</strong>
                    <EquationDisplay value={wizard.questionText} placeholder="(no transcribed text)" />
                  </div>
                </div>
                <div>
                  <strong>Answer</strong>
                  <EquationDisplay value={wizard.answerText} placeholder="(no transcribed text)" />
                  {extractSourcePageImages(wizard.answerPages).length > 0 && (
                    <div className="admin-ai-demo-page-grid">
                      {extractSourcePageImages(wizard.answerPages).map((page) => (
                        <img key={page.order} src={page.imageData} alt={`Answer page ${page.order}`} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {submitError && <p className="error-text">{submitError}</p>}
              <div className="admin-ai-demo-actions">
                <button type="button" className="ghost-button" onClick={() => goToStep("capture-answer")} disabled={submitBusy}>
                  Back
                </button>
                <button type="button" className="primary-button" disabled={submitBusy} onClick={handleSubmit}>
                  {submitBusy ? "Grading with AI..." : "Submit for AI Assessment"}
                </button>
              </div>
            </div>
          )}

          {wizard.step === "feedback" && submission && (
            <div className="admin-ai-demo-panel">
              <h2>6. Feedback</h2>
              <span
                className={`admin-bulk-pipeline-status-badge ${
                  submission.aiIsCorrect ? "is-completed" : "is-failed"
                }`}
              >
                {submission.aiIsCorrect ? "Correct" : "Needs Work"}
              </span>
              <div className="admin-ai-demo-feedback-block">
                <strong>Ideal answer</strong>
                <EquationDisplay value={submission.aiIdealAnswer} />
              </div>
              <div className="admin-ai-demo-feedback-block">
                <strong>Feedback</strong>
                <EquationDisplay value={submission.aiFeedback} />
              </div>
              {submission.modelName && <p className="admin-workbench-muted">Model: {submission.modelName}</p>}
              <div className="admin-ai-demo-actions">
                <button type="button" className="primary-button" onClick={startNewDemo}>
                  Start Another Demo
                </button>
                <button type="button" className="ghost-button" onClick={() => setView("list")}>
                  View Completed Demos
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {view === "list" && (
        <>
          {listError && <p className="error-text">{listError}</p>}
          <div className="admin-bulk-pipeline-grid-shell">
            {listLoading ? (
              <div className="admin-bulk-pipeline-empty">Loading completed demos...</div>
            ) : submissions.length === 0 ? (
              <div className="admin-bulk-pipeline-empty">No demo submissions yet. Start a new demo above.</div>
            ) : (
              <table className="admin-exam-types-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Question</th>
                    <th>Verdict</th>
                    <th>Submitted</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((row) => (
                    <tr key={row.id}>
                      <td>{row.subjectName}</td>
                      <td>{truncate(row.questionText) || "(image only)"}</td>
                      <td>
                        <span
                          className={`admin-bulk-pipeline-status-badge ${
                            row.aiIsCorrect ? "is-completed" : "is-failed"
                          }`}
                        >
                          {row.aiIsCorrect ? "Correct" : "Needs Work"}
                        </span>
                      </td>
                      <td className="admin-pipeline-runs-datetime">{formatDateTime(row.createdAt)}</td>
                      <td className="admin-ai-demo-row-actions">
                        <button type="button" className="ghost-button is-compact" onClick={() => setViewingSubmission(row)}>
                          View
                        </button>
                        <button type="button" className="ghost-button is-compact" onClick={() => handleReuse(row)}>
                          Reuse
                        </button>
                        <button
                          type="button"
                          className="ghost-button is-compact admin-pipeline-runs-danger"
                          disabled={deleteBusyId === row.id}
                          onClick={() => handleDelete(row.id)}
                        >
                          {deleteBusyId === row.id ? "Deleting..." : "Delete"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {lightboxPage && (
        <AdminPdfPageLightbox pageNumber={lightboxPage.pageNumber} dataUrl={lightboxPage.dataUrl} onClose={() => setLightboxPage(null)} />
      )}

      {cropPage && (
        <div className="modal-backdrop" onClick={() => setCropPage(null)}>
          <div className="modal-panel is-wide" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close-button" aria-label="Close" onClick={() => setCropPage(null)}>
              &times;
            </button>
            <h2>Crop Page {cropPage.pageNumber}</h2>
            <AdminImageCropEditor imageDataUrl={cropPage.dataUrl} onSave={handleCropSave} onCancel={() => setCropPage(null)} />
          </div>
        </div>
      )}

      {viewingSubmission && (
        <div className="modal-backdrop" onClick={() => setViewingSubmission(null)}>
          <div className="modal-panel is-wide" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close-button" aria-label="Close" onClick={() => setViewingSubmission(null)}>
              &times;
            </button>
            <h2>{viewingSubmission.subjectName} demo</h2>
            <div className="admin-ai-demo-panel admin-ai-demo-panel-in-modal">
              <div className="admin-ai-demo-actions">
                <span
                  className={`admin-bulk-pipeline-status-badge ${
                    viewingSubmission.aiIsCorrect ? "is-completed" : "is-failed"
                  }`}
                >
                  {viewingSubmission.aiIsCorrect ? "Correct" : "Needs Work"}
                </span>
                <button type="button" className="ghost-button is-compact" onClick={() => handleReuse(viewingSubmission)}>
                  Reuse This Question
                </button>
              </div>
              <div className="admin-ai-demo-review-grid">
                <img src={viewingSubmission.questionImageData} alt="Question" className="admin-ai-demo-review-image" />
                <div>
                  <strong>Question</strong>
                  <EquationDisplay value={viewingSubmission.questionText} placeholder="(no transcribed text)" />
                </div>
              </div>
              <div className="admin-ai-demo-feedback-block">
                <strong>Answer</strong>
                <EquationDisplay value={viewingSubmission.answerText} placeholder="(no transcribed text)" />
                {(viewingSubmission.answerSourceImages || []).length > 0 && (
                  <div className="admin-ai-demo-page-grid">
                    {viewingSubmission.answerSourceImages.map((page) => (
                      <img key={page.order} src={page.imageData} alt={`Answer page ${page.order}`} />
                    ))}
                  </div>
                )}
              </div>
              <div className="admin-ai-demo-feedback-block">
                <strong>Ideal answer</strong>
                <EquationDisplay value={viewingSubmission.aiIdealAnswer} />
              </div>
              <div className="admin-ai-demo-feedback-block">
                <strong>Feedback</strong>
                <EquationDisplay value={viewingSubmission.aiFeedback} />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
