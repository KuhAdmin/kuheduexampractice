import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StudentPageShell } from "../components/StudentPageShell";
import { useAuth } from "../context/authHooks";
import { StudentMediaViewer } from "../components/StudentMediaViewer";
import { StudentMicroActivityPanel } from "../components/StudentMicroActivityPanel";
import { StudentAiTutorPanel } from "../components/StudentAiTutorPanel";
import { StudentConceptPracticeCapture } from "../components/StudentConceptPracticeCapture";
import { StudentEinsteinMode } from "../components/StudentEinsteinMode";
import { StudentVivaMode } from "../components/StudentVivaMode";
import { StudentDetailCard } from "../components/StudentDetailCard";
import { StudentChallengesTab } from "../components/StudentChallengesTab";
import { StudentOpenResponsePanel } from "../components/StudentOpenResponsePanel";
import { MathPreview } from "../components/MathPreview";
import { useBreakpoint } from "../hooks/useBreakpoint";
import {
  getStudentConceptCard,
  getStudentConceptSectionMedia,
  getStudentDiagramMedia,
  getStudentRevision,
  getStudentSections,
  getStudentTextbookContent,
  getStudentVisualLearningItems,
  getTextbookActivityResponse,
  submitTextbookActivityResponse,
  getExercisesActivitiesTabVisible,
} from "../api/client";
import { decodeSelectionChapterId } from "./studentChapterData";

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

  if (type === "maximize") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.9"
        />
      </svg>
    );
  }

  if (type === "close") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="m6 6 12 12M18 6 6 18"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.9"
        />
      </svg>
    );
  }

  // Tab-bar icons below (Explore/Exercises-Activities/Practice/Revision/
  // Smart Tutor/Challenges) -- same glyphs as SectionDetailIcon's
  // atom/list/quiz/revision/tutor on StudentSectionDetailPage.jsx, kept as
  // a separate copy here rather than a shared import (this file's icon
  // components have always been self-contained, see StudentMediaViewer.jsx
  // for the same pattern elsewhere).
  if (type === "atom") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <circle cx="12" cy="12" r="2" fill="currentColor" />
        <ellipse cx="12" cy="12" rx="9" ry="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <ellipse cx="12" cy="12" rx="9" ry="4" fill="none" stroke="currentColor" strokeWidth="1.6" transform="rotate(60 12 12)" />
        <ellipse cx="12" cy="12" rx="9" ry="4" fill="none" stroke="currentColor" strokeWidth="1.6" transform="rotate(120 12 12)" />
      </svg>
    );
  }

  if (type === "list") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path d="M8 6.5h10M8 12h10M8 17.5h10" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        <circle cx="4.5" cy="6.5" r="1.1" fill="currentColor" />
        <circle cx="4.5" cy="12" r="1.1" fill="currentColor" />
        <circle cx="4.5" cy="17.5" r="1.1" fill="currentColor" />
      </svg>
    );
  }

  if (type === "quiz") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M8 6.5h8m-8 4h8m-8 4h5M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path d="m8.2 15.5 1.2 1.2 2-2.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (type === "revision") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M6 4.5h9l3 3V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
        <path d="M8 9.5h8M8 13h8M8 16.5h5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      </svg>
    );
  }

  if (type === "tutor") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M12 4.5c-3.6 0-6.5 2.6-6.5 5.8 0 1.9 1 3.6 2.6 4.7-.1.9-.5 1.7-1.2 2.4a.5.5 0 0 0 .4.9c1.4-.2 2.6-.7 3.6-1.5.7.2 1.4.3 2.1.3 3.6 0 6.5-2.6 6.5-5.8s-2.9-5.8-6.5-5.8Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
        <circle cx="9.3" cy="10.3" r="0.9" fill="currentColor" />
        <circle cx="14.7" cy="10.3" r="0.9" fill="currentColor" />
      </svg>
    );
  }

  if (type === "trophy") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M7 4h10v4a5 5 0 0 1-5 5 5 5 0 0 1-5-5V4Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
        <path
          d="M7 5H4.5A1.5 1.5 0 0 0 3 6.5 3.5 3.5 0 0 0 6.5 10H7M17 5h2.5A1.5 1.5 0 0 1 21 6.5 3.5 3.5 0 0 1 17.5 10H17"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
        <path
          d="M12 13v3M9 20h6M10 20v-2.2a2 2 0 0 1 4 0V20"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
    );
  }

  if (type === "lightbulb") {
    return (
      <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
        <path
          d="M12 4.5a5.5 5.5 0 0 0-3 10.1c.5.3.8.9.8 1.5v.4h4.4v-.4c0-.6.3-1.2.8-1.5A5.5 5.5 0 0 0 12 4.5Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
        <path d="M10 19.5h4M10.7 21.5h2.6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
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

const TABS = ["Learn", "Explore", "Exercises/Activities", "Practice", "Revision", "Smart Tutor", "Challenges"];

// Mobile accordion only (see .student-concept-accordion-header below) --
// desktop keeps its plain underline tabs, no icons there.
const MOBILE_TAB_ICON = {
  Learn: "book",
  Explore: "atom",
  "Exercises/Activities": "list",
  Practice: "quiz",
  Revision: "revision",
  "Smart Tutor": "tutor",
  Challenges: "trophy",
};

// Ordered, real fields only -- mirrors exactly what renderExploreMode's
// accordion already checks for presence, just as a sequence instead of a
// grid, so the step rail and the old accordion never drift apart on what
// counts as "this concept has X".
//
// Compare/Story/Simple/Real Life read card.teachingNotes (the same
// multi-item, per-concept source LEARN_MODE_DISPLAY's pages use) instead of
// the single synthesized card.analogy/story/realWorldConnection strings --
// these four used to be their own Learn-tab pages; moved here so Learn only
// keeps "Learn"/"Understand", with the fuller (possibly multi-slide, see
// getTeachingSlidesForMode) content intact rather than the one-line summary.
// "Simple" (eli5) has no equivalent memory_hook_media section key, so it
// never attempts a media fetch (see hasMediaSlot).
// Order here drives the Explore tab's step rail (exploreSteps filters this
// list down to whichever steps have content for the active concept,
// preserving this relative order -- see the exploreSteps useMemo below).
const EXPLORE_STEPS = [
  {
    key: "simple",
    label: "Simple",
    subtitle: "Easy explanation",
    teachingMode: "eli5",
    hasMediaSlot: false,
    hasContent: (c) => Boolean(c.teachingNotes?.some((note) => note.mode === "eli5")),
  },
  {
    key: "story",
    label: "Story",
    subtitle: "Learn through storytelling",
    teachingMode: "storymode",
    hasContent: (c) => Boolean(c.teachingNotes?.some((note) => note.mode === "storymode")),
  },
  {
    key: "deepLearning",
    label: "Deep Dive",
    subtitle: "Common pitfalls and the reasoning behind them",
    notesField: "deepLearningNotes",
    hasMediaSlot: false,
    hasContent: (c) => Boolean(c.deepLearningNotes?.length),
  },
  {
    key: "analogy",
    label: "Compare",
    subtitle: "Learn using familiar comparisons",
    teachingMode: "analogy",
    hasContent: (c) => Boolean(c.teachingNotes?.some((note) => note.mode === "analogy")),
  },
  // Unlike every other step, this one's content isn't part of the concept
  // card at all -- mind maps/flowcharts/etc are section-scoped, not
  // per-concept (see getVisualLearningItemsForSection), so hasContent below
  // is never actually consulted for it; exploreSteps filters it in/out by
  // visualLearningItems length instead (see the exploreSteps useMemo).
  {
    key: "visualLearning",
    label: "Visual Learning",
    subtitle: "Mind maps, flowcharts & more",
    hasMediaSlot: false,
    hasContent: () => false,
  },
  {
    key: "realWorldConnection",
    label: "Real Life Connection",
    subtitle: "Connect to everyday applications",
    teachingMode: "realworld",
    hasContent: (c) => Boolean(c.teachingNotes?.some((note) => note.mode === "realworld")),
  },
  { key: "visualHook", label: "Visual Hook", subtitle: "See it to believe it", hasContent: (c) => Boolean(c.visualHook) },
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

// Visual Learning items are tagged with a `mode` field (content_card.processorkey
// server-side) matching one of these keys -- lets the step show a sub-section
// pill bar (same visual language as the Visual/Read tabs) so students can jump
// straight to the kind of visual aid they want instead of scrolling one long
// mixed grid.
const VISUAL_LEARNING_CATEGORIES = [
  { key: "mindmap", label: "Mind Map" },
  { key: "flowchart", label: "Flow Chart" },
  { key: "diagram", label: "Diagram" },
  { key: "visualposter", label: "Visual Poster" },
  { key: "notebooknotes", label: "Notebook Notes" },
  { key: "infographics", label: "Infographics" },
];

const REVISION_MODES = [
  { key: "cheatsheet", label: "Cheat Sheet" },
  { key: "mnemonics", label: "Mnemonics" },
  { key: "examnotes", label: "Exam Notes" },
];

// Collapsible card for the Explore tab. mediaType ("image" | "video" | null)
// hints at the kind of media a future admin authoring pass will attach to
// this section -- the icon is purely indicative for now, no media is stored
// or rendered yet.
const ExploreSection = ({ sectionKey, title, mediaType, isExpanded, onToggle, children }) => (
  <section className={`student-concept-learning-card student-explore-section ${isExpanded ? "is-open" : ""}`}>
    <button
      type="button"
      className="student-explore-section-header"
      onClick={() => onToggle(sectionKey)}
      aria-expanded={isExpanded}
    >
      {mediaType && (
        <span className="student-explore-section-icon">
          <ConceptLearningIcon type={mediaType} />
        </span>
      )}
      <span className="student-explore-section-title">{title}</span>
      <ConceptLearningIcon
        type="chevron-down"
        className={`student-concept-accordion-chevron ${isExpanded ? "is-open" : ""}`}
      />
    </button>
    {isExpanded && (
      <div className="student-concept-learning-copy student-explore-section-body">{children}</div>
    )}
  </section>
);

// Turns a concept card's knowledge fields into a slide sequence: the core
// narrative first, then any relationships/processes/comparisons that exist,
// skipping dimensions the pipeline left empty for this concept.
// The Learn tab's two selectable "pages". Simple/Story/Compare/Real Life
// used to also be pages here -- moved to the Explore tab's step rail (see
// EXPLORE_STEPS) so Learn stays focused on the core structured explanation,
// and Explore is the single place for every other teaching angle. Fixed
// canonical order + student-facing label/purpose, independent of whatever
// order modes happen to appear in the DB. Real (non-imported) pipeline
// content has no modes at all, so it never produces any pages here -- see
// FALLBACK handling in buildLearnContent.
const LEARN_MODE_DISPLAY = [
  { mode: "teachme", label: "Learn", purpose: "Structured concept learning" },
  { mode: "explain", label: "Understand", purpose: "Detailed classroom explanation" },
];

const noteToSlide = (note, card) => ({
  heading: note.title || card.primaryConcept,
  body: [note.summary].filter(Boolean),
  details: note.details,
});

// Same source data as buildLearnContent's per-mode grouping, but for a
// single mode on demand -- used by the Explore tab's Compare/Story/Simple/
// Real Life steps (see EXPLORE_STEPS' teachingMode field) instead of
// building the whole Learn-tab page map for just one mode's slides.
const getTeachingSlidesForMode = (card, mode) =>
  (card?.teachingNotes || [])
    .filter((note) => note.mode === mode)
    .map((note) => noteToSlide(note, card));

// Deep Dive shows every deepLearningNotes item together (misconceptions +
// whychain both, no per-family filtering) -- unlike Compare/Story/Simple/
// Real Life there's no single processorkey to isolate per step.
const getStepSlides = (card, step) => {
  if (step.notesField) {
    return (card?.[step.notesField] || []).map((note) => noteToSlide(note, card));
  }
  if (step.teachingMode) {
    return getTeachingSlidesForMode(card, step.teachingMode);
  }
  return [];
};

// Fallback slide sequence for concepts with no imported teaching notes at
// all (real pipeline output) -- unchanged from before mode pages existed.
const buildFallbackSlides = (card) => {
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

// eli5/storymode/analogy/realworld moved to the Explore tab's step rail (see
// EXPLORE_STEPS) -- excluded here so they don't also fall through to the
// "unknown mode" fallback below and end up shown twice.
const MOVED_TO_EXPLORE_MODES = new Set(["eli5", "storymode", "analogy", "realworld"]);

// Groups card.teachingNotes (one row per imported teachme/explain/eli5/
// storymode/analogy/realworld item) into per-mode "pages" in the canonical
// LEARN_MODE_DISPLAY order, each page holding its own slide sequence (a mode
// can carry more than one item, e.g. two teachme entries, paginated with the
// existing Prev/Next). A mode absent from this concept's import produces no
// page at all, rather than an empty one. Any mode name outside the known set
// (future content, or a not-yet-catalogued source field) still gets a page
// -- appended after the known ones with a title-cased label -- so content is
// never silently dropped for not matching the table.
const buildLearnContent = (card) => {
  const notesByMode = new Map();
  (card.teachingNotes || []).forEach((note) => {
    const key = note.mode || "";
    if (!notesByMode.has(key)) notesByMode.set(key, []);
    notesByMode.get(key).push(note);
  });
  MOVED_TO_EXPLORE_MODES.forEach((mode) => notesByMode.delete(mode));

  const modePages = [];
  LEARN_MODE_DISPLAY.forEach(({ mode, label, purpose }) => {
    const notes = notesByMode.get(mode);
    if (!notes?.length) return;
    modePages.push({ mode, label, purpose, slides: notes.map((note) => noteToSlide(note, card)) });
    notesByMode.delete(mode);
  });
  notesByMode.forEach((notes, mode) => {
    modePages.push({
      mode,
      label: mode.charAt(0).toUpperCase() + mode.slice(1),
      purpose: "",
      slides: notes.map((note) => noteToSlide(note, card)),
    });
  });

  return { modePages, fallbackSlides: modePages.length ? [] : buildFallbackSlides(card) };
};

export const StudentConceptLearningPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tier = useBreakpoint();
  const isDesktop = tier !== "mobile";
  const { chapterId: chapterNumber, sectionId: sourceSectionId, conceptId: assessmentUnitId } = useParams();
  const selectionOverride = decodeSelectionChapterId(chapterNumber);
  const displayChapterNumber = selectionOverride?.chapterNumber ?? chapterNumber;
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState(TABS[0]);
  // Mobile accordion's own "which section is visually expanded" flag,
  // decoupled from activeTab (which must always hold a real tab so desktop's
  // tab bar/content-selection keeps working). Starts at null so landing on
  // this page shows every section's header at a glance -- previously this
  // just read `tab === activeTab`, which meant TABS[0] ("Learn") was always
  // pre-expanded, pushing every other option below the fold on a phone.
  const [mobileExpandedTab, setMobileExpandedTab] = useState(null);
  // Moderator/admin toggle (AdminContentEditorPage.jsx) -- defaults to
  // hidden (opt-in) so a slow/failed fetch never shows a tab that hasn't
  // been explicitly turned on.
  const [exercisesActivitiesTabVisible, setExercisesActivitiesTabVisible] = useState(false);

  useEffect(() => {
    getExercisesActivitiesTabVisible()
      .then((result) => setExercisesActivitiesTabVisible(result?.visible ?? false))
      .catch(() => {});
  }, []);

  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [activeLearnMode, setActiveLearnMode] = useState(null);
  const [expandedSections, setExpandedSections] = useState(() => new Set());
  const [breadcrumbMeta, setBreadcrumbMeta] = useState({ chapterName: "", sectionNumber: "", topicName: "" });
  // Mobile header's compact "C11·BIO·4.1" prefix ahead of the concept name.
  // selectionOverride (present when reached via the class/subject switcher's
  // encoded chapterId, see decodeSelectionChapterId above) wins over the
  // student's own profile since it reflects what's actually being browsed.
  // user.subject is stored as a lowercase full word ("biology"), not a short
  // code, so one is derived here rather than adding a lookup table.
  // sectionNumber (from breadcrumbMeta below) is already "<chapter>.<section>"
  // (e.g. "4.1"), so it is NOT combined with displayChapterNumber separately
  // -- that would duplicate the chapter digit.
  const headerClassLabel = selectionOverride?.levelCode || user?.studentClass || "";
  const headerSubjectLabel =
    selectionOverride?.subjectCode || (user?.subject ? user.subject.slice(0, 3).toUpperCase() : "");
  const headerSectionLabel = breadcrumbMeta.sectionNumber || "";
  const headerPrefix = [headerClassLabel ? `C${headerClassLabel}` : "", headerSubjectLabel, headerSectionLabel]
    .filter(Boolean)
    .join("·");
  const [activeExploreStepKey, setActiveExploreStepKey] = useState(null);
  const [visitedExploreSteps, setVisitedExploreSteps] = useState(() => new Set());
  // Only meaningful for teachingMode-driven steps (Compare/Story/Simple/Real
  // Life), which -- like the Learn tab's own pages -- can carry more than one
  // item per concept. Reset whenever the active step changes so paging
  // through Compare's slides doesn't leave Story starting mid-sequence.
  const [activeExploreSlideIndex, setActiveExploreSlideIndex] = useState(0);
  // Visual/Read toggle for any Explore step with a media slot -- side-by-side
  // columns looked odd once the "Read" side (Compare/Story/etc's fuller
  // teaching content) grew much longer than a placeholder image box. Defaults
  // to "read" since most concepts have no uploaded visual yet, so a first-time
  // visitor lands on real content instead of a "Visual coming soon" tab.
  const [activeStepView, setActiveStepView] = useState("read");
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
  // Visual Learning (mind maps/flowcharts/etc) is section-scoped, not part of
  // the concept card -- fetched once per section instead of once per concept,
  // since every concept in the same section shares the same set of cards.
  // null = not loaded yet, [] = loaded, confirmed empty.
  const [visualLearningItems, setVisualLearningItems] = useState(null);
  const [textbookContent, setTextbookContent] = useState(null);
  const [revisionItems, setRevisionItems] = useState(null);
  const [activeRevisionMode, setActiveRevisionMode] = useState(null);
  const [visualLearningMediaByCardId, setVisualLearningMediaByCardId] = useState({});
  const [activeVisualLearningCategory, setActiveVisualLearningCategory] = useState(VISUAL_LEARNING_CATEGORIES[0].key);
  // Visual Learning grid item opened via its maximize button -- full item
  // (not just the media) so the lightbox can use item.title for alt text.
  const [maximizedVisualItem, setMaximizedVisualItem] = useState(null);

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

    getStudentSections(displayChapterNumber, selectionOverride || undefined)
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

  // Same section-scoped fetch-once pattern as breadcrumbMeta above -- keyed
  // on sourceSectionId (not assessmentUnitId), so navigating between
  // concepts within one section doesn't re-fetch this.
  useEffect(() => {
    let cancelled = false;
    setVisualLearningItems(null);
    setVisualLearningMediaByCardId({});

    getStudentVisualLearningItems(sourceSectionId)
      .then((result) => {
        if (cancelled) return;
        const items = result?.items || [];
        setVisualLearningItems(items);
        const firstPopulatedCategory = VISUAL_LEARNING_CATEGORIES.find((category) =>
          items.some((item) => item.mode === category.key)
        );
        setActiveVisualLearningCategory(firstPopulatedCategory?.key || VISUAL_LEARNING_CATEGORIES[0].key);
        Promise.all(
          items.map((item) =>
            getStudentDiagramMedia(item.cardId)
              .then((mediaResult) => [item.cardId, mediaResult?.media || null])
              .catch(() => [item.cardId, null])
          )
        ).then((entries) => {
          if (cancelled) return;
          setVisualLearningMediaByCardId(Object.fromEntries(entries));
        });
      })
      .catch(() => {
        if (!cancelled) setVisualLearningItems([]);
      });

    return () => {
      cancelled = true;
    };
  }, [sourceSectionId]);

  // Same section-scoped fetch-once pattern as visualLearningItems above --
  // Exercises/Activities content is the textbook's own end-of-section
  // material, shared by every concept in the section.
  useEffect(() => {
    let cancelled = false;
    setTextbookContent(null);

    getStudentTextbookContent(sourceSectionId)
      .then((result) => {
        if (!cancelled) setTextbookContent(result?.items || []);
      })
      .catch(() => {
        if (!cancelled) setTextbookContent([]);
      });

    return () => {
      cancelled = true;
    };
  }, [sourceSectionId]);

  // Fetched section-wide (same endpoint StudentRevisionPage.jsx uses) since
  // that's what content_card's assessment_unit_id join naturally returns --
  // filtered down to this concept's rows below, in renderRevisionMode.
  useEffect(() => {
    let cancelled = false;
    setRevisionItems(null);

    getStudentRevision(sourceSectionId)
      .then((result) => {
        if (!cancelled) setRevisionItems(result?.items || []);
      })
      .catch(() => {
        if (!cancelled) setRevisionItems([]);
      });

    return () => {
      cancelled = true;
    };
  }, [sourceSectionId]);

  // revisionItems is section-wide (every concept's cheatsheet/mnemonics/
  // examnotes); narrowed to this concept here so switching concepts within
  // the same section (no refetch needed) still shows only relevant cards.
  const conceptRevisionItems = useMemo(
    () => (revisionItems || []).filter((item) => String(item.assessmentUnitId) === String(assessmentUnitId)),
    [revisionItems, assessmentUnitId]
  );
  const populatedRevisionModes = useMemo(
    () => REVISION_MODES.filter((mode) => conceptRevisionItems.some((item) => item.mode === mode.key)),
    [conceptRevisionItems]
  );

  useEffect(() => {
    setActiveRevisionMode(populatedRevisionModes[0]?.key || null);
  }, [populatedRevisionModes]);

  const learnContent = useMemo(
    () => (card ? buildLearnContent(card) : { modePages: [], fallbackSlides: [] }),
    [card]
  );
  const activeModePage =
    learnContent.modePages.find((page) => page.mode === activeLearnMode) || learnContent.modePages[0] || null;
  const slides = activeModePage ? activeModePage.slides : learnContent.fallbackSlides;
  const totalSlides = slides.length;
  const activeSlide = slides[activeSlideIndex] || slides[0];

  // Reset to the first available mode page (teachme/"Learn" when present,
  // per LEARN_MODE_DISPLAY's order) and the first slide whenever the concept
  // changes, so switching concepts never leaves a stale mode/slide selected
  // from the previous one.
  useEffect(() => {
    setActiveLearnMode(learnContent.modePages[0]?.mode || null);
    setActiveSlideIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentUnitId, learnContent.modePages.length]);

  const selectLearnMode = (mode) => {
    setActiveLearnMode(mode);
    setActiveSlideIndex(0);
  };

  const exploreSteps = useMemo(
    () =>
      card
        ? EXPLORE_STEPS.filter((step) =>
            step.key === "visualLearning" ? Boolean(visualLearningItems?.length) : step.hasContent(card)
          )
        : [],
    [card, visualLearningItems]
  );

  useEffect(() => {
    const firstStepKey = exploreSteps[0]?.key || null;
    setActiveExploreStepKey(firstStepKey);
    setVisitedExploreSteps(new Set(firstStepKey ? [firstStepKey] : []));
    setActiveExploreSlideIndex(0);
    setActiveStepView("read");
    if (firstStepKey && exploreSteps[0]?.hasMediaSlot !== false) {
      ensureSectionMedia(firstStepKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentUnitId, exploreSteps.length]);

  const goToExploreStep = (key) => {
    setActiveExploreStepKey(key);
    setVisitedExploreSteps((current) => new Set(current).add(key));
    setActiveExploreSlideIndex(0);
    setActiveStepView("read");
    if (exploreSteps.find((step) => step.key === key)?.hasMediaSlot !== false) {
      ensureSectionMedia(key);
    }
  };

  const activeExploreStepIndex = exploreSteps.findIndex((step) => step.key === activeExploreStepKey);

  const renderLearnMode = () => (
    <>
      {learnContent.modePages.length > 0 && (
        <div className="student-learn-mode-tabs" role="tablist" aria-label="Learning style">
          {learnContent.modePages.map((page) => (
            <button
              key={page.mode}
              type="button"
              role="tab"
              aria-selected={page.mode === activeModePage?.mode}
              className={`student-learn-mode-tab ${page.mode === activeModePage?.mode ? "is-active" : ""}`}
              onClick={() => selectLearnMode(page.mode)}
            >
              <span className="student-learn-mode-tab-label">{page.label}</span>
              {page.purpose && <span className="student-learn-mode-tab-subtitle">{page.purpose}</span>}
            </button>
          ))}
        </div>
      )}

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
          {activeSlide?.details?.length > 0 && (
            <StudentDetailCard className="student-concept-learning-detail-card" details={activeSlide.details} />
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

  // Shared between the desktop step view and the mobile accordion -- a list
  // of section-scoped visual cards (mind maps/flowcharts/etc), each with its
  // own optional image, rather than one media slot + one text block like
  // every other Explore step.
  const renderVisualLearningGrid = () => {
    // Only items with actual media -- an item with no image has nothing to
    // show in this grid (each card is purely the image, no caption/text of
    // its own), so it's dropped rather than rendered as an empty/placeholder
    // tile.
    const categoryItems =
      visualLearningItems
        ?.filter((item) => item.mode === activeVisualLearningCategory)
        .filter((item) => visualLearningMediaByCardId[item.cardId]) || [];
    const activeCategoryLabel =
      VISUAL_LEARNING_CATEGORIES.find((category) => category.key === activeVisualLearningCategory)?.label ||
      "visual aids";
    // Only offer categories this section actually has items for -- avoids a
    // row of pills where most just dead-end in "No X recorded yet."
    const populatedCategories = VISUAL_LEARNING_CATEGORIES.filter((category) =>
      visualLearningItems?.some((item) => item.mode === category.key)
    );

    return (
      <div className="student-concept-step-copy is-full-width">
        {populatedCategories.length > 0 && (
          <div
            className="student-concept-step-view-tabs is-multi"
            role="tablist"
            aria-label="Visual learning category"
          >
            {populatedCategories.map((category) => (
              <button
                key={category.key}
                type="button"
                role="tab"
                aria-selected={activeVisualLearningCategory === category.key}
                className={`student-concept-step-view-tab ${
                  activeVisualLearningCategory === category.key ? "is-active" : ""
                }`}
                onClick={() => setActiveVisualLearningCategory(category.key)}
              >
                {category.label}
              </button>
            ))}
          </div>
        )}

        {visualLearningItems === null ? (
          <p>Loading visuals...</p>
        ) : categoryItems.length === 0 ? (
          <p>{`No ${activeCategoryLabel.toLowerCase()} recorded for this section yet.`}</p>
        ) : (
          <div className="student-concept-visual-learning-grid">
            {categoryItems.map((item) => {
              const media = visualLearningMediaByCardId[item.cardId];
              return (
                <div className="student-concept-visual-learning-card" key={item.cardId}>
                  <img src={media.mediaData} alt={item.title || "Visual aid"} />
                  <button
                    type="button"
                    className="student-concept-visual-learning-maximize"
                    aria-label="View full size"
                    onClick={() => setMaximizedVisualItem(item)}
                  >
                    <ConceptLearningIcon type="maximize" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {maximizedVisualItem && (
          <div
            className="student-concept-visual-learning-lightbox"
            onClick={() => setMaximizedVisualItem(null)}
          >
            <button
              type="button"
              className="student-concept-visual-learning-lightbox-close"
              aria-label="Close"
              onClick={() => setMaximizedVisualItem(null)}
            >
              <ConceptLearningIcon type="close" />
            </button>
            <img
              src={visualLearningMediaByCardId[maximizedVisualItem.cardId]?.mediaData}
              alt={maximizedVisualItem.title || "Visual aid"}
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        )}
      </div>
    );
  };

  // Visual/Read toggle for a step with a media slot -- replaces the old
  // fixed two-column layout (see activeStepView above for why).
  const renderStepViewTabs = () => (
    <div className="student-concept-step-view-tabs" role="tablist" aria-label="View">
      <button
        type="button"
        role="tab"
        aria-selected={activeStepView === "visual"}
        className={`student-concept-step-view-tab ${activeStepView === "visual" ? "is-active" : ""}`}
        onClick={() => setActiveStepView("visual")}
      >
        Visual
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeStepView === "read"}
        className={`student-concept-step-view-tab ${activeStepView === "read" ? "is-active" : ""}`}
        onClick={() => setActiveStepView("read")}
      >
        Read
      </button>
    </div>
  );

  // Condensed slide pager for a step with more than one slide -- lives in
  // the step heading (top-right) instead of at the bottom of the step copy,
  // so it reads as "paging this step's content" rather than competing with
  // the Previous/Continue footer that pages between steps. Mirrors the same
  // step/slides resolution renderExploreStepContent uses below, since this
  // renders in a different part of the tree (the heading) but needs to know
  // the same slide count/position.
  const renderExploreSlideNav = () => {
    const step = exploreSteps[activeExploreStepIndex];
    if (!step || !(step.teachingMode || step.notesField)) return null;

    const slides = getStepSlides(card, step);
    if (slides.length <= 1) return null;

    const showVisual = step.hasMediaSlot !== false && activeStepView === "visual";
    if (showVisual) return null;

    return (
      <div className="student-concept-explore-slide-nav is-condensed">
        <button
          type="button"
          className="student-concept-learning-nav is-previous"
          aria-label="Previous slide"
          disabled={activeExploreSlideIndex === 0}
          onClick={() => setActiveExploreSlideIndex((current) => Math.max(current - 1, 0))}
        >
          <ConceptLearningIcon type="chevron-left" />
        </button>
        <span className="student-concept-learning-counter">
          {activeExploreSlideIndex + 1}/{slides.length}
        </span>
        <button
          type="button"
          className="student-concept-learning-nav is-next"
          aria-label="Next slide"
          disabled={activeExploreSlideIndex === slides.length - 1}
          onClick={() => setActiveExploreSlideIndex((current) => Math.min(current + 1, slides.length - 1))}
        >
          <ConceptLearningIcon type="chevron-right" />
        </button>
      </div>
    );
  };

  // Desktop/tablet step view: media (when this step has a slot for it) or
  // text, switched by renderStepViewTabs instead of shown side by side --
  // driven by the same real card fields the mobile accordion
  // (renderExploreMode below) already reads, no new data.
  const renderExploreStepContent = () => {
    const step = exploreSteps[activeExploreStepIndex];
    if (!step) return null;

    if (step.teachingMode || step.notesField) {
      const slides = getStepSlides(card, step);
      const activeStepSlide = slides[activeExploreSlideIndex] || slides[0];
      const media = step.hasMediaSlot === false ? null : sectionMediaByKey[step.key];
      const speechText = [activeStepSlide?.heading, ...(activeStepSlide?.body || [])].filter(Boolean).join(". ");

      const showVisual = step.hasMediaSlot !== false && activeStepView === "visual";

      return (
        <div className="student-concept-step-panel">
          {step.hasMediaSlot !== false && renderStepViewTabs()}
          {showVisual ? (
            <div className="student-concept-step-media is-full-width">
              {media === undefined ? (
                <div className="student-memory-booster-media-placeholder">
                  <span>Loading visual...</span>
                </div>
              ) : media ? (
                <StudentMediaViewer
                  mediaType={media.mediaType}
                  src={media.mediaData}
                  alt={`${step.label} illustration`}
                  speechText={speechText}
                />
              ) : null}
            </div>
          ) : (
            <div className="student-concept-step-copy is-full-width">
              <h3>{step.subtitle}</h3>
              {(activeStepSlide?.body || []).map((paragraph) => (
                <div key={paragraph}>
                  <p>{paragraph}</p>
                  <MathPreview text={paragraph} />
                </div>
              ))}
              {activeStepSlide?.details?.length > 0 && (
                <StudentDetailCard className="student-concept-learning-detail-card" details={activeStepSlide.details} />
              )}
            </div>
          )}
        </div>
      );
    }

    if (step.key === "visualLearning") {
      return renderVisualLearningGrid();
    }

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
      <div className="student-concept-step-panel">
        {renderStepViewTabs()}
        {activeStepView === "visual" ? (
          <div className="student-concept-step-media is-full-width">
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
            ) : null}
          </div>
        ) : (
          <div className="student-concept-step-copy is-full-width">
            <h3>{step.subtitle}</h3>
            <p>{text}</p>
            <MathPreview text={text} />
          </div>
        )}
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
    const hasTeachingMode = (mode) => Boolean(card?.teachingNotes?.some((note) => note.mode === mode));
    const hasAnyExploreContent =
      hasTeachingMode("analogy") ||
      hasTeachingMode("storymode") ||
      hasTeachingMode("eli5") ||
      hasTeachingMode("realworld") ||
      card?.visualHook ||
      card?.curiosityHook ||
      card?.microActivity ||
      card?.memoryTrick ||
      misconceptionEntries.length > 0 ||
      card?.misconceptionAlert ||
      card?.retrievalCues?.length > 0 ||
      card?.associatedConcepts?.length > 0 ||
      card?.supportingConcepts?.length > 0 ||
      card?.deepLearningNotes?.length > 0 ||
      visualLearningItems?.length > 0;

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

    // Compare/Story/Simple/Real Life read the multi-item teachingNotes list
    // (same source as the Learn tab's pages) rather than a single summary
    // string -- stacked here (no pagination needed, the section already
    // scrolls) instead of one paragraph per field.
    // mediaType gates the uploadable image/video hook (sectionMediaByKey) --
    // iconType is purely which icon ExploreSection's header shows, and
    // defaults to mediaType so Compare/Story/Real Life (which use the same
    // value for both) don't need to pass it separately. Deep Dive/Simple
    // have no uploadable media (mediaType: null) but still want a header
    // icon, hence the two being split apart instead of one param serving
    // both.
    const renderTeachingModeSection = ({ sectionKey, title, mediaType, iconType, teachingMode, notesField }) => {
      const slides = notesField ? getStepSlides(card, { notesField }) : getTeachingSlidesForMode(card, teachingMode);
      if (!slides.length) return null;
      const media = mediaType ? sectionMediaByKey[sectionKey] : null;
      const speechText = slides
        .map((slide) => [slide.heading, ...(slide.body || [])].filter(Boolean).join(". "))
        .join(" ");

      return (
        <ExploreSection
          sectionKey={sectionKey}
          title={title}
          mediaType={iconType ?? mediaType}
          isExpanded={isExpanded(sectionKey)}
          onToggle={toggleSection}
        >
          {media && (
            <StudentMediaViewer
              mediaType={media.mediaType}
              src={media.mediaData}
              alt={`${title} illustration`}
              speechText={speechText}
            />
          )}
          {slides.map((slide, index) => (
            <div key={`${slide.heading}-${index}`} className="student-explore-teaching-slide">
              {slides.length > 1 && <h4>{slide.heading}</h4>}
              {(slide.body || []).map((paragraph) => (
                <div key={paragraph}>
                  <p>{paragraph}</p>
                  <MathPreview text={paragraph} />
                </div>
              ))}
              {slide.details?.length > 0 && (
                <StudentDetailCard className="student-concept-learning-detail-card" details={slide.details} />
              )}
            </div>
          ))}
        </ExploreSection>
      );
    };

    return (
      <div className="student-explore-grid">
        {renderTeachingModeSection({
          sectionKey: "simple",
          title: "Simple",
          mediaType: null,
          iconType: "lightbulb",
          teachingMode: "eli5",
        })}

        {renderTeachingModeSection({
          sectionKey: "story",
          title: "Story",
          mediaType: "video",
          // Header icon only (see iconType's own comment above) -- the thin
          // outline-rect "video" glyph read as effectively invisible at
          // header-icon size against the muted inactive-header color,
          // unlike "image"/"atom"'s bolder filled shapes. mediaType itself
          // stays "video" so the uploadable video hook is unaffected.
          iconType: "book",
          teachingMode: "storymode",
        })}

        {renderTeachingModeSection({ sectionKey: "analogy", title: "Compare", mediaType: "image", teachingMode: "analogy" })}

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

        {renderTeachingModeSection({
          sectionKey: "realWorldConnection",
          title: "Real Life Connection",
          mediaType: "video",
          teachingMode: "realworld",
        })}

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

        {renderTeachingModeSection({
          sectionKey: "deepLearning",
          title: "Deep Dive",
          mediaType: null,
          iconType: "atom",
          notesField: "deepLearningNotes",
        })}

        {visualLearningItems?.length > 0 && (
          <ExploreSection
            sectionKey="visualLearning"
            title="Visual Learning"
            mediaType="image"
            isExpanded={isExpanded("visualLearning")}
            onToggle={toggleSection}
          >
            {renderVisualLearningGrid()}
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

  // Mobile accordion header click: toggles that section's own expanded
  // state (collapsing it again on a second click, which was never possible
  // when the accordion was driven directly off activeTab) while still going
  // through selectTab for anything else it does (activeTab itself, and
  // Practice's navigate-away special case) -- so expanding a section here
  // behaves exactly like selecting it always did, just also collapsible.
  const toggleMobileAccordionSection = (tab) => {
    if (tab === "Practice") {
      selectTab(tab);
      return;
    }
    if (mobileExpandedTab === tab) {
      setMobileExpandedTab(null);
      return;
    }
    selectTab(tab);
    setMobileExpandedTab(tab);
  };

  const renderComingSoon = (label) => (
    <section className="student-concept-learning-card">
      <div className="student-concept-learning-copy">
        <h2>{label}</h2>
        <p>{label} is coming soon for this concept.</p>
      </div>
    </section>
  );

  const renderRevisionMode = () => {
    if (revisionItems === null) {
      return <p className="student-empty-state">Loading revision content...</p>;
    }

    if (populatedRevisionModes.length === 0) {
      return (
        <section className="student-concept-learning-card">
          <div className="student-concept-learning-copy">
            <h2>Revision</h2>
            <p>No revision content has been generated for this concept yet.</p>
          </div>
        </section>
      );
    }

    const visibleItems = conceptRevisionItems.filter((item) => item.mode === activeRevisionMode);

    return (
      <div className="student-concept-step-copy is-full-width">
        <div className="student-concept-step-view-tabs is-multi" role="tablist" aria-label="Revision mode">
          {populatedRevisionModes.map((mode) => (
            <button
              key={mode.key}
              type="button"
              role="tab"
              aria-selected={activeRevisionMode === mode.key}
              className={`student-concept-step-view-tab ${activeRevisionMode === mode.key ? "is-active" : ""}`}
              onClick={() => setActiveRevisionMode(mode.key)}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="student-detail-card-list-page">
          {visibleItems.map((item, index) => (
            <StudentDetailCard
              key={`${item.assessmentUnitId}-${item.mode}-${index}`}
              title={item.title}
              summary={item.summary}
              details={item.details}
            />
          ))}
        </div>
      </div>
    );
  };

  const EXERCISES_ACTIVITIES_GROUPS = [
    { key: "activities", label: "Activities" },
    { key: "exercises", label: "Exercises" },
  ];

  const renderExercisesActivitiesMode = () => {
    if (textbookContent === null) {
      return <p className="student-empty-state">Loading exercises and activities...</p>;
    }

    const groups = EXERCISES_ACTIVITIES_GROUPS.map((group) => ({
      ...group,
      items: textbookContent.filter((item) => item.mode === group.key),
    })).filter((group) => group.items.length > 0);

    if (groups.length === 0) {
      return (
        <section className="student-concept-learning-card">
          <div className="student-concept-learning-copy">
            <h2>Exercises/Activities</h2>
            <p>No exercises or activities have been added for this section yet.</p>
          </div>
        </section>
      );
    }

    return (
      <>
        {groups.map((group) => (
          <section className="student-concept-learning-card" key={group.key}>
            <div className="student-concept-learning-copy">
              <h2>{group.label}</h2>
            </div>
            <div className="student-detail-card-list-page">
              {group.items.map((item) => (
                <StudentDetailCard
                  key={item.cardId}
                  title={item.title}
                  // Exercises' "summary" is just a paraphrase of the question(s)
                  // already listed in full in "details" below -- for multi-
                  // question exercises the source content often only captures
                  // some of them there, which reads as a truncation bug rather
                  // than the harmless redundancy it is for single-question
                  // ones. "details" is always the complete, authoritative
                  // content, so summary is dropped here. Activities keep their
                  // summary -- it's a distinct instructional blurb there, not a
                  // duplicate of the details.
                  summary={group.key === "exercises" ? null : item.summary}
                  details={item.details}
                >
                  {group.key === "exercises" && (
                    <StudentOpenResponsePanel
                      responseKey={item.activityKey}
                      fetchResponse={getTextbookActivityResponse}
                      submitResponse={submitTextbookActivityResponse}
                    />
                  )}
                </StudentDetailCard>
              ))}
            </div>
          </section>
        ))}
      </>
    );
  };

  // Feeds the mobile accordion's expanded panel (below). Desktop keeps its
  // own separate if/else chain -- its Explore tab renders a bespoke step
  // rail (exploreSteps/renderExploreStepContent), not renderExploreMode(),
  // so the two aren't safe to unify without also touching that rail.
  // Parameterized by tab rather than reading activeTab directly so the
  // accordion can call it per-item; in practice it's only ever invoked for
  // whichever tab is currently open, since Practice never actually becomes
  // activeTab (selectTab navigates away instead of opening it).
  const renderTabContent = (tab) => {
    if (tab === "Learn") return renderLearnMode();
    if (tab === "Explore") return renderExploreMode();
    if (tab === "Smart Tutor") {
      return (
        <>
          <StudentAiTutorPanel assessmentUnitId={assessmentUnitId} />
          <StudentConceptPracticeCapture assessmentUnitId={assessmentUnitId} />
          <StudentEinsteinMode assessmentUnitId={assessmentUnitId} />
          <StudentVivaMode assessmentUnitId={assessmentUnitId} />
        </>
      );
    }
    if (tab === "Challenges") return <StudentChallengesTab assessmentUnitId={assessmentUnitId} />;
    if (tab === "Exercises/Activities") return renderExercisesActivitiesMode();
    if (tab === "Revision") return renderRevisionMode();
    return renderComingSoon(tab);
  };

  // Moderator/admin can hide Exercises/Activities app-wide in one toggle
  // (AdminContentEditorPage.jsx) -- filtered here rather than in the TABS
  // constant itself so activeTab/mobileExpandedTab's default (TABS[0]) and
  // MOBILE_TAB_ICON lookups stay untouched regardless of this setting.
  const visibleTabs = TABS.filter((tab) => tab !== "Exercises/Activities" || exercisesActivitiesTabVisible);

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
              {`Chapter ${displayChapterNumber}${breadcrumbMeta.chapterName ? `. ${breadcrumbMeta.chapterName}` : ""}`}
            </button>
            <ConceptLearningIcon type="chevron-right" />
            <button
              type="button"
              onClick={() => navigate(`/chapters/${chapterNumber}/sections/${sourceSectionId}`)}
            >
              {breadcrumbMeta.topicName
                ? `${breadcrumbMeta.sectionNumber ? `${breadcrumbMeta.sectionNumber} ` : ""}${breadcrumbMeta.topicName}`
                : `Section ${sourceSectionId}`}
            </button>
            <ConceptLearningIcon type="chevron-right" />
            <span className="is-current">
              {card?.primaryConcept ? `Concept - ${card.primaryConcept}` : "Concept"}
            </span>
          </nav>

          <header className="student-concept-hero">
            <div className="student-concept-hero-icon">
              <ConceptLearningIcon type="book" />
            </div>
            <div className="student-concept-hero-copy">
              <h1>{card?.primaryConcept || "Concept"}</h1>
              {(card?.learningObjective || card?.contextSummary) && (
                <p>{card.learningObjective || card.contextSummary}</p>
              )}
            </div>
          </header>

          <nav className="student-concept-tabbar" aria-label="Concept modes">
            {visibleTabs.map((tab) => (
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
                        {renderExploreSlideNav()}
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
                ) : activeTab === "Smart Tutor" ? (
                  <>
                    <StudentAiTutorPanel assessmentUnitId={assessmentUnitId} />
                    <StudentConceptPracticeCapture assessmentUnitId={assessmentUnitId} />
                    <StudentEinsteinMode assessmentUnitId={assessmentUnitId} />
                    <StudentVivaMode assessmentUnitId={assessmentUnitId} />
                  </>
                ) : activeTab === "Challenges" ? (
                  <StudentChallengesTab assessmentUnitId={assessmentUnitId} />
                ) : activeTab === "Exercises/Activities" ? (
                  renderExercisesActivitiesMode()
                ) : activeTab === "Revision" ? (
                  renderRevisionMode()
                ) : (
                  renderComingSoon(activeTab)
                )}
              </div>
              {activeTab === "Explore" && exploreSteps.length > 0 && renderExploreRail()}
            </div>
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
          <h1>
            {headerPrefix ? <span className="student-concept-learning-header-prefix">{headerPrefix}</span> : null}
            {card?.primaryConcept || "Concept"}
          </h1>
        </header>

        {loading ? (
          <p className="student-empty-state">Loading concept...</p>
        ) : error || !card ? (
          <p className="student-empty-state">{error || "This concept has not been generated yet."}</p>
        ) : (
          // Accordion instead of a separate horizontally-scrolling tab bar --
          // 7 tabs never all fit on a phone width, and scrolling (arrows,
          // swipe, keyboard) still left the tab bar and its content as two
          // disconnected pieces of chrome competing for the same screen.
          // Stacking every tab as a collapsible section means there's
          // nothing to scroll sideways at all: at most one section expands
          // at a time (mobileExpandedTab, toggled via
          // toggleMobileAccordionSection -- separate from activeTab, which
          // still just tracks which tab's content to render/keep loaded).
          // Starts with nothing expanded, so landing here shows every
          // section's header at a glance instead of TABS[0] pre-opened and
          // pushing the rest below the fold. Practice still isn't a real
          // section here -- selectTab navigates straight to the assessment
          // page for it, so its header never actually expands.
          <div className="student-concept-accordion">
            {visibleTabs.map((tab) => {
              const isOpen = tab === mobileExpandedTab;
              return (
                <section key={tab} className={`student-concept-accordion-item ${isOpen ? "is-open" : ""}`}>
                  <button
                    type="button"
                    className="student-concept-accordion-header"
                    onClick={() => toggleMobileAccordionSection(tab)}
                    aria-expanded={isOpen}
                  >
                    <span className="student-concept-accordion-header-icon">
                      <ConceptLearningIcon type={MOBILE_TAB_ICON[tab]} />
                    </span>
                    <span className="student-concept-accordion-header-label">{tab}</span>
                    <ConceptLearningIcon
                      type="chevron-down"
                      className={`student-concept-accordion-chevron ${isOpen ? "is-open" : ""}`}
                    />
                  </button>
                  {isOpen && <div className="student-concept-accordion-panel">{renderTabContent(tab)}</div>}
                </section>
              );
            })}
          </div>
        )}

    </StudentPageShell>
  );
};
