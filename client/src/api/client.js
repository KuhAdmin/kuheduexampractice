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

export const getAssessmentStudioBootstrap = async (params = {}) => {
  const query = buildQuery(params);
  return apiRequest(`/catalog/assessment-studio/bootstrap${query ? `?${query}` : ""}`);
};

export const getStudentSections = async (chapterNumber) =>
  apiRequest(`/user/sections?${buildQuery({ chapterNumber })}`);

export const getRemainingConcepts = async () => apiRequest("/user/goals/remaining-concepts");

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

export const getStudentDiagrams = async (sourceSectionId) =>
  apiRequest(`/user/sections/${sourceSectionId}/diagrams`);

export const getStudentDiagramMedia = async (diagramId) =>
  apiRequest(`/user/diagrams/${diagramId}/media`);

export const getStudentConceptCard = async (assessmentUnitId) =>
  apiRequest(`/user/concepts/${assessmentUnitId}/card`);

export const getStudentConceptSectionMedia = async (assessmentUnitId, sectionKey) =>
  apiRequest(`/user/concepts/${assessmentUnitId}/memory-hook-media/${sectionKey}`);

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

export const getAssessmentStudioChapters = async (params = {}) => {
  const query = buildQuery(params);
  return apiRequest(`/catalog/assessment-studio/chapters${query ? `?${query}` : ""}`);
};

export const getAssessmentStudioSections = async (params = {}) => {
  const query = buildQuery(params);
  return apiRequest(`/catalog/assessment-studio/sections${query ? `?${query}` : ""}`);
};

