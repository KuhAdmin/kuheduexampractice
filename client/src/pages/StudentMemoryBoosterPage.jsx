import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { StudentMediaViewer } from "../components/StudentMediaViewer";
import { StudentMicroActivityPanel } from "../components/StudentMicroActivityPanel";
import { getStudentMemoryBoosterForSection } from "../api/client";

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

const ChevronIcon = ({ direction }) => (
  <svg viewBox="0 0 24 24" className="student-dashboard-icon" aria-hidden="true">
    <path
      d={direction === "left" ? "m14.5 6-6 6 6 6" : "m9.5 6 6 6-6 6"}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    />
  </svg>
);

const MediaPlaceholderIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="m10 9.5 5 3-5 3z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

// Same brain/bulb glyph used for "Memory Booster" elsewhere in the app (e.g.
// the section detail page's action list), kept consistent here.
const MemoryIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 5.5a4 4 0 0 1 4 4c0 1.3-.6 2.4-1.4 3.2-.8.8-1.3 1.4-1.4 2.3h-2.4c-.1-.9-.6-1.5-1.4-2.3A4.4 4.4 0 0 1 8 9.5a4 4 0 0 1 4-4Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
    <path
      d="M10 18h4M10.5 20.5h3"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </svg>
);

const MEMORY_FIELDS = [
  { key: "story", label: "Story" },
  { key: "analogy", label: "Analogy" },
  { key: "visualHook", label: "Visual Hook" },
  { key: "realWorldConnection", label: "Real World Connection" },
  { key: "memoryTrick", label: "Memory Trick" },
  { key: "curiosityHook", label: "Curiosity Hook" },
  { key: "microActivity", label: "Try This" },
];

const SWIPE_THRESHOLD = 50;

const getTabsForAid = (aid) => {
  if (!aid) return [];
  const fieldTabs = MEMORY_FIELDS.filter((field) => aid[field.key]);
  const cueTab = aid.retrievalCues?.length ? [{ key: "retrievalCues", label: "Retrieval Cues" }] : [];
  return [...fieldTabs, ...cueTab];
};

