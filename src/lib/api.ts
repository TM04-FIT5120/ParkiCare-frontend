import axios from "axios";

const api = axios.create({
  // baseURL: "http://localhost:8080/api",
  baseURL: "https://futurestack.webhop.me/api",
  headers: { "Content-Type": "application/json" },
});

const LANG_STORAGE_KEY = "parkicare_lang";
const SUPPORTED_API_LANGS = new Set(["en", "zh-CN", "ms-MY"]);

function readInitialApiLanguage(): string {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored && SUPPORTED_API_LANGS.has(stored)) return stored;
  } catch {
    // private mode / SSR
  }
  return "en";
}

/** Synced with LanguageContext; initialized from localStorage before first request. */
let _currentLanguage = readInitialApiLanguage();

export function setApiLanguage(lang: string) {
  _currentLanguage = lang;
}

api.interceptors.request.use((config) => {
  config.headers["Accept-Language"] = _currentLanguage;
  // For FormData (file uploads), let the browser set Content-Type with the
  // correct multipart boundary — the instance default of application/json
  // would otherwise override it and break multipart parsing on the server.
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error.response?.data;
    const message =
      (typeof data === "string" ? data : data?.error ?? data?.message) ||
      error.message ||
      "An unexpected error occurred";
    return Promise.reject(new Error(String(message)));
  },
);

export interface PendingReminder {
  remindId: number;
  patientId: number;
  drugId: number;
  dosage: string;
  mealTiming: string | null;
  quantity: number | null;
  remindStatus: number;
}

/** Fetch all pending/snoozed reminders for a caregiver across all their patients. */
export async function fetchPendingRemindersForCaregiver(caregiverId: number): Promise<PendingReminder[]> {
  const res = await api.get<PendingReminder[]>(`/reminder/pending/caregiver/${caregiverId}`);
  return res.data;
}

export default api;
