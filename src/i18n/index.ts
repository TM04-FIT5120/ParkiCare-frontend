import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import zh from "./locales/zh.json";
import ms from "./locales/ms.json";

i18n.use(initReactI18next).init({
  resources: {
    en:      { translation: en },
    "zh-CN": { translation: zh },
    "ms-MY": { translation: ms },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
