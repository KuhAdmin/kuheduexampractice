export const defaultChapters = [];

// Chapters browsed via the class/subject switcher on
// StudentChaptersPage.jsx need their (examGoalCode, levelCode, subjectCode)
// carried along too -- chapterNumber alone doesn't disambiguate which
// subject's "Chapter 5" is meant once the page can show any subject, not
// just the student's own profile. Encoded into the route param with its own
// prefix so it's distinguishable from a plain chapter number.
const SELECTION_ID_PREFIX = "sel:";

export const encodeSelectionChapterId = ({ examGoalCode, levelCode, subjectCode, chapterNumber }) =>
  `${SELECTION_ID_PREFIX}${encodeURIComponent(
    JSON.stringify([examGoalCode, levelCode, subjectCode, chapterNumber])
  )}`;

export const isSelectionChapterId = (value) => typeof value === "string" && value.startsWith(SELECTION_ID_PREFIX);

export const decodeSelectionChapterId = (value) => {
  if (!isSelectionChapterId(value)) {
    return null;
  }
  try {
    const [examGoalCode, levelCode, subjectCode, chapterNumber] = JSON.parse(
      decodeURIComponent(value.slice(SELECTION_ID_PREFIX.length))
    );
    return { examGoalCode, levelCode, subjectCode, chapterNumber };
  } catch {
    return null;
  }
};

export const toTitleLabel = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export const buildChapterRows = (chapters = []) =>
  chapters.map((chapter, index) => ({
    ...chapter,
    id: Number(chapter.id ?? index + 1),
    progress: Number(chapter.progress || 0),
    sectionCount: Number(chapter.sectionCount || 0),
  }));
