export const THEME_STORAGE_KEY = "kuhedu_theme";

export const getStoredTheme = () => {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "dusk" ? "dusk" : "dawn";
  } catch (_error) {
    return "dawn";
  }
};

export const applyTheme = (theme) => {
  const next = theme === "dusk" ? "dusk" : "dawn";
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch (_error) {
    // localStorage unavailable (private browsing etc.) -- attribute is still applied.
  }
};
