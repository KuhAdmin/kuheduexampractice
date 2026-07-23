import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { StudentMediaViewer } from "../components/StudentMediaViewer";
import { StudentMicroActivityPanel } from "../components/StudentMicroActivityPanel";
import { StudentAiTutorPanel } from "../components/StudentAiTutorPanel";
import { MathPreview } from "../components/MathPreview";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { getStudentConceptCard, getStudentConceptSectionMedia, getStudentSections } from "../api/client";

const ConceptLearningIcon = ({ type, className = "" }) => {
  const classes = `student-dashboard-icon ${className}`.trim();

  if (type === "back") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
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
  }

  if (type === "chevron-left") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="m14.5 6-6 6 6 6"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.9"
        />
      </svg>
    );
  }

  if (type === "chevron-down") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="m7 10 5 5 5-5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.9"
        />
      </svg>
    );
  }

  // Same rect + play-triangle glyph used for the video placeholder on the
  // section-level Memory Booster page, kept consistent here.
  if (type === "video") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="m10 9.5 5 3-5 3z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    );
  }

  if (type === "image") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="8.5" cy="10" r="1.4" fill="currentColor" />
        <path
          d="m5 16 4.5-4.5L13 15l2-2 4 4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
      </svg>
    );
  }

  if (type === "home") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="m4 11 8-6.5L20 11v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
    );
  }

  if (type === "check") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="m5 12.5 4.5 4.5L19 7"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.2"
        />
      </svg>
    );
  }

  if (type === "book") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M4 5.5c0-.83.67-1.5 1.5-1.5H12v16H5.5A1.5 1.5 0 0 0 4 21.5v-16Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
        <path
          d="M20 5.5c0-.83-.67-1.5-1.5-1.5H12v16h6.5a1.5 1.5 0 0 1 1.5 1.5v-16Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
      <path
        d="m9.5 6 6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
};

const TABS = ["Learn", "Explore", "Practice", "Notes"];

// Ordered, real fields only -- mirrors exactly what renderExploreMode's
// accordion already checks for presence, just as a sequence instead of a
// grid, so the step rail and the old accordion never drift apart on what
// counts as "this concept has X".
const EXPLORE_STEPS = [
  { key: "analogy", label: "Analogy", subtitle: "Understand with comparison", hasContent: (c) => Boolean(c.analogy) },
  { key: "story", label: "Story", subtitle: "A short story to connect", hasContent: (c) => Boolean(c.story) },
  { key: "visualHook", label: "Visual Hook", subtitle: "See it to believe it", hasContent: (c) => Boolean(c.visualHook) },
  {
    key: "realWorldConnection",
    label: "Real World Connection",
    subtitle: "Where it matters",
    hasContent: (c) => Boolean(c.realWorldConnection),
  },
  {
    key: "curiosityHook",
    label: "Curiosity Hook",
    subtitle: "Spark your curiosity",
    hasContent: (c) => Boolean(c.curiosityHook),
  },
  {
    key: "microActivity",
    label: "Try This",
    subtitle: "Put it into practice",
    hasContent: (c) => Boolean(c.microActivity),
  },
  {
    key: "memoryTrick",
    label: "Memory Trick",
    subtitle: "A trick to remember it",
    hasContent: (c) => Boolean(c.memoryTrick),
  },
  {
    key: "misconceptions",
    label: "Common Misconceptions",
    subtitle: "Clear up confusion",
    hasContent: (c) => Boolean(c.misconceptions?.length || c.misconceptionAlert),
  },
  {
    key: "supportingConcepts",
    label: "Supporting Concepts",
    subtitle: "Concepts that support this",
    hasContent: (c) => Boolean(c.supportingConcepts?.length),
  },
  {
    key: "retrievalCues",
    label: "Retrieval Cues",
    subtitle: "Quick recall cues",
    hasContent: (c) => Boolean(c.retrievalCues?.length),
  },
  {
    key: "associatedConcepts",
    label: "Associated Concepts",
    subtitle: "Related ideas",
    hasContent: (c) => Boolean(c.associatedConcepts?.length),
  },
];

