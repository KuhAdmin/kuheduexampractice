const API_ROOT = "/api";

const GENERIC_SERVER_ERROR_MESSAGE =
  "We're having trouble completing that right now. Please try again in a moment.";

const readJson = async (response) => {
  if (response.status === 204) {
    return null;
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status >= 500) {
      throw new Error(GENERIC_SERVER_ERROR_MESSAGE);
    }
    throw new Error(data?.message || `Request failed with status ${response.status}.`);
  }

  return data;
};

export const apiRequest = async (path, options = {}) => {
  const token = localStorage.getItem("kuhedu_token");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch (error) {
   throw new Error(
  `Unable to connect to the KUHEDU server. Please check your internet connection and try again. ${
    error.message || ""
  }`.trim()
);
  }

  return readJson(response);
};

const buildQuery = (params = {}) => {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, value);
    }
  });

  return search.toString();
};

export const getStudentSections = async (chapterNumber, { examGoalCode, levelCode, subjectCode } = {}) =>
  apiRequest(`/user/sections?${buildQuery({ chapterNumber, examGoalCode, levelCode, subjectCode })}`);

export const getClassSubjectOptions = async () => apiRequest("/user/class-subject-options");

export const getChaptersForSelection = async ({ examGoalCode, levelCode, subjectCode }) =>
  apiRequest(`/user/chapters-for-selection?${buildQuery({ examGoalCode, levelCode, subjectCode })}`);

export const getDashboardForSelection = async ({ examGoalCode, levelCode, subjectCode }) =>
  apiRequest(`/user/dashboard-for-selection?${buildQuery({ examGoalCode, levelCode, subjectCode })}`);

export const getRemainingConcepts = async () => apiRequest("/user/goals/remaining-concepts");

export const createPremiumOrder = async ({ plan } = {}) =>
  apiRequest("/user/payments/create-order", { method: "POST", body: JSON.stringify({ plan }) });

export const verifyPremiumPayment = async ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) =>
  apiRequest("/user/payments/verify", {
    method: "POST",
    body: JSON.stringify({ razorpayOrderId, razorpayPaymentId, razorpaySignature }),
  });

export const verifyPremiumSubscription = async ({ razorpaySubscriptionId, razorpayPaymentId, razorpaySignature }) =>
  apiRequest("/user/payments/verify", {
    method: "POST",
    body: JSON.stringify({ razorpaySubscriptionId, razorpayPaymentId, razorpaySignature }),
  });

export const getMySubscription = async () => apiRequest("/user/payments/subscription");

export const cancelMySubscription = async ({ razorpaySubscriptionId }) =>
  apiRequest("/user/payments/subscription/cancel", {
    method: "POST",
    body: JSON.stringify({ razorpaySubscriptionId }),
  });

export const getNotifications = async () => apiRequest("/user/notifications");

export const markNotificationsSeen = async () =>
  apiRequest("/user/notifications/mark-seen", { method: "POST" });

export const getStudentSectionOverview = async (sourceSectionId) =>
  apiRequest(`/user/sections/${sourceSectionId}/overview`);

export const getStudentLearningMap = async (sourceSectionId) =>
  apiRequest(`/user/sections/${sourceSectionId}/learning-map`);

export const getStudentMemoryBoosterForSection = async (sourceSectionId) =>
  apiRequest(`/user/sections/${sourceSectionId}/memory-booster`);

export const getStudentFlashcards = async (sourceSectionId) =>
  apiRequest(`/user/sections/${sourceSectionId}/flashcards`);

export const getStudentRevision = async (sourceSectionId) =>
  apiRequest(`/user/sections/${sourceSectionId}/revision`);

export const getStudentTutorNotes = async (sourceSectionId) =>
  apiRequest(`/user/sections/${sourceSectionId}/tutor-notes`);

export const getStudentTextbookContent = async (sourceSectionId) =>
  apiRequest(`/user/sections/${sourceSectionId}/textbook-content`);

