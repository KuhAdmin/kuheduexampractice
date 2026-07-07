import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  abortAssessmentStudioPipeline,
  getAssessmentStudioBootstrap,
  getAssessmentStudioChapters,
  getAssessmentStudioPipelineNavigation,
  getAssessmentStudioPipelineStatus,
  getAssessmentStudioSections,
  runAssessmentStudioPipeline,
} from "../api/client";

const practiceTypes = [
  "Concept Builder",
  "Rapid Revision",
  "Board Pattern",
  "Full Mock",
  "Weak Area Retry",
  "Memory Booster",
];

const sourceOptions = [
  {
    id: "manual",
    label: "Create manually",
    description: "Start from an empty set and shape the structure yourself.",
  },
  {
    id: "bank",
    label: "From Question Bank",
    description: "Pull from the existing question library by chapter and type.",
  },
  {
    id: "duplicate",
    label: "Duplicate existing",
    description: "Clone a previous practice set and adapt it quickly.",
  },
  {
    id: "ai",
    label: "AI Assisted",
    description: "Generate a starting structure from learning signals and chapter context.",
  },
];

const sectionOptions = [
  "Foundation",
  "Core Practice",
  "Board Pattern",
  "Retry Booster",
];

const duplicateCandidates = [
  { id: "d1", title: "Motion Foundations", type: "Concept Builder" },
  { id: "d2", title: "Newton Laws Rapid Revision", type: "Rapid Revision" },
  { id: "d3", title: "Force and Motion Board Pattern", type: "Board Pattern" },
];

const questionBank = [
  { id: "q1", title: "Newton's first law conceptual MCQ", kind: "MCQ", difficulty: "Core" },
  { id: "q2", title: "Inertia assertion and reason", kind: "Assertion", difficulty: "Core" },
  { id: "q3", title: "Free-body diagram case prompt", kind: "Diagram", difficulty: "Advanced" },
  { id: "q4", title: "Net force numerical set", kind: "Numerical", difficulty: "Advanced" },
  { id: "q5", title: "Motion in lift case study", kind: "Case Study", difficulty: "Focused" },
  { id: "q6", title: "Action-reaction misconception corrector", kind: "MCQ", difficulty: "Focused" },
];

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Failed to read the selected image."));
    reader.readAsDataURL(file);
  });

const initialDraft = {
  board: "CBSE",
  className: "11",
  subject: "Physics",
  subjectCode: "PHY",
  chapter: "Laws of Motion",
  chapterKey: "",
  sectionNumber: "1",
  sectionText: "",
  practiceType: "Concept Builder",
  source: "manual",
  duplicateBaseId: "d1",
  duration: "25",
  targetDifficulty: "Balanced",
  blueprint: "Understand -> recall -> apply -> retry",
  sourceLanguage: "",
  outputLanguage: "",
  selectedQuestionEntries: [
    { id: "q1", section: "Foundation" },
    { id: "q2", section: "Core Practice" },
    { id: "q4", section: "Core Practice" },
  ],
};

const stepLabels = [
  "Academic setup",
  "Pipeline run",
  "Question source",
  "Question selection",
];

const pipelineLayers = [
  "Knowledge Extraction",
  "Concept Memory",
  "Assessment Capability",
  "Assessment Strategy",
  "Blueprint Generation",
  "Item Generation",
  "Learning Support",
];

const aiRecommendations = [
  {
    title: "Suggested structure",
    detail: "Start with concept recall, then application, then one retry-focused question.",
  },
  {
    title: "Recommended question types",
    detail: "2 MCQ · 1 Assertion · 1 Numerical · 1 Diagram prompt",
  },
  {
    title: "Learning signal",
    detail: "Students retry free-body diagram items often. Add one visual reasoning prompt.",
  },
];

const getQuestionById = (id) => questionBank.find((item) => item.id === id);

const normalizeDraftFromBootstrap = (current, bootstrap) => {
  const next = { ...current };

  const selectedLevel =
    bootstrap.levels.find((item) => item.code === current.className) || bootstrap.levels[0];
  if (selectedLevel) {
    next.className = selectedLevel.code;
  }

  const selectedSubject =
    bootstrap.subjects.find((item) => item.code === current.subjectCode) || bootstrap.subjects[0];
  if (selectedSubject) {
    next.subjectCode = selectedSubject.code;
    next.subject = selectedSubject.name;
  } else {
    next.subjectCode = "";
    next.subject = "";
  }

  const selectedPracticeType =
    bootstrap.practiceTypes.find((item) => item.name === current.practiceType) ||
    bootstrap.practiceTypes[0];
  next.practiceType = selectedPracticeType?.name || "";

  return next;
};

const normalizeDraftFromRunPayload = (current, payload = {}) => ({
  ...current,
  board: payload.board || current.board,
  className: payload.className || current.className,
  subject: payload.subject || current.subject,
  subjectCode: payload.subjectCode || current.subjectCode,
  chapter: payload.chapter || current.chapter,
  chapterKey: payload.chapterKey || current.chapterKey,
  sectionNumber: payload.sectionNumber || current.sectionNumber,
  sectionText: payload.sectionOcrText || "",
  practiceType: payload.practiceType || current.practiceType,
  duration: payload.duration || current.duration,
  targetDifficulty: payload.targetDifficulty || current.targetDifficulty,
  blueprint: payload.blueprint || current.blueprint,
  sourceLanguage: payload.sourceLanguage || payload.source_language || current.sourceLanguage,
  outputLanguage: payload.outputLanguage || payload.output_language || current.outputLanguage,
});

const buildSectionImageFromPayload = (payload = {}) => {
  if (!payload.sectionImageDataUrl) {
    return null;
  }

  return {
    name: payload.sectionImageName || "section-image",
    type: payload.sectionImageMimeType || "",
    size: 0,
    dataUrl: payload.sectionImageDataUrl,
  };
};

