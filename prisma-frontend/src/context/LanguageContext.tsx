import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { defaultLocale, normalizeLocale, type Locale } from "@/i18n/config";
import { languages } from "@/i18n/languages";

/** Alias kept for existing imports; the list of codes lives in i18n/config.ts. */
export type LanguageCode = Locale;

export type Language = {
  code: LanguageCode;
  name: string;
  dir: "ltr" | "rtl";
  flag?: string;
};

/** Derived from i18n/languages.ts, so only languages that really have translations are offered. */
export const AVAILABLE_LANGUAGES: Language[] = languages.map((l) => ({
  code: l.id,
  name: l.name,
  dir: l.dir,
}));

type LanguageContextType = {
  language: LanguageCode;
  currentLanguage: Language;
  dir: "ltr" | "rtl";
  setLanguage: (code: LanguageCode) => void;
  availableLanguages: Language[];
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { i18n } = useTranslation();
  const [language, setLanguageState] = useState<LanguageCode>(
    () => normalizeLocale(i18n.resolvedLanguage || i18n.language) ?? defaultLocale,
  );

  const currentLanguage =
    AVAILABLE_LANGUAGES.find((lang) => lang.code === language) ||
    AVAILABLE_LANGUAGES.find((lang) => lang.code === defaultLocale) ||
    AVAILABLE_LANGUAGES[0];
  const dir = currentLanguage.dir;

  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      const next = normalizeLocale(lng);
      if (next && next !== language) {
        setLanguageState(next);
      }
    };

    i18n.on("languageChanged", handleLanguageChanged);
    return () => {
      i18n.off("languageChanged", handleLanguageChanged);
    };
  }, [i18n, language]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
    try {
      localStorage.setItem("i18nextLng", language);
      localStorage.setItem("language", language);
    } catch {
      // storage unavailable: the choice just won't survive a reload
    }
  }, [language, dir]);

  const setLanguage = (code: LanguageCode) => {
    void i18n.changeLanguage(code);
    setLanguageState(code);
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        currentLanguage,
        dir,
        setLanguage,
        availableLanguages: AVAILABLE_LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
