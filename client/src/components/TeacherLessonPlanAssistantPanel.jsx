import { useState } from "react";
import { askLessonPlanAssistant, getLessonPlanAssistantHistory, recordLessonPlanAssistantHistory } from "../api/client";
import { getSubjectActivityExample } from "../utils/subjectExamples";

// The prompt asks the model for plain text, but it can still slip in
// markdown emphasis now and then -- strip stray ** / __ / single asterisks
// rather than showing them as literal characters.
const stripMarkdown = (text) => (text || "").replace(/\*\*|__/g, "").replace(/(?<!\d)\*(?!\d)/g, "");

// The assistant returns plain free-text, not structured JSON -- when it
// happens to answer with a numbered list ("1. ... 2. ... 3. ..."), split it
// into separate items instead of leaving it as one run-on paragraph. Only
// splits when EVERY resulting piece actually starts with "N. ", so a
// mid-sentence number (a mark, a price) can't cause a false split.
const getAnswerListItems = (text) => {
  if (!text) return null;
  const parts = text
    .trim()
    .split(/\s*(?=\d+\.\s)/)
    .map((part) => part.trim())
    .filter(Boolean);
  // The model is told never to add one, but if a preamble sentence slips in
  // before the first "1. " anyway, it can only ever be this leading part --
  // every other split boundary falls exactly at a numbered marker by
  // construction. Drop it rather than rejecting the whole list over one
  // stray sentence.
  const firstItemIndex = parts.findIndex((part) => /^\d+\.\s/.test(part));
  const itemParts = firstItemIndex === -1 ? [] : parts.slice(firstItemIndex);
  if (itemParts.length < 2 || !itemParts.every((part) => /^\d+\.\s/.test(part))) return null;
  return itemParts.map((part) => stripMarkdown(part.replace(/^\d+\.\s*/, "")));
};

// A plain "Day N" match against THIS ONE ITEM's own text (not the whole
// answer, so a multi-day answer's items each resolve their own day instead
// of every item matching whichever day the FIRST item happened to mention).
// Returns null -- not a fallback guess -- when there's no confident match,
// so the caller can tell "known day, just attach it" apart from "ambiguous,
// ask the teacher" instead of silently defaulting to the wrong day.
const parseDayNumber = (text, days) => {
  const match = /day\s*(\d+)/i.exec(text || "");
  const parsed = match ? Number(match[1]) : null;
  return parsed && days.some((day) => day.dayNumber === parsed) ? parsed : null;
};