export const AdminAssessmentStudioPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(initialDraft);
  const [savedMessage, setSavedMessage] = useState("Draft saved just now");
  const [launchContext, setLaunchContext] = useState("");
  const [catalog, setCatalog] = useState({
    boards: [{ code: "CBSE", name: "CBSE" }],
    levels: [],
    subjects: [],
    chapters: [],
    sections: [],
    practiceTypes: [],
  });
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const bootstrapHydratedRef = useRef(false);
  const [pipelineStatus, setPipelineStatus] = useState("idle");
  const [activeLayerIndex, setActiveLayerIndex] = useState(-1);
  const [sectionImage, setSectionImage] = useState(null);
  const [pipelineJobId, setPipelineJobId] = useState("");
  const [pipelineError, setPipelineError] = useState("");
  const [pipelineTokenRows, setPipelineTokenRows] = useState(
    pipelineLayers.map((layer) => ({ layer, usedTokens: 0 }))
  );
  const [pipelineLayerStatuses, setPipelineLayerStatuses] = useState(
    pipelineLayers.map(() => "paused")
  );
  const [historyNavigation, setHistoryNavigation] = useState({
    currentJobId: "",
    previousJobId: null,
    nextJobId: null,
    status: "",
    createdAt: "",
  });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [suspendLatestRestore, setSuspendLatestRestore] = useState(false);
  const [jobIdSearch, setJobIdSearch] = useState("");

  const selectedQuestions = useMemo(
    () =>
      draft.selectedQuestionEntries
        .map((entry) => {
          const question = getQuestionById(entry.id);
          return question ? { ...question, section: entry.section } : null;
        })
        .filter(Boolean),
    [draft.selectedQuestionEntries]
  );

  const remainingQuestions = useMemo(
    () =>
      questionBank.filter(
        (item) => !draft.selectedQuestionEntries.some((entry) => entry.id === item.id)
      ),
    [draft.selectedQuestionEntries]
  );

  const sectionSummary = useMemo(
    () =>
      sectionOptions.map((section) => ({
        section,
        count: selectedQuestions.filter((item) => item.section === section).length,
      })),
    [selectedQuestions]
  );

  const updateDraft = (patch) => {
    setDraft((current) => ({ ...current, ...patch }));
    setSavedMessage("Draft saved just now");
  };

  const addQuestion = (id, section = "Core Practice") => {
    if (draft.selectedQuestionEntries.some((entry) => entry.id === id)) {
      return;
    }

    updateDraft({
      selectedQuestionEntries: [...draft.selectedQuestionEntries, { id, section }],
    });
  };

  const removeQuestion = (id) => {
    updateDraft({
      selectedQuestionEntries: draft.selectedQuestionEntries.filter((entry) => entry.id !== id),
    });
  };

  const moveQuestion = (id, direction) => {
    const index = draft.selectedQuestionEntries.findIndex((entry) => entry.id === id);
    if (index < 0) {
      return;
    }

    const next = [...draft.selectedQuestionEntries];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= next.length) {
      return;
    }

    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    updateDraft({ selectedQuestionEntries: next });
  };

  const assignSection = (id, section) => {
    updateDraft({
      selectedQuestionEntries: draft.selectedQuestionEntries.map((entry) =>
        entry.id === id ? { ...entry, section } : entry
      ),
    });
  };

  const selectedTypeCounts = useMemo(() => {
    const counts = {};
    selectedQuestions.forEach((item) => {
      counts[item.kind] = (counts[item.kind] || 0) + 1;
    });
    return counts;
  }, [selectedQuestions]);

  const applyRunNavigationState = (navigation) => {
    const payload = navigation?.current?.requestPayload || {};
    const jobId = navigation?.current?.jobId || "";

    setDraft((current) => normalizeDraftFromRunPayload(current, payload));
    setSectionImage(buildSectionImageFromPayload(payload));
    setPipelineJobId(jobId);
    setJobIdSearch(jobId);
    setHistoryNavigation({
      currentJobId: jobId,
      previousJobId: navigation?.previousJobId || null,
      nextJobId: navigation?.nextJobId || null,
      status: navigation?.current?.status || "",
      createdAt: navigation?.current?.createdAt || "",
    });
  };

  const applyPipelineSnapshot = (jobId, status) => {
    setPipelineJobId(jobId);
    setPipelineStatus(status.status);
    setActiveLayerIndex(status.activeLayerIndex);
    setPipelineError(status.error || "");
    setPipelineLayerStatuses(status.layerStatuses || pipelineLayers.map(() => "paused"));
    setPipelineTokenRows(
      status.layers.map((layer, index) => ({
        layer,
        usedTokens: status.tokenRows[index] || 0,
      }))
    );
  };

  const resetPipelineState = () => {
    setPipelineStatus("idle");
    setActiveLayerIndex(-1);
    setPipelineJobId("");
    setPipelineError("");
    setPipelineLayerStatuses(pipelineLayers.map(() => "paused"));
    setPipelineTokenRows(pipelineLayers.map((layer) => ({ layer, usedTokens: 0 })));
  };

  useEffect(() => {
    const mode = searchParams.get("mode");
    const subject = searchParams.get("subject");
    const className = searchParams.get("class");
    const chapter = searchParams.get("chapter");
    const practiceType = searchParams.get("practiceType");
    const recommendation = searchParams.get("recommendation");
    const fromSet = searchParams.get("fromSet");
    const sectionNumber = searchParams.get("sectionNumber");
    const requestedStep = searchParams.get("step");
    const requestedJobId = searchParams.get("jobId");

    if (requestedJobId) {
      setSuspendLatestRestore(false);
    }

    if (!mode && !subject && !chapter && !practiceType && !requestedStep && !requestedJobId) {
      return;
    }

    if (mode || subject || className || chapter || practiceType || sectionNumber) {
      setDraft((current) => ({
        ...current,
        source:
          mode === "duplicate"
            ? "duplicate"
            : mode === "ai" || mode === "retry"
              ? "ai"
              : current.source,
        subject: subject || current.subject,
        className: className || current.className,
        chapter: chapter || current.chapter,
        practiceType: practiceType || current.practiceType,
        sectionNumber: sectionNumber || current.sectionNumber,
      }));
    }

    if (requestedJobId) {
      setPipelineJobId(requestedJobId);
    }

    if (requestedStep) {
      setStep(Number(requestedStep));
      setLaunchContext(
        requestedJobId
          ? `Pipeline run restored for job ${requestedJobId}`
          : "Manual path returned to studio"
      );
    } else if (mode === "manual") {
      setLaunchContext(`Manual path loaded for ${subject || draft.subject}`);
      setStep(1);
    } else if (mode === "duplicate" && fromSet) {
      setLaunchContext(`Prefilled from analytics clone of ${fromSet}`);
      setStep(1);
    } else if (mode === "retry" && chapter) {
      setLaunchContext(`AI recommendation loaded for ${chapter}`);
      setStep(1);
    } else if (mode === "ai" && recommendation) {
      setLaunchContext(`AI suggestion loaded: ${recommendation}`);
      setStep(1);
    } else {
      setLaunchContext("Studio prefilled from admin workflow");
    }

    if (mode || subject || className || chapter || practiceType || sectionNumber) {
      setSavedMessage("Draft prepared from recommendation");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!pipelineJobId) {
      return;
    }

    let isCancelled = false;

    getAssessmentStudioPipelineStatus(pipelineJobId)
      .then((status) => {
        if (isCancelled) {
          return;
        }

        applyPipelineSnapshot(pipelineJobId, status);
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }

        setPipelineError(error.message || "Failed to restore the pipeline run.");
      });

    return () => {
      isCancelled = true;
    };
  }, [pipelineJobId]);

  useEffect(() => {
    const mode = searchParams.get("mode");
    const subject = searchParams.get("subject");
    const chapter = searchParams.get("chapter");
    const practiceType = searchParams.get("practiceType");
    const sectionNumber = searchParams.get("sectionNumber");
    const requestedJobId = searchParams.get("jobId");
    const shouldHydrateFromRuns =
      requestedJobId ||
      (!mode && !subject && !chapter && !practiceType && !sectionNumber && !suspendLatestRestore);

    if (!shouldHydrateFromRuns) {
      return;
    }

    let isCancelled = false;
    setHistoryLoading(true);
    setHistoryError("");

    getAssessmentStudioPipelineNavigation(requestedJobId ? { jobId: requestedJobId } : {})
      .then((navigation) => {
        if (isCancelled) {
          return;
        }

        applyRunNavigationState(navigation);
        setLaunchContext(`Viewing saved pipeline ${navigation.current.jobId}`);
        setSavedMessage("Academic setup restored from pipeline history");
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }

        if (requestedJobId) {
          setHistoryError(error.message || "Failed to load the selected pipeline run.");
        } else {
          setHistoryNavigation({
            currentJobId: "",
            previousJobId: null,
            nextJobId: null,
            status: "",
            createdAt: "",
          });
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setHistoryLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [searchParams, suspendLatestRestore]);

  useEffect(() => {
    let isCancelled = false;

    setBootstrapLoading(true);
    setCatalogError("");

    getAssessmentStudioBootstrap({
      levelCode: draft.className,
    })
      .then((data) => {
        if (isCancelled) {
          return;
        }

        setCatalog((current) => ({ ...current, ...data }));
        setDraft((current) => normalizeDraftFromBootstrap(current, data));
        bootstrapHydratedRef.current = true;
      })
      .catch((error) => {
        if (!isCancelled) {
          setCatalogError(error.message || "Failed to load academic setup.");
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setBootstrapLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [draft.className]);

  useEffect(() => {
    if (!bootstrapHydratedRef.current || !draft.className || !draft.subjectCode) {
      return;
    }

    let isCancelled = false;

    setChaptersLoading(true);
    setCatalogError("");

    getAssessmentStudioChapters({
      levelCode: draft.className,
      subjectCode: draft.subjectCode,
    })
      .then((data) => {
        if (isCancelled) {
          return;
        }

        setCatalog((current) => ({
          ...current,
          chapters: data.chapters,
          sections: [],
        }));
        setDraft((current) => {
          const selectedChapter =
            data.chapters.find((item) => item.key === current.chapterKey) ||
            data.chapters[0];
          const isSameChapter = selectedChapter?.key === current.chapterKey;

          return {
            ...current,
            chapterKey: selectedChapter?.key || "",
            chapter: selectedChapter?.chapterName || "",
            sectionNumber: isSameChapter ? current.sectionNumber : "",
          };
        });
      })
      .catch((error) => {
        if (!isCancelled) {
          setCatalogError(error.message || "Failed to load chapters.");
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setChaptersLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [draft.className, draft.subjectCode]);

  useEffect(() => {
    if (!bootstrapHydratedRef.current || !draft.className || !draft.subjectCode || !draft.chapterKey) {
      return;
    }

    let isCancelled = false;

    setSectionsLoading(true);
    setCatalogError("");

    getAssessmentStudioSections({
      levelCode: draft.className,
      subjectCode: draft.subjectCode,
      chapterKey: draft.chapterKey,
    })
      .then((data) => {
        if (isCancelled) {
          return;
        }

        setCatalog((current) => ({
          ...current,
          sections: data.sections,
        }));
        setDraft((current) => {
          const selectedSection =
            data.sections.find((item) => item.sectionNumber === current.sectionNumber) ||
            null;

          return {
            ...current,
            sectionNumber:
              selectedSection?.sectionNumber ||
              current.sectionNumber ||
              data.sections[0]?.sectionNumber ||
              "",
          };
        });
      })
      .catch((error) => {
        if (!isCancelled) {
          setCatalogError(error.message || "Failed to load sections.");
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setSectionsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [draft.className, draft.subjectCode, draft.chapterKey]);

  useEffect(() => {
    if (!pipelineJobId || !["queued", "running"].includes(pipelineStatus)) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      getAssessmentStudioPipelineStatus(pipelineJobId)
        .then((status) => {
          setPipelineStatus(status.status);
          setActiveLayerIndex(status.activeLayerIndex);
          setPipelineLayerStatuses(status.layerStatuses || pipelineLayers.map(() => "paused"));
          setPipelineTokenRows(
            status.layers.map((layer, index) => ({
              layer,
              usedTokens: status.tokenRows[index] || 0,
            }))
          );

          if (status.status === "completed") {
            setSavedMessage("Pipeline completed. Continue to question setup.");
            window.clearInterval(timer);
          }

          if (status.status === "aborted") {
            setSavedMessage("Pipeline aborted. Adjust inputs and rerun when ready.");
            window.clearInterval(timer);
          }

          if (status.status === "failed") {
            setPipelineError(status.error || "Pipeline failed.");
            setSavedMessage("Pipeline failed. Review the error and retry.");
            window.clearInterval(timer);
          }
        })
        .catch((error) => {
          setPipelineError(error.message || "Failed to poll pipeline status.");
          setPipelineStatus("failed");
          window.clearInterval(timer);
        });
    }, 1200);

    return () => window.clearInterval(timer);
  }, [pipelineJobId, pipelineStatus]);

  const runPipeline = async (targetLayerNumber = pipelineLayers.length) => {
    setPipelineError("");
    setPipelineStatus("running");
    setActiveLayerIndex(0);
    setPipelineLayerStatuses(
      pipelineLayers.map((_, index) => (index === 0 ? "running" : "paused"))
    );
    setPipelineTokenRows(pipelineLayers.map((layer) => ({ layer, usedTokens: 0 })));
    setSavedMessage(
      targetLayerNumber === pipelineLayers.length
        ? "Pipeline running across all layers"
        : `Pipeline running through layer ${targetLayerNumber}`
    );

    try {
      const result = await runAssessmentStudioPipeline({
        board: draft.board,
        className: draft.className,
        subject: draft.subject,
        subjectCode: draft.subjectCode,
        chapter: draft.chapter,
        chapterKey: draft.chapterKey,
        sectionNumber: draft.sectionNumber,
        practiceType: draft.practiceType,
        targetDifficulty: draft.targetDifficulty,
        duration: draft.duration,
        blueprint: draft.blueprint,
        sourceLanguage: draft.sourceLanguage,
        outputLanguage: draft.outputLanguage,
        sectionOcrText: draft.sectionText,
        sectionImageName: sectionImage?.name || "",
        sectionImageMimeType: sectionImage?.type || "",
        sectionImageDataUrl: sectionImage?.dataUrl || "",
        targetLayerNumber,
      });

      setPipelineJobId(result.jobId);
      setHistoryNavigation((current) => ({
        ...current,
        currentJobId: result.jobId,
        nextJobId: null,
      }));
      navigate(`/admin/ai-assessment-studio?step=1&jobId=${encodeURIComponent(result.jobId)}`, {
        replace: true,
      });
    } catch (error) {
      setPipelineStatus("failed");
      setPipelineError(error.message || "Failed to start the pipeline.");
      setSavedMessage("Pipeline could not start.");
    }
  };

  const abortPipeline = async () => {
    try {
      if (pipelineJobId) {
        await abortAssessmentStudioPipeline(pipelineJobId);
      }
    } catch (error) {
      setPipelineError(error.message || "Failed to abort the pipeline.");
    } finally {
      setPipelineStatus("aborted");
      setSavedMessage("Pipeline aborted. Adjust inputs and rerun when ready.");
    }
  };

  const resetPipeline = () => {
    resetPipelineState();
    setSavedMessage("Draft saved just now");
  };

  const loadPipelineHistoryEntry = async (jobId) => {
    if (!jobId) {
      return;
    }

    setSuspendLatestRestore(false);
    setHistoryLoading(true);
    setHistoryError("");

    try {
      const navigation = await getAssessmentStudioPipelineNavigation({ jobId });
      applyRunNavigationState(navigation);
      const status = await getAssessmentStudioPipelineStatus(jobId);
      applyPipelineSnapshot(jobId, status);
      setLaunchContext(`Viewing saved pipeline ${navigation.current.jobId}`);
      setSavedMessage("Academic setup restored from pipeline history");
      const targetStep = step === 1 ? "1" : "0";
      const query = new URLSearchParams({
        step: targetStep,
        jobId,
      }).toString();
      navigate(`/admin/ai-assessment-studio?${query}`, { replace: true });
    } catch (error) {
      setHistoryError(error.message || "Failed to load the selected pipeline run.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadPreviousPipeline = () => {
    if (historyNavigation.previousJobId) {
      loadPipelineHistoryEntry(historyNavigation.previousJobId);
      return;
    }

    if (!historyNavigation.currentJobId) {
      setHistoryError("No pipeline is currently loaded. Use Load or refresh to restore the latest run first.");
      return;
    }

    setHistoryError("No previous pipeline run is available from this point.");
  };

  const loadNextPipeline = () => {
    if (historyNavigation.nextJobId) {
      loadPipelineHistoryEntry(historyNavigation.nextJobId);
      return;
    }

    if (!historyNavigation.currentJobId) {
      setHistoryError("No pipeline is currently loaded. Use Load or refresh to restore the latest run first.");
      return;
    }

    setHistoryError("No newer pipeline run is available from this point.");
  };

  const startNewPipeline = () => {
    setSuspendLatestRestore(true);
    setDraft(initialDraft);
    setSectionImage(null);
    setJobIdSearch("");
    setHistoryNavigation({
      currentJobId: "",
      previousJobId: null,
      nextJobId: null,
      status: "",
      createdAt: "",
    });
    setHistoryError("");
    resetPipelineState();
    setStep(0);
    setLaunchContext("New pipeline initialized");
    setSavedMessage("Fresh academic setup ready");
    navigate("/admin/ai-assessment-studio", { replace: true });
  };

  const loadPipelineBySearch = async () => {
    const trimmedJobId = jobIdSearch.trim();
    if (!trimmedJobId) {
      setHistoryError("Enter a Job ID to load a saved pipeline run.");
      return;
    }

    await loadPipelineHistoryEntry(trimmedJobId);
  };

  const completedLayerCount = pipelineLayerStatuses.filter((status) => status === "completed").length;
  const isPipelineBusy = ["queued", "running"].includes(pipelineStatus);
  const pipelineCompletion =
    completedLayerCount > 0
      ? Math.round((completedLayerCount / pipelineLayers.length) * 100)
      : activeLayerIndex < 0
        ? 0
        : Math.round(((activeLayerIndex + 1) / pipelineLayers.length) * 100);

  const pipelineSummaryText =
    pipelineStatus === "completed" && completedLayerCount === pipelineLayers.length
      ? "All 7 layers completed"
      : pipelineStatus === "completed"
        ? `${completedLayerCount} of ${pipelineLayers.length} layers completed`
      : pipelineStatus === "aborted"
        ? "Run aborted before completion"
        : pipelineStatus === "queued"
          ? "Pipeline queued and waiting to start"
        : pipelineStatus === "running"
          ? `Running layer ${Math.min(activeLayerIndex + 1, pipelineLayers.length)} of ${pipelineLayers.length}`
          : "Ready to execute the full layered pipeline";

  const totalTokensUsed = pipelineTokenRows.reduce((sum, row) => sum + row.usedTokens, 0);
  const getLayerStatusLabel = (status) =>
    ({
      completed: "Done",
      running: "Running",
      queued: "Queued",
      aborted: "Aborted",
      paused: "Paused",
    })[status] || "Paused";

  const openManualBuilder = () => {
    const query = new URLSearchParams({
      subject: draft.subject,
      class: draft.className,
      chapter: draft.chapter,
      practiceType: draft.practiceType,
      sectionNumber: draft.sectionNumber,
    }).toString();

    navigate(`/admin/assessment-studio/manual?${query}`);
  };

  return (
    <section className="admin-studio-page">
      <div className="admin-studio-header">
        <div>
          <span className="eyebrow">Admin module</span>
          <h1>Assessment Studio</h1>
          <p>Build and refine memory-first assessments from a focused editorial workflow.</p>
        </div>
        <div className="admin-studio-draft">
          <strong>{savedMessage}</strong>
          <span>
            {draft.subject} · Class {draft.className} · {draft.practiceType}
          </span>
          {launchContext ? <small>{launchContext}</small> : null}
        </div>
      </div>

      <section className="admin-studio-progress">
        {stepLabels.map((label, index) => (
          <button
            key={label}
            type="button"
            className={`admin-studio-step ${index === step ? "is-active" : ""} ${
              index < step ? "is-complete" : ""
            }`}
            onClick={() => setStep(index)}
          >
            <span>{index + 1}</span>
            <strong>{label}</strong>
          </button>
        ))}
      </section>

      {step === 0 ? (
        <section className="admin-studio-panel">
          <div className="admin-panel-head">
            <div>
              <h2>Step 1: Academic setup</h2>
              <span>
                Define the learning context and the structure target before composing the set.
              </span>
            </div>
            <div className="admin-studio-history-actions">
              <label className="admin-studio-job-search">
                <input
                  type="text"
                  value={jobIdSearch}
                  onChange={(event) => setJobIdSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      loadPipelineBySearch();
                    }
                  }}
                  placeholder="Search Job ID"
                  disabled={historyLoading}
                />
                <button
                  className="ghost-button"
                  type="button"
                  onClick={loadPipelineBySearch}
                  disabled={historyLoading}
                >
                  Load
                </button>
              </label>
              <button
                className="ghost-button"
                type="button"
                onClick={loadPreviousPipeline}
                disabled={historyLoading}
                title={
                  historyNavigation.previousJobId
                    ? "Load previous pipeline run"
                    : "No previous pipeline run available"
                }
              >
                Previous
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={loadNextPipeline}
                disabled={historyLoading}
                title={
                  historyNavigation.nextJobId
                    ? "Load next pipeline run"
                    : "No newer pipeline run available"
                }
              >
                Next
              </button>
              <button className="primary-button" type="button" onClick={startNewPipeline}>
                New Pipeline
              </button>
            </div>
          </div>
          <div className="admin-studio-history-banner">
            <div>
              <strong>
                {historyNavigation.currentJobId
                  ? `Loaded Job ID: ${historyNavigation.currentJobId}`
                  : "New unsaved pipeline"}
              </strong>
              <span>
                {historyNavigation.currentJobId
                  ? `Status: ${historyNavigation.status || "unknown"}`
                  : "Use this form to initialize a fresh run."}
              </span>
            </div>
            {historyNavigation.createdAt ? (
              <small>{new Date(historyNavigation.createdAt).toLocaleString()}</small>
            ) : null}
          </div>
          {historyError ? <p className="admin-studio-pipeline-error">{historyError}</p> : null}
          <div className="admin-studio-form-grid">
            <label className="admin-studio-field">
              <span>Board</span>
              <select value={draft.board} onChange={(event) => updateDraft({ board: event.target.value })}>
                {catalog.boards.map((item) => (
                  <option key={item.code} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-studio-field">
              <span>Class</span>
              <select
                value={draft.className}
                onChange={(event) => updateDraft({ className: event.target.value })}
                disabled={bootstrapLoading}
              >
                {catalog.levels.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-studio-field">
              <span>Subject</span>
              <select
                value={draft.subjectCode}
                onChange={(event) => {
                  const selectedSubject = catalog.subjects.find(
                    (item) => item.code === event.target.value
                  );

                  updateDraft({
                    subjectCode: event.target.value,
                    subject: selectedSubject?.name || "",
                    chapterKey: "",
                    sectionNumber: "",
                  });
                }}
                disabled={bootstrapLoading || catalog.subjects.length === 0}
              >
                {catalog.subjects.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-studio-field">
              <span>Chapter</span>
              <select
                value={draft.chapterKey}
                onChange={(event) => updateDraft({ chapterKey: event.target.value, sectionNumber: "" })}
                disabled={chaptersLoading || catalog.chapters.length === 0}
              >
                {catalog.chapters.map((item) => (
                  <option key={item.key} value={item.key}>
                    {`Chapter ${item.chapterNumber || "?"} - ${item.chapterName} (${item.bookName})`}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-studio-field">
              <span>Section Number</span>
              <select
                value={draft.sectionNumber}
                onChange={(event) => updateDraft({ sectionNumber: event.target.value })}
                disabled={sectionsLoading || catalog.sections.length === 0}
              >
                {catalog.sections.map((item) => (
                  <option key={item.sectionNumber} value={item.sectionNumber}>
                    {item.sectionNumber} - {item.topicName}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-studio-field">
              <span>Practice Type</span>
              <select
                value={draft.practiceType}
                onChange={(event) => updateDraft({ practiceType: event.target.value })}
                disabled={bootstrapLoading || catalog.practiceTypes.length === 0}
              >
                {catalog.practiceTypes.map((item) => (
                  <option key={item.code} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-studio-field">
              <span>Time Limit (min)</span>
              <input
                value={draft.duration}
                onChange={(event) => updateDraft({ duration: event.target.value })}
              />
            </label>
            <label className="admin-studio-field">
              <span>Target Difficulty</span>
              <select
                value={draft.targetDifficulty}
                onChange={(event) => updateDraft({ targetDifficulty: event.target.value })}
              >
                <option>Balanced</option>
                <option>Core</option>
                <option>Focused</option>
                <option>Advanced</option>
              </select>
            </label>
            <label className="admin-studio-field">
              <span>Source Language</span>
              <select
                value={draft.sourceLanguage}
                onChange={(event) => updateDraft({ sourceLanguage: event.target.value })}
              >
                <option value="">Auto detect</option>
                <option value="en">English</option>
                <option value="bn">Bengali</option>
              </select>
            </label>
            <label className="admin-studio-field">
              <span>Output Language</span>
              <select
                value={draft.outputLanguage}
                onChange={(event) => updateDraft({ outputLanguage: event.target.value })}
              >
                <option value="">Match source</option>
                <option value="en">English</option>
                <option value="bn">Bengali</option>
              </select>
            </label>
            <label className="admin-studio-field admin-studio-field-wide">
              <span>Section Image</span>
              <label className="admin-studio-file-upload">
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (event) => {
                    const file = event.target.files?.[0] || null;
                    if (!file) {
                      setSectionImage(null);
                      return;
                    }

                    try {
                      const dataUrl = await readFileAsDataUrl(file);
                      setSectionImage({
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        dataUrl,
                      });
                    } catch (error) {
                      setPipelineError(error.message || "Failed to read the selected image.");
                      setSectionImage(null);
                    }
                  }}
                />
                <strong>{sectionImage ? "Replace section image" : "Upload section image"}</strong>
                <small>
                  {sectionImage
                    ? sectionImage.name
                    : "Attach the chapter section image used for the pipeline run."}
                </small>
              </label>
            </label>
            <label className="admin-studio-field admin-studio-field-wide">
              <span>Section Text / OCR</span>
              <textarea
                rows={6}
                value={draft.sectionText}
                onChange={(event) => updateDraft({ sectionText: event.target.value })}
                placeholder="Paste the extracted section text here so Layer 1 runs from the actual section content."
              />
            </label>
            <label className="admin-studio-field admin-studio-field-wide">
              <span>Blueprint</span>
              <input
                value={draft.blueprint}
                onChange={(event) => updateDraft({ blueprint: event.target.value })}
              />
            </label>
            {catalogError ? (
              <p className="admin-studio-field admin-studio-field-wide">{catalogError}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="admin-studio-panel">
          <div className="admin-panel-head">
            <h2>Step 2: Pipeline run</h2>
            <span>Run the caching-aware AI pipeline before moving into question authoring.</span>
          </div>
          <div className="admin-studio-pipeline-layout">
            <div className="admin-studio-pipeline-main">
              <div className="admin-studio-pipeline-context">
                <div className="admin-panel-head">
                  <h3>Academic context</h3>
                  <span>The exact setup that will feed the 7-layer pipeline.</span>
                </div>
                <div className="admin-studio-context-grid">
                  <div className="admin-studio-context-pill">
                    <span>Board</span>
                    <strong>{draft.board}</strong>
                  </div>
                  <div className="admin-studio-context-pill">
                    <span>Class</span>
                    <strong>Class {draft.className}</strong>
                  </div>
                  <div className="admin-studio-context-pill">
                    <span>Subject</span>
                    <strong>{draft.subject}</strong>
                  </div>
                  <div className="admin-studio-context-pill">
                    <span>Chapter</span>
                    <strong>{draft.chapter || "Not selected"}</strong>
                  </div>
                  <div className="admin-studio-context-pill">
                    <span>Section</span>
                    <strong>{draft.sectionNumber || "Not selected"}</strong>
                  </div>
                  <div className="admin-studio-context-pill">
                    <span>Practice Type</span>
                    <strong>{draft.practiceType}</strong>
                  </div>
                  <div className="admin-studio-context-pill">
                    <span>Target Difficulty</span>
                    <strong>{draft.targetDifficulty}</strong>
                  </div>
                  <div className="admin-studio-context-pill">
                    <span>Time Limit</span>
                    <strong>{draft.duration} min</strong>
                  </div>
                  <div className="admin-studio-context-pill">
                    <span>Source Language</span>
                    <strong>{draft.sourceLanguage || "Auto detect"}</strong>
                  </div>
                  <div className="admin-studio-context-pill">
                    <span>Output Language</span>
                    <strong>{draft.outputLanguage || "Match source"}</strong>
                  </div>
                </div>
                <div className="admin-studio-context-footnote">
                  <strong>Section image</strong>
                  <span>{sectionImage ? sectionImage.name : "No image uploaded yet"}</span>
                </div>
                <div className="admin-studio-context-footnote">
                  <strong>Section text</strong>
                  <span>
                    {draft.sectionText
                      ? `${draft.sectionText.length.toLocaleString()} characters ready for Layer 1`
                      : "No OCR text added yet"}
                  </span>
                </div>
              </div>

              <div className="admin-studio-pipeline-wheel-card">
                <div
                  className={`admin-studio-pipeline-wheel is-${pipelineStatus}`}
                  style={{ "--pipeline-progress": `${pipelineCompletion}%` }}
                >
                  <div className="admin-studio-pipeline-core">
                    <strong>{pipelineCompletion}%</strong>
                    <span>{pipelineSummaryText}</span>
                  </div>
                  {pipelineLayers.map((layer, index) => {
                    const angle = (360 / pipelineLayers.length) * index - 90;
                    const state =
                      pipelineLayerStatuses[index] === "completed"
                        ? "is-complete"
                        : index === activeLayerIndex && isPipelineBusy
                          ? "is-active"
                          : "is-pending";

                    return (
                      <div
                        key={layer}
                        className={`admin-studio-pipeline-node ${state}`}
                        style={{
                          transform: `translate(-50%, -50%) rotate(${angle}deg) translate(0, -150px) rotate(${-angle}deg)`,
                        }}
                      >
                        <span>{index + 1}</span>
                        <strong>{layer}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <aside className="admin-studio-sidecard">
              <div className="admin-panel-head">
                <h3>Run controls</h3>
                <span>Start, stop, and inspect layer progression here.</span>
              </div>
              <div className="admin-studio-balance-list">
                {pipelineLayers.map((layer, index) => (
                  <div key={layer} className="admin-studio-layer-control-row">
                    <div>
                      <span>{layer}</span>
                      <strong>{getLayerStatusLabel(pipelineLayerStatuses[index])}</strong>
                    </div>
                    <div className="admin-studio-layer-control-actions">
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={isPipelineBusy}
                        onClick={() => runPipeline(index + 1)}
                      >
                        Run
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={
                          !isPipelineBusy ||
                          activeLayerIndex !== index
                        }
                        onClick={abortPipeline}
                      >
                        Abort
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="admin-studio-pipeline-actions">
                <button
                  className="primary-button"
                  type="button"
                  disabled={isPipelineBusy}
                  onClick={() => runPipeline()}
                >
                  {pipelineStatus === "completed" ? "Run All Again" : "Run All"}
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  disabled={!isPipelineBusy}
                  onClick={abortPipeline}
                >
                  Abort All
                </button>
                {(pipelineStatus === "aborted" || pipelineStatus === "completed") ? (
                  <button className="ghost-button" type="button" onClick={resetPipeline}>
                    Reset
                  </button>
                ) : null}
                {pipelineJobId ? (
                  <Link
                    className="primary-button"
                    to={`/admin/ai-assessment-studio/workbench/${encodeURIComponent(pipelineJobId)}`}
                  >
                    Open Workbench
                  </Link>
                ) : null}
                {pipelineJobId ? (
                  <Link
                    className="ghost-button"
                    to={`/admin/ai-assessment-studio/audit/${encodeURIComponent(pipelineJobId)}`}
                  >
                    Open Audit Log
                  </Link>
                ) : null}
              </div>
              {pipelineError ? (
                <p className="admin-studio-pipeline-error">{pipelineError}</p>
              ) : null}

              <div className="admin-studio-token-card">
                <div className="admin-panel-head">
                  <h3>Token usage</h3>
                  <span>Estimated consumption by layer for this run.</span>
                </div>
                <div className="admin-studio-token-list">
                  {pipelineTokenRows.map((row) => (
                    <div key={row.layer} className="admin-studio-token-row">
                      <span>{row.layer}</span>
                      <strong>{row.usedTokens.toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
                <div className="admin-studio-token-total">
                  <span>Total</span>
                  <strong>{totalTokensUsed.toLocaleString()} tokens</strong>
                </div>
              </div>
            </aside>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="admin-studio-panel">
          <div className="admin-panel-head">
            <h2>Step 3: Source strategy</h2>
            <span>Choose how this draft should begin and let the studio shape the first structure.</span>
          </div>
          <div className="admin-studio-strategy-layout">
            <div className="admin-studio-source-grid">
              {sourceOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`admin-studio-source-card ${
                    draft.source === option.id ? "is-active" : ""
                  }`}
                  onClick={() => {
                    if (option.id === "manual") {
                      updateDraft({ source: option.id });
                      openManualBuilder();
                      return;
                    }

                    updateDraft({ source: option.id });
                  }}
                >
                  <strong>{option.label}</strong>
                  <p>{option.description}</p>
                </button>
              ))}
            </div>

            <aside className="admin-studio-ai-panel">
              <div className="admin-panel-head">
                <h3>AI starter guidance</h3>
                <span>Based on chapter context</span>
              </div>
              {launchContext ? (
                <div className="admin-studio-context-banner">
                  <strong>Active recommendation</strong>
                  <p>{launchContext}</p>
                </div>
              ) : null}
              <div className="admin-studio-ai-list">
                {aiRecommendations.map((item) => (
                  <article key={item.title} className="admin-studio-ai-card">
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </article>
                ))}
              </div>
            </aside>
          </div>

          {draft.source === "duplicate" ? (
            <div className="admin-studio-duplicate-panel">
              <div className="admin-panel-head">
                <h3>Duplicate from an existing set</h3>
                <span>Reuse a structure and adapt quickly</span>
              </div>
              <div className="admin-studio-duplicate-grid">
                {duplicateCandidates.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`admin-studio-duplicate-card ${
                      draft.duplicateBaseId === item.id ? "is-active" : ""
                    }`}
                    onClick={() => updateDraft({ duplicateBaseId: item.id })}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.type}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 3 ? (
        <section className="admin-studio-panel">
          <div className="admin-panel-head">
            <h2>Step 4: Studio canvas</h2>
            <span>Assemble the assessment, control order, and balance sections explicitly.</span>
          </div>
          <div className="admin-studio-canvas-layout">
            <div className="admin-studio-builder">
              <div className="admin-studio-column">
                <div className="admin-studio-column-head">
                  <h3>Available Questions</h3>
                  <span>{remainingQuestions.length} remaining</span>
                </div>
                <div className="admin-studio-question-list">
                  {remainingQuestions.map((item) => (
                    <article key={item.id} className="admin-studio-question-card">
                      <div>
                        <strong>{item.title}</strong>
                        <span>
                          {item.kind} · {item.difficulty}
                        </span>
                      </div>
                      <div className="admin-studio-question-actions">
                        {sectionOptions.slice(0, 2).map((section) => (
                          <button
                            key={section}
                            className="ghost-button"
                            type="button"
                            onClick={() => addQuestion(item.id, section)}
                          >
                            Add to {section}
                          </button>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="admin-studio-column">
                <div className="admin-studio-column-head">
                  <h3>Practice Set</h3>
                  <span>{selectedQuestions.length} selected</span>
                </div>
                <div className="admin-studio-question-list">
                  {selectedQuestions.map((item, index) => (
                    <article key={item.id} className="admin-studio-question-card is-selected">
                      <div>
                        <strong>
                          {index + 1}. {item.title}
                        </strong>
                        <span>
                          {item.kind} · {item.section}
                        </span>
                      </div>
                      <div className="admin-studio-question-actions">
                        <select
                          value={item.section}
                          onChange={(event) => assignSection(item.id, event.target.value)}
                        >
                          {sectionOptions.map((section) => (
                            <option key={section}>{section}</option>
                          ))}
                        </select>
                        <button className="ghost-button" type="button" onClick={() => moveQuestion(item.id, "up")}>
                          Up
                        </button>
                        <button className="ghost-button" type="button" onClick={() => moveQuestion(item.id, "down")}>
                          Down
                        </button>
                        <button className="ghost-button" type="button" onClick={() => removeQuestion(item.id)}>
                          Remove
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>

            <aside className="admin-studio-sidepanel">
              <div className="admin-studio-sidecard">
                <div className="admin-panel-head">
                  <h3>Section balance</h3>
                  <span>Draft structure</span>
                </div>
                <div className="admin-studio-balance-list">
                  {sectionSummary.map((item) => (
                    <div key={item.section} className="admin-studio-balance-row">
                      <span>{item.section}</span>
                      <strong>{item.count}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="admin-studio-sidecard">
                <div className="admin-panel-head">
                  <h3>Question mix</h3>
                  <span>Current composition</span>
                </div>
                <div className="admin-studio-balance-list">
                  {Object.entries(selectedTypeCounts).map(([kind, count]) => (
                    <div key={kind} className="admin-studio-balance-row">
                      <span>{kind}</span>
                      <strong>{count}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="admin-studio-sidecard">
                <div className="admin-panel-head">
                  <h3>AI composition notes</h3>
                  <span>Suggested improvements</span>
                </div>
                <div className="admin-studio-ai-list compact">
                  <article className="admin-studio-ai-card">
                    <strong>Add one visual question</strong>
                    <p>Current selection is light on diagram-based recall.</p>
                  </article>
                  <article className="admin-studio-ai-card">
                    <strong>Keep one retry item last</strong>
                    <p>End with a misconception-correction prompt to reinforce memory.</p>
                  </article>
                </div>
              </div>
            </aside>
          </div>
        </section>
      ) : null}

      <div className="admin-studio-footer">
        <button
          className="ghost-button"
          type="button"
          disabled={step === 0}
          onClick={() => setStep((current) => current - 1)}
        >
          Back
        </button>
        <div className="admin-studio-footer-actions">
          <button className="ghost-button" type="button">
            Save Draft
          </button>
          {step < stepLabels.length - 1 ? (
            <button
              className="primary-button"
              type="button"
              disabled={step === 1 && isPipelineBusy}
              onClick={() => setStep((current) => current + 1)}
            >
              {step === 0 ? "Continue" : "Next"}
            </button>
          ) : (
            <>
              <button className="ghost-button" type="button">
                Preview Blueprint
              </button>
              <Link className="primary-button" to={`/admin/assessment-studio/manual?subject=${encodeURIComponent(draft.subject)}&class=${encodeURIComponent(draft.className)}&chapter=${encodeURIComponent(draft.chapter)}&practiceType=${encodeURIComponent(draft.practiceType)}&sectionNumber=${encodeURIComponent(draft.sectionNumber)}`}>
                Open Manual Builder
              </Link>
              <button className="primary-button" type="button">
                Finish Setup
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
};
