import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { StudentTestLabActivitySidebar } from "../components/StudentTestLabActivitySidebar";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { useClassSubject } from "../context/classSubjectHooks";
import { useAuth } from "../context/authHooks";
import { getTestLabFilterOptions, getRecentTestLabAttempts, startTestLabAttempt } from "../api/client";

const BackIcon = () => (
  <svg viewBox="0 0 24 24" className="student-dashboard-icon" aria-hidden="true">
    <path
      d="m15 6-6 6 6 6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    />
  </svg>
);

const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" className="student-testlab-chevron" aria-hidden="true">
    <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  </svg>
);

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" className="student-testlab-arrow-icon" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  </svg>
);

const HistoryIcon = () => (
  <svg viewBox="0 0 24 24" className="student-dashboard-icon" aria-hidden="true">
    <path
      d="M12 7v5l3.5 2M20 12a8 8 0 1 1-2.34-5.66"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
    <path d="M20 4v4h-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

const ShuffleIcon = () => (
  <svg viewBox="0 0 24 24" className="student-testlab-pick-card-icon-glyph" aria-hidden="true">
    <path
      d="M4 7h3.5l9 10H20M4 17h3.5l3-3.3M16.5 7H20m-3.5 10L20 13.5M16.5 7 20 10.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    />
  </svg>
);

const QUESTION_COUNT_OPTIONS = [10, 20, 30, 50];
const DEFAULT_QUESTION_COUNT = 20;
const CHAPTER_PREVIEW_LIMIT = 5;

export const StudentTestLabPage = () => {
  const navigate = useNavigate();
  const tier = useBreakpoint();
  const isDesktop = tier === "desktop";
  const { user } = useAuth();
  const { classSubjectOptions, selection, setSelection } = useClassSubject();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chapters, setChapters] = useState([]);
  const [interactionTypes, setInteractionTypes] = useState([]);
  const [selectedChapters, setSelectedChapters] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [questionCount, setQuestionCount] = useState(DEFAULT_QUESTION_COUNT);
  const [chaptersExpanded, setChaptersExpanded] = useState(false);
  const [recentAttempts, setRecentAttempts] = useState([]);
  const [attemptsLoading, setAttemptsLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    // Wait for the class/subject switcher's own selection to resolve before
    // asking the server -- without a selection yet, a profile-less account
    // (e.g. a superstudent) has nothing to fall back to and would flash the
    // "profile isn't set up" error for no reason.
    if (!selection) return undefined;

    let cancelled = false;
    setLoading(true);
    setError("");
    getTestLabFilterOptions(selection)
      .then((result) => {
        if (cancelled) return;
        const nextChapters = result?.chapters || [];
        const nextTypes = result?.interactionTypes || [];
        setChapters(nextChapters);
        setInteractionTypes(nextTypes);
        setSelectedChapters(nextChapters.map((chapter) => chapter.chapterNumber));
        setSelectedTypes(nextTypes.map((type) => type.value));
        setChaptersExpanded(false);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || "Failed to load TestLab filters.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selection]);

  useEffect(() => {
    let cancelled = false;
    getRecentTestLabAttempts()
      .then((result) => {
        if (!cancelled) setRecentAttempts(result?.attempts || []);
      })
      .catch(() => {
        if (!cancelled) setRecentAttempts([]);
      })
      .finally(() => {
        if (!cancelled) setAttemptsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const classOptions = useMemo(() => {
    const seen = new Map();
    classSubjectOptions.forEach((option) => {
      if (!seen.has(option.levelCode)) {
        seen.set(option.levelCode, { levelCode: option.levelCode, levelName: option.levelName });
      }
    });
    return Array.from(seen.values());
  }, [classSubjectOptions]);

  const subjectOptions = useMemo(
    () => classSubjectOptions.filter((option) => option.levelCode === selection?.levelCode),
    [classSubjectOptions, selection?.levelCode]
  );

  const handleClassChange = (levelCode) => {
    const optionsForClass = classSubjectOptions.filter((option) => option.levelCode === levelCode);
    const next = optionsForClass.find((option) => option.subjectCode === selection?.subjectCode) || optionsForClass[0];
    if (next) setSelection(next);
  };

  const handleSubjectChange = (subjectCode) => {
    const next = subjectOptions.find((option) => option.subjectCode === subjectCode);
    if (next) setSelection(next);
  };

  const toggleChapter = (chapterNumber) => {
    setSelectedChapters((current) =>
      current.includes(chapterNumber) ? current.filter((value) => value !== chapterNumber) : [...current, chapterNumber]
    );
  };

  const toggleType = (typeValue) => {
    setSelectedTypes((current) =>
      current.includes(typeValue) ? current.filter((value) => value !== typeValue) : [...current, typeValue]
    );
  };

  const allChaptersSelected = chapters.length > 0 && selectedChapters.length === chapters.length;

  const handleSelectAllChapters = () => {
    setSelectedChapters(allChaptersSelected ? [] : chapters.map((chapter) => chapter.chapterNumber));
  };

  const handleReset = () => {
    setSelectedChapters(chapters.map((chapter) => chapter.chapterNumber));
    setSelectedTypes(interactionTypes.map((type) => type.value));
    setQuestionCount(DEFAULT_QUESTION_COUNT);
    setStartError("");
  };

  const handleGenerateTest = () => {
    if (!selectedChapters.length) {
      setStartError("Select at least one chapter to generate a test.");
      return;
    }
    setStartError("");
    setStep(2);
  };

  const handleStartCustomMix = async () => {
    setStartError("");
    setStarting(true);
    try {
      const result = await startTestLabAttempt(selectedChapters, selectedTypes, selection, questionCount);
      navigate(`/test-lab/attempts/${result.attemptId}`);
    } catch (startAttemptError) {
      setStartError(startAttemptError.message || "Couldn't start this TestLab set. Try again.");
    } finally {
      setStarting(false);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStartError("");
      setStep(1);
      return;
    }
    navigate("/dashboard");
  };

  const visibleChapters = chaptersExpanded ? chapters : chapters.slice(0, CHAPTER_PREVIEW_LIMIT);
  const boardLabel = user?.board ? user.board.toUpperCase() : "CBSE";

  // Only "Custom Mix" is real today -- it's the sole card that reuses the
  // student's own Step 1 selections. The curated packs implied by a richer
  // design (grammar/vocabulary/reading-comprehension mixes) would need topic
  // tagging that doesn't exist anywhere in the question content yet, so they
  // aren't stubbed in here with copy that doesn't correspond to a real
  // filter -- see the "no synthetic concept hacks" precedent this codebase
  // already learned from. Built as a list (of one, for now) so a future real
  // pack is a new entry, not a restructure.
  const pickTestOptions = [
    {
      key: "custom",
      icon: <ShuffleIcon />,
      tone: "indigo",
      title: "Custom Mix",
      meta: `${questionCount} Questions${selection?.levelName ? ` • ${boardLabel} Class ${selection.levelName}` : ""}`,
      description: "Your selected filters",
      tags: [
        { label: "Mixed", tone: "blue" },
        { label: "Personalised", tone: "warning" },
      ],
      onStart: handleStartCustomMix,
    },
  ];

  return (
    <StudentPageShell pageClass="student-page--test-lab" legacyModifierClass="student-testlab-phone">
      <header className="student-testlab-header">
        {(!isDesktop || step === 2) && (
          <button
            type="button"
            className="student-chapter-detail-back"
            aria-label={step === 2 ? "Back to filters" : "Back to home"}
            onClick={handleBack}
          >
            <BackIcon />
          </button>
        )}
        <div className="student-testlab-header-copy">
          <h1>TestLab</h1>
          <p>Mixed practice sets, drawn fresh from Question Bank + HOTS.</p>
        </div>
        <button
          type="button"
          className="student-testlab-icon-button"
          aria-label="Recent sessions"
          onClick={() => setHistoryOpen(true)}
        >
          <HistoryIcon />
        </button>
      </header>

      {loading ? (
        <p className="student-empty-state">Loading TestLab...</p>
      ) : error ? (
        <p className="student-empty-state">{error}</p>
      ) : !chapters.length ? (
        <p className="student-empty-state">No chapters available for TestLab yet.</p>
      ) : (
        <div className="student-testlab-card">
          {step === 1 ? (
            <>
              <div className="student-testlab-step-heading">
                <span className="student-testlab-step-badge">1</span>
                <div>
                  <h2>Choose Filters</h2>
                  <p>Select question types and chapters</p>
                </div>
              </div>

              <div className="student-testlab-academic-row">
                <div className="student-testlab-academic-field">
                  <label htmlFor="testlab-board">Board</label>
                  <div className="student-testlab-academic-select-wrap">
                    <select id="testlab-board" className="student-testlab-academic-select" value={boardLabel} disabled>
                      <option value={boardLabel}>{boardLabel}</option>
                    </select>
                    <ChevronIcon />
                  </div>
                </div>
                <div className="student-testlab-academic-field">
                  <label htmlFor="testlab-class">Class</label>
                  <div className="student-testlab-academic-select-wrap">
                    <select
                      id="testlab-class"
                      className="student-testlab-academic-select"
                      value={selection?.levelCode || ""}
                      onChange={(event) => handleClassChange(event.target.value)}
                    >
                      {classOptions.map((option) => (
                        <option key={option.levelCode} value={option.levelCode}>
                          {option.levelName}
                        </option>
                      ))}
                    </select>
                    <ChevronIcon />
                  </div>
                </div>
                <div className="student-testlab-academic-field">
                  <label htmlFor="testlab-subject">Subject</label>
                  <div className="student-testlab-academic-select-wrap">
                    <select
                      id="testlab-subject"
                      className="student-testlab-academic-select"
                      value={selection?.subjectCode || ""}
                      onChange={(event) => handleSubjectChange(event.target.value)}
                    >
                      {subjectOptions.map((option) => (
                        <option key={option.subjectCode} value={option.subjectCode}>
                          {option.subjectName}
                        </option>
                      ))}
                    </select>
                    <ChevronIcon />
                  </div>
                </div>
              </div>

              <div className="student-testlab-two-col">
                <div className="student-testlab-section">
                  <div className="student-testlab-section-header">
                    <h4>
                      Question Types <span>(Select multiple)</span>
                    </h4>
                  </div>
                  <div className="student-testlab-checkbox-grid student-testlab-checkbox-grid--two-col">
                    {interactionTypes.map((type) => (
                      <label key={type.value} className="student-testlab-checkbox-row">
                        <input type="checkbox" checked={selectedTypes.includes(type.value)} onChange={() => toggleType(type.value)} />
                        <span>{type.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="student-testlab-section">
                  <div className="student-testlab-section-header">
                    <h4>
                      Chapters <span>(Select multiple)</span>
                    </h4>
                    <button type="button" className="student-testlab-select-all" onClick={handleSelectAllChapters}>
                      {allChaptersSelected ? "Clear All" : "Select All"}
                    </button>
                  </div>
                  <div className="student-testlab-checkbox-grid">
                    {visibleChapters.map((chapter) => (
                      <label key={chapter.id} className="student-testlab-checkbox-row">
                        <input
                          type="checkbox"
                          checked={selectedChapters.includes(chapter.chapterNumber)}
                          onChange={() => toggleChapter(chapter.chapterNumber)}
                        />
                        <span>
                          {chapter.chapterNumber}. {chapter.title}
                        </span>
                      </label>
                    ))}
                  </div>
                  {chapters.length > CHAPTER_PREVIEW_LIMIT && (
                    <button
                      type="button"
                      className="student-testlab-show-more"
                      onClick={() => setChaptersExpanded((current) => !current)}
                    >
                      {chaptersExpanded ? "Show fewer chapters" : "Show all chapters"} <span aria-hidden="true">{"›"}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="student-testlab-section">
                <h4>Number of Questions</h4>
                <div className="student-testlab-count-group">
                  {QUESTION_COUNT_OPTIONS.map((count) => (
                    <button
                      key={count}
                      type="button"
                      className={`student-testlab-count-button ${questionCount === count ? "is-active" : ""}`}
                      onClick={() => setQuestionCount(count)}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              {startError && <p className="student-testlab-start-error">{startError}</p>}

              <div className="student-testlab-actions">
                <button type="button" className="student-testlab-reset-button" onClick={handleReset}>
                  Reset
                </button>
                <button type="button" className="student-testlab-generate-button" disabled={starting} onClick={handleGenerateTest}>
                  {starting ? "Generating..." : "Generate Test"}
                  <ArrowIcon />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="student-testlab-step-heading">
                <span className="student-testlab-step-badge">2</span>
                <div>
                  <h2>Pick a Test</h2>
                  <p>Mixed set of {questionCount} questions (QB + HOTS)</p>
                </div>
              </div>

              {startError && <p className="student-testlab-start-error">{startError}</p>}

              <div className="student-testlab-pick-list">
                {pickTestOptions.map((option) => (
                  <div key={option.key} className="student-testlab-pick-card">
                    <div className="student-testlab-pick-card-head">
                      <span className={`student-testlab-pick-card-icon is-tone-${option.tone}`}>{option.icon}</span>
                      <div className="student-testlab-pick-card-copy">
                        <strong>{option.title}</strong>
                        <span>{option.meta}</span>
                        <span>{option.description}</span>
                      </div>
                    </div>
                    <div className="student-testlab-pick-card-footer">
                      <div className="student-testlab-pick-tags">
                        {option.tags.map((tag) => (
                          <span key={tag.label} className={`student-testlab-pick-tag is-tone-${tag.tone}`}>
                            {tag.label}
                          </span>
                        ))}
                      </div>
                      <button type="button" className="student-testlab-pick-start" disabled={starting} onClick={option.onStart}>
                        {starting ? "Starting..." : "Start Test"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {historyOpen && (
        <div className="student-testlab-drawer-backdrop" onClick={() => setHistoryOpen(false)}>
          <div className="student-testlab-drawer" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="student-testlab-drawer-close"
              aria-label="Close recent sessions"
              onClick={() => setHistoryOpen(false)}
            >
              &#10005;
            </button>
            <StudentTestLabActivitySidebar attempts={recentAttempts} loading={attemptsLoading} />
          </div>
        </div>
      )}
    </StudentPageShell>
  );
};