export const getTextbookActivityResponse = async (activityKey) =>
  apiRequest(`/user/textbook-activities/${encodeURIComponent(activityKey)}/response`);

export const submitTextbookActivityResponse = async (activityKey, responseText, sourcePageImages) =>
  apiRequest(`/user/textbook-activities/${encodeURIComponent(activityKey)}/respond`, {
    method: "POST",
    body: JSON.stringify({ responseText, sourcePageImages }),
  });

export const getChallengeResponse = async (responseKey) =>
  apiRequest(`/user/challenges/${encodeURIComponent(responseKey)}/response`);

export const submitChallengeResponse = async (responseKey, responseText, sourcePageImages) =>
  apiRequest(`/user/challenges/${encodeURIComponent(responseKey)}/respond`, {
    method: "POST",
    body: JSON.stringify({ responseText, sourcePageImages }),
  });

export const getStudentDiagrams = async (sourceSectionId) =>
  apiRequest(`/user/sections/${sourceSectionId}/diagrams`);

export const getStudentVisualLearningItems = async (sourceSectionId) =>
  apiRequest(`/user/sections/${sourceSectionId}/visual-learning`);

export const getStudentDiagramMedia = async (diagramId) =>
  apiRequest(`/user/diagrams/${diagramId}/media`);

export const getStudentConceptCard = async (assessmentUnitId) =>
  apiRequest(`/user/concepts/${assessmentUnitId}/card`);

export const getStudentConceptChallenges = async (assessmentUnitId) =>
  apiRequest(`/user/concepts/${assessmentUnitId}/challenges`);

export const getStudentConceptSectionMedia = async (assessmentUnitId, sectionKey) =>
  apiRequest(`/user/concepts/${assessmentUnitId}/memory-hook-media/${sectionKey}`);

export const uploadStudentConceptSectionMedia = async (assessmentUnitId, sectionKey, { dataUrl, fileName }) =>
  apiRequest(`/user/concepts/${assessmentUnitId}/memory-hook-media/${sectionKey}/upload`, {
    method: "POST",
    body: JSON.stringify({ dataUrl, fileName }),
  });

export const getStudentMemoryBoosterForUnit = async (assessmentUnitId) =>
  apiRequest(`/user/concepts/${assessmentUnitId}/memory-booster`);

export const askConceptTutor = async (assessmentUnitId, { mode, question }) =>
  apiRequest(`/user/concepts/${assessmentUnitId}/tutor`, {
    method: "POST",
    body: JSON.stringify({ mode, question }),
  });

export const getConceptTutorVoiceToken = async (assessmentUnitId, mode) =>
  apiRequest(`/user/concepts/${assessmentUnitId}/tutor/voice-token`, {
    method: "POST",
    body: JSON.stringify({ mode }),
  });

export const getTutorAvatarToken = async () =>
  apiRequest(`/user/tutor/avatar-token`, { method: "POST" });

export const getTutorUsage = async () => apiRequest("/user/tutor/usage");

export const postTutorVoiceUsage = async (seconds) =>
  apiRequest("/user/tutor/voice-usage", {
    method: "POST",
    body: JSON.stringify({ seconds }),
  });

export const captureConceptPracticeQuestion = async (assessmentUnitId, imageDataUrl) =>
  apiRequest(`/user/concepts/${assessmentUnitId}/practice-capture/question`, {
    method: "POST",
    body: JSON.stringify({ imageDataUrl }),
  });

export const captureConceptPracticeAnswer = async (assessmentUnitId, imageDataUrl) =>
  apiRequest(`/user/concepts/${assessmentUnitId}/practice-capture/answer`, {
    method: "POST",
    body: JSON.stringify({ imageDataUrl }),
  });

export const submitConceptPracticeGrading = async (assessmentUnitId, { questionText, answerText }) =>
  apiRequest(`/user/concepts/${assessmentUnitId}/practice-capture/grade`, {
    method: "POST",
    body: JSON.stringify({ questionText, answerText }),
  });