// Collapsible card for the Explore tab. mediaType ("image" | "video" | null)
// hints at the kind of media a future admin authoring pass will attach to
// this section -- the icon is purely indicative for now, no media is stored
// or rendered yet.
const ExploreSection = ({ sectionKey, title, mediaType, isExpanded, onToggle, children }) => (
  <section className="student-concept-learning-card student-explore-section">
    <button
      type="button"
      className="student-explore-section-header"
      onClick={() => onToggle(sectionKey)}
      aria-expanded={isExpanded}
    >
      {mediaType && <ConceptLearningIcon type={mediaType} />}
      <span className="student-explore-section-title">{title}</span>
      <ConceptLearningIcon type="chevron-down" className={isExpanded ? "is-expanded" : ""} />
    </button>
    {isExpanded && (
      <div className="student-concept-learning-copy student-explore-section-body">{children}</div>
    )}
  </section>
);

// Turns a concept card's knowledge fields into a slide sequence: the core
// narrative first, then any relationships/processes/comparisons that exist,
// skipping dimensions the pipeline left empty for this concept.
const buildLearnSlides = (card) => {
  const slides = [];

  const introParagraphs = [card.contextSummary, card.learningObjective].filter(Boolean);
  if (introParagraphs.length || card.coreConcepts?.length || card.formula) {
    slides.push({
      heading: card.primaryConcept,
      formula: card.formula,
      body: introParagraphs,
      list: card.coreConcepts,
    });
  }

  if (card.processes?.length) {
    slides.push({
      heading: "Process",
      body: card.processes
        .map((item) => item?.summary || item?.description || (typeof item === "string" ? item : ""))
        .filter(Boolean),
    });
  }

  if (card.relationships?.length) {
    slides.push({
      heading: "How this connects",
      body: card.relationships
        .map((item) => item?.relationship_summary || item?.summary)
        .filter(Boolean),
    });
  }

  if (card.comparisons?.length) {
    slides.push({
      heading: "Comparisons",
      body: card.comparisons
        .map((item) => item?.key_difference || item?.comparison_basis || item?.summary)
        .filter(Boolean),
    });
  }

  return slides.length ? slides : [{ heading: card.primaryConcept, body: [card.learningObjective].filter(Boolean) }];
};

