"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";
type Locale = "es" | "en";

type PreferencesContextValue = {
  theme: Theme;
  locale: Locale;
  toggleTheme: () => void;
  setLocale: (locale: Locale) => void;
  t: (es: string, en: string) => string;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [locale, setLocaleState] = useState<Locale>("es");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("nub-theme") as Theme | null;
    const storedLocale = window.localStorage.getItem("nub-locale") as Locale | null;
    if (storedTheme === "dark" || storedTheme === "light") {
      setTheme(storedTheme);
    }
    if (storedLocale === "en" || storedLocale === "es") {
      setLocaleState(storedLocale);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.lang = locale;
    window.localStorage.setItem("nub-theme", theme);
    window.localStorage.setItem("nub-locale", locale);
  }, [locale, theme]);

  const value = useMemo(
    () => ({
      theme,
      locale,
      toggleTheme: () => setTheme((current) => (current === "dark" ? "light" : "dark")),
      setLocale: setLocaleState,
      t: (es: string, en: string) => (locale === "en" ? en : es),
    }),
    [locale, theme],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) {
    throw new Error("usePreferences must be used inside PreferencesProvider");
  }
  return value;
}
