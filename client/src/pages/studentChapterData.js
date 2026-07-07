export const defaultChapters = [];

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