export const StudentConceptLearningPage = () => {
  const navigate = useNavigate();
  const tier = useBreakpoint();
  const isDesktop = tier !== "mobile";
  const { chapterId: chapterNumber, sectionId: sourceSectionId, conceptId: assessmentUnitId } = useParams();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [expandedSections, setExpandedSections] = useState(() => new Set());
  const [breadcrumbMeta, setBreadcrumbMeta] = useState({ chapterName: "", sectionNumber: "", topicName: "" });
  const [activeExploreStepKey, setActiveExploreStepKey] = useState(null);
  const [visitedExploreSteps, setVisitedExploreSteps] = useState(() => new Set());
  // Memory-hook media (base64 image/video, up to ~20MB per section) is
  // deliberately NOT part of the concept card payload -- it's fetched one
  // section at a time, only for the section actually being viewed, keyed
  // here by section key. Absent key = not fetched yet, null = fetched,
  // confirmed no media for that section.
  const [sectionMediaByKey, setSectionMediaByKey] = useState({});
  // Tracks which section keys have already been fetched (or are in flight),
  // synchronously, so a fast double-toggle/double-navigation can't fire the
  // same request twice while the first one is still pending.
  const requestedMediaKeysRef = useRef(new Set());

  const toggleSection = (sectionKey) => {
    setExpandedSections((current) => {
      const next = new Set(current);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
        ensureSectionMedia(sectionKey);
      }
      return next;
    });
  };

  const ensureSectionMedia = (sectionKey) => {
    if (requestedMediaKeysRef.current.has(sectionKey)) {
      return;
    }
    requestedMediaKeysRef.current.add(sectionKey);

    getStudentConceptSectionMedia(assessmentUnitId, sectionKey)
      .then((result) => {
        setSectionMediaByKey((current) => ({ ...current, [sectionKey]: result?.media || null }));
      })
      .catch(() => {
        setSectionMediaByKey((current) => ({ ...current, [sectionKey]: null }));
      });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setSectionMediaByKey({});
    requestedMediaKeysRef.current = new Set();

    getStudentConceptCard(assessmentUnitId)
      .then((result) => {
        if (!cancelled) setCard(result);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || "This concept has not been generated yet.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [assessmentUnitId]);

  // Breadcrumb chapter/section labels (the concept's own name for the
  // current crumb comes from the concept card itself) -- same endpoint
  // StudentChapterDetailPage already uses for its own header, so this
  // doesn't add a new data source, just reuses an existing one.
  useEffect(() => {
    let cancelled = false;

    getStudentSections(chapterNumber)
      .then((result) => {
        if (cancelled) return;
        const section = (result?.sections || []).find(
          (item) => String(item.sourceSectionId) === String(sourceSectionId)
        );
        setBreadcrumbMeta({
          chapterName: result?.chapterName || "",
          sectionNumber: section?.sectionNumber || "",
          topicName: section?.topicName || section?.sectionNumber || "",
        });
      })
      .catch(() => {
        if (!cancelled) setBreadcrumbMeta({ chapterName: "", sectionNumber: "", topicName: "" });
      });

    return () => {
      cancelled = true;
    };
  }, [chapterNumber, sourceSectionId]);

  const slides = useMemo(() => (card ? buildLearnSlides(card) : []), [card]);
  const totalSlides = slides.length;
  const activeSlide = slides[activeSlideIndex] || slides[0];

  const exploreSteps = useMemo(
    () => (card ? EXPLORE_STEPS.filter((step) => step.hasContent(card)) : []),
    [card]
  );

  useEffect(() => {
    const firstStepKey = exploreSteps[0]?.key || null;
    setActiveExploreStepKey(firstStepKey);
    setVisitedExploreSteps(new Set(firstStepKey ? [firstStepKey] : []));
    if (firstStepKey) {
      ensureSectionMedia(firstStepKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentUnitId, exploreSteps.length]);

  const goToExploreStep = (key) => {
    setActiveExploreStepKey(key);
    setVisitedExploreSteps((current) => new Set(current).add(key));
    ensureSectionMedia(key);
  };

  const activeExploreStepIndex = exploreSteps.findIndex((step) => step.key === activeExploreStepKey);

  const renderLearnMode = () => (
    <>
      <section className="student-concept-learning-card">
        <div className="student-concept-learning-copy">
          <h2>{activeSlide?.heading}</h2>
          {activeSlide?.formula && <MathPreview text={activeSlide.formula} />}
          {(activeSlide?.body || []).map((paragraph) => (
            <div key={paragraph}>
              <p>{paragraph}</p>
              <MathPreview text={paragraph} />
            </div>
          ))}
          {activeSlide?.list?.length > 0 && (
            <ul className="student-concept-learning-list">
              {activeSlide.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {card?.memoryHooks?.length > 0 && (
        <section className="student-memory-hook-card">
          <span className="student-memory-hook-label">Memory Hook</span>
          <p>{card.memoryHooks[0]?.memory_hook}</p>
        </section>
      )}

      <footer className="student-concept-learning-footer">
        <button
          type="button"
          className="student-concept-learning-nav is-previous"
          onClick={() => setActiveSlideIndex((current) => Math.max(current - 1, 0))}
          disabled={activeSlideIndex === 0}
        >
          <ConceptLearningIcon type="chevron-left" />
          <span>Previous</span>
        </button>
        <span className="student-concept-learning-counter">
          {activeSlideIndex + 1}/{totalSlides}
        </span>
        <button
          type="button"
          className="student-concept-learning-nav is-next"
          onClick={() => setActiveSlideIndex((current) => Math.min(current + 1, totalSlides - 1))}
          disabled={activeSlideIndex === totalSlides - 1}
        >
          <span>Next</span>
          <ConceptLearningIcon type="chevron-right" />
        </button>
      </footer>
    </>
  );

  // Desktop/tablet step view: one field at a time, image/video on the left
  // and text on the right (matching the reference layout), driven by the
  // same real card fields the mobile accordion (renderExploreMode below)
  // already reads -- no new data, just a different presentation of it.
  const renderExploreStepContent = () => {
    const step = exploreSteps[activeExploreStepIndex];
    if (!step) return null;

    if (step.key === "misconceptions") {
      const misconceptionEntries = card.misconceptions?.length ? card.misconceptions : [];
      return (
        <div className="student-concept-step-copy is-full-width">
          {card.misconceptionAlert && (
            <>
              <p>{card.misconceptionAlert}</p>
              <MathPreview text={card.misconceptionAlert} />
            </>
          )}
          {misconceptionEntries.length > 0 && (
            <ul className="student-concept-learning-list">
              {misconceptionEntries.map((entry, index) => (
                <li key={`${entry.misconception}-${index}`}>
                  <strong>{entry.misconception}</strong>
                  {entry.correction ? ` — ${entry.correction}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }

    if (step.key === "supportingConcepts" || step.key === "associatedConcepts") {
      const items = card[step.key] || [];
      return (
        <div className="student-concept-step-copy is-full-width">
          {step.key === "supportingConcepts" ? (
            <ul className="student-concept-learning-list">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <div className="student-concept-explore-tags">
              {items.map((item) => (
                <span key={item} className="student-concept-explore-tag">
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (step.key === "retrievalCues") {
      return (
        <div className="student-concept-step-copy is-full-width">
          <div className="student-concept-explore-tags">
            {(card.retrievalCues || []).map((cue) => (
              <span key={cue} className="student-concept-explore-tag">
                {cue}
              </span>
            ))}
          </div>
        </div>
      );
    }

    const media = sectionMediaByKey[step.key];
    const text = card[step.key];

    // Try This is an interactive task (photo/text + submit + feedback), not
    // a passive image/video to view -- always single-column, and only ever
    // shows real media if the pipeline actually generated some (matching
    // the mobile accordion/StudentMemoryBoosterPage's own behavior); never
    // the "Visual coming soon" placeholder, which just wastes space next to
    // an activity that isn't waiting on a visual at all.
    if (step.key === "microActivity") {
      return (
        <div className="student-concept-step-copy is-full-width">
          <h3>{step.subtitle}</h3>
          {media && (
            <StudentMediaViewer
              mediaType={media.mediaType}
              src={media.mediaData}
              alt={`${step.label} illustration`}
            />
          )}
          <StudentMicroActivityPanel assessmentUnitId={assessmentUnitId} prompt={text} />
        </div>
      );
    }

    return (
      <div className="student-concept-step-split">
        <div className="student-concept-step-media">
          {media === undefined ? (
            <div className="student-memory-booster-media-placeholder">
              <span>Loading visual...</span>
            </div>
          ) : media ? (
            <StudentMediaViewer
              mediaType={media.mediaType}
              src={media.mediaData}
              alt={`${step.label} illustration`}
              speechText={text}
            />
          ) : (
            <div className="student-memory-booster-media-placeholder">
              <ConceptLearningIcon type="image" />
              <span>Visual coming soon</span>
            </div>
          )}
        </div>
        <div className="student-concept-step-copy">
          <h3>{step.subtitle}</h3>
          <p>{text}</p>
          <MathPreview text={text} />
        </div>
      </div>
    );
  };

  const renderExploreRail = () => (
    <aside className="student-concept-explore-rail" aria-label="Explore steps">
      <h2>Explore</h2>
      <ol>
        {exploreSteps.map((step, index) => (
          <li key={step.key}>
            <button
              type="button"
              className={`student-concept-explore-rail-item ${step.key === activeExploreStepKey ? "is-active" : ""}`}
              onClick={() => goToExploreStep(step.key)}
            >
              <span className="student-concept-explore-rail-index">
                {visitedExploreSteps.has(step.key) && step.key !== activeExploreStepKey ? (
                  <ConceptLearningIcon type="check" />
                ) : (
                  index + 1
                )}
              </span>
              <span className="student-concept-explore-rail-copy">
                <strong>{step.label}</strong>
                <span>{step.subtitle}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </aside>
  );

  const renderExploreMode = () => {
    const misconceptionEntries = card?.misconceptions?.length ? card.misconceptions : [];
    const hasAnyExploreContent =
      card?.analogy ||
      card?.story ||
      card?.visualHook ||
      card?.realWorldConnection ||
      card?.curiosityHook ||
      card?.microActivity ||
      card?.memoryTrick ||
      misconceptionEntries.length > 0 ||
      card?.misconceptionAlert ||
      card?.retrievalCues?.length > 0 ||
      card?.associatedConcepts?.length > 0 ||
      card?.supportingConcepts?.length > 0;

    if (!hasAnyExploreContent) {
      return (
        <section className="student-concept-learning-card">
          <div className="student-concept-learning-copy">
            <h2>Supporting concepts</h2>
            <p>No supporting concepts recorded for this idea.</p>
          </div>
        </section>
      );
    }

    const isExpanded = (sectionKey) => expandedSections.has(sectionKey);

    return (
      <div className="student-explore-grid">
        {card.analogy && (
          <ExploreSection
            sectionKey="analogy"
            title="Analogy"
            mediaType="image"
            isExpanded={isExpanded("analogy")}
            onToggle={toggleSection}
          >
            {sectionMediaByKey.analogy && (
              <StudentMediaViewer
                mediaType={sectionMediaByKey.analogy.mediaType}
                src={sectionMediaByKey.analogy.mediaData}
                alt="Analogy illustration"
                speechText={card.analogy}
              />
            )}
            <p>{card.analogy}</p>
            <MathPreview text={card.analogy} />
          </ExploreSection>
        )}

        {card.story && (
          <ExploreSection
            sectionKey="story"
            title="Story"
            mediaType="video"
            isExpanded={isExpanded("story")}
            onToggle={toggleSection}
          >
            {sectionMediaByKey.story && (
              <StudentMediaViewer
                mediaType={sectionMediaByKey.story.mediaType}
                src={sectionMediaByKey.story.mediaData}
                alt="Story"
                speechText={card.story}
              />
            )}
            <p>{card.story}</p>
            <MathPreview text={card.story} />
          </ExploreSection>
        )}

        {card.visualHook && (
          <ExploreSection
            sectionKey="visualHook"
            title="Visual Hook"
            mediaType="image"
            isExpanded={isExpanded("visualHook")}
            onToggle={toggleSection}
          >
            {sectionMediaByKey.visualHook && (
              <StudentMediaViewer
                mediaType={sectionMediaByKey.visualHook.mediaType}
                src={sectionMediaByKey.visualHook.mediaData}
                alt="Visual Hook illustration"
                speechText={card.visualHook}
              />
            )}
            <p>{card.visualHook}</p>
            <MathPreview text={card.visualHook} />
          </ExploreSection>
        )}

        {card.realWorldConnection && (
          <ExploreSection
            sectionKey="realWorldConnection"
            title="Real World Connection"
            mediaType="video"
            isExpanded={isExpanded("realWorldConnection")}
            onToggle={toggleSection}
          >
            {sectionMediaByKey.realWorldConnection && (
              <StudentMediaViewer
                mediaType={sectionMediaByKey.realWorldConnection.mediaType}
                src={sectionMediaByKey.realWorldConnection.mediaData}
                alt="Real World Connection"
                speechText={card.realWorldConnection}
              />
            )}
            <p>{card.realWorldConnection}</p>
            <MathPreview text={card.realWorldConnection} />
          </ExploreSection>
        )}

        {card.curiosityHook && (
          <ExploreSection
            sectionKey="curiosityHook"
            title="Curiosity Hook"
            mediaType="image"
            isExpanded={isExpanded("curiosityHook")}
            onToggle={toggleSection}
          >
            {sectionMediaByKey.curiosityHook && (
              <StudentMediaViewer
                mediaType={sectionMediaByKey.curiosityHook.mediaType}
                src={sectionMediaByKey.curiosityHook.mediaData}
                alt="Curiosity Hook illustration"
                speechText={card.curiosityHook}
              />
            )}
            <p>{card.curiosityHook}</p>
            <MathPreview text={card.curiosityHook} />
          </ExploreSection>
        )}

        {card.microActivity && (
          <ExploreSection
            sectionKey="microActivity"
            title="Try This"
            mediaType="video"
            isExpanded={isExpanded("microActivity")}
            onToggle={toggleSection}
          >
            {sectionMediaByKey.microActivity && (
              <StudentMediaViewer
                mediaType={sectionMediaByKey.microActivity.mediaType}
                src={sectionMediaByKey.microActivity.mediaData}
                alt="Try This"
                speechText={card.microActivity}
              />
            )}
            <StudentMicroActivityPanel assessmentUnitId={assessmentUnitId} prompt={card.microActivity} />
          </ExploreSection>
        )}

        {card.memoryTrick && (
          <ExploreSection
            sectionKey="memoryTrick"
            title="Memory Trick"
            mediaType="image"
            isExpanded={isExpanded("memoryTrick")}
            onToggle={toggleSection}
          >
            {sectionMediaByKey.memoryTrick && (
              <StudentMediaViewer
                mediaType={sectionMediaByKey.memoryTrick.mediaType}
                src={sectionMediaByKey.memoryTrick.mediaData}
                alt="Memory Trick illustration"
                speechText={card.memoryTrick}
              />
            )}
            <p>{card.memoryTrick}</p>
            <MathPreview text={card.memoryTrick} />
          </ExploreSection>
        )}

        {(misconceptionEntries.length > 0 || card.misconceptionAlert) && (
          <ExploreSection
            sectionKey="misconceptions"
            title="Common Misconceptions"
            mediaType={null}
            isExpanded={isExpanded("misconceptions")}
            onToggle={toggleSection}
          >
            {card.misconceptionAlert && (
              <>
                <p>{card.misconceptionAlert}</p>
                <MathPreview text={card.misconceptionAlert} />
              </>
            )}
            {misconceptionEntries.length > 0 && (
              <ul className="student-concept-learning-list">
                {misconceptionEntries.map((entry, index) => (
                  <li key={`${entry.misconception}-${index}`}>
                    <strong>{entry.misconception}</strong>
                    {entry.correction ? ` — ${entry.correction}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </ExploreSection>
        )}

        {card.supportingConcepts?.length > 0 && (
          <ExploreSection
            sectionKey="supportingConcepts"
            title="Supporting concepts"
            mediaType={null}
            isExpanded={isExpanded("supportingConcepts")}
            onToggle={toggleSection}
          >
            <ul className="student-concept-learning-list">
              {card.supportingConcepts.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </ExploreSection>
        )}

        {card.retrievalCues?.length > 0 && (
          <ExploreSection
            sectionKey="retrievalCues"
            title="Retrieval Cues"
            mediaType={null}
            isExpanded={isExpanded("retrievalCues")}
            onToggle={toggleSection}
          >
            <div className="student-concept-explore-tags">
              {card.retrievalCues.map((cue) => (
                <span key={cue} className="student-concept-explore-tag">
                  {cue}
                </span>
              ))}
            </div>
          </ExploreSection>
        )}

        {card.associatedConcepts?.length > 0 && (
          <ExploreSection
            sectionKey="associatedConcepts"
            title="Associated Concepts"
            mediaType={null}
            isExpanded={isExpanded("associatedConcepts")}
            onToggle={toggleSection}
          >
            <div className="student-concept-explore-tags">
              {card.associatedConcepts.map((concept) => (
                <span key={concept} className="student-concept-explore-tag">
                  {concept}
                </span>
              ))}
            </div>
          </ExploreSection>
        )}
      </div>
    );
  };

  const goToConceptAssessment = () =>
    navigate(`/chapters/${chapterNumber}/sections/${sourceSectionId}/concepts/${assessmentUnitId}/assessment`);

  // Practice was previously its own in-page tab with a single "Practice
  // This Concept" button whose only job was to navigate to the assessment
  // page -- a redundant extra click through a near-empty intermediate
  // screen. Selecting the tab now navigates straight there instead of
  // switching to local tab state.
  const selectTab = (tab) => {
    if (tab === "Practice") {
      goToConceptAssessment();
      return;
    }
    setActiveTab(tab);
  };

  const renderComingSoon = (label) => (
    <section className="student-concept-learning-card">
      <div className="student-concept-learning-copy">
        <h2>{label}</h2>
        <p>{label} is coming soon for this concept.</p>
      </div>
    </section>
  );

  // Desktop/tablet only: breadcrumb + hero card + tab bar as persistent
  // chrome, matching the reference design's Notion/Duolingo-style layout.
  // Only the Explore tab's content structure actually changes (accordion ->
  // step rail); Learn/Practice/Notes keep exactly their existing render
  // functions, just under this header instead of the plain back-button one.
  // Mobile is untouched -- see the unconditional return below this branch.
  if (isDesktop) {
    return (
      <StudentPageShell pageClass="student-page--concept-learning" legacyModifierClass="student-concept-learning-phone">
        <div className="student-concept-desktop">
          <nav className="student-concept-breadcrumb" aria-label="Breadcrumb">
            <button type="button" onClick={() => navigate("/dashboard")} aria-label="Home">
              <ConceptLearningIcon type="home" />
            </button>
            <ConceptLearningIcon type="chevron-right" />
            <button type="button" onClick={() => navigate(`/chapters/${chapterNumber}`)}>
              {`Chapter ${chapterNumber}${breadcrumbMeta.chapterName ? `. ${breadcrumbMeta.chapterName}` : ""}`}
            </button>
            <ConceptLearningIcon type="chevron-right" />
            <button type="button" onClick={() => navigate(`/chapters/${chapterNumber}/sections/${sourceSectionId}`)}>
              {breadcrumbMeta.topicName
                ? `${breadcrumbMeta.sectionNumber ? `${breadcrumbMeta.sectionNumber} ` : ""}${breadcrumbMeta.topicName}`
                : `Section ${sourceSectionId}`}
            </button>
            <ConceptLearningIcon type="chevron-right" />
            <span className="is-current">
              {`${assessmentUnitId ? `${assessmentUnitId} ` : ""}${card?.primaryConcept || ""}`}
            </span>
          </nav>

          <header className="student-concept-hero">
            <div className="student-concept-hero-icon">
              <ConceptLearningIcon type="book" />
            </div>
            <div className="student-concept-hero-copy">
              <span className="student-concept-hero-badge">Chapter {chapterNumber}</span>
              <h1>{card?.primaryConcept || "Concept"}</h1>
              {(card?.learningObjective || card?.contextSummary) && (
                <p>{card.learningObjective || card.contextSummary}</p>
              )}
            </div>
          </header>

          <nav className="student-concept-tabbar" aria-label="Concept modes">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                className={`student-concept-tabbar-tab ${tab === activeTab ? "is-active" : ""}`}
                onClick={() => selectTab(tab)}
              >
                {tab}
              </button>
            ))}
          </nav>

          {loading ? (
            <p className="student-empty-state">Loading concept...</p>
          ) : error || !card ? (
            <p className="student-empty-state">{error || "This concept has not been generated yet."}</p>
          ) : (
            <>
            <div
              className={`student-concept-desktop-body ${
                activeTab === "Explore" && exploreSteps.length > 0 ? "has-rail" : ""
              }`}
            >
              <div className="student-concept-desktop-main">
                {activeTab === "Learn" ? (
                  renderLearnMode()
                ) : activeTab === "Explore" ? (
                  exploreSteps.length > 0 ? (
                    <section className="student-concept-learning-card student-concept-step-card">
                      <div className="student-concept-step-heading">
                        <span className="student-concept-step-index">
                          {activeExploreStepIndex + 1}. {exploreSteps[activeExploreStepIndex]?.label}
                        </span>
                      </div>
                      {renderExploreStepContent()}
                      <footer className="student-concept-learning-footer is-two-up">
                        <button
                          type="button"
                          className="student-concept-learning-nav is-previous"
                          onClick={() =>
                            goToExploreStep(exploreSteps[Math.max(activeExploreStepIndex - 1, 0)].key)
                          }
                          disabled={activeExploreStepIndex <= 0}
                        >
                          <ConceptLearningIcon type="chevron-left" />
                          <span>Previous</span>
                        </button>
                        <button
                          type="button"
                          className="student-concept-learning-nav is-next"
                          onClick={() =>
                            goToExploreStep(
                              exploreSteps[Math.min(activeExploreStepIndex + 1, exploreSteps.length - 1)].key
                            )
                          }
                          disabled={activeExploreStepIndex >= exploreSteps.length - 1}
                        >
                          <span>Continue</span>
                          <ConceptLearningIcon type="chevron-right" />
                        </button>
                      </footer>
                    </section>
                  ) : (
                    <section className="student-concept-learning-card">
                      <div className="student-concept-learning-copy">
                        <h2>Supporting concepts</h2>
                        <p>No supporting concepts recorded for this idea.</p>
                      </div>
                    </section>
                  )
                ) : (
                  renderComingSoon(activeTab)
                )}
              </div>
              {activeTab === "Explore" && exploreSteps.length > 0 && renderExploreRail()}
            </div>
            {activeTab === "Explore" && card && (
              <StudentAiTutorPanel assessmentUnitId={assessmentUnitId} />
            )}
            </>
          )}
        </div>
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell pageClass="student-page--concept-learning" legacyModifierClass="student-concept-learning-phone">
        <header className="student-concept-learning-header">
          <button
            type="button"
            className="student-chapter-detail-back"
            aria-label="Back to section"
            onClick={() => navigate(`/chapters/${chapterNumber}/sections/${sourceSectionId}`)}
          >
            <ConceptLearningIcon type="back" />
          </button>
          <h1>{card?.primaryConcept || "Concept"}</h1>
        </header>

        <nav className="student-concept-learning-tabs" aria-label="Concept modes">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`student-concept-learning-tab ${tab === activeTab ? "is-active" : ""}`}
              onClick={() => selectTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>

        {loading ? (
          <p className="student-empty-state">Loading concept...</p>
        ) : error || !card ? (
          <p className="student-empty-state">{error || "This concept has not been generated yet."}</p>
        ) : activeTab === "Learn" ? (
          renderLearnMode()
        ) : activeTab === "Explore" ? (
          <>
            {renderExploreMode()}
            {card && <StudentAiTutorPanel assessmentUnitId={assessmentUnitId} />}
          </>
        ) : (
          renderComingSoon(activeTab)
        )}

    </StudentPageShell>
  );
};