export const getEinsteinChallenge = async (assessmentUnitId) =>
  apiRequest(`/user/concepts/${assessmentUnitId}/einstein-mode/challenge`, { method: "POST" });

export const submitEinsteinRecognition = async (assessmentUnitId, { targetObject, imageDataUrl }) =>
  apiRequest(`/user/concepts/${assessmentUnitId}/einstein-mode/recognize`, {
    method: "POST",
    body: JSON.stringify({ targetObject, imageDataUrl }),
  });

export const getVivaQuestions = async (assessmentUnitId) =>
  apiRequest(`/user/concepts/${assessmentUnitId}/viva/questions`, { method: "POST" });

export const getVivaFeedback = async (assessmentUnitId, { question, answerText }) =>
  apiRequest(`/user/concepts/${assessmentUnitId}/viva/feedback`, {
    method: "POST",
    body: JSON.stringify({ question, answerText }),
  });

export const getStudentMindMap = async (sourceSectionId) =>
  apiRequest(`/user/sections/${sourceSectionId}/mind-map`);

export const startSectionAssessment = async (sourceSectionId) =>
  apiRequest(`/user/sections/${sourceSectionId}/assessment/start`, { method: "POST" });

export const restartSectionAssessment = async (sourceSectionId) =>
  apiRequest(`/user/sections/${sourceSectionId}/assessment/restart`, { method: "POST" });

export const getRecentAssessmentAttempts = async (sourceSectionId) =>
  apiRequest(`/user/sections/${sourceSectionId}/assessment/attempts`);

export const startConceptAssessment = async (assessmentUnitId) =>
  apiRequest(`/user/concepts/${assessmentUnitId}/assessment/start`, { method: "POST" });

export const restartConceptAssessment = async (assessmentUnitId) =>
  apiRequest(`/user/concepts/${assessmentUnitId}/assessment/restart`, { method: "POST" });

export const getRecentConceptAssessmentAttempts = async (assessmentUnitId) =>
  apiRequest(`/user/concepts/${assessmentUnitId}/assessment/attempts`);

export const startChapterAssessment = async (chapterNumber) =>
  apiRequest(`/user/chapters/${chapterNumber}/assessment/start`, { method: "POST" });

export const restartChapterAssessment = async (chapterNumber) =>
  apiRequest(`/user/chapters/${chapterNumber}/assessment/restart`, { method: "POST" });

export const getRecentChapterAssessmentAttempts = async (chapterNumber) =>
  apiRequest(`/user/chapters/${chapterNumber}/assessment/attempts`);

export const submitAssessmentAnswer = async (
  attemptId,
  displayOrder,
  studentAnswer,
  timeTakenSeconds,
  sourcePageImages
) =>
  apiRequest(`/user/attempts/${attemptId}/items/${displayOrder}/answer`, {
    method: "POST",
    body: JSON.stringify({ studentAnswer, timeTakenSeconds, sourcePageImages }),
  });

export const ocrHandwrittenNote = async (imageDataUrl, subjectCode) =>
  apiRequest("/user/ocr/handwritten-note", {
    method: "POST",
    body: JSON.stringify({ imageDataUrl, subjectCode }),
  });

export const getMicroActivityResponse = async (assessmentUnitId) =>
  apiRequest(`/user/concepts/${assessmentUnitId}/micro-activity/response`);

export const submitMicroActivityResponse = async (assessmentUnitId, responseText, sourcePageImages) =>
  apiRequest(`/user/concepts/${assessmentUnitId}/micro-activity/respond`, {
    method: "POST",
    body: JSON.stringify({ responseText, sourcePageImages }),
  });

export const submitAssessment = async (attemptId) =>
  apiRequest(`/user/attempts/${attemptId}/submit`, { method: "POST" });

export const getAssessmentResult = async (attemptId) =>
  apiRequest(`/user/attempts/${attemptId}/result`);

export const getAdminUsers = async () => apiRequest("/admin/users");

