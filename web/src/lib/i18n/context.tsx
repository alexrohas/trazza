import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { es, type TranslationKey } from "./es";
import { en } from "./en";
import { safeLocalGet, safeLocalSet } from "../storage";

export type Language = "es" | "en";

const dictionaries: Record<Language, Record<TranslationKey, string>> = { en, es };

const storageKey = "trazza:language";

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLanguage(): Language {
  return safeLocalGet(storageKey) === "en" ? "en" : "es";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => readStoredLanguage());

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    safeLocalSet(storageKey, next);
  }, []);

  const t = useCallback((key: TranslationKey) => dictionaries[language][key] ?? es[key], [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n debe usarse dentro de I18nProvider.");
  return context;
}

export function useT() {
  return useI18n().t;
}
