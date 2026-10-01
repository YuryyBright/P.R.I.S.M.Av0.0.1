import { UaFlagIcon, UsFlagIcon } from "@/icons";
import type React from "react";
import { defaultLocale, locales, type Locale } from "./config";

// Re-exported so existing imports from "@/i18n/languages" keep working.
export { defaultLocale, locales };
export type { Locale };

export interface Language {
  id: Locale;
  name: string;
  shortName: string;
  dir: "ltr" | "rtl";
  FlagIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  badge?: string;
}

export const languages: Language[] = [
  {
    id: "uk",
    name: "Українська",
    shortName: "Українська",
    dir: "ltr",
    FlagIcon: UaFlagIcon,
  },
  {
    id: "en",
    name: "English",
    shortName: "English",
    dir: "ltr",
    FlagIcon: UsFlagIcon,
  },
  // {
  //   id: "ar",
  //   name: "Arabic (Saudi)",
  //   shortName: "Arabic",
  //   dir: "rtl",
  //   FlagIcon: SaFlagIcon,
  //   badge: "RTL",
  // },
  // {
  //   id: "es",
  //   name: "Español",
  //   shortName: "Español",
  //   dir: "ltr",
  //   FlagIcon: EsFlagIcon,
  // },
  // {
  //   id: "de",
  //   name: "Deutsch",
  //   shortName: "Deutsch",
  //   dir: "ltr",
  //   FlagIcon: DeFlagIcon,
  // },
];

export function getLanguage(locale: Locale): Language {
  return (
    languages.find((l) => l.id === locale) ||
    languages.find((l) => l.id === defaultLocale) ||
    languages[0]
  );
}

export function isRtl(locale: Locale): boolean {
  return getLanguage(locale).dir === "rtl";
}