export const createAdminUser = async ({ name, email, password, role }) =>
  apiRequest("/admin/users", {
    method: "POST",
    body: JSON.stringify({ name, email, password, role }),
  });

export const updateAdminUserRole = async (userId, role) =>
  apiRequest(`/admin/users/${userId}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  });

export const getAdminExamTypes = async () => apiRequest("/admin/exam-types");

export const createAdminExamType = async ({ typeId, name }) =>
  apiRequest("/admin/exam-types", {
    method: "POST",
    body: JSON.stringify({ typeId, name }),
  });

export const updateAdminExamType = async (examTypeId, { typeId, name }) =>
  apiRequest(`/admin/exam-types/${examTypeId}`, {
    method: "PUT",
    body: JSON.stringify({ typeId, name }),
  });

export const deleteAdminExamType = async (examTypeId) =>
  apiRequest(`/admin/exam-types/${examTypeId}`, {
    method: "DELETE",
  });

export const getAdminExamGoals = async () => apiRequest("/admin/exam-goals");

export const getAdminExamGoalOptions = async () => apiRequest("/admin/exam-goals/options");

export const createAdminExamGoal = async ({ goalId, name, examTypeId, stateId, isActive }) =>
  apiRequest("/admin/exam-goals", {
    method: "POST",
    body: JSON.stringify({ goalId, name, examTypeId, stateId, isActive }),
  });

export const updateAdminExamGoal = async (examGoalId, { goalId, name, examTypeId, stateId, isActive }) =>
  apiRequest(`/admin/exam-goals/${examGoalId}`, {
    method: "PUT",
    body: JSON.stringify({ goalId, name, examTypeId, stateId, isActive }),
  });

export const deleteAdminExamGoal = async (examGoalId) =>
  apiRequest(`/admin/exam-goals/${examGoalId}`, {
    method: "DELETE",
  });

export const getAdminLevels = async () => apiRequest("/admin/levels");

export const createAdminLevel = async ({ nameCode, name, displayOrder }) =>
  apiRequest("/admin/levels", {
    method: "POST",
    body: JSON.stringify({ nameCode, name, displayOrder }),
  });

export const updateAdminLevel = async (levelId, { nameCode, name, displayOrder }) =>
  apiRequest(`/admin/levels/${levelId}`, {
    method: "PUT",
    body: JSON.stringify({ nameCode, name, displayOrder }),
  });

export const deleteAdminLevel = async (levelId) =>
  apiRequest(`/admin/levels/${levelId}`, {
    method: "DELETE",
  });

export const getAdminSubjects = async () => apiRequest("/admin/subjects");

export const createAdminSubject = async ({ nameCode, name, displayOrder, isActive }) =>
  apiRequest("/admin/subjects", {
    method: "POST",
    body: JSON.stringify({ nameCode, name, displayOrder, isActive }),
  });

export const updateAdminSubject = async (subjectId, { nameCode, name, displayOrder, isActive }) =>
  apiRequest(`/admin/subjects/${subjectId}`, {
    method: "PUT",
    body: JSON.stringify({ nameCode, name, displayOrder, isActive }),
  });

export const deleteAdminSubject = async (subjectId) =>
  apiRequest(`/admin/subjects/${subjectId}`, {
    method: "DELETE",
  });

export const getAdminBooks = async () => apiRequest("/admin/books");

export const getAdminBookOptions = async () => apiRequest("/admin/books/options");

export const createAdminBook = async ({
  nameCode,
  name,
  subjectId,
  levelId,
  examGoalId,
  displayOrder,
  isActive,
}) =>
  apiRequest("/admin/books", {
    method: "POST",
    body: JSON.stringify({ nameCode, name, subjectId, levelId, examGoalId, displayOrder, isActive }),
  });

export const updateAdminBook = async (
  bookId,
  { nameCode, name, subjectId, levelId, examGoalId, displayOrder, isActive }
) =>
  apiRequest(`/admin/books/${bookId}`, {
    method: "PUT",
    body: JSON.stringify({ nameCode, name, subjectId, levelId, examGoalId, displayOrder, isActive }),
  });

export const deleteAdminBook = async (bookId) =>
  apiRequest(`/admin/books/${bookId}`, {
    method: "DELETE",
  });

export const uploadAdminBooksBulk = async ({ fileName, dataUrl }) =>
  apiRequest("/admin/books/bulk-upload", {
    method: "POST",
    body: JSON.stringify({ fileName, dataUrl }),
  });

// Streams newline-delimited JSON progress events from postConceptImport
// (server/src/controllers/adminConceptImportController.js) as the import
// actually runs, calling onEvent for each one, so the caller can render a
// live log of concept nodes instead of waiting for the whole import to
// finish. Still resolves to { summary } like a normal apiRequest call once
// the stream ends, for callers that only care about the final result.
export const uploadConceptImport = async ({ payload, onEvent }) => {
  const token = localStorage.getItem("kuhedu_token");
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_ROOT}/admin/concept-import`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ payload }),
    });
  } catch (error) {
    throw new Error(
      `Unable to connect to the KUHEDU server. Please check your internet connection and try again. ${
        error.message || ""
      }`.trim()
    );
  }

  // A shape-validation failure responds with a normal JSON body before any
  // streaming starts (see the controller) -- detected by content-type, since
  // response.ok alone can't tell a pre-stream 400 apart from a 200 stream
  // that later reports a {type:"error"} line.
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/x-ndjson")) {
    return readJson(response);
  }
  if (!response.body) {
    throw new Error("This browser doesn't support streaming responses.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let summary = null;
  let streamError = null;

  const consumeLine = (line) => {
    if (!line.trim()) return;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }
    if (event.type === "summary") {
      summary = event.summary;
    } else if (event.type === "error") {
      streamError = event.message;
    }
    onEvent?.(event);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    lines.forEach(consumeLine);
  }
  if (buffer) {
    consumeLine(buffer);
  }

  if (streamError) {
    throw new Error(streamError);
  }
  if (!summary) {
    throw new Error("The import stream ended without a summary.");
  }
  return { summary };
};

