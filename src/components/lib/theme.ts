export type ThemePreference = "light" | "dark";

export const THEME_STORAGE_KEY = "myfixly.theme";

export function getStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "light";
  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  return value === "dark" ? "dark" : "light";
}

export function applyTheme(preference: ThemePreference): void {
  if (typeof document === "undefined") return;
  const isDark = preference === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
}

export function setTheme(preference: ThemePreference): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  applyTheme(preference);
}
