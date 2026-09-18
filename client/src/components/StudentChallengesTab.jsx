import { useEffect, useState } from "react";
import {
  checkObjectHuntPhotos,
  getChallengeResponse,
  getStudentConceptChallenges,
  submitChallengeResponse,
} from "../api/client";
import { StudentCameraCapture } from "./StudentCameraCapture";
import { StudentOpenResponsePanel } from "./StudentOpenResponsePanel";
import { useBreakpoint } from "../hooks/useBreakpoint";

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l.9-1.5A1.5 1.5 0 0 1 9.7 4.75h4.6a1.5 1.5 0 0 1 1.3.75L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    />
    <circle cx="12" cy="12.5" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

// Strips <script> tags and on*="..." handler attributes before the SVG is
// injected via dangerouslySetInnerHTML. The generation contract already
// instructs the model never to emit either, but this content is still
// externally-sourced (an admin JSON upload), so this is defense in depth
// rather than trusting that instruction blindly.
const sanitizeSvg = (markup) => {
  if (typeof markup !== "string") return "";
  return markup
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "");
};

const parseJsonDetail = (value) => {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const getDetailValue = (details, label) => details?.find((detail) => detail.label === label)?.value;

// casestudy: scenario + question up front, hints/answer behind reveal
// buttons for self-check, plus a "Submit for Feedback" response box (same
// StudentOpenResponsePanel used by textbook Exercises) so a student can
// also write their own answer and get AI feedback instead of only
// comparing against the official answer/rubric.
const CaseStudyCard = ({ item }) => {
  const [showHints, setShowHints] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  // "Show answer" only becomes available once the student has submitted
  // their own attempt for feedback (below) -- true both right after a
  // fresh submit and when a prior session's feedback loads on mount, via
  // StudentOpenResponsePanel's onFeedbackChange.
  const [hasFeedback, setHasFeedback] = useState(false);
  const scenario = getDetailValue(item.details, "Scenario");
  const question = getDetailValue(item.details, "Question");
  const hints = getDetailValue(item.details, "Hints");
  const hintList = Array.isArray(hints) ? hints : hints ? [hints] : [];
  const answer = getDetailValue(item.details, "Answer");
  const rubric = getDetailValue(item.details, "Rubric");

  return (
    <article className="student-detail-card student-challenge-casestudy">
      {item.title && <h3 className="student-detail-card-title">{item.title}</h3>}
      {scenario && <p className="student-detail-card-summary">{scenario}</p>}
      {question && (
        <p className="student-challenge-question">
          <strong>Question:</strong> {question}
        </p>
      )}
      {hintList.length > 0 && (
        <div className="student-challenge-reveal">
          <button type="button" className="ghost-button" onClick={() => setShowHints((current) => !current)}>
            {showHints ? "Hide hints" : "Show hints"}
          </button>
          {showHints && (
            <ul className="student-concept-learning-list">
              {hintList.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {(answer || rubric) && hasFeedback && (
        <div className="student-challenge-reveal">
          <button type="button" className="ghost-button" onClick={() => setShowAnswer((current) => !current)}>
            {showAnswer ? "Hide answer" : "Show answer"}
          </button>
          {showAnswer && (
            <>
              {answer && (
                <p>
                  <strong>Answer:</strong> {answer}
                </p>
              )}
              {rubric && (
                <p>
                  <strong>Rubric:</strong> {rubric}
                </p>
              )}
            </>
          )}
        </div>
      )}
      {item.responseKey && (
        <StudentOpenResponsePanel
          responseKey={item.responseKey}
          fetchResponse={getChallengeResponse}
          submitResponse={submitChallengeResponse}
          placeholder="Capture a photo of your handwritten answer above"
          onFeedbackChange={(feedbackValue) => setHasFeedback(Boolean(feedbackValue))}
          hideTextInput
        />
      )}
    </article>
  );
};

// hotspot: SVG diagram with tappable markers at each labeled point; tapping
// reveals that point's label and marks it found. No grading -- self-check.
const HotspotCard = ({ item }) => {
  const [foundIds, setFoundIds] = useState(() => new Set());
  const svgMarkup = getDetailValue(item.details, "Diagram");
  const hotspots = parseJsonDetail(getDetailValue(item.details, "Hotspots")) || [];

  const toggleFound = (id) => {
    setFoundIds((current) => new Set(current).add(id));
  };

  return (
    <article className="student-detail-card student-challenge-hotspot">
      {item.title && <h3 className="student-detail-card-title">{item.title}</h3>}
      {item.summary && <p className="student-detail-card-summary">{item.summary}</p>}
      <div className="student-hotspot-counter">
        {foundIds.size}/{hotspots.length} found
      </div>
      <div className="student-hotspot-diagram">
        {svgMarkup && (
          <div className="student-hotspot-svg" dangerouslySetInnerHTML={{ __html: sanitizeSvg(svgMarkup) }} />
        )}
        {hotspots.map((point) => (
          <button
            key={point.id}
            type="button"
            className={`student-hotspot-marker ${foundIds.has(point.id) ? "is-found" : ""}`}
            style={{ left: `${point.xPercent}%`, top: `${point.yPercent}%` }}
            onClick={() => toggleFound(point.id)}
            aria-label={point.label}
          >
            {foundIds.has(point.id) ? "✓" : "?"}
          </button>
        ))}
      </div>
      {foundIds.size > 0 && (
        <ul className="student-concept-learning-list">
          {hotspots
            .filter((point) => foundIds.has(point.id))
            .map((point) => (
              <li key={point.id}>{point.label}</li>
            ))}
        </ul>
      )}
    </article>
  );
};

// einsteinmode -> "Object Hunt": a checklist of 15 real-world objects,
// distinctly named/placed from the existing live "Einstein Mode" feature
// (StudentEinsteinMode.jsx, a different single-object-per-round activity) so
// the two aren't mistaken for one another. Each object is photographed
// locally first (no AI call yet, same low-friction capture as before), then
// "Check My Objects" sends every attached photo in ONE batch to
// checkObjectHuntPhotos, which reuses einsteinModeService.js's
// recognizeEinsteinObject per photo -- real AI vision verification against
// the object's name, not a local-only "I found it" claim. Replaces the
// earlier design (a separate StudentOpenResponsePanel asking for a
// photographed written reflection), which was confusing -- two unrelated
// "snap a photo" actions with only one of them actually AI-graded.
const ObjectHuntCard = ({ item, assessmentUnitId }) => {
  const objects = parseJsonDetail(getDetailValue(item.details, "Objects")) || [];
  const [photoState, setPhotoState] = useState({});
  const [results, setResults] = useState({});
  const [cameraObjectId, setCameraObjectId] = useState(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");

  const attachPhoto = (id, dataUrl) => {
    setPhotoState((current) => ({ ...current, [id]: dataUrl }));
    // A retaken photo invalidates whatever verdict was based on the old one.
    setResults((current) => {
      if (!current[id]) return current;
      const { [id]: _removed, ...rest } = current;
      return rest;
    });
  };

  const attachedIds = Object.keys(photoState);
  const matchedCount = Object.values(results).filter((entry) => entry.isMatch).length;
  const hasResults = Object.keys(results).length > 0;

  const handleCheckObjects = async () => {
    setChecking(true);
    setCheckError("");
    try {
      const items = attachedIds.map((id) => ({
        objectId: id,
        objectName: objects.find((object) => object.id === id)?.name || "",
        imageDataUrl: photoState[id],
      }));
      const { results: checkResults } = await checkObjectHuntPhotos(assessmentUnitId, items);
      setResults(Object.fromEntries(checkResults.map((entry) => [entry.objectId, entry])));
    } catch (error) {
      setCheckError(error.message || "Failed to check your photos. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <article className="student-detail-card student-object-hunt">
      {item.title && <h3 className="student-detail-card-title">{item.title}</h3>}
      {item.summary && <p className="student-detail-card-summary">{item.summary}</p>}
      <div className="student-hotspot-counter">
        {hasResults ? `${matchedCount}/${attachedIds.length} matched` : `${attachedIds.length}/${objects.length} photos attached`}
      </div>
      <ul className="student-object-hunt-list">
        {objects.map((object) => {
          const photo = photoState[object.id];
          const result = results[object.id];
          return (
            <li
              key={object.id}
              className={`student-object-hunt-item ${
                result ? (result.isMatch ? "is-matched" : "is-unmatched") : photo ? "is-attached" : ""
              }`}
            >
              {photo && <img src={photo} alt={object.name} className="student-object-hunt-thumb" />}
              <div className="student-object-hunt-copy">
                <div className="student-object-hunt-header">
                  <strong>{object.name}</strong>
                  <button
                    type="button"
                    className="student-object-hunt-camera-button"
                    onClick={() => setCameraObjectId(object.id)}
                    aria-label={photo ? "Retake photo" : "Attach photo"}
                    title={photo ? "Retake photo" : "Attach photo"}
                  >
                    <CameraIcon />
                  </button>
                </div>
                <p>{object.hint}</p>
                {result ? (
                  <span
                    className={`student-object-hunt-toggle is-active ${result.isMatch ? "is-match" : "is-no-match"}`}
                  >
                    {result.isMatch ? "✓ Matched" : "✗ Not quite"} — {result.feedback}
                  </span>
                ) : (
                  photo && <span className="student-object-hunt-toggle">Photo attached</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {cameraObjectId && (
        <StudentCameraCapture
          onCapture={(dataUrl) => {
            attachPhoto(cameraObjectId, dataUrl);
            setCameraObjectId(null);
          }}
          onCancel={() => setCameraObjectId(null)}
        />
      )}
      <div className="admin-ai-demo-actions student-object-hunt-check-actions">
        <button
          type="button"
          className="primary-button"
          disabled={checking || attachedIds.length === 0}
          onClick={handleCheckObjects}
        >
          {checking ? "Checking your photos..." : "Check My Objects"}
        </button>
      </div>
      {checkError && <p className="error-text">{checkError}</p>}
    </article>
  );
};

const CHALLENGE_FAMILIES = [
  { key: "casestudy", label: "Case Study" },
  { key: "hotspot", label: "Hotspot" },
  { key: "einsteinmode", label: "Object Hunt" },
];

// Shared by both the mobile (one family at a time) and desktop/tablet (all
// families at once) layouts, so which component renders a given family's
// items is only ever defined in one place.
const renderChallengeCard = (familyKey, item, index, assessmentUnitId) =>
  familyKey === "casestudy" ? (
    <CaseStudyCard key={index} item={item} />
  ) : familyKey === "hotspot" ? (
    <HotspotCard key={index} item={item} />
  ) : (
    <ObjectHuntCard key={index} item={item} assessmentUnitId={assessmentUnitId} />
  );

export const StudentChallengesTab = ({ assessmentUnitId }) => {
  const isDesktop = useBreakpoint() !== "mobile";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeFamily, setActiveFamily] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    getStudentConceptChallenges(assessmentUnitId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || "Failed to load challenges.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [assessmentUnitId]);

  const availableFamilies = CHALLENGE_FAMILIES.filter((family) => data?.[family.key]?.length > 0);

  useEffect(() => {
    setActiveFamily(availableFamilies[0]?.key || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (loading) {
    return <p className="student-empty-state">Loading challenges...</p>;
  }
  if (error) {
    return <p className="student-empty-state">{error}</p>;
  }
  if (availableFamilies.length === 0) {
    return (
      <section className="student-concept-learning-card">
        <div className="student-concept-learning-copy">
          <h2>Challenges</h2>
          <p>No extra challenges have been generated for this micro learning unit yet.</p>
        </div>
      </section>
    );
  }

  const activeItems = data[activeFamily] || [];

  // Still a tab switch on every width -- only the active family's items
  // show at once. Desktop/tablet lays those items out 2-per-row (when
  // there's more than one) instead of full-width stacked, via the same
  // .student-challenges-grid used elsewhere; mobile keeps the single-column
  // list.
  return (
    <>
      <nav className="student-section-detail-tabs" aria-label="Challenge type">
        {availableFamilies.map((family) => (
          <button
            key={family.key}
            type="button"
            className={`student-section-detail-tab ${activeFamily === family.key ? "is-active" : ""}`}
            onClick={() => setActiveFamily(family.key)}
          >
            {family.label}
          </button>
        ))}
      </nav>
      <div className={isDesktop ? "student-challenges-grid" : "student-detail-card-list-page"}>
        {activeItems.map((item, index) => renderChallengeCard(activeFamily, item, index, assessmentUnitId))}
      </div>
    </>
  );
};