export const getMemoryHookMedia = async (assessmentUnitId) =>
  apiRequest(`/admin/media/memory-hooks/${assessmentUnitId}`);

export const uploadMemoryHookMedia = async (assessmentUnitId, sectionKey, dataUrl, fileName) =>
  apiRequest(`/admin/media/memory-hooks/${assessmentUnitId}/${sectionKey}/upload`, {
    method: "POST",
    body: JSON.stringify({ dataUrl, fileName }),
  });

export const getAssessmentUnitDiagrams = async (assessmentUnitId) =>
  apiRequest(`/admin/media/diagrams/unit/${assessmentUnitId}`);

export const getDiagramMedia = async (diagramId) =>
  apiRequest(`/admin/media/diagrams/${diagramId}`);

export const uploadDiagramMedia = async (diagramId, dataUrl, fileName) =>
  apiRequest(`/admin/media/diagrams/${diagramId}/upload`, {
    method: "POST",
    body: JSON.stringify({ dataUrl, fileName }),
  });

export const getContentEditorBooks = async () => apiRequest("/admin/content-editor/books");

export const getContentEditorChapters = async (bookId) =>
  apiRequest(`/admin/content-editor/books/${bookId}/chapters`);

export const getContentEditorCards = async (sourceSectionId) =>
  apiRequest(`/admin/content-editor/sections/${sourceSectionId}/cards`);

export const updateContentEditorCard = async (cardId, { title, summary, details, isHidden }) =>
  apiRequest(`/admin/content-editor/cards/${cardId}`, {
    method: "PUT",
    body: JSON.stringify({ title, summary, details, isHidden }),
  });

export const regenerateContentCardImage = async (cardId, prompt) =>
  apiRequest(`/admin/content-editor/cards/${cardId}/regenerate-image`, {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });

