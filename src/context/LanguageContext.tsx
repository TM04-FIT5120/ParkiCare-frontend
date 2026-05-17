import { createContext, useContext, useEffect, useState } from "react";
import i18n from "@/i18n/index";
import { setApiLanguage } from "@/lib/api";
import { caregiverService } from "@/services/caregiver";
import { useAuth } from "@/context/AuthContext";

const SUPPORTED = ["en", "zh-CN", "ms-MY"] as const;
type SupportedLang = (typeof SUPPORTED)[number];
const STORAGE_KEY = "parkicare_lang";

function isSupported(lang: string): lang is SupportedLang {
  return SUPPORTED.includes(lang as SupportedLang);
}

/** Prefer explicit UI choice in localStorage over possibly stale user.language from login. */
function resolveInitialLang(userLang?: string): SupportedLang {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && isSupported(stored)) return stored;
  if (userLang && isSupported(userLang)) return userLang;
  return "en";
}

interface LanguageContextValue {
  currentLang: SupportedLang;
  setLanguage: (lang: string) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { user, updateUserLanguage } = useAuth();
  const [currentLang, setCurrentLang] = useState<SupportedLang>(() => {
    const lang = resolveInitialLang(user?.language);
    setApiLanguage(lang);
    return lang;
  });

  // Re-sync when user changes (login/logout restores DB-persisted language)
  useEffect(() => {
    if (user?.language && isSupported(user.language)) {
      setCurrentLang(user.language);
    }
  }, [user?.language]);

  // Drive i18next + axios header + localStorage on every lang change
  useEffect(() => {
    i18n.changeLanguage(currentLang);
    setApiLanguage(currentLang);
    localStorage.setItem(STORAGE_KEY, currentLang);
  }, [currentLang]);

  const setLanguage = async (lang: string) => {
    if (!isSupported(lang) || lang === currentLang) return;
    setCurrentLang(lang);
    updateUserLanguage(lang);
    if (user?.caregiverId) {
      try {
        await caregiverService.updateLanguage(user.caregiverId, lang);
      } catch {
        // Non-fatal — UI already switched; sync will happen on next login
      }
    }
  };

  return (
    <LanguageContext.Provider value={{ currentLang, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