export const StudentMemoryBoosterPage = () => {
  const navigate = useNavigate();
  const { chapterId: chapterNumber, sectionId: sourceSectionId } = useParams();
  const [memoryAids, setMemoryAids] = useState([]);
  const [sectionMeta, setSectionMeta] = useState({ sectionNumber: "", topicName: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTabKey, setActiveTabKey] = useState(null);
  const swipeStartX = useRef(null);
  const tabsScrollRef = useRef(null);
  const previousTabIndexRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    getStudentMemoryBoosterForSection(sourceSectionId)
      .then((result) => {
        if (cancelled) return;
        setMemoryAids(result?.memoryAids || []);
        setSectionMeta({
          sectionNumber: result?.sectionNumber || "",
          topicName: result?.topicName || "",
        });
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || "Failed to load memory boosters.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sourceSectionId]);

  useEffect(() => {
    setActiveIndex(0);
  }, [memoryAids]);

  const activeAid = memoryAids[activeIndex];
  const tabs = getTabsForAid(activeAid);

  useEffect(() => {
    setActiveTabKey(tabs[0]?.key || null);
    // A new concept's tab list has no meaningful relationship to the
    // previous concept's tab positions -- start its scroll-direction
    // tracking fresh so the first tab shown always left-aligns instead of
    // being compared against an unrelated index from before.
    previousTabIndexRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, memoryAids]);

  // Keeps the active tab scrolled into view regardless of how it became
  // active -- a direct click (handleTabClick) as well as landing on a new
  // concept above (which resets activeTabKey to that concept's first tab,
  // possibly scrolled out of view from wherever the row was left at) both
  // need this, so it lives here rather than only in the click handler.
  //
  // Direction-aware: selecting a tab to the right of the previously active
  // one aligns its LEFT edge to the container's left edge (revealing what's
  // ahead, in the direction of travel); selecting one to the left aligns
  // its RIGHT edge to the container's right edge (revealing what's behind).
  // A plain scrollIntoView({inline:"nearest"}) doesn't do this -- it's a
  // no-op whenever the tab already happens to sit flush at whichever edge,
  // which is exactly the case that needs fixing here.
  useEffect(() => {
    if (!activeTabKey) return;
    const container = tabsScrollRef.current;
    const button = container?.querySelector(`[data-tab-key="${activeTabKey}"]`);
    if (!container || !button) return;

    const currentIndex = tabs.findIndex((tab) => tab.key === activeTabKey);
    const previousIndex = previousTabIndexRef.current;
    previousTabIndexRef.current = currentIndex;

    const containerRect = container.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();

    if (previousIndex !== null && currentIndex < previousIndex) {
      // Right-side tab -> left-side tab: reveal earlier tabs.
      const shift = buttonRect.right - containerRect.right;
      container.scrollBy({ left: shift + 12, behavior: "smooth" });
    } else if (previousIndex === null || currentIndex > previousIndex) {
      // Left-side tab -> right-side tab (or the first tab shown for a
      // concept): reveal later tabs.
      const shift = buttonRect.left - containerRect.left;
      container.scrollBy({ left: shift - 12, behavior: "smooth" });
    }
  }, [activeTabKey, tabs]);

  const goToConcept = (nextIndex) => {
    setActiveIndex((current) => {
      const clamped = Math.max(0, Math.min(nextIndex, memoryAids.length - 1));
      return clamped === current ? current : clamped;
    });
  };

  const handleSwipeStart = (event) => {
    swipeStartX.current = (event.touches?.[0] ?? event).clientX;
  };

  const handleSwipeEnd = (event) => {
    if (swipeStartX.current === null) return;
    const endX = (event.changedTouches?.[0] ?? event).clientX;
    const deltaX = endX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
    goToConcept(activeIndex + (deltaX < 0 ? 1 : -1));
  };

  const handleTabsWheel = (event) => {
    if (event.deltaY === 0) return;
    event.currentTarget.scrollLeft += event.deltaY;
  };

  const handleTabClick = (key) => {
    setActiveTabKey(key);
  };

  return (
    <StudentPageShell pageClass="student-page--memory-booster" legacyModifierClass="student-memory-booster-phone">
        <header className="student-section-detail-header">
          <button
            type="button"
            className="student-chapter-detail-back"
            aria-label="Back to section"
            onClick={() => navigate(`/chapters/${chapterNumber}/sections/${sourceSectionId}`)}
          >
            <BackIcon />
          </button>
          <h1>
            {sectionMeta.sectionNumber
              ? `${sectionMeta.sectionNumber} ${sectionMeta.topicName || ""}`.trim()
              : "Memory Booster"}
          </h1>
        </header>

        <div className="student-memory-booster-kicker">
          <MemoryIcon />
          <span>Memory Booster</span>
        </div>

        {loading ? (
          <p className="student-empty-state">Loading memory boosters...</p>
        ) : error ? (
          <p className="student-empty-state">{error}</p>
        ) : memoryAids.length === 0 ? (
          <p className="student-empty-state">No memory aids have been generated for this section yet.</p>
        ) : (
          <>
            <div className="student-memory-booster-concept-meta">
              <div className="student-memory-booster-counter-row">
                <button
                  type="button"
                  className="student-memory-booster-counter-nav"
                  aria-label="Previous concept"
                  onClick={() => goToConcept(activeIndex - 1)}
                  disabled={activeIndex === 0}
                >
                  <ChevronIcon direction="left" />
                </button>
                <span className="student-memory-booster-concept-counter">
                  Concept {activeIndex + 1} of {memoryAids.length}
                </span>
                <button
                  type="button"
                  className="student-memory-booster-counter-nav"
                  aria-label="Next concept"
                  onClick={() => goToConcept(activeIndex + 1)}
                  disabled={activeIndex === memoryAids.length - 1}
                >
                  <ChevronIcon direction="right" />
                </button>
              </div>
              <h2>{activeAid.primaryConcept}</h2>
            </div>

            {tabs.length > 0 && (
              <div className="student-memory-booster-tabs-shell">
                <nav
                  ref={tabsScrollRef}
                  className="student-memory-booster-tabs"
                  aria-label="Memory booster sections"
                  onWheel={handleTabsWheel}
                >
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      data-tab-key={tab.key}
                      className={`student-memory-booster-tab ${tab.key === activeTabKey ? "is-active" : ""}`}
                      onClick={() => handleTabClick(tab.key)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>
            )}

            <article
              className="student-memory-booster-card"
              onTouchStart={handleSwipeStart}
              onTouchEnd={handleSwipeEnd}
              onPointerDown={handleSwipeStart}
              onPointerUp={handleSwipeEnd}
            >
              {activeTabKey === "retrievalCues" || activeTabKey === "microActivity" ? null : activeAid?.[
                  `${activeTabKey}Media`
                ] ? (
                <StudentMediaViewer
                  mediaType={activeAid[`${activeTabKey}Media`].mediaType}
                  src={activeAid[`${activeTabKey}Media`].mediaData}
                  alt={`${tabs.find((tab) => tab.key === activeTabKey)?.label || "Memory hook"} illustration`}
                  speechText={activeAid[activeTabKey]}
                  className="student-memory-booster-media-wrap"
                />
              ) : (
                <div className="student-memory-booster-media-placeholder">
                  <MediaPlaceholderIcon />
                  <span>Visual coming soon</span>
                </div>
              )}

              {activeTabKey === "retrievalCues" ? (
                <div className="student-memory-booster-cue-chips">
                  {activeAid.retrievalCues.map((cue, index) => (
                    <span key={cue} className={`student-memory-booster-cue-chip is-tone-${index % 5}`}>
                      {cue}
                    </span>
                  ))}
                </div>
              ) : activeTabKey === "microActivity" ? (
                <>
                  {activeAid.microActivityMedia && (
                    <StudentMediaViewer
                      mediaType={activeAid.microActivityMedia.mediaType}
                      src={activeAid.microActivityMedia.mediaData}
                      alt="Try This illustration"
                      className="student-memory-booster-media-wrap"
                    />
                  )}
                  <StudentMicroActivityPanel
                    assessmentUnitId={activeAid.assessmentUnitId}
                    prompt={activeAid.microActivity}
                  />
                </>
              ) : activeTabKey ? (
                <p>{activeAid[activeTabKey]}</p>
              ) : (
                <p className="student-empty-state">No memory aids recorded for this concept yet.</p>
              )}
            </article>
          </>
        )}

    </StudentPageShell>
  );
};