const timeAgo = (isoString) => {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

// AI Teaching Assistant -- single-shot per Ask (see lessonPlanAssistantService.js),
// but a resolved answer isn't purely ephemeral anymore: Attach writes ONE
// item into its own day's Activities field (a multi-day answer has several
// items, each attached independently -- there's no single day a whole
// multi-item answer could go to), Retry discards and regenerates the WHOLE
// exchange, and both file into a small server-persisted history a teacher
// can revisit later (see lessonPlanAssistantHistoryService.js) -- the one
// deliberate exception to this feature's otherwise fully-stateless design.
//
// Accepting an item never removes it from view -- the whole list stays put
// so a teacher can keep attaching the other suggestions afterward. Only the
// Edit/Delete/Attach icons for THAT item are replaced with a small "Added"
// badge; explicit Delete is the only action that removes an item.
export const TeacherLessonPlanAssistantPanel = ({ batchId, subjectName, chapterTitle, planContext, days = [], onAcceptToDay }) => {
  const [question, setQuestion] = useState("");
  const [entries, setEntries] = useState([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [editingKey, setEditingKey] = useState(null); // `${entryIndex}:${itemIndex}` or null
  const [editValue, setEditValue] = useState("");

  // itemIndex is "p" for a plain-paragraph answer (there's only one "item").
  const [acceptingKey, setAcceptingKey] = useState(null); // `${entryIndex}:${itemIndex}` or null
  const [acceptDayNumber, setAcceptDayNumber] = useState("");
  const [acceptingBusyKey, setAcceptingBusyKey] = useState(null);
  const [acceptedByKey, setAcceptedByKey] = useState({}); // { [`${entryIndex}:${itemIndex}`]: dayNumber }
  const [retryingIndex, setRetryingIndex] = useState(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const runAsk = async (questionText) => {
    setPending(true);
    setError("");
    try {
      const { answer } = await askLessonPlanAssistant({ batchId, chapterTitle, question: questionText, planContext });
      setEntries((prev) => [...prev, { question: questionText, answer, listItems: getAnswerListItems(answer) }]);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const handleAsk = async (event) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || pending) return;
    await runAsk(trimmed);
    setQuestion("");
  };

  const startEdit = (entryIndex, itemIndex, currentValue) => {
    setEditingKey(`${entryIndex}:${itemIndex}`);
    setEditValue(currentValue);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue("");
  };

  const saveEdit = (entryIndex, itemIndex) => {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    setEntries((prev) =>
      prev.map((entry, index) =>
        index === entryIndex
          ? { ...entry, listItems: entry.listItems.map((item, i) => (i === itemIndex ? trimmed : item)) }
          : entry
      )
    );
    cancelEdit();
  };

  const deleteItem = (entryIndex, itemIndex) => {
    setEntries((prev) =>
      prev
        .map((entry, index) =>
          index === entryIndex ? { ...entry, listItems: entry.listItems.filter((_, i) => i !== itemIndex) } : entry
        )
        .filter((entry) => !entry.listItems || entry.listItems.length > 0)
    );
    if (editingKey === `${entryIndex}:${itemIndex}`) cancelEdit();
  };

  const recordHistory = async ({ question, answer, items, status, acceptedDayNumber }) => {
    if (!batchId) return;
    try {
      await recordLessonPlanAssistantHistory({ batchId, question, answer, items, status, acceptedDayNumber });
    } catch {
      // Best-effort archive -- never block Attach/Retry itself on this.
    }
  };

  const cancelAccept = () => {
    setAcceptingKey(null);
    setAcceptDayNumber("");
  };

  // Marks ONE item (or the whole paragraph, when itemIndex is "p") as
  // accepted -- the item's text stays visible in the list, only its
  // action row is replaced with an "Added" badge, so the rest of a
  // multi-item answer stays available to attach afterward.
  const performAccept = async (entryIndex, itemIndex, text, dayNumber) => {
    const entry = entries[entryIndex];
    const key = `${entryIndex}:${itemIndex}`;
    if (!dayNumber || !onAcceptToDay) return;
    setAcceptingBusyKey(key);
    setError("");
    try {
      const ok = await onAcceptToDay(dayNumber, text);
      if (ok) {
        await recordHistory({ question: entry.question, answer: text, items: null, status: "accepted", acceptedDayNumber: dayNumber });
        setAcceptedByKey((prev) => ({ ...prev, [key]: dayNumber }));
        cancelAccept();
        setNotice("Added to lesson plan. View the Activities section.");
      } else {
        setError("Failed to add this to the lesson plan. Please try again.");
      }
    } catch (err) {
      setError(err.message || "Failed to add this to the lesson plan.");
    } finally {
      setAcceptingBusyKey(null);
    }
  };

  // The day-picker is a fallback, not the default path: since the model now
  // always names exactly one day per item, attaching should be a single
  // click whenever that day can be parsed with confidence -- only ambiguous
  // text (no "Day N" found, or one that doesn't match a real day) opens the
  // picker for a manual choice.
  const handleAttachClick = (entryIndex, itemIndex, text) => {
    const dayNumber = parseDayNumber(text, days);
    if (dayNumber) {
      performAccept(entryIndex, itemIndex, text, dayNumber);
      return;
    }
    setAcceptingKey(`${entryIndex}:${itemIndex}`);
    setAcceptDayNumber(days[0]?.dayNumber ?? "");
    setNotice("");
    setError("");
  };

  const confirmAccept = (entryIndex, itemIndex) => {
    const entry = entries[entryIndex];
    const text = itemIndex === "p" ? stripMarkdown(entry.answer) : entry.listItems[itemIndex];
    performAccept(entryIndex, itemIndex, text, Number(acceptDayNumber));
  };

  const handleRetry = async (entryIndex) => {
    const entry = entries[entryIndex];
    setRetryingIndex(entryIndex);
    setNotice("");
    await recordHistory({ question: entry.question, answer: entry.answer, items: entry.listItems, status: "retried" });
    setEntries((prev) => prev.filter((_, index) => index !== entryIndex));
    setAcceptedByKey((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([key]) => !key.startsWith(`${entryIndex}:`)))
    );
    await runAsk(entry.question);
    setRetryingIndex(null);
  };

  const toggleHistory = async () => {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setHistoryOpen(true);
    if (!batchId) return;
    setHistoryLoading(true);
    try {
      const { entries: rows } = await getLessonPlanAssistantHistory(batchId);
      setHistoryEntries(rows || []);
    } catch {
      setHistoryEntries([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const renderAcceptPicker = (entryIndex, itemIndex) => {
    const busy = acceptingBusyKey === `${entryIndex}:${itemIndex}`;
    return (
      <div className="teacher-lesson-assistant-accept-picker">
        <label>
          <span>Add to day</span>
          <select value={acceptDayNumber} onChange={(event) => setAcceptDayNumber(event.target.value)}>
            {days.map((day) => (
              <option key={day.dayNumber} value={day.dayNumber}>
                Day {day.dayNumber}: {day.topic}
              </option>
            ))}
          </select>
        </label>
        <div className="teacher-lesson-assistant-item-actions">
          <button type="button" className="ghost-button" onClick={cancelAccept} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={() => confirmAccept(entryIndex, itemIndex)} disabled={busy || !acceptDayNumber}>
            {busy ? "Adding…" : "Confirm"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <section className="teacher-lesson-assistant-panel" aria-label="AI Teaching Assistant">
      <header className="teacher-lesson-assistant-header">
        <div className="teacher-lesson-assistant-header-row">
          <h3>AI Teaching Assistant</h3>
          <button type="button" className="teacher-lesson-assistant-history-toggle" onClick={toggleHistory}>
            {historyOpen ? "Hide History" : "History"}
          </button>
        </div>
        <p>Ask anything about planning this chapter.</p>
      </header>

      {historyOpen && (
        <div className="teacher-lesson-assistant-history-panel">
          {historyLoading ? (
            <p>Loading history…</p>
          ) : historyEntries.length === 0 ? (
            <p>No past generations yet.</p>
          ) : (
            <ul className="teacher-lesson-assistant-history-list">
              {historyEntries.map((row) => (
                <li key={row.id} className="teacher-lesson-assistant-history-row">
                  <div className="teacher-lesson-assistant-history-row-head">
                    <span className={`teacher-lesson-method-chip ${row.status === "accepted" ? "is-accepted" : "is-retried"}`}>
                      {row.status === "accepted" ? `Accepted · Day ${row.acceptedDayNumber}` : "Retried"}
                    </span>
                    <span className="teacher-lesson-assistant-history-time">{timeAgo(row.createdAt)}</span>
                  </div>
                  <p className="teacher-lesson-assistant-entry-question">{row.question}</p>
                  <p className="teacher-lesson-assistant-entry-answer">{stripMarkdown(row.answer)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <form className="teacher-lesson-assistant-form" onSubmit={handleAsk}>
        <textarea
          rows={6}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={`e.g. Suggest ${getSubjectActivityExample(subjectName)}`}
          disabled={pending}
        />
        <button type="submit" className="primary-button" disabled={pending || !question.trim()}>
          {pending ? "Thinking…" : "Ask"}
        </button>
      </form>

      {notice && <p className="teacher-lesson-assistant-notice">{notice}</p>}
      {error && <p className="error-text">{error}</p>}

      {entries.length > 0 && (
        <ul className="teacher-lesson-assistant-history">
          {entries.map((entry, entryIndex) => (
            <li key={entryIndex} className="teacher-lesson-assistant-entry">
              <p className="teacher-lesson-assistant-entry-question">{entry.question}</p>
              {entry.listItems ? (
                <ol className="teacher-lesson-assistant-entry-answer-list">
                  {entry.listItems.map((item, itemIndex) => {
                    const key = `${entryIndex}:${itemIndex}`;
                    const isEditing = editingKey === key;
                    const isAccepting = acceptingKey === key;
                    const acceptedDay = acceptedByKey[key];
                    return (
                      <li key={itemIndex} className="teacher-lesson-assistant-answer-item">
                        {isEditing ? (
                          <div className="teacher-lesson-assistant-item-edit">
                            <textarea rows={8} value={editValue} onChange={(event) => setEditValue(event.target.value)} autoFocus />
                            <div className="teacher-lesson-assistant-item-actions">
                              <button type="button" title="Save" aria-label="Save" onClick={() => saveEdit(entryIndex, itemIndex)}>
                                ✓
                              </button>
                              <button type="button" title="Cancel" aria-label="Cancel" onClick={cancelEdit}>
                                ✕
                              </button>
                            </div>
                          </div>
                        ) : isAccepting ? (
                          <div className="teacher-lesson-assistant-item-accept">
                            <span>{item}</span>
                            {renderAcceptPicker(entryIndex, itemIndex)}
                          </div>
                        ) : acceptedDay ? (
                          <>
                            <span>{item}</span>
                            <span className="teacher-lesson-method-chip is-accepted">✓ Added · Day {acceptedDay}</span>
                          </>
                        ) : (
                          <>
                            <span>{item}</span>
                            <div className="teacher-lesson-assistant-item-actions">
                              <button
                                type="button"
                                title="Attach to day"
                                aria-label="Attach this item to a day"
                                onClick={() => handleAttachClick(entryIndex, itemIndex, item)}
                                disabled={days.length === 0}
                              >
                                📎
                              </button>
                              <button
                                type="button"
                                title="Edit"
                                aria-label="Edit this item"
                                onClick={() => startEdit(entryIndex, itemIndex, item)}
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                title="Delete"
                                aria-label="Delete this item"
                                onClick={() => deleteItem(entryIndex, itemIndex)}
                              >
                                🗑️
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ol>
              ) : acceptingKey === `${entryIndex}:p` ? (
                <div className="teacher-lesson-assistant-item-accept">
                  <p className="teacher-lesson-assistant-entry-answer">{stripMarkdown(entry.answer)}</p>
                  {renderAcceptPicker(entryIndex, "p")}
                </div>
              ) : (
                <>
                  <p className="teacher-lesson-assistant-entry-answer">{stripMarkdown(entry.answer)}</p>
                  <div className="teacher-lesson-assistant-resolve-actions">
                    {acceptedByKey[`${entryIndex}:p`] ? (
                      <span className="teacher-lesson-method-chip is-accepted">✓ Added · Day {acceptedByKey[`${entryIndex}:p`]}</span>
                    ) : (
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => handleAttachClick(entryIndex, "p", entry.answer)}
                        disabled={days.length === 0}
                        title={days.length === 0 ? "Add at least one day to the plan first" : undefined}
                      >
                        📎 Attach to day
                      </button>
                    )}
                  </div>
                </>
              )}

              <div className="teacher-lesson-assistant-resolve-actions">
                <button type="button" className="ghost-button" onClick={() => handleRetry(entryIndex)} disabled={retryingIndex === entryIndex}>
                  {retryingIndex === entryIndex ? "Retrying…" : "Retry"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
