import i18n from "@/i18n";
import { registerLocale } from "react-datepicker";
import { zhCN, ms as msLocale, enUS, type Locale } from "date-fns/locale";

export type SupportedLang = "en" | "zh-CN" | "ms-MY";

const INTL_LOCALE_MAP: Record<SupportedLang, string> = {
  en: "en-US",
  "zh-CN": "zh-CN",
  "ms-MY": "ms-MY",
};

const DATE_FNS_LOCALE_MAP: Record<SupportedLang, Locale> = {
  en: enUS,
  "zh-CN": zhCN,
  "ms-MY": msLocale,
};

function normalize(lang: string | undefined): SupportedLang {
  if (!lang) return "en";
  if (lang.startsWith("zh")) return "zh-CN";
  if (lang.startsWith("ms")) return "ms-MY";
  return "en";
}

/** Active app language, derived from i18next. */
export function getActiveLang(): SupportedLang {
  return normalize(i18n.language);
}

export function getIntlLocale(lang?: string): string {
  return INTL_LOCALE_MAP[normalize(lang ?? i18n.language)];
}

export function getDateFnsLocale(lang?: string): Locale {
  return DATE_FNS_LOCALE_MAP[normalize(lang ?? i18n.language)];
}

/** Locale-aware Intl.DateTimeFormat wrapper. */
export function formatDate(
  date: Date | string | number | null | undefined,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
  lang?: string,
): string {
  if (date == null) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(getIntlLocale(lang), options).format(d);
}

export function formatWeekday(
  date: Date,
  variant: "long" | "short" = "long",
  lang?: string,
): string {
  return new Intl.DateTimeFormat(getIntlLocale(lang), { weekday: variant }).format(date);
}

export function formatMonthYear(date: Date, lang?: string): string {
  return new Intl.DateTimeFormat(getIntlLocale(lang), {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatMonthShort(date: Date, lang?: string): string {
  return new Intl.DateTimeFormat(getIntlLocale(lang), { month: "short" }).format(date);
}

export function formatTime(date: Date, lang?: string): string {
  return new Intl.DateTimeFormat(getIntlLocale(lang), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/** Localized array of weekday short labels starting Sunday. */
export function getWeekdayShort(lang?: string): string[] {
  const fmt = new Intl.DateTimeFormat(getIntlLocale(lang), { weekday: "short" });
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 7 + i)));
}

/** Localized array of month names (long) starting January. */
export function getMonthNames(lang?: string, variant: "long" | "short" = "long"): string[] {
  const fmt = new Intl.DateTimeFormat(getIntlLocale(lang), { month: variant });
  return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2024, i, 1)));
}

let registered = false;
export function ensureDatePickerLocales(): void {
  if (registered) return;
  registerLocale("zh-CN", zhCN);
  registerLocale("ms-MY", msLocale);
  registerLocale("en", enUS);
  registered = true;
}