export const regenerateMemoryHookImage = async (assessmentUnitId, sectionKey, prompt) =>
  apiRequest(`/admin/content-editor/memory-hooks/${assessmentUnitId}/${sectionKey}/regenerate-image`, {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });

export const updateMemoryHookPrompt = async (assessmentUnitId, sectionKey, prompt) =>
  apiRequest(`/admin/content-editor/memory-hooks/${assessmentUnitId}/${sectionKey}/prompt`, {
    method: "PUT",
    body: JSON.stringify({ prompt }),
  });

export const generateMemoryHookPrompt = async (assessmentUnitId, sectionKey) =>
  apiRequest(`/admin/content-editor/memory-hooks/${assessmentUnitId}/${sectionKey}/generate-prompt`, {
    method: "POST",
  });

export const uploadChapterExercise = async (bookId, chapterNumber, { dataUrl, mimeType, chapterName }) =>
  apiRequest(`/admin/chapter-exercises/${bookId}/${chapterNumber}/upload`, {
    method: "POST",
    body: JSON.stringify({ dataUrl, mimeType, chapterName }),
  });

export const getPendingChapterExerciseQuestions = async (bookId, chapterNumber) =>
  apiRequest(`/admin/chapter-exercises/${bookId}/${chapterNumber}/pending`);

export const reviewChapterExerciseQuestion = async (questionId, decision) =>
  apiRequest(`/admin/chapter-exercises/${questionId}/review`, {
    method: "POST",
    body: JSON.stringify({ decision }),
  });

export const getBookQuestions = async (chapterNumber) =>
  apiRequest(`/user/chapters/${chapterNumber}/book-questions`);

export const submitBookQuestionResponse = async (chapterNumber, questionId, studentAnswer, sourcePageImages) =>
  apiRequest(`/user/chapters/${chapterNumber}/book-questions/${questionId}/respond`, {
    method: "POST",
    body: JSON.stringify({ studentAnswer, sourcePageImages }),
  });

export const getAdminOverviewStats = async () => apiRequest("/admin/overview");

export const getAdminOrders = async (params) => apiRequest(`/admin/orders?${buildQuery(params)}`);

export const getAdminOrdersSummary = async (params) => apiRequest(`/admin/orders/summary?${buildQuery(params)}`);

// A plain <a href> download can't attach the Bearer header this app's auth
// relies on, so the export button does an authenticated fetch and downloads
// the resulting Blob itself (see AdminOrdersPage.jsx) instead of going
// through apiRequest, which assumes a JSON response.
export const fetchAdminOrdersExportBlob = async (params) => {
  const token = localStorage.getItem("kuhedu_token");
  const response = await fetch(`/api/admin/orders/export?${buildQuery(params)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to export orders.");
  }
  return response.blob();
};

export const getAdminDemoSubmissions = async () => apiRequest("/admin/ai-demo");

export const getAdminDemoSubmission = async (submissionId) =>
  apiRequest(`/admin/ai-demo/${submissionId}`);

export const submitAdminDemoAssessment = async ({
  subjectId,
  captureMethod,
  questionImageDataUrl,
  questionText,
  answerText,
  answerSourceImages,
}) =>
  apiRequest("/admin/ai-demo", {
    method: "POST",
    body: JSON.stringify({
      subjectId,
      captureMethod,
      questionImageDataUrl,
      questionText,
      answerText,
      answerSourceImages,
    }),
  });

export const deleteAdminDemoSubmission = async (submissionId) =>
  apiRequest(`/admin/ai-demo/${submissionId}`, { method: "DELETE" });

export const getDemoModelSettings = async () => apiRequest("/admin/ai-demo/model-settings");

export const updateDemoSubjectModelOverride = async (subjectCode, { ocrModelId, gradingModelId }) =>
  apiRequest(`/admin/ai-demo/model-settings/${subjectCode}`, {
    method: "PUT",
    body: JSON.stringify({ ocrModelId, gradingModelId }),
  });