export const saveSourceSectionDraft = async (payload) =>
  apiRequest("/assessment-studio/sections/draft", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getSourceSectionDraft = async (sourceSectionId) =>
  apiRequest(`/assessment-studio/sections/${sourceSectionId}`);

export const updateSourceSection = async (sourceSectionId, { adminNotes, sectionOcrText }) =>
  apiRequest(`/assessment-studio/sections/${sourceSectionId}`, {
    method: "PUT",
    body: JSON.stringify({ adminNotes, sectionOcrText }),
  });

export const addSourceSectionImage = async (sourceSectionId, image) =>
  apiRequest(`/assessment-studio/sections/${sourceSectionId}/images`, {
    method: "POST",
    body: JSON.stringify(image),
  });

export const removeSourceSectionImage = async (sourceSectionId, imageId) =>
  apiRequest(`/assessment-studio/sections/${sourceSectionId}/images/${imageId}`, {
    method: "DELETE",
  });

export const saveSourceDocumentPdf = async (sourceDocumentId, { pdfDataUrl, fileName, pageCount }) =>
  apiRequest(`/assessment-studio/documents/${sourceDocumentId}/pdf`, {
    method: "POST",
    body: JSON.stringify({ pdfDataUrl, fileName, pageCount }),
  });

export const getSourceDocumentPdf = async (sourceDocumentId) =>
  apiRequest(`/assessment-studio/documents/${sourceDocumentId}/pdf`);

export const runAssessmentStudioPipeline = async (payload) =>
  apiRequest("/assessment-studio/pipeline/run", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getAssessmentStudioPipelineStatus = async (jobId) =>
  apiRequest(`/assessment-studio/pipeline/${jobId}`);

export const getAssessmentStudioPipelineStatusBatch = async (jobIds = []) => {
  if (!jobIds.length) {
    return { jobs: [] };
  }
  const query = buildQuery({ jobIds: jobIds.join(",") });
  return apiRequest(`/assessment-studio/pipeline/status-batch?${query}`);
};

export const getAssessmentStudioPipelineConcurrency = async () =>
  apiRequest("/assessment-studio/pipeline/concurrency");

export const getAssessmentStudioPipelineNavigation = async (params = {}) => {
  const query = buildQuery(params);
  return apiRequest(`/assessment-studio/pipeline/navigation${query ? `?${query}` : ""}`);
};

export const abortAssessmentStudioPipeline = async (jobId) =>
  apiRequest(`/assessment-studio/pipeline/${jobId}/abort`, {
    method: "POST",
  });

export const getAssessmentStudioPipelineAudit = async (jobId) =>
  apiRequest(`/assessment-studio/pipeline/${jobId}/audit`);

export const getCompletedAssessmentStudioRuns = async () =>
  apiRequest("/assessment-studio/pipeline/completed");

export const deleteAssessmentStudioPipelineRun = async (jobId) =>
  apiRequest(`/assessment-studio/pipeline/${jobId}`, {
    method: "DELETE",
  });

export const rerunAssessmentStudioPipelineLayer = async (jobId, layerNumber, modelId = null) =>
  apiRequest(`/assessment-studio/pipeline/${jobId}/layers/${layerNumber}/rerun`, {
    method: "POST",
    body: JSON.stringify({ modelId }),
  });

export const initializeAssessmentStudioDatabase = async (options = {}) =>
  apiRequest("/assessment-studio/admin/db/initialize", {
    method: "POST",
    body: JSON.stringify(options),
  });

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

export const assignModerationTask = async ({ sourceSectionId, layerNumber, moderatorUserId, dueAt }) =>
  apiRequest("/moderation/tasks", {
    method: "POST",
    body: JSON.stringify({ sourceSectionId, layerNumber, moderatorUserId, dueAt }),
  });

export const getModerationAssignableSections = async (params = {}) => {
  const query = buildQuery(params);
  return apiRequest(`/moderation/assignable-sections${query ? `?${query}` : ""}`);
};

export const getMyModerationTasks = async () => apiRequest("/moderation/tasks/mine");

export const getAllModerationTasks = async () => apiRequest("/moderation/tasks");

export const getModerationTaskDetail = async (reviewQueueId) =>
  apiRequest(`/moderation/tasks/${reviewQueueId}`);

export const submitModeratorDecision = async (reviewQueueId, decision, notes) =>
  apiRequest(`/moderation/tasks/${reviewQueueId}/moderator-decision`, {
    method: "POST",
    body: JSON.stringify({ decision, notes }),
  });

export const submitAdminModerationDecision = async (reviewQueueId, decision, notes) =>
  apiRequest(`/moderation/tasks/${reviewQueueId}/admin-decision`, {
    method: "POST",
    body: JSON.stringify({ decision, notes }),
  });

export const getAssessmentStudioLayerVersions = async (jobId, layerNumber) =>
  apiRequest(`/assessment-studio/pipeline/${jobId}/layers/${layerNumber}/versions`);

export const selectAssessmentStudioLayerVersion = async (assessmentUnitId, layerNumber, generationId) =>
  apiRequest(
    `/assessment-studio/assessment-units/${assessmentUnitId}/layers/${layerNumber}/versions/${generationId}/select`,
    { method: "POST" }
  );

export const getMemoryHookMedia = async (assessmentUnitId) =>
  apiRequest(`/assessment-studio/assessment-units/${assessmentUnitId}/memory-hook-media`);

export const uploadMemoryHookMedia = async (assessmentUnitId, sectionKey, dataUrl, fileName) =>
  apiRequest(`/assessment-studio/assessment-units/${assessmentUnitId}/memory-hook-media/${sectionKey}/upload`, {
    method: "POST",
    body: JSON.stringify({ dataUrl, fileName }),
  });

export const generateMemoryHookImage = async (assessmentUnitId, sectionKey, modelId = null) =>
  apiRequest(`/assessment-studio/assessment-units/${assessmentUnitId}/memory-hook-images/${sectionKey}/generate`, {
    method: "POST",
    body: JSON.stringify({ modelId }),
  });

export const getAssessmentUnitDiagrams = async (assessmentUnitId) =>
  apiRequest(`/assessment-studio/assessment-units/${assessmentUnitId}/diagrams`);

export const getDiagramMedia = async (diagramId) =>
  apiRequest(`/assessment-studio/diagrams/${diagramId}/media`);

export const uploadDiagramMedia = async (diagramId, dataUrl, fileName) =>
  apiRequest(`/assessment-studio/diagrams/${diagramId}/media/upload`, {
    method: "POST",
    body: JSON.stringify({ dataUrl, fileName }),
  });

export const generateDiagramImage = async (diagramId, modelId = null) =>
  apiRequest(`/assessment-studio/diagrams/${diagramId}/media/generate`, {
    method: "POST",
    body: JSON.stringify({ modelId }),
  });

export const generateAllMemoryHookImages = async (assessmentUnitId, modelId = null) =>
  apiRequest(`/assessment-studio/assessment-units/${assessmentUnitId}/memory-hook-images/generate-all`, {
    method: "POST",
    body: JSON.stringify({ modelId }),
  });

export const uploadChapterExercise = async (bookId, chapterNumber, { dataUrl, mimeType, chapterName, pipelineJobId }) =>
  apiRequest(`/assessment-studio/chapters/${bookId}/${chapterNumber}/exercises/upload`, {
    method: "POST",
    body: JSON.stringify({ dataUrl, mimeType, chapterName, pipelineJobId }),
  });

export const getPendingChapterExerciseQuestions = async (bookId, chapterNumber) =>
  apiRequest(`/assessment-studio/chapters/${bookId}/${chapterNumber}/exercises/pending`);

export const reviewChapterExerciseQuestion = async (questionId, decision) =>
  apiRequest(`/assessment-studio/chapters/exercises/${questionId}/review`, {
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

export const getAiModelSettings = async () => apiRequest("/settings/ai-model");

export const updateActiveAiModel = async (modelId) =>
  apiRequest("/settings/ai-model", {
    method: "PUT",
    body: JSON.stringify({ modelId }),
  });

export const updateLayerAiModelOverride = async (layerNumber, modelId) =>
  apiRequest("/settings/ai-model/layer-overrides", {
    method: "PUT",
    body: JSON.stringify({ layerNumber, modelId }),
  });

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

export const downloadAssessmentStudioPipelineAudit = async (jobId) => {
  const token = localStorage.getItem("kuhedu_token");
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(`${API_ROOT}/assessment-studio/pipeline/${jobId}/audit.txt`, {
    method: "GET",
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    let message = "Failed to download audit log.";
    try {
      const data = await response.json();
      message = data.message || message;
    } catch {
      message = await response.text();
    }
    throw new Error(message);
  }

  return response.text();
};
