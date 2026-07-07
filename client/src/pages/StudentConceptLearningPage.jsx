import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StudentBottomNav } from "../components/StudentBottomNav";
import { StudentMediaViewer } from "../components/StudentMediaViewer";
import { StudentMicroActivityPanel } from "../components/StudentMicroActivityPanel";
import { getStudentConceptCard } from "../api/client";

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
  if (introParagraphs.length || card.coreConcepts?.length) {
    slides.push({
      heading: card.primaryConcept,
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
  const { chapterId: chapterNumber, sectionId: sourceSectionId, conceptId: assessmentUnitId } = useParams();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [expandedSections, setExpandedSections] = useState(() => new Set());

  const toggleSection = (sectionKey) => {
    setExpandedSections((current) => {
      const next = new Set(current);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
      }
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

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

  const slides = useMemo(() => (card ? buildLearnSlides(card) : []), [card]);
  const totalSlides = slides.length;
  const activeSlide = slides[activeSlideIndex] || slides[0];

  const renderLearnMode = () => (
    <>
      <section className="student-concept-learning-card">
        <div className="student-concept-learning-copy">
          <h2>{activeSlide?.heading}</h2>
          {(activeSlide?.body || []).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
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
      <>
        {card.analogy && (
          <ExploreSection
            sectionKey="analogy"
            title="Analogy"
            mediaType="image"
            isExpanded={isExpanded("analogy")}
            onToggle={toggleSection}
          >
            {card.analogyMedia && (
              <StudentMediaViewer
                mediaType={card.analogyMedia.mediaType}
                src={card.analogyMedia.mediaData}
                alt="Analogy illustration"
                speechText={card.analogy}
              />
            )}
            <p>{card.analogy}</p>
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
            {card.storyMedia && (
              <StudentMediaViewer
                mediaType={card.storyMedia.mediaType}
                src={card.storyMedia.mediaData}
                alt="Story"
                speechText={card.story}
              />
            )}
            <p>{card.story}</p>
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
            {card.visualHookMedia && (
              <StudentMediaViewer
                mediaType={card.visualHookMedia.mediaType}
                src={card.visualHookMedia.mediaData}
                alt="Visual Hook illustration"
                speechText={card.visualHook}
              />
            )}
            <p>{card.visualHook}</p>
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
            {card.realWorldConnectionMedia && (
              <StudentMediaViewer
                mediaType={card.realWorldConnectionMedia.mediaType}
                src={card.realWorldConnectionMedia.mediaData}
                alt="Real World Connection"
                speechText={card.realWorldConnection}
              />
            )}
            <p>{card.realWorldConnection}</p>
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
            {card.curiosityHookMedia && (
              <StudentMediaViewer
                mediaType={card.curiosityHookMedia.mediaType}
                src={card.curiosityHookMedia.mediaData}
                alt="Curiosity Hook illustration"
                speechText={card.curiosityHook}
              />
            )}
            <p>{card.curiosityHook}</p>
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
            {card.microActivityMedia && (
              <StudentMediaViewer
                mediaType={card.microActivityMedia.mediaType}
                src={card.microActivityMedia.mediaData}
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
            {card.memoryTrickMedia && (
              <StudentMediaViewer
                mediaType={card.memoryTrickMedia.mediaType}
                src={card.memoryTrickMedia.mediaData}
                alt="Memory Trick illustration"
                speechText={card.memoryTrick}
              />
            )}
            <p>{card.memoryTrick}</p>
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
            {card.misconceptionAlert && <p>{card.misconceptionAlert}</p>}
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
      </>
    );
  };

  const renderPracticeMode = () => (
    <section className="student-concept-learning-card">
      <div className="student-concept-learning-copy">
        <p>Practice just this concept's questions to build focused, measurable progress.</p>
        <button
          type="button"
          className="student-concept-practice-next"
          onClick={() =>
            navigate(
              `/chapters/${chapterNumber}/sections/${sourceSectionId}/concepts/${assessmentUnitId}/assessment`
            )
          }
        >
          Practice This Concept
        </button>
      </div>
    </section>
  );

  const renderComingSoon = (label) => (
    <section className="student-concept-learning-card">
      <div className="student-concept-learning-copy">
        <p>{label} is coming soon for this concept.</p>
      </div>
    </section>
  );

  return (
    <main className="student-dashboard-shell">
      <section className="student-dashboard-phone student-concept-learning-phone">
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
              onClick={() => setActiveTab(tab)}
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
          renderExploreMode()
        ) : activeTab === "Practice" ? (
          renderPracticeMode()
        ) : (
          renderComingSoon(activeTab)
        )}

        <StudentBottomNav activeItem="chapters" />
      </section>
    </main>
  );
};
