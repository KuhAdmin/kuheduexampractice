import { useEffect, useState } from "react";
import { getChallengeResponse, getStudentConceptChallenges, submitChallengeResponse } from "../api/client";
import { StudentCameraCapture } from "./StudentCameraCapture";
import { StudentOpenResponsePanel } from "./StudentOpenResponsePanel";

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
      {(answer || rubric) && (
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
          placeholder="Type your own answer, or capture a photo of your handwritten answer above"
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

// einsteinmode -> "Object Hunt": a self-check checklist of 15 real-world
// objects, distinctly named/placed from the existing live "Einstein Mode"
// feature (StudentEinsteinMode.jsx, a different single-object-per-round,
// AI-vision-graded activity) so the two aren't mistaken for one another.
// Per-object "Attach a photo" stays a local, in-session reference thumbnail
// only (never sent to the server, no per-object grading) -- but a
// StudentOpenResponsePanel below the checklist lets the student write a
// free-text summary of the whole hunt and get one holistic AI feedback
// pass on it, same mechanism as Case Study/textbook Exercises.
const ObjectHuntCard = ({ item }) => {
  const objects = parseJsonDetail(getDetailValue(item.details, "Objects")) || [];
  const [foundState, setFoundState] = useState({});
  const [cameraObjectId, setCameraObjectId] = useState(null);

  const markFound = (id) =>
    setFoundState((current) => ({ ...current, [id]: { ...current[id], found: true } }));
  const attachPhoto = (id, dataUrl) =>
    setFoundState((current) => ({ ...current, [id]: { ...current[id], found: true, photo: dataUrl } }));

  const foundCount = Object.values(foundState).filter((entry) => entry.found).length;

  return (
    <article className="student-detail-card student-object-hunt">
      {item.title && <h3 className="student-detail-card-title">{item.title}</h3>}
      {item.summary && <p className="student-detail-card-summary">{item.summary}</p>}
      <div className="student-hotspot-counter">
        {foundCount}/{objects.length} found
      </div>
      <ul className="student-object-hunt-list">
        {objects.map((object) => {
          const entry = foundState[object.id] || {};
          return (
            <li key={object.id} className={`student-object-hunt-item ${entry.found ? "is-found" : ""}`}>
              {entry.photo && (
                <img src={entry.photo} alt={object.name} className="student-object-hunt-thumb" />
              )}
              <div className="student-object-hunt-copy">
                <strong>{object.name}</strong>
                <p>{object.hint}</p>
              </div>
              <div className="student-object-hunt-actions">
                <button type="button" className="ghost-button" onClick={() => setCameraObjectId(object.id)}>
                  {entry.photo ? "Retake photo" : "Attach a photo"}
                </button>
                <button
                  type="button"
                  className={`student-object-hunt-toggle ${entry.found ? "is-active" : ""}`}
                  onClick={() => markFound(object.id)}
                >
                  {entry.found ? "Found it" : "Mark found"}
                </button>
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
      {item.responseKey && (
        <StudentOpenResponsePanel
          responseKey={item.responseKey}
          fetchResponse={getChallengeResponse}
          submitResponse={submitChallengeResponse}
          placeholder="Describe the objects you found and how they connect to the theme, or capture a photo of your notes above"
        />
      )}
    </article>
  );
};

const CHALLENGE_FAMILIES = [
  { key: "casestudy", label: "Case Study" },
  { key: "hotspot", label: "Hotspot" },
  { key: "einsteinmode", label: "Object Hunt" },
];

export const StudentChallengesTab = ({ assessmentUnitId }) => {
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
          <p>No extra challenges have been generated for this concept yet.</p>
        </div>
      </section>
    );
  }

  const activeItems = data[activeFamily] || [];

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
      <div className="student-detail-card-list-page">
        {activeItems.map((item, index) =>
          activeFamily === "casestudy" ? (
            <CaseStudyCard key={index} item={item} />
          ) : activeFamily === "hotspot" ? (
            <HotspotCard key={index} item={item} />
          ) : (
            <ObjectHuntCard key={index} item={item} />
          )
        )}
      </div>
    </>
  );
};
