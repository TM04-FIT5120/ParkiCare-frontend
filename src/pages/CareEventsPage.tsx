import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { formatWeekday, formatDate, getIntlLocale } from "@/lib/dateLocale";
import { motion, AnimatePresence } from "motion/react";
import { Pill, Clock, Plus, Info, Check, Search, AlertCircle, Trash2, CalendarHeart, Upload, MapPin, Calendar, X, Loader2, Camera, Pencil, Heart, ChevronDown, ChevronUp, Cloud, Wind, Sun, Sparkles, TriangleAlert, Coffee, Utensils, Moon } from "lucide-react";
import { toast } from "sonner";
import { useCareEvents } from "@/hooks/useCareEvents";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { drugsService, type DrugBase } from "@/services/drugs";
import { careEventsService } from "@/services/careEvents";
import { caregiverScheduleService } from "@/services/caregiverSchedule";
import { scanMedicineLabel } from "@/services/ocr";
// import { HistorySection } from "@/components/HistorySection";
// import type { CareEvent } from "@/context/careEventsContext";
import { getMYTDateString, isEventOnDay } from "@/lib/eventRecurrence";
import { translateEnum } from "@/lib/translateEnum";
import { translateMealTitle, isMealTitle } from "@/lib/translateMealTitle";
import { getMealSchedules, updateMealTime, type MealScheduleEntry } from "@/services/mealSchedule";
import { activityService, type WeatherData, type ActivitySuggestion } from "@/services/activityRecommendations";
import { ObservationNoteModal } from "@/components/ObservationNoteModal";
import { ListSkeleton, SectionSpinner } from "@/components/LoadingState";
import type { MedicationAlert } from "@/context/MedicationAlertContext";

const CARE_EVENT_TYPES = ["Bathing", "Nursing Care", "Toileting Assist", "Meals", "Exercise", "Physical Therapy"];
const OUTDOOR_EVENT_TYPES = ["Doctor Appointment", "Walk in Park", "Social Visit", "Shopping", "Recreation", "Family Outing"];
const FREQUENCIES = ["1 time/day", "2 times/day", "3 times/day"];
const HOURS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

const DEFAULT_MEAL_TIMES: MealScheduleEntry[] = [
  { caregiverId: 0, mealType: "BREAKFAST", mealTime: "08:00" },
  { caregiverId: 0, mealType: "LUNCH",     mealTime: "13:00" },
  { caregiverId: 0, mealType: "DINNER",    mealTime: "19:00" },
];

// MEAL_LABELS defined inside CareEventsPage component (needs useTranslation)

/** Matches backend MealDoseTimeCalculator / caregiver meal event duration. */
const MEAL_DURATION_MINUTES = 60;

const MEAL_OFFSET: Record<string, number> = {
  "before meals": -60,
  "after meals":  60,
  "with meals":   0,
};

function getDayName(dateStr: string): string {
  if (!dateStr) return i18n.t("enums.recurrence.selectedDay");
  const d = new Date(dateStr + "T00:00:00");
  return formatWeekday(d, "long");
}

function translateFrequency(freq: string): string {
  const map: Record<string, string> = {
    "1 time/day": i18n.t("enums.frequency.once"),
    "2 times/day": i18n.t("enums.frequency.twice"),
    "3 times/day": i18n.t("enums.frequency.thrice"),
  };
  return map[freq] ?? freq;
}

function formatPeriodLabel(period: "AM" | "PM"): string {
  return period === "AM" ? i18n.t("careEvents.wizard.am") : i18n.t("careEvents.wizard.pm");
}

function translateRecurrence(value: string | null | undefined, startDate?: string): string {
  if (!value || value === "none") return "—";
  if (value === "daily") return i18n.t("enums.recurrence.daily");
  if (value === "weekdays") return i18n.t("enums.recurrence.weekdays");
  if (value === "weekly") return i18n.t("enums.recurrence.weekly", { day: getDayName(startDate ?? "") });
  return value;
}

function to24h(hour: string, minute: string, period: string): string {
  let h = parseInt(hour, 10);
  if (period === "AM" && h === 12) h = 0;
  if (period === "PM" && h !== 12) h += 12;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

function formatDisplayTime(hour: string, minute: string, period: string): string {
  const p = period === "PM" ? "PM" : "AM";
  return `${hour}:${minute} ${formatPeriodLabel(p as "AM" | "PM")}`;
}

function minutesToHHmm(totalMinutes: number): string {
  const norm = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function hhmmTo12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  let h = parseInt(hStr, 10);
  const period = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${String(h).padStart(2, "0")}:${mStr} ${formatPeriodLabel(period)}`;
}

function datesOverlap(
  start1: string, end1: string | null,
  start2: string, end2: string | null,
): boolean {
  const FAR = "9999-12-31";
  return start1 <= (end2 ?? FAR) && start2 <= (end1 ?? FAR);
}

function calculateDoseTimes(
  selectedMeals: string[],
  mealSchedules: MealScheduleEntry[],
  mealTiming: string,
  intervalMinutes: number
): { times: string[]; orderedMeals: string[] } {
  const offset = MEAL_OFFSET[mealTiming] ?? 0;
  const anchorFromMealEnd = mealTiming === "after meals";

  const pairs = selectedMeals.map(meal => {
    const entry =
      mealSchedules.find(e => e.mealType === meal) ??
      DEFAULT_MEAL_TIMES.find(e => e.mealType === meal)!;
    const [h, m] = entry.mealTime.split(":").map(Number);
    const mealStartMinutes = h * 60 + m;
    const anchorMinutes = anchorFromMealEnd
      ? mealStartMinutes + MEAL_DURATION_MINUTES
      : mealStartMinutes;
    return { meal, totalMinutes: ((anchorMinutes + offset + 1440) % 1440) };
  });

  pairs.sort((a, b) => a.totalMinutes - b.totalMinutes);

  for (let i = 1; i < pairs.length; i++) {
    const minAllowed = pairs[i - 1].totalMinutes + intervalMinutes;
    if (pairs[i].totalMinutes < minAllowed % 1440) {
      pairs[i] = { ...pairs[i], totalMinutes: minAllowed % 1440 };
    }
  }

  return {
    times: pairs.map(p => minutesToHHmm(p.totalMinutes)),
    orderedMeals: pairs.map(p => p.meal),
  };
}

/** Resolve catalog drug for API save (requires drugId). Exact name match only. */
async function resolveDrugForSave(
  medName: string,
  selectedDrug: DrugBase | null,
  cachedResults: DrugBase[],
): Promise<DrugBase | null> {
  if (selectedDrug) return selectedDrug;
  const normalized = medName.trim().toLowerCase();
  if (!normalized) return null;

  const fromCache = cachedResults.find(
    (d) => d.drugName.trim().toLowerCase() === normalized,
  );
  if (fromCache) return fromCache;

  try {
    const results = await drugsService.searchDrugs(medName.trim());
    return results.find((d) => d.drugName.trim().toLowerCase() === normalized) ?? null;
  } catch {
    return null;
  }
}

/** Score similarity between two drug name strings.
 *  Exact word match = 2pts, substring match (≥4 chars) = 1pt. */
function scoreWordOverlap(a: string, b: string): number {
  const tokenize = (s: string) => s.toLowerCase().split(/[\s\-\/,.()+]+/).filter(w => w.length > 1);
  const wordsA = tokenize(a);
  const wordsB = tokenize(b);
  let score = 0;
  for (const wa of wordsA) {
    for (const wb of wordsB) {
      if (wa === wb) { score += 2; break; }
      if (wa.length >= 4 && wb.length >= 4 && (wb.includes(wa) || wa.includes(wb))) { score += 1; break; }
    }
  }
  return score;
}

/** Search the drug catalog and return candidates ranked by word-overlap with medName.
 *  Searches with the full name AND each significant token so partial OCR names still find matches. */
async function findDrugCandidates(medName: string, cachedResults: DrugBase[]): Promise<DrugBase[]> {
  const seen = new Set<number>();
  const pool: DrugBase[] = [];
  const add = (drugs: DrugBase[]) => {
    for (const d of drugs) if (!seen.has(d.drugId)) { pool.push(d); seen.add(d.drugId); }
  };

  add(cachedResults);
  try { add(await drugsService.searchDrugs(medName.trim())); } catch { /* ignore */ }

  // Also search individual tokens — handles cases where the full OCR string returns nothing
  const tokens = medName.trim().split(/[\s\-\/,.()+]+/).filter(w => w.length >= 4);
  for (const token of tokens) {
    try { add(await drugsService.searchDrugs(token)); } catch { /* ignore */ }
  }

  return pool
    .map(d => ({ drug: d, score: scoreWordOverlap(medName, d.drugName) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ drug }) => drug);
}

type EnvTone = "danger" | "warn" | "info" | "good";
const ENV_NOTE_STYLE: Record<EnvTone, { bg: string; text: string; icon: string; msgKey: string }> = {
  danger: { bg: "bg-rose-50/80 border-rose-200",       text: "text-rose-900",     icon: "text-red-600",      msgKey: "careEvents.environment.noteDanger" },
  warn:   { bg: "bg-sky-50/80 border-sky-200",         text: "text-sky-900",      icon: "text-sky-600",      msgKey: "careEvents.environment.noteWarn" },
  info:   { bg: "bg-indigo-50/70 border-indigo-200",   text: "text-indigo-900",   icon: "text-indigo-600",   msgKey: "careEvents.environment.noteInfo" },
  good:   { bg: "bg-emerald-50/70 border-emerald-200", text: "text-emerald-900",  icon: "text-emerald-600",  msgKey: "careEvents.environment.noteGood" },
};

const CARE_EVENT_TYPE_KEYS: Record<string, string> = {
  "Bathing": "careEvents.bathing",
  "Nursing Care": "careEvents.nursingCare",
  "Toileting Assist": "careEvents.toiletingAssist",
  "Meals": "careEvents.meals",
  "Exercise": "careEvents.exercise",
  "Physical Therapy": "careEvents.physicalTherapy",
};
const OUTDOOR_EVENT_TYPE_KEYS: Record<string, string> = {
  "Doctor Appointment": "careEvents.doctorAppointment",
  "Walk in Park": "careEvents.walkInPark",
  "Social Visit": "careEvents.socialVisit",
  "Shopping": "careEvents.shopping",
  "Recreation": "careEvents.recreation",
  "Family Outing": "careEvents.familyOuting",
};
function getEnvTone(temp: number, weather: string, aqi: number | null): EnvTone {
  if (aqi !== null && aqi > 150) return "danger";
  if ((aqi !== null && aqi > 100) || temp >= 33) return "warn";
  if (/rain|storm|drizzle/i.test(weather)) return "info";
  return "good";
}

const TAG_STYLES: Record<string, string> = {
  outdoor:      "bg-emerald-50 text-emerald-700 border border-emerald-200",
  indoor:       "bg-violet-50 text-violet-700 border border-violet-200",
  aqi:          "bg-sky-50 text-sky-700 border border-sky-200",
  calming:      "bg-pink-50 text-pink-700 border border-pink-200",
  "low-impact": "bg-blue-50 text-blue-700 border border-blue-200",
};
function getSuggestionTags(
  s: { type: string; period: string },
  t: (key: string) => string,
  aqi?: number,
): Array<[string, string]> {
  const tags: Array<[string, string]> = [];
  if (s.type === "outdoor") {
    tags.push([t("careEvents.aiSuggestions.tagOutdoor"), TAG_STYLES.outdoor]);
    if (aqi !== undefined && aqi > 100) tags.push([t("careEvents.aiSuggestions.tagAqiAware"), TAG_STYLES.aqi]);
  } else {
    tags.push([t("careEvents.aiSuggestions.tagIndoor"), TAG_STYLES.indoor]);
  }
  if (s.period === "on") tags.push([t("careEvents.aiSuggestions.tagOnPeriod"), TAG_STYLES.calming]);
  else tags.push([t("careEvents.aiSuggestions.tagLowImpact"), TAG_STYLES["low-impact"]]);
  return tags;
}

// --- Meal planner types & helpers --------------------------------------------

type MealRow = {
  mealType: string;
  mealTime: string;
  editHour: string;
  editMinute: string;
  editPeriod: "AM" | "PM";
  editing: boolean;
  saving: boolean;
};

const MEAL_ICON_CONFIG = {
  BREAKFAST: { icon: Coffee,   color: "#F59E0B", bg: "#FEF3C7" },
  LUNCH:     { icon: Utensils, color: "#FB7185", bg: "#FFE4E6" },
  DINNER:    { icon: Moon,     color: "#6366F1", bg: "#E0E7FF" },
};

function parseToEditFields(mealTime: string): { editHour: string; editMinute: string; editPeriod: "AM" | "PM" } {
  const [hStr, mStr] = mealTime.split(":");
  let h = parseInt(hStr, 10);
  const period: "AM" | "PM" = h < 12 ? "AM" : "PM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return { editHour: String(h).padStart(2, "0"), editMinute: mStr, editPeriod: period };
}

function formatMealDisplayTime(mealTime: string): string {
  const [hStr, mStr] = mealTime.split(":");
  let h = parseInt(hStr, 10);
  const period = h < 12 ? "AM" : "PM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${mStr} ${formatPeriodLabel(period)}`;
}

/** Normalise AI / API clock strings like "9:15" to "09:15" for editors. */
function normalizeHmTime(hm: string): string {
  const match = hm.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return hm;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

export function CareEventsPage() {
  const { t } = useTranslation();
  const { currentLang } = useLanguage();
  const {
    meds,
    deleteMed,
    events,
    addEvent,
    deleteEvent,
    patientId,
    refresh,
    loading: careEventsLoading,
  } = useCareEvents();
  const { user } = useAuth();
  const caregiverId = user?.caregiverId ?? 0;

  const mealLabel = (meal: string) => translateEnum("mealType", meal);
  const translateEventType = (type: string, map: Record<string, string>) => {
    const key = map[type];
    return key ? t(key) : type;
  };

  // Ref for the combined event form
  const eventFormRef = useRef<HTMLDivElement>(null);
  const careTypeInputRef = useRef<HTMLInputElement>(null);
  const outdoorTypeInputRef = useRef<HTMLInputElement>(null);

  // Scroll to section when navigated with a URL hash; also pre-select event tab
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    if (hash === "#outdoor-event-section") {
      setActiveEventTab("outdoor");
      setEventListFilter("outdoor");
    } else if (hash === "#care-event-section") {
      setActiveEventTab("care");
      setEventListFilter("care");
    } else if (hash === "#caregiver-event-section") {
      setActiveEventTab("caregiver");
      setEventListFilter("caregiver");
    }
    const isEventSection = ["#care-event-section", "#outdoor-event-section", "#caregiver-event-section", "#events-section"].includes(hash);
    const scrollId = isEventSection ? "events-section" : hash.slice(1);
    const el = document.getElementById(scrollId) ?? document.getElementById(hash.slice(1));
    if (el) setTimeout(() => {
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: "smooth" });
    }, 300);
  }, []);

  // --- Medication state ---
  const [medName, setMedName] = useState("");
  const [selectedDrug, setSelectedDrug] = useState<DrugBase | null>(null);
  const [manufacturerName, setManufacturerName] = useState("");
  const [manufacturerSuggestions, setManufacturerSuggestions] = useState<string[]>([]);
  const [showManufacturerDropdown, setShowManufacturerDropdown] = useState(false);
  const [dose, setDose] = useState("");
  const [dosagePart, setDosagePart] = useState<"oral" | "other">("oral");
  const [quantity, setQuantity] = useState<number | "">(1);
  const [intakeMethod, setIntakeMethod] = useState("");
  // Schedule
  const [startDate, setStartDate] = useState(() => getMYTDateString());
  const [isNeverEnding, setIsNeverEnding] = useState(true);
  const [endDate, setEndDate] = useState("");
  const [recurrence, setRecurrence] = useState<"daily" | "weekdays" | "weekly" | "none">("none");
  // Frequency & meal timing
  const [frequency, setFrequency] = useState("2 times/day");
  const [mealTiming, setMealTiming] = useState<"before meals" | "after meals" | "with meals">("after meals");
  // Auto-scheduling state
  const [selectedMeals, setSelectedMeals] = useState<string[]>([]);
  const [mealSchedules, setMealSchedules] = useState<MealScheduleEntry[]>([]);
  const [usingDefaultMealTimes, setUsingDefaultMealTimes] = useState(false);
  const [mealEditRows, setMealEditRows] = useState<MealRow[]>(() =>
    DEFAULT_MEAL_TIMES.map(m => ({ mealType: m.mealType, mealTime: m.mealTime, ...parseToEditFields(m.mealTime), editing: false, saving: false }))
  );
  const [drugIntervalMinutes, setDrugIntervalMinutes] = useState(0);
  const [calculatedTimes, setCalculatedTimes] = useState<string[]>([]);
  const [orderedMealsForTimes, setOrderedMealsForTimes] = useState<string[]>([]);
  // Image upload (client-side only)
  const [medicationImage, setMedicationImage] = useState<File | null>(null);
  const [medicationImagePreview, setMedicationImagePreview] = useState<string | null>(null);
  // OCR result floating panel
  const [ocrResult, setOcrResult] = useState<{ name: string; dose: string; quantity: number; manufacturer: string; error?: boolean } | null>(null);
  const [inputMode, setInputMode] = useState<"choice" | "ocr" | "manual">("choice");
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [dosageMismatchAcked, setDosageMismatchAcked] = useState(false);
  // Dropdowns
  const [showMedsDropdown, setShowMedsDropdown] = useState(false);
  const [drugSearchResults, setDrugSearchResults] = useState<DrugBase[]>([]);
  const [showFreqDropdown, setShowFreqDropdown] = useState(false);
  const [medicationStep, setMedicationStep] = useState(1);
  const [formInteractive, setFormInteractive] = useState(false);
  const [showPreMedWarning, setShowPreMedWarning] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [expandMealEdit, setExpandMealEdit] = useState(false);
  const drugSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manufacturerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manufacturerJustSelected = useRef(false);
  const testDrugSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Care Event state ---
  const [careEventType, setCareEventType] = useState("Bathing");
  const [showCareTypeDropdown, setShowCareTypeDropdown] = useState(false);
  const [careEventTimeHour, setCareEventTimeHour] = useState("08");
  const [careEventTimeMinute, setCareEventTimeMinute] = useState("00");
  const [careEventTimePeriod, setCareEventTimePeriod] = useState("AM");
  const [careEventEndTimeHour, setCareEventEndTimeHour] = useState("09");
  const [careEventEndTimeMinute, setCareEventEndTimeMinute] = useState("00");
  const [careEventEndTimePeriod, setCareEventEndTimePeriod] = useState("AM");
  const [careEventStartDate, setCareEventStartDate] = useState(() => getMYTDateString());
  const [careEventIsNeverEnding, setCareEventIsNeverEnding] = useState(true);
  const [careEventEndDate, setCareEventEndDate] = useState("");
  const [careEventRecurrence, setCareEventRecurrence] = useState<"daily" | "weekdays" | "weekly" | "none">("none");

  // --- Outdoor Event state ---
  const [outdoorEventType, setOutdoorEventType] = useState("Doctor Appointment");
  const [showOutdoorTypeDropdown, setShowOutdoorTypeDropdown] = useState(false);
  const [outdoorEventTimeHour, setOutdoorEventTimeHour] = useState("08");
  const [outdoorEventTimeMinute, setOutdoorEventTimeMinute] = useState("00");
  const [outdoorEventTimePeriod, setOutdoorEventTimePeriod] = useState("AM");
  const [outdoorEventEndTimeHour, setOutdoorEventEndTimeHour] = useState("09");
  const [outdoorEventEndTimeMinute, setOutdoorEventEndTimeMinute] = useState("00");
  const [outdoorEventEndTimePeriod, setOutdoorEventEndTimePeriod] = useState("AM");
  const [outdoorEventStartDate, setOutdoorEventStartDate] = useState(() => getMYTDateString());
  const [outdoorEventIsNeverEnding, setOutdoorEventIsNeverEnding] = useState(true);
  const [outdoorEventEndDate, setOutdoorEventEndDate] = useState("");
  const [outdoorEventRecurrence, setOutdoorEventRecurrence] = useState<"daily" | "weekdays" | "weekly" | "none">("none");

  // --- Caregiver Event state ---
  const [caregiverEventTitle, setCaregiverEventTitle] = useState("");
  const [caregiverEventStartDate, setCaregiverEventStartDate] = useState(() => getMYTDateString());
  const [caregiverEventIsNeverEnding, setCaregiverEventIsNeverEnding] = useState(true);
  const [caregiverEventEndDate, setCaregiverEventEndDate] = useState("");
  const [caregiverEventRecurrence, setCaregiverEventRecurrence] = useState<"daily" | "weekdays" | "weekly" | "none">("none");
  const [caregiverEventTimeHour, setCaregiverEventTimeHour] = useState("08");
  const [caregiverEventTimeMinute, setCaregiverEventTimeMinute] = useState("00");
  const [caregiverEventTimePeriod, setCaregiverEventTimePeriod] = useState("AM");
  const [caregiverEventEndTimeHour, setCaregiverEventEndTimeHour] = useState("09");
  const [caregiverEventEndTimeMinute, setCaregiverEventEndTimeMinute] = useState("00");
  const [caregiverEventEndTimePeriod, setCaregiverEventEndTimePeriod] = useState("AM");

  // --- Caregiver agenda ---
  const [agenda, setAgenda] = useState<{ id: number; title: string; time: string; startDatetime: string; endDatetime: string; recurrence: string | null }[]>([]);
  const [isAgendaLoading, setIsAgendaLoading] = useState(true);

  // --- Combined event UI state ---
  const [activeEventTab, setActiveEventTab] = useState<"caregiver" | "care" | "outdoor">("caregiver");
  const [eventListFilter, setEventListFilter] = useState<"all" | "caregiver" | "care" | "outdoor">("all");
  const [hideMealEvents, setHideMealEvents] = useState(false);
  const [medSearch, setMedSearch] = useState("");
  const [expandedMedId, setExpandedMedId] = useState<number | null>(null);

  // Loading states for API-wired buttons
  const [isSavingMed, setIsSavingMed] = useState(false);
  const [isSavingCaregiver, setIsSavingCaregiver] = useState(false);
  const [isSavingCare, setIsSavingCare] = useState(false);
  const [isSavingOutdoor, setIsSavingOutdoor] = useState(false);
  const [deletingMedIds, setDeletingMedIds] = useState<Set<number>>(new Set());
  const [deletingCaregiverIds, setDeletingCaregiverIds] = useState<Set<number>>(new Set());
  const [deletingCareIds, setDeletingCareIds] = useState<Set<number>>(new Set());
  const [deletingOutdoorIds, setDeletingOutdoorIds] = useState<Set<number>>(new Set());

  // --- Test Mode state ---
  const [isTestMode, setIsTestMode] = useState(false);
  const [testMedName, setTestMedName] = useState("");
  const [testSelectedDrug, setTestSelectedDrug] = useState<DrugBase | null>(null);
  const [testDrugSearchResults, setTestDrugSearchResults] = useState<DrugBase[]>([]);
  const [testShowMedsDropdown, setTestShowMedsDropdown] = useState(false);
  const [testFrequency, setTestFrequency] = useState("1 time/day");
  const [testMedTimes, setTestMedTimes] = useState<{ hour: string; minute: string; period: string }[]>([
    { hour: "08", minute: "00", period: "AM" },
  ]);
  const [isSavingTestMed, setIsSavingTestMed] = useState(false);

  // --- Test Observation Note state ---
  const [showTestObsSelector, setShowTestObsSelector] = useState(false);
  const [testObsAlert, setTestObsAlert] = useState<MedicationAlert | null>(null);

  // --- Weather & Location state ---
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // --- AI Suggestions state ---
  const [aiSuggestions, setAiSuggestions] = useState<ActivitySuggestion[] | null>(null);
  const [aiSuggestionsLoading, setAiSuggestionsLoading] = useState(false);
  const [aiSuggestionsError, setAiSuggestionsError] = useState<string | null>(null);
  const [feedbackInProgress, setFeedbackInProgress] = useState<Set<string>>(new Set());
  const [aiSuggestionConflicts, setAiSuggestionConflicts] = useState<
    Map<string, { title: string; startTime: string; endTime: string; date: string } | null>
  >(new Map());
  const [editingAiSuggestionIndex, setEditingAiSuggestionIndex] = useState<number | null>(null);
  const [aiSuggestionEditDraft, setAiSuggestionEditDraft] = useState<{
    editHour: string;
    editMinute: string;
    editPeriod: "AM" | "PM";
  } | null>(null);

  // --- Duplicate medication guard ---
  const [showDuplicateMedModal, setShowDuplicateMedModal] = useState(false);
  const [duplicateMedType, setDuplicateMedType] = useState<"name-only" | "name-and-dose" | null>(null);
  const [pendingDuplicateSave, setPendingDuplicateSave] = useState<(() => Promise<void>) | null>(null);

  // --- Medication overlap warning ---
  const [showOverlapModal, setShowOverlapModal] = useState(false);
  const [pendingOverlapAction, setPendingOverlapAction] = useState<(() => Promise<void>) | null>(null);

  // --- Schedule clash warning ---
  const [showScheduleClashModal, setShowScheduleClashModal] = useState(false);
  const [pendingScheduleClashAction, setPendingScheduleClashAction] = useState<(() => Promise<void>) | null>(null);
  const [scheduleClashInfo, setScheduleClashInfo] = useState<{
    title: string;
    startTime: string;
    endTime: string;
    date: string;
  } | null>(null);

  // Computes HH:mm end time given a start time (HH:mm) and duration in minutes
  function suggestionEndTime(startTime: string, durationMinutes: number): string {
    const [h, m] = startTime.split(":").map(Number);
    const totalMin = h * 60 + m + durationMinutes;
    return `${String(Math.floor(totalMin / 60) % 24).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
  }

  // Returns true if eventStartTime (HH:mm) is within 60 min of any scheduled med time
  function hasMedicationOverlap(eventStartTime: string): boolean {
    const [h, m] = eventStartTime.split(":").map(Number);
    const startMin = h * 60 + m;
    return meds.some(med => {
      const parts = (med.time ?? "00:00:00").split(":");
      const medMin = parseInt(parts[0]) * 60 + parseInt(parts[1]);
      const diff = Math.abs(startMin - medMin);
      return diff < 60 || diff > 1380;
    });
  }

  // Separate events into care and outdoor
  const careEvents = events.filter(ev => CARE_EVENT_TYPES.includes(ev.type) || ev.eventType === "home");
  const outdoorEvents = events.filter(ev => OUTDOOR_EVENT_TYPES.includes(ev.type) || ev.eventType === "outdoor");

  // Returns first schedule-on-schedule clash for a new event, or null if clear.
  // Checks agenda (caregiver schedule) + HomeCare + Outdoor events over up to 60 days.
  function findScheduleConflict(
    newStartDate: string,      // YYYY-MM-DD
    newStartTime: string,      // HH:mm
    newEndTime: string,        // HH:mm
    newRecurrence: string,     // "none"|"daily"|"weekdays"|"weekly"
    newEndDate: string | null, // series end YYYY-MM-DD, or null for never-ending
  ): { title: string; startTime: string; endTime: string; date: string } | null {
    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const sliceDate = (dt: string) => dt.slice(0, 10);
    const sliceTime = (dt: string) => dt.slice(11, 16); // HH:mm

    type Ev = { title: string; startDate: string; seriesEnd: string | undefined; recurrence: string | null; startTime: string; endTime: string };

    const allExisting: Ev[] = [
      ...agenda.map(a => {
        const sd = sliceDate(a.startDatetime);
        const ed = a.endDatetime ? sliceDate(a.endDatetime) : undefined;
        return { title: a.title, startDate: sd, seriesEnd: ed && ed > sd ? ed : undefined, recurrence: a.recurrence, startTime: sliceTime(a.startDatetime), endTime: a.endDatetime ? sliceTime(a.endDatetime) : sliceTime(a.startDatetime) };
      }),
      ...careEvents.map(e => {
        const sd = sliceDate(e.startDatetime ?? "");
        const ed = e.endDatetime ? sliceDate(e.endDatetime) : undefined;
        return { title: e.title ?? "", startDate: sd, seriesEnd: ed && ed > sd ? ed : undefined, recurrence: e.recurrence ?? null, startTime: sliceTime(e.startDatetime ?? ""), endTime: e.endDatetime ? sliceTime(e.endDatetime) : sliceTime(e.startDatetime ?? "") };
      }),
      ...outdoorEvents.map(e => {
        const sd = sliceDate(e.startDatetime ?? "");
        const ed = e.endDatetime ? sliceDate(e.endDatetime) : undefined;
        return { title: e.title ?? "", startDate: sd, seriesEnd: ed && ed > sd ? ed : undefined, recurrence: e.recurrence ?? null, startTime: sliceTime(e.startDatetime ?? ""), endTime: e.endDatetime ? sliceTime(e.endDatetime) : sliceTime(e.startDatetime ?? "") };
      }),
    ].filter(e => e.startDate && e.startTime);

    const newStartMin = toMin(newStartTime);
    const newEndMin   = toMin(newEndTime);

    // Cap window at 60 days from newStartDate
    const maxDate = new Date(newStartDate + "T00:00:00");
    maxDate.setDate(maxDate.getDate() + 60);
    const maxDateStr = `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, "0")}-${String(maxDate.getDate()).padStart(2, "0")}`;
    const windowEnd = newEndDate && newEndDate < maxDateStr ? newEndDate : maxDateStr;

    const cursor = new Date(newStartDate + "T00:00:00");
    while (true) {
      const dayStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      if (dayStr > windowEnd) break;

      if (isEventOnDay(dayStr, newStartDate, newEndDate, newRecurrence)) {
        for (const ev of allExisting) {
          if (!isEventOnDay(dayStr, ev.startDate, ev.seriesEnd, ev.recurrence)) continue;
          const evStartMin = toMin(ev.startTime);
          const evEndMin   = toMin(ev.endTime);
          // True overlap: newStart < existEnd AND existStart < newEnd
          if (newStartMin < evEndMin && evStartMin < newEndMin) {
            return { title: ev.title, startTime: ev.startTime, endTime: ev.endTime, date: dayStr };
          }
        }
      }

      cursor.setDate(cursor.getDate() + 1);
    }
    return null;
  }

  // Debounced drug name search
  useEffect(() => {
    if (drugSearchTimer.current) clearTimeout(drugSearchTimer.current);
    if (!medName.trim() || selectedDrug !== null) {
      setDrugSearchResults([]);
      setShowMedsDropdown(false);
      return;
    }
    drugSearchTimer.current = setTimeout(async () => {
      try {
        const results = await drugsService.searchDrugs(medName);
        setDrugSearchResults(results);
        setShowMedsDropdown(results.length > 0);
      } catch {
        setDrugSearchResults([]);
      }
    }, 350);
    return () => { if (drugSearchTimer.current) clearTimeout(drugSearchTimer.current); };
  }, [medName, selectedDrug]);

  // Debounced manufacturer name search
  useEffect(() => {
    if (manufacturerSearchTimer.current) clearTimeout(manufacturerSearchTimer.current);
    if (!manufacturerName.trim()) {
      setManufacturerSuggestions([]);
      return;
    }
    if (manufacturerJustSelected.current) {
      manufacturerJustSelected.current = false;
      setManufacturerSuggestions([]);
      return;
    }
    manufacturerSearchTimer.current = setTimeout(async () => {
      try {
        const results = await drugsService.searchManufacturers(manufacturerName);
        setManufacturerSuggestions(results);
        setShowManufacturerDropdown(results.length > 0);
      } catch {
        setManufacturerSuggestions([]);
      }
    }, 350);
    return () => { if (manufacturerSearchTimer.current) clearTimeout(manufacturerSearchTimer.current); };
  }, [manufacturerName]);

  // Revoke image preview URL on unmount
  useEffect(() => {
    return () => {
      if (medicationImagePreview) URL.revokeObjectURL(medicationImagePreview);
    };
  }, [medicationImagePreview]);

  // Debounced drug name search - Test Mode
  useEffect(() => {
    if (testDrugSearchTimer.current) clearTimeout(testDrugSearchTimer.current);
    if (!testMedName.trim() || testSelectedDrug !== null) {
      setTestDrugSearchResults([]);
      setTestShowMedsDropdown(false);
      return;
    }
    testDrugSearchTimer.current = setTimeout(async () => {
      try {
        const results = await drugsService.searchDrugs(testMedName);
        setTestDrugSearchResults(results);
        setTestShowMedsDropdown(results.length > 0);
      } catch {
        setTestDrugSearchResults([]);
      }
    }, 350);
    return () => { if (testDrugSearchTimer.current) clearTimeout(testDrugSearchTimer.current); };
  }, [testMedName, testSelectedDrug]);

  // Fetch meal schedules for auto-scheduling and meal planner UI
  useEffect(() => {
    if (!caregiverId) return;
    getMealSchedules(caregiverId)
      .then(schedules => {
        if (schedules.length > 0) {
          setMealSchedules(schedules);
          setUsingDefaultMealTimes(false);
          setMealEditRows(prev =>
            prev.map(row => {
              const found = schedules.find(e => e.mealType === row.mealType);
              if (!found) return row;
              return { ...row, mealTime: found.mealTime, ...parseToEditFields(found.mealTime) };
            })
          );
        } else {
          setMealSchedules(DEFAULT_MEAL_TIMES);
          setUsingDefaultMealTimes(true);
        }
      })
      .catch(() => {
        setMealSchedules(DEFAULT_MEAL_TIMES);
        setUsingDefaultMealTimes(true);
      });
  }, [caregiverId]);

  // Fetch weather whenever location is set
  useEffect(() => {
    if (!userLocation) return;
    const doFetch = async () => {
      setWeatherLoading(true);
      setWeatherError(null);
      try {
        const data = await activityService.getWeather(userLocation.lat, userLocation.lon);
        setWeatherData(data);
      } catch {
        setWeatherError(t("careEvents.environment.weatherFetchFailed"));
      } finally {
        setWeatherLoading(false);
      }
    };
    doFetch();
  }, [userLocation, currentLang, t]);

  // Suggestions are translated per request; clear when language changes so the user regenerates.
  useEffect(() => {
    setAiSuggestions(null);
    setAiSuggestionsError(null);
    setEditingAiSuggestionIndex(null);
    setAiSuggestionEditDraft(null);
  }, [currentLang]);

  function startAiSuggestionEdit(index: number) {
    const suggestion = aiSuggestions?.[index];
    if (!suggestion) return;
    setEditingAiSuggestionIndex(index);
    setAiSuggestionEditDraft(parseToEditFields(normalizeHmTime(suggestion.startTime)));
  }

  function cancelAiSuggestionEdit() {
    setEditingAiSuggestionIndex(null);
    setAiSuggestionEditDraft(null);
  }

  function saveAiSuggestionEdit(index: number) {
    if (!aiSuggestionEditDraft) return;
    const newTime = to24h(
      aiSuggestionEditDraft.editHour,
      aiSuggestionEditDraft.editMinute,
      aiSuggestionEditDraft.editPeriod,
    );
    setAiSuggestions(prev =>
      prev?.map((s, i) => (i === index ? { ...s, startTime: newTime } : s)) ?? null,
    );
    setEditingAiSuggestionIndex(null);
    setAiSuggestionEditDraft(null);
  }

  function setAiSuggestionEditField(
    field: "editHour" | "editMinute" | "editPeriod",
    value: string,
  ) {
    setAiSuggestionEditDraft(prev => (prev ? { ...prev, [field]: value } : prev));
  }

  // Recalculate dose times whenever meal selection, meal timing, or interval changes
  useEffect(() => {
    if (selectedMeals.length === 0) {
      setCalculatedTimes([]);
      setOrderedMealsForTimes([]);
      return;
    }
    const effective = mealSchedules.length > 0 ? mealSchedules : DEFAULT_MEAL_TIMES;
    const { times, orderedMeals } = calculateDoseTimes(selectedMeals, effective, mealTiming, drugIntervalMinutes);
    setCalculatedTimes(times);
    setOrderedMealsForTimes(orderedMeals);
  }, [selectedMeals, mealSchedules, mealTiming, drugIntervalMinutes]);

  // -- Meal planner edit handlers -----------------------------------------------
  function startMealEdit(mealType: string) {
    setMealEditRows(prev => prev.map(r => r.mealType === mealType ? { ...r, editing: true } : r));
  }
  function cancelMealEdit(mealType: string) {
    setMealEditRows(prev => prev.map(r => r.mealType === mealType ? { ...r, editing: false, ...parseToEditFields(r.mealTime) } : r));
  }
  async function saveMealEdit(mealType: string) {
    const row = mealEditRows.find(r => r.mealType === mealType);
    if (!row) return;
    let h = parseInt(row.editHour, 10);
    if (row.editPeriod === "AM" && h === 12) h = 0;
    if (row.editPeriod === "PM" && h !== 12) h += 12;
    const newTime = `${String(h).padStart(2, "0")}:${row.editMinute}`;
    setMealEditRows(prev => prev.map(r => r.mealType === mealType ? { ...r, saving: true } : r));
    try {
      await updateMealTime(caregiverId, mealType, newTime);
      const refreshed = await getMealSchedules(caregiverId);
      setMealSchedules(refreshed);
      setMealEditRows(prev =>
        prev.map(row => {
          const found = refreshed.find(e => e.mealType === row.mealType);
          if (!found) return { ...row, editing: false, saving: false };
          return { ...row, mealTime: found.mealTime, ...parseToEditFields(found.mealTime), editing: false, saving: false };
        })
      );
      refresh();
      refreshCaregiverAgenda();
      toast.success(t("dashboard.mealTimeSaved"));
    } catch {
      toast.error(t("dashboard.mealTimeFailed"));
      setMealEditRows(prev => prev.map(r => r.mealType === mealType ? { ...r, saving: false } : r));
    }
  }
  function setMealField(mealType: string, field: "editHour" | "editMinute" | "editPeriod", value: string) {
    setMealEditRows(prev => prev.map(r => r.mealType === mealType ? { ...r, [field]: value } : r));
  }

  const handleFrequencyChange = (newFreq: string) => {
    setFrequency(newFreq);
    setSelectedMeals([]);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (medicationImagePreview) URL.revokeObjectURL(medicationImagePreview);
    setMedicationImage(file);
    setMedicationImagePreview(URL.createObjectURL(file));
    setOcrResult(null);
    setIsOcrLoading(false);
    setDosageMismatchAcked(false);
  };

  const resetMedicationForm = () => {
    setMedicationStep(1);
    setInputMode("choice");
    setMedName("");
    setSelectedDrug(null);
    setManufacturerName("");
    setManufacturerSuggestions([]);
    setDose("");
    setDosagePart("oral");
    setQuantity(1);
    setIntakeMethod("");
    setStartDate(getMYTDateString());
    setIsNeverEnding(true);
    setEndDate("");
    setRecurrence("none");
    setFrequency("2 times/day");
    setMealTiming("after meals");
    setSelectedMeals([]);
    setDrugIntervalMinutes(0);
    setCalculatedTimes([]);
    setOrderedMealsForTimes([]);
    if (medicationImagePreview) URL.revokeObjectURL(medicationImagePreview);
    setMedicationImage(null);
    setMedicationImagePreview(null);
    setOcrResult(null);
    setIsOcrLoading(false);
    setDosageMismatchAcked(false);
    setFormInteractive(false);
    setShowConfirmModal(false);
    setExpandMealEdit(false);
  };

  const resetTestMedicationForm = () => {
    setTestMedName("");
    setTestSelectedDrug(null);
    setTestDrugSearchResults([]);
    setTestShowMedsDropdown(false);
    setTestFrequency("1 time/day");
    setTestMedTimes([{ hour: "08", minute: "00", period: "AM" }]);
  };

  const handleTestFrequencyChange = (newFreq: string) => {
    setTestFrequency(newFreq);
    const count = parseInt(newFreq.match(/\d+/)?.[0] || "1");
    setTestMedTimes(prev => {
      if (count > prev.length)
        return [...prev, ...Array.from({ length: count - prev.length }, () => ({ hour: "08", minute: "00", period: "AM" }))];
      return prev.slice(0, count);
    });
  };

  const handleTestSaveMedication = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const adminTimesArr = testMedTimes.map(t => to24h(t.hour, t.minute, t.period));
    const adminTimesStr = adminTimesArr.join(",");
    const remindTime = adminTimesArr[0];
    const todayStr = getMYTDateString();
    setIsSavingTestMed(true);
    try {
      if (!patientId) {
        toast.error(t("careEvents.noPatientProfile"));
        return;
      }
      const drug = await resolveDrugForSave(testMedName, testSelectedDrug, testDrugSearchResults);
      if (!drug) {
        const candidates = await findDrugCandidates(testMedName, testDrugSearchResults);
        if (candidates.length === 0) {
          toast.error(t("careEvents.selectMedFromSearch"));
          return;
        }
        setTestDrugSearchResults(candidates);
        setTestShowMedsDropdown(true);
        toast.info(t("careEvents.drugPicker.selectFromDropdown"));
        return;
      }
      await careEventsService.createMedication(
        patientId, drug.drugId,
        drug.dosage ?? "", testFrequency,
        adminTimesStr, remindTime, todayStr,
        "", null, null, null, null, todayStr, "none",
      );
      refresh();
      toast.success(t("careEvents.testMedScheduled"));
      resetTestMedicationForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("careEvents.failedSaveMed"));
    } finally {
      setIsSavingTestMed(false);
    }
  };

  const handleToggleTestMode = () => {
    setIsTestMode(prev => {
      if (!prev) resetMedicationForm();
      else resetTestMedicationForm();
      return !prev;
    });
  };

  const medsWithRemindId = meds.filter(m => m.remindId != null);

  const handleOpenTestObsNote = (med: (typeof meds)[0]) => {
    setShowTestObsSelector(false);
    setTestObsAlert({
      remindId: String(med.remindId),
      caregiverId: String(caregiverId),
      title: t("careEvents.observationNoteTitle"),
      body: t("careEvents.testObsBody", {
        name: med.name,
        dosePart: med.dose ? t("careEvents.testObsDosePart", { dose: med.dose }) : "",
        time: med.time,
      }),
    });
  };

  const handleSaveMedication = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!medName) {
      toast.error(t("careEvents.enterMedName"));
      return;
    }
    const oralValid = dosagePart === "oral" && dose.trim() && quantity !== "";
    const otherValid = dosagePart === "other" && intakeMethod.trim();
    if (!oralValid && !otherValid) {
      toast.error(t("careEvents.completeDosage"));
      return;
    }
    if (!frequency.trim()) {
      toast.error(t("careEvents.selectFrequency"));
      return;
    }
    if (calculatedTimes.length === 0) {
      toast.error(t("careEvents.completeMealSelection"));
      return;
    }

    const adminTimesStr = calculatedTimes.join(",");
    const remindTime = calculatedTimes[0];
    const finalDosage = dosagePart === "oral" ? dose.trim() : intakeMethod.trim();
    const finalQuantity = dosagePart === "oral" && quantity !== "" ? Number(quantity) : null;
    const finalIntakeMethod = dosagePart === "other" ? intakeMethod.trim() : null;
    const finalEndDate = isNeverEnding ? startDate : (endDate || null);
    const finalRecurrence = recurrence;

    // ── Duplicate medication check ──────────────────────────────────────────────
    const newNameNorm = medName.trim().toLowerCase();
    const newDoseNorm = finalDosage.toLowerCase();
    const newEnd = isNeverEnding ? null : (endDate || null);

    const nameMatches = meds.filter((m) => {
      if (m.name.trim().toLowerCase() !== newNameNorm) return false;
      const mStart = m.startDate ?? "2000-01-01";
      const mEnd = m.endDate ?? null;
      return datesOverlap(startDate, newEnd, mStart, mEnd);
    });

    const executeActualSave = async () => {
      setIsSavingMed(true);
      try {
        if (!patientId) {
          toast.error(t("careEvents.noPatientProfile"));
          return;
        }

        const drug = await resolveDrugForSave(medName, selectedDrug, drugSearchResults);
        if (!drug) {
          const candidates = await findDrugCandidates(medName, drugSearchResults);
          if (candidates.length === 0) {
            toast.error(t("careEvents.selectMedFromSearch"));
            return;
          }
          setDrugSearchResults(candidates);
          setShowMedsDropdown(true);
          setShowConfirmModal(false);
          setMedicationStep(1);
          toast.info(t("careEvents.drugPicker.selectFromDropdown"));
          return;
        }

        await careEventsService.createMedication(
          patientId,
          drug.drugId,
          finalDosage,
          frequency,
          adminTimesStr,
          remindTime,
          startDate,
          "",
          mealTiming,
          selectedMeals.length > 0 ? selectedMeals.join(",") : null,
          finalQuantity,
          finalIntakeMethod,
          finalEndDate,
          finalRecurrence,
        );
        refresh();
        toast.success(t("careEvents.medScheduled"));
        resetMedicationForm();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("careEvents.failedSaveMed"));
      } finally {
        setIsSavingMed(false);
      }
    };

    if (nameMatches.length > 0) {
      const hasDoseMatch = nameMatches.some(
        (m) => m.dose.trim().toLowerCase() === newDoseNorm
      );
      if (hasDoseMatch) {
        setDuplicateMedType("name-and-dose");
        setShowDuplicateMedModal(true);
        return;
      }
      setDuplicateMedType("name-only");
      setPendingDuplicateSave(() => executeActualSave);
      setShowDuplicateMedModal(true);
      return;
    }

    await executeActualSave();
  };


  const handleNextStep = async () => {
    if (medicationStep === 1) {
      if (inputMode === "choice") return;

      if (inputMode === "ocr") {
        // Phase A â†’ trigger OCR, don't advance yet
        if (!ocrResult && !isOcrLoading) {
          if (!medicationImage) {
            toast.error(t("careEvents.pleaseSelectPhoto"));
            return;
          }
          setIsOcrLoading(true);
          setDosageMismatchAcked(false);
          try {
            const result = await scanMedicineLabel(medicationImage);
            setOcrResult({ name: result.drugName, dose: result.dosage, quantity: 0, manufacturer: result.manufacturer });
            if (result.drugName) setMedName(result.drugName);
            if (result.dosage) setDose(result.dosage);
            if (result.manufacturer) { manufacturerJustSelected.current = true; setManufacturerName(result.manufacturer); }
          } catch {
            setOcrResult({ name: "", dose: "", quantity: 0, manufacturer: "", error: true });
          } finally {
            setIsOcrLoading(false);
          }
          return; // stay on step 1 so user can review/edit pre-filled fields
        }
      }

      // Both manual and OCR phase B: validate fields before advancing
      if (!medName.trim()) {
        toast.error(t("careEvents.enterMedName"));
        return;
      }
      if (!dose.trim()) {
        toast.error(t("careEvents.enterDosage"));
        return;
      }
    }

    if (medicationStep === 2) {
      if (dosagePart === "oral" && quantity === "") {
        toast.error(t("careEvents.enterQuantity"));
        return;
      }
      if (dosagePart === "other" && !intakeMethod.trim()) {
        toast.error(t("careEvents.describeIntakeMethod"));
        return;
      }
    }
    if (medicationStep === 3) {
      if (!startDate) {
        toast.error(t("careEvents.selectStartDate"));
        return;
      }
      if (!isNeverEnding && endDate && endDate < startDate) {
        toast.error(t("careEvents.endDateBeforeStart"));
        return;
      }
    }
    if (medicationStep === 4) {
      if (!frequency.trim()) {
        toast.error(t("careEvents.selectFrequency"));
        return;
      }
      const requiredCount = parseInt(frequency.match(/\d+/)?.[0] || "1");
      if (selectedMeals.length !== requiredCount) {
        toast.error(`Please select exactly ${requiredCount} meal(s) to anchor your doses`);
        return;
      }
      if (calculatedTimes.length === 0) {
        toast.error(t("careEvents.couldNotCalculateDoseTimes"));
        return;
      }
      setShowConfirmModal(true);
      return;
    }
    setMedicationStep(s => s + 1);
  };

  const handlePrevStep = () => setMedicationStep(s => s - 1);
  const handleEditField = (step: number) => setMedicationStep(step);

  // --- Care Event handlers ---
  const handleSaveCareEvent = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!careEventType) {
      toast.error(t("careEvents.selectCareEventType"));
      return;
    }
    const time24 = to24h(careEventTimeHour, careEventTimeMinute, careEventTimePeriod);
    const endTime24 = to24h(careEventEndTimeHour, careEventEndTimeMinute, careEventEndTimePeriod);
    const startDatetime = `${careEventStartDate}T${time24}:00`;
    const endDateBase = (!careEventIsNeverEnding && careEventEndDate) ? careEventEndDate : careEventStartDate;
    const endDatetimeFinal = `${endDateBase}T${endTime24}:00`;
    // const displayTime = formatDisplayTime(careEventTimeHour, careEventTimeMinute, careEventTimePeriod);

    const executeSaveCareEvent = async () => {
      setIsSavingCare(true);
      try {
        if (patientId) {
          try {
            const created = await careEventsService.createHomeCare(
              patientId,
              caregiverId,
              careEventType,
              startDatetime,
              endDatetimeFinal,
              "",
              false,
              careEventRecurrence,
            );
            addEvent({
              backendId: created.id,
              eventType: "home",
              title: created.homeCareTitle,
              type: careEventType,
              time: time24,
              startDatetime: created.startDatetime,
              endDatetime: created.endDatetime,
              recurrence: created.recurrence,
            });
            toast.success(t("careEvents.careEventScheduled"));
          } catch (err) {
            toast.error(err instanceof Error ? err.message : t("careEvents.eventFailed"));
            return;
          }
        } else {
          addEvent({ title: careEventType, type: careEventType, time: time24 });
          toast.success(t("careEvents.careEventSavedLocally"));
        }

        setCareEventType("Bathing");
        setCareEventTimeHour("08");
        setCareEventTimeMinute("00");
        setCareEventTimePeriod("AM");
        setCareEventStartDate(getMYTDateString());
        setCareEventIsNeverEnding(true);
        setCareEventEndDate("");
        setCareEventRecurrence("none");
        setCareEventEndTimeHour("09");
        setCareEventEndTimeMinute("00");
        setCareEventEndTimePeriod("AM");
      } finally {
        setIsSavingCare(false);
      }
    };

    const clash = findScheduleConflict(
      careEventStartDate, time24, endTime24,
      careEventRecurrence,
      careEventIsNeverEnding ? null : (careEventEndDate || null),
    );
    if (clash) {
      setScheduleClashInfo(clash);
      setPendingScheduleClashAction(() => executeSaveCareEvent);
      setShowScheduleClashModal(true);
      return;
    }
    if (meds.length > 0 && hasMedicationOverlap(time24)) {
      setPendingOverlapAction(() => executeSaveCareEvent);
      setShowOverlapModal(true);
      return;
    }
    await executeSaveCareEvent();
  };

  const handleSaveOutdoorEvent = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!outdoorEventType) {
      toast.error(t("careEvents.selectOutdoorEventType"));
      return;
    }
    const time24 = to24h(outdoorEventTimeHour, outdoorEventTimeMinute, outdoorEventTimePeriod);
    const endTime24 = to24h(outdoorEventEndTimeHour, outdoorEventEndTimeMinute, outdoorEventEndTimePeriod);
    const startDatetime = `${outdoorEventStartDate}T${time24}:00`;
    const endDateBase = (!outdoorEventIsNeverEnding && outdoorEventEndDate) ? outdoorEventEndDate : outdoorEventStartDate;
    const endDatetimeFinal = `${endDateBase}T${endTime24}:00`;
    // const displayTime = formatDisplayTime(outdoorEventTimeHour, outdoorEventTimeMinute, outdoorEventTimePeriod);

    const executeSaveOutdoor = async () => {
      setIsSavingOutdoor(true);
      try {
        if (patientId) {
          try {
            const created = await careEventsService.createOutdoor(
              patientId,
              caregiverId,
              outdoorEventType,
              startDatetime,
              endDatetimeFinal,
              "",
              outdoorEventRecurrence,
            );
            addEvent({
              backendId: created.id,
              eventType: "outdoor",
              title: created.outdoorTitle,
              type: outdoorEventType,
              time: time24,
              startDatetime: created.startDatetime,
              endDatetime: created.endDatetime,
              recurrence: created.recurrence,
            });
            toast.success(t("careEvents.outdoorEventScheduled"));
          } catch (err) {
            toast.error(err instanceof Error ? err.message : t("careEvents.eventFailed"));
            return;
          }
        } else {
          addEvent({ title: outdoorEventType, type: outdoorEventType, time: time24 });
          toast.success(t("careEvents.outdoorEventSavedLocally"));
        }

        setOutdoorEventType("Doctor Appointment");
        setOutdoorEventTimeHour("08");
        setOutdoorEventTimeMinute("00");
        setOutdoorEventTimePeriod("AM");
        setOutdoorEventStartDate(getMYTDateString());
        setOutdoorEventIsNeverEnding(true);
        setOutdoorEventEndDate("");
        setOutdoorEventRecurrence("none");
        setOutdoorEventEndTimeHour("09");
        setOutdoorEventEndTimeMinute("00");
        setOutdoorEventEndTimePeriod("AM");
      } finally {
        setIsSavingOutdoor(false);
      }
    };

    const clash = findScheduleConflict(
      outdoorEventStartDate, time24, endTime24,
      outdoorEventRecurrence,
      outdoorEventIsNeverEnding ? null : (outdoorEventEndDate || null),
    );
    if (clash) {
      setScheduleClashInfo(clash);
      setPendingScheduleClashAction(() => executeSaveOutdoor);
      setShowScheduleClashModal(true);
      return;
    }
    if (meds.length > 0 && hasMedicationOverlap(time24)) {
      setPendingOverlapAction(() => executeSaveOutdoor);
      setShowOverlapModal(true);
      return;
    }
    await executeSaveOutdoor();
  };

  // Fetch caregiver agenda (meal entries + caregiver personal events)
  const refreshCaregiverAgenda = useCallback(() => {
    if (!caregiverId) {
      setIsAgendaLoading(false);
      return;
    }
    setIsAgendaLoading(true);
    caregiverScheduleService
      .getSchedules(caregiverId)
      .then((schedules) => {
        setAgenda(
          schedules
            .filter((s) => s.startDatetime)
            .map((s) => ({
              id: s.id,
              title: s.scheduleTitle,
              time: s.startDatetime.slice(11, 16),
              startDatetime: s.startDatetime,
              endDatetime: s.endDatetime,
              recurrence: s.recurrence ?? null,
            }))
            .sort((a, b) => a.time.localeCompare(b.time)),
        );
      })
      .catch(() => {})
      .finally(() => setIsAgendaLoading(false));
  }, [caregiverId]);

  useEffect(() => {
    refreshCaregiverAgenda();
  }, [refreshCaregiverAgenda, currentLang]);

  const isEventsListLoading = careEventsLoading || isAgendaLoading;

  const handleSaveCaregiverEvent = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!caregiverEventTitle.trim()) {
      toast.error(t("careEvents.enterEventTitle"));
      return;
    }
    if (!caregiverId) {
      toast.error(t("careEvents.caregiverNotFound"));
      return;
    }
    const startTime24 = to24h(caregiverEventTimeHour, caregiverEventTimeMinute, caregiverEventTimePeriod);
    const endTime24 = to24h(caregiverEventEndTimeHour, caregiverEventEndTimeMinute, caregiverEventEndTimePeriod);
    const startDatetime = `${caregiverEventStartDate}T${startTime24}:00`;
    const endDateBase = (!caregiverEventIsNeverEnding && caregiverEventEndDate) ? caregiverEventEndDate : caregiverEventStartDate;
    const endDatetime = `${endDateBase}T${endTime24}:00`;
    const recurrence = caregiverEventRecurrence !== "none" ? caregiverEventRecurrence : null;

    const executeSaveCaregiverEvent = async () => {
      setIsSavingCaregiver(true);
      try {
        const created = await caregiverScheduleService.createSchedule(
          caregiverId, caregiverEventTitle, startDatetime, endDatetime, "", recurrence,
        );
        setAgenda(prev => [...prev, {
          id: created.id,
          title: created.scheduleTitle,
          time: startTime24,
          startDatetime,
          endDatetime,
          recurrence: created.recurrence ?? null,
        }].sort((a, b) => a.time.localeCompare(b.time)));
        toast.success(t("careEvents.caregiverEventAdded"));
        setCaregiverEventTitle("");
        setCaregiverEventStartDate(getMYTDateString());
        setCaregiverEventIsNeverEnding(true);
        setCaregiverEventEndDate("");
        setCaregiverEventRecurrence("none");
        setCaregiverEventTimeHour("08");
        setCaregiverEventTimeMinute("00");
        setCaregiverEventTimePeriod("AM");
        setCaregiverEventEndTimeHour("09");
        setCaregiverEventEndTimeMinute("00");
        setCaregiverEventEndTimePeriod("AM");
      } catch {
        toast.error(t("careEvents.failedAddCaregiverEvent"));
      } finally {
        setIsSavingCaregiver(false);
      }
    };

    const clash = findScheduleConflict(
      caregiverEventStartDate, startTime24, endTime24,
      caregiverEventRecurrence,
      caregiverEventIsNeverEnding ? null : (caregiverEventEndDate || null),
    );
    if (clash) {
      setScheduleClashInfo(clash);
      setPendingScheduleClashAction(() => executeSaveCaregiverEvent);
      setShowScheduleClashModal(true);
      return;
    }
    if (meds.length > 0 && hasMedicationOverlap(startTime24)) {
      setPendingOverlapAction(() => executeSaveCaregiverEvent);
      setShowOverlapModal(true);
      return;
    }
    await executeSaveCaregiverEvent();
  };

  // --- Get Location / weather handler (user-triggered) ---
  const handleGetLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setWeatherError(t("careEvents.environment.geoNotSupported"));
      return;
    }
    setWeatherData(null);
    setWeatherError(null);
    setWeatherLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {
        setWeatherLoading(false);
        setWeatherError(t("careEvents.environment.locationDenied"));
      },
    );
  }, []);

  // --- AI suggestion handlers ---
  const handleGenerateSuggestions = async () => {
    if (!userLocation) return;
    setAiSuggestionsLoading(true);
    setAiSuggestionsError(null);
    setEditingAiSuggestionIndex(null);
    setAiSuggestionEditDraft(null);
    setAiSuggestionConflicts(new Map());
    try {
      const suggestions = await activityService.generateSuggestions(caregiverId, userLocation.lat, userLocation.lon);
      setAiSuggestions(suggestions);
      // Pre-compute schedule conflicts for each suggestion so badges can be shown immediately
      const today = getMYTDateString();
      const conflicts = new Map<string, { title: string; startTime: string; endTime: string; date: string } | null>();
      for (const s of suggestions) {
        const key = `${s.eventName}-${s.startTime}`;
        const endTime = suggestionEndTime(s.startTime, s.durationMinutes);
        conflicts.set(key, findScheduleConflict(today, s.startTime, endTime, "none", null));
      }
      setAiSuggestionConflicts(conflicts);
    } catch {
      setAiSuggestionsError(t("careEvents.aiSuggestions.generateFailed"));
    } finally {
      setAiSuggestionsLoading(false);
    }
  };

  const handleFeedback = async (suggestion: ActivitySuggestion, feedback: "accept" | "reject") => {
    if (!userLocation) return;
    const key = `${suggestion.eventName}-${suggestion.startTime}`;

    const doFeedback = async () => {
      setFeedbackInProgress(prev => new Set(prev).add(key));
      try {
        await activityService.submitFeedback({
          caregiverId,
          lat: userLocation.lat,
          lon: userLocation.lon,
          ...suggestion,
          userFeedback: feedback,
        });
        setAiSuggestions(prev =>
          prev?.filter(s => !(s.eventName === suggestion.eventName && s.startTime === suggestion.startTime)) ?? null,
        );
        if (feedback === "accept") {
          localStorage.setItem(`parkicare_ai_activity_added_${caregiverId}`, "true");
          await refresh();
        }
        toast.success(feedback === "accept" ? t("careEvents.aiSuggestions.activityAdded") : t("careEvents.aiSuggestions.suggestionDismissed"));
      } catch {
        toast.error(t("careEvents.aiSuggestions.feedbackFailed"));
      } finally {
        setFeedbackInProgress(prev => { const s = new Set(prev); s.delete(key); return s; });
      }
    };

    if (feedback === "accept" && meds.length > 0 && hasMedicationOverlap(suggestion.startTime)) {
      setPendingOverlapAction(() => doFeedback);
      setShowOverlapModal(true);
      return;
    }

    if (feedback === "accept") {
      const today = getMYTDateString();
      const endTime = suggestionEndTime(suggestion.startTime, suggestion.durationMinutes);
      const clash = findScheduleConflict(today, suggestion.startTime, endTime, "none", null);
      if (clash) {
        setScheduleClashInfo(clash);
        setPendingScheduleClashAction(() => doFeedback);
        setShowScheduleClashModal(true);
        return;
      }
    }

    await doFeedback();
  };


  // Build combined event lists for the unified list panel
  const combinedEvents = useMemo(() => {
    const caregiverItems = agenda.map(a => ({
      id: a.id, backendId: undefined as number | undefined,
      title: a.title, time: a.time, eventKind: "caregiver" as const,
      startDatetime: a.startDatetime, endDatetime: a.endDatetime,
      recurrence: a.recurrence,
    }));
    const careItems = careEvents.map(e => ({
      id: e.id, backendId: e.backendId,
      title: e.title, time: e.time ?? "", eventKind: "care" as const,
      startDatetime: e.startDatetime, endDatetime: e.endDatetime,
      recurrence: e.recurrence ?? null,
    }));
    const outdoorItems = outdoorEvents.map(e => ({
      id: e.id, backendId: e.backendId,
      title: e.title, time: e.time ?? "", eventKind: "outdoor" as const,
      startDatetime: e.startDatetime, endDatetime: e.endDatetime,
      recurrence: e.recurrence ?? null,
    }));
    return [...caregiverItems, ...careItems, ...outdoorItems];
  }, [agenda, careEvents, outdoorEvents]);

  const filteredCombinedEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Use local date parts to avoid UTC-offset shifting (toISOString gives UTC date, not MYT)
    const toLocalDateStr = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const todayStr = toLocalDateStr(today);

    // End of current week = this Sunday (0 extra days if today is already Sunday)
    const daysToSunday = (7 - today.getDay()) % 7;
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + daysToSunday);
    const endOfWeekStr = toLocalDateStr(endOfWeek);

    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(today.getDate() + 7);

    // Expand recurring events into individual occurrences within the week window.
    const expanded: typeof combinedEvents = [];
    for (const e of combinedEvents) {
      const rec = (e.recurrence ?? "none").toLowerCase();

      if (!e.startDatetime) {
        expanded.push(e);
        continue;
      }

      const startDateStr = e.startDatetime.slice(0, 10);
      const startTimeStr = e.startDatetime.slice(11); // "HH:mm:ss"
      const endDateStr = e.endDatetime ? e.endDatetime.slice(0, 10) : undefined;
      const endTimeStr = e.endDatetime ? e.endDatetime.slice(11) : undefined;
      // Series end date: only set when endDate is strictly after startDate
      const seriesEnd = endDateStr && endDateStr > startDateStr ? endDateStr : undefined;

      if (!rec || rec === "none") {
        // Non-recurring: keep only if on or after today
        if (startDateStr >= todayStr) expanded.push(e);
        continue;
      }

      // Recurring: generate one occurrence per matching day from today to end-of-week
      // (capped by the series end date when it falls before end-of-week)
      const windowEnd = seriesEnd && seriesEnd < endOfWeekStr ? seriesEnd : endOfWeekStr;
      const cursor = new Date(today);
      while (true) {
        const cursorStr = toLocalDateStr(cursor);
        if (cursorStr > windowEnd) break;
        if (isEventOnDay(cursorStr, startDateStr, seriesEnd, rec)) {
          expanded.push({
            ...e,
            startDatetime: `${cursorStr}T${startTimeStr}`,
            endDatetime: endTimeStr ? `${cursorStr}T${endTimeStr}` : "",
          });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    return expanded
      .filter(e => {
        const isMeal = e.eventKind === "caregiver" && isMealTitle(e.title);
        if (isMeal && hideMealEvents) return false;
        if (isMeal && e.startDatetime) {
          const evDate = new Date(e.startDatetime);
          evDate.setHours(0, 0, 0, 0);
          if (evDate >= sevenDaysLater) return false;
        }
        if (eventListFilter !== "all" && e.eventKind !== eventListFilter) return false;
        return true;
      })
      .sort((a, b) => (a.startDatetime ?? "").localeCompare(b.startDatetime ?? ""));
  }, [combinedEvents, eventListFilter, hideMealEvents]);

  const TOTAL_STEPS = 4;
  const STEP_LABELS = [t("careEvents.stepMedication"), t("careEvents.stepRouteAndDose"), t("careEvents.stepSchedule"), t("careEvents.stepFrequency")];

  return (
    <div className="pb-10">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#2B3674]">{t("careEvents.title")}</h1>
        <p className="text-sm sm:text-base text-[#A3AED0] font-bold mt-1">{t("careEvents.subtitle")}</p>
      </div>

      <div className="space-y-6 sm:space-y-8">

        {/* -- Meal Schedule ------------------------------------------------------- */}
        <div id="meal-schedule-section" className="bg-white rounded-[20px] p-5 sm:p-6 shadow-[0_18px_40px_rgba(112,144,176,0.12)] border border-[#EEEAFB]">
          <h2 className="text-xl font-bold text-[#2B3674] mb-4">{t("dashboard.mealScheduleTitle")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {mealEditRows.map((row) => {
              const cfg = MEAL_ICON_CONFIG[row.mealType as keyof typeof MEAL_ICON_CONFIG];
              const getMealLabel = (mt: string) =>
                mt === "BREAKFAST" ? t("dashboard.breakfast")
                : mt === "LUNCH" ? t("dashboard.lunch")
                : t("dashboard.dinner");
              return (
                <div key={row.mealType} className="rounded-2xl overflow-hidden flex flex-col">
                  {!row.editing ? (
                    <div className="flex items-center gap-3 p-3 rounded-2xl border border-[#EEEAFB] hover:bg-[#F8F6FF] transition-colors">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        <cfg.icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] uppercase tracking-widest font-extrabold text-[#A3AED0]">{getMealLabel(row.mealType)}</p>
                        <p className="text-[15px] font-extrabold text-[#1F2247] mt-0.5">{formatMealDisplayTime(row.mealTime)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => startMealEdit(row.mealType)}
                        className="w-8 h-8 rounded-xl hover:bg-[#F4F2FF] flex items-center justify-center text-[#A3AED0] hover:text-[#4318FF] transition-colors cursor-pointer"
                        title={t("dashboard.editTime")}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="bg-[#F8F6FF] rounded-2xl px-4 py-3 border border-[#4318FF]/20 space-y-2">
                      <p className="text-[10px] font-bold text-[#4318FF] uppercase tracking-widest">{getMealLabel(row.mealType)}</p>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={row.editHour}
                          onChange={(e) => setMealField(row.mealType, "editHour", e.target.value)}
                          className="flex-1 px-2 py-1.5 bg-white border border-[#E0E5F2] rounded-lg text-xs font-bold text-[#1F2247] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/30"
                        >
                          {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <span className="text-[#4318FF] font-bold text-sm">:</span>
                        <select
                          value={row.editMinute}
                          onChange={(e) => setMealField(row.mealType, "editMinute", e.target.value)}
                          className="flex-1 px-2 py-1.5 bg-white border border-[#E0E5F2] rounded-lg text-xs font-bold text-[#1F2247] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/30"
                        >
                          {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <div className="flex rounded-lg overflow-hidden border border-[#4318FF]/30">
                          {(["AM", "PM"] as const).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setMealField(row.mealType, "editPeriod", p)}
                              className={`px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer
                                ${row.editPeriod === p
                                  ? "bg-[#4318FF] text-white"
                                  : "bg-white text-[#A3AED0] hover:bg-[#F4F2FF]"}`}
                            >
                              {formatPeriodLabel(p as "AM" | "PM")}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => cancelMealEdit(row.mealType)}
                          disabled={row.saving}
                          className="flex-1 py-1.5 bg-white text-[#A3AED0] text-xs font-bold rounded-lg border border-[#E0E5F2] transition-all disabled:opacity-50 cursor-pointer hover:bg-[#F4F7FE]"
                        >
                          {t("common.cancel")}
                        </button>
                        <button
                          type="button"
                          onClick={() => saveMealEdit(row.mealType)}
                          disabled={row.saving}
                          className="flex-1 py-1.5 bg-[#4318FF] hover:bg-[#3412C7] text-white text-xs font-bold rounded-lg transition-all disabled:opacity-70 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          {row.saving && <Loader2 className="w-3 h-3 animate-spin" />}
                          {t("common.save")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Medication Row */}
        <div id="medication-section" className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-stretch">

          {/* Add Medication Form */}
          <div className="bg-white rounded-[20px] p-4 sm:p-6 shadow-[0_18px_40px_rgba(112,144,176,0.12)] border-none relative h-[480px] flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 shrink-0">
              <h2 className="text-lg sm:text-xl font-bold text-[#2B3674] flex flex-wrap items-center gap-2">
                <Plus className="w-5 h-5 text-[#4318FF]" /> {t("careEvents.addMedicationHeader")}
                {isTestMode && (
                  <span className="ml-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full uppercase tracking-widest">
                    {t("careEvents.testMedReminder")}
                  </span>
                )}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {/* Test Observation Note button + medication picker dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTestObsSelector(prev => !prev)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all border bg-[#F4F7FE] text-[#A3AED0] border-[#E0E5F2] hover:bg-[#E9E3FF] hover:text-[#4318FF]"
                  >
                    {t("careEvents.testObsNote")}
                  </button>
                  {showTestObsSelector && (
                    <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowTestObsSelector(false)} />
                    <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#E0E5F2] min-w-[220px] max-w-[calc(100vw-1rem)] overflow-hidden">
                      {medsWithRemindId.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-[#A3AED0]">
                          {t("careEvents.testObsNoteNoMeds")}
                        </p>
                      ) : (
                        medsWithRemindId.map(med => (
                          <button
                            key={med.remindId}
                            type="button"
                            onClick={() => handleOpenTestObsNote(med)}
                            className="w-full text-left px-4 py-2.5 hover:bg-[#F4F7FE] transition-colors flex items-center gap-2"
                          >
                            <Pill className="w-3.5 h-3.5 text-[#4318FF] shrink-0" />
                            <span className="text-sm font-bold text-[#2B3674] truncate">{med.name}</span>
                            <span className="text-xs text-[#A3AED0] ml-auto shrink-0">{med.time}</span>
                          </button>
                        ))
                      )}
                    </div>
                    </>
                  )}
                </div>

                {/* Test Medication Reminder toggle */}
                <button
                  type="button"
                  onClick={handleToggleTestMode}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all border ${
                    isTestMode
                      ? "bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200"
                      : "bg-[#F4F7FE] text-[#A3AED0] border-[#E0E5F2] hover:bg-[#E9E3FF] hover:text-[#4318FF]"
                  }`}
                >
                  {isTestMode ? t("careEvents.exitTestMode") : t("careEvents.testMedReminder")}
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 px-1 pb-1">

            {/* Test Mode Form */}
            {isTestMode && (
              <form onSubmit={handleTestSaveMedication} className="space-y-5">
                {/* Drug name search */}
                <div className="relative z-20">
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">{t("careEvents.wizard.medicationName")}</label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#A3AED0]" />
                    <input
                      type="text" value={testMedName}
                      onChange={(e) => { setTestMedName(e.target.value); setTestSelectedDrug(null); }}
                      onBlur={() => setTimeout(() => setTestShowMedsDropdown(false), 200)}
                      placeholder={t("careEvents.wizard.medicationNamePlaceholder")}
                      className="w-full pl-11 pr-4 py-3.5 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50 transition-all placeholder:text-[#A3AED0]"
                    />
                  </div>
                  <div className="mt-2 flex items-start gap-2 bg-[#E9E3FF]/50 p-3 rounded-xl">
                    <Info className="w-4 h-4 text-[#4318FF] shrink-0 mt-0.5" />
                    <p className="text-xs font-bold text-[#4318FF] leading-relaxed">
                      {testSelectedDrug
                        ? t("careEvents.wizard.selectedMed", { name: testSelectedDrug.drugName, dose: testSelectedDrug.dosage })
                        : t("careEvents.wizard.typeToSearchMeds")}
                    </p>
                  </div>
                  <AnimatePresence>
                    {testShowMedsDropdown && testDrugSearchResults.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="absolute top-[75px] left-0 right-0 bg-white rounded-xl shadow-[0_18px_40px_rgba(112,144,176,0.12)] p-2 max-h-48 overflow-y-auto z-50"
                      >
                        {testDrugSearchResults.map(drug => (
                          <div key={drug.drugId}
                            onClick={() => { setTestSelectedDrug(drug); setTestMedName(drug.drugName); setTestShowMedsDropdown(false); }}
                            className="px-4 py-3 hover:bg-indigo-50 rounded-lg cursor-pointer text-sm font-semibold text-slate-700 hover:text-indigo-700 flex items-center justify-between group"
                          >
                            <span>{drug.drugName}</span>
                            <span className="text-xs text-[#A3AED0]">{drug.dosage}</span>
                            <Check className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Frequency segmented control */}
                <div>
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">{t("careEvents.wizard.frequencyLabel")}</label>
                  <div className="flex rounded-xl overflow-hidden border border-[#E0E5F2]">
                    {FREQUENCIES.map(freq => (
                      <button key={freq} type="button" onClick={() => handleTestFrequencyChange(freq)}
                        className={`flex-1 py-2.5 text-xs font-bold transition-all ${testFrequency === freq ? "bg-[#4318FF] text-white" : "bg-[#F4F7FE] text-[#A3AED0] hover:bg-[#E9E3FF]"}`}
                      >
                        {translateFrequency(freq)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Per-dose time pickers */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-1 block ml-1">{t("careEvents.wizard.doseTimesLabel")}</label>
                  {testMedTimes.map((slot, idx) => (
                    <div key={idx} className="p-4 bg-[#F4F7FE] rounded-xl">
                      <p className="text-xs font-bold text-[#4318FF] mb-3">
                        {t("careEvents.wizard.dosePreview", { num: idx + 1, time: formatDisplayTime(slot.hour, slot.minute, slot.period) })}
                      </p>
                      <div className="grid grid-cols-1 min-[400px]:grid-cols-3 gap-2">
                        <div>
                          <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">{t("careEvents.wizard.hour")}</p>
                          <select value={slot.hour}
                            onChange={(e) => setTestMedTimes(prev => prev.map((item, i) => i === idx ? { ...item, hour: e.target.value } : item))}
                            className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50"
                          >
                            {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">{t("careEvents.wizard.min")}</p>
                          <select value={slot.minute}
                            onChange={(e) => setTestMedTimes(prev => prev.map((item, i) => i === idx ? { ...item, minute: e.target.value } : item))}
                            className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50"
                          >
                            {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">{t("careEvents.wizard.period")}</p>
                          <div className="flex rounded-lg overflow-hidden border border-[#E0E5F2] h-[42px]">
                            {(["AM", "PM"] as const).map(p => (
                              <button key={p} type="button"
                                onClick={() => setTestMedTimes(prev => prev.map((item, i) => i === idx ? { ...item, period: p } : item))}
                                className={`flex-1 text-xs font-bold transition-all ${slot.period === p ? "bg-[#4318FF] text-white" : "bg-white text-[#A3AED0] hover:bg-[#E9E3FF]"}`}
                              >
                                {formatPeriodLabel(p as "AM" | "PM")}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Submit */}
                <button type="submit" disabled={isSavingTestMed}
                  className="w-full py-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSavingTestMed && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSavingTestMed ? t("careEvents.saving") : t("careEvents.saveTestMed")}
                </button>
              </form>
            )}

            {!isTestMode && (<>
            {/* Pre-Medication Safety Warning Overlay */}
            <AnimatePresence>
              {showPreMedWarning && (
                <motion.div
                  key="pre-med-warning"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 bg-white/95 backdrop-blur-sm rounded-[20px] flex flex-col items-center justify-center p-6 sm:p-8 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                    <AlertCircle className="w-8 h-8 text-amber-500" />
                  </div>
                  <h3 className="text-lg font-bold text-[#2B3674] mb-2">{t("careEvents.wizard.medicationSafetyNotice")}</h3>
                  <p className="text-sm text-[#A3AED0] leading-relaxed mb-6 max-w-xs">
                    {t("careEvents.wizard.medicationSafetyBody")}
                  </p>
                  <button
                    type="button"
                    onClick={() => { setShowPreMedWarning(false); setFormInteractive(true); }}
                    className="w-full max-w-xs py-3.5 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] active:scale-[0.98]"
                  >
                    {t("careEvents.wizard.iUnderstandProceed")}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* CTA shown before form is opened */}
            {!formInteractive && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-14 h-14 rounded-full bg-[#E9E3FF] flex items-center justify-center mb-4">
                  <Pill className="w-7 h-7 text-[#4318FF]" />
                </div>
                <p className="text-sm text-[#A3AED0] leading-relaxed mb-5 max-w-xs">
                  {t("careEvents.wizard.addMedicationCta")}
                </p>
                <button
                  type="button"
                  onClick={() => setShowPreMedWarning(true)}
                  className="px-6 py-3.5 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] active:scale-[0.98] flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> {t("careEvents.addMedicationHeader")}
                </button>
              </div>
            )}

            {/* Progress Indicator + Form - only when form is interactive */}
            {formInteractive && <>
            <div className="flex items-center justify-between mb-6">
              {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((step) => {
                const isCompleted = medicationStep > step;
                const isCurrent = medicationStep === step;
                const StepNode = isCompleted ? "button" : "div";
                return (
                  <div key={step} className="flex items-center flex-1 last:flex-none">
                    <StepNode
                      {...(isCompleted ? {
                        type: "button" as const,
                        onClick: () => handleEditField(step),
                        title: t("careEvents.wizard.goBackToStep", { step: STEP_LABELS[step - 1] }),
                      } : {})}
                      className={`flex flex-col items-center gap-1 ${isCompleted ? "cursor-pointer group" : ""}`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isCurrent
                          ? "bg-[#4318FF] text-white scale-110"
                          : isCompleted
                          ? "bg-[#E9E3FF] text-[#4318FF] group-hover:bg-[#4318FF] group-hover:text-white group-hover:scale-110"
                          : "bg-[#F4F7FE] text-[#A3AED0]"
                      }`}>
                        {isCompleted ? <Check className="w-3.5 h-3.5" /> : step}
                      </div>
                      <span className={`text-[10px] font-bold hidden sm:block transition-colors ${
                        isCurrent ? "text-[#4318FF]" :
                        isCompleted ? "text-[#4318FF] group-hover:text-[#2B3674]" :
                        "text-[#A3AED0]"
                      }`}>
                        {STEP_LABELS[step - 1]}
                      </span>
                    </StepNode>
                    {step < TOTAL_STEPS && (
                      <div className={`h-0.5 flex-1 mx-1 mb-3 transition-all ${isCompleted ? "bg-[#4318FF]" : "bg-[#F4F7FE]"}`} />
                    )}
                  </div>
                );
              })}
            </div>

            <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
              <AnimatePresence mode="wait">

                {/* Step 1: Medication - choice / OCR / manual */}
                {medicationStep === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">

                    {/* Choice screen */}
                    {inputMode === "choice" && (
                      <>
                        <div>
                          <p className="text-sm font-bold text-[#2B3674] mb-1">{t("careEvents.wizard.addMedicationPrompt")}</p>
                          <p className="text-xs text-[#A3AED0]">{t("careEvents.wizard.chooseMethod")}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <button
                            type="button"
                            onClick={() => setInputMode("ocr")}
                            className="p-5 bg-[#F4F7FE] hover:bg-[#E9E3FF] border-2 border-transparent hover:border-[#4318FF]/30 rounded-xl flex flex-col items-center gap-3 text-center transition-all group active:scale-[0.98]"
                          >
                            <div className="w-12 h-12 rounded-xl bg-[#E9E3FF] group-hover:bg-[#4318FF] flex items-center justify-center transition-colors">
                              <Camera className="w-6 h-6 text-[#4318FF] group-hover:text-white transition-colors" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[#2B3674]">{t("careEvents.wizard.scanLabel")}</p>
                              <p className="text-xs text-[#A3AED0] mt-0.5">{t("careEvents.wizard.useCameraOrUpload")}</p>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setInputMode("manual")}
                            className="p-5 bg-[#F4F7FE] hover:bg-[#E9E3FF] border-2 border-transparent hover:border-[#4318FF]/30 rounded-xl flex flex-col items-center gap-3 text-center transition-all group active:scale-[0.98]"
                          >
                            <div className="w-12 h-12 rounded-xl bg-[#E9E3FF] group-hover:bg-[#4318FF] flex items-center justify-center transition-colors">
                              <Pencil className="w-6 h-6 text-[#4318FF] group-hover:text-white transition-colors" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[#2B3674]">{t("careEvents.wizard.manualInput")}</p>
                              <p className="text-xs text-[#A3AED0] mt-0.5">{t("careEvents.wizard.typeDetailsDirectly")}</p>
                            </div>
                          </button>
                        </div>
                      </>
                    )}

                    {/* OCR - Phase A: image capture */}
                    {inputMode === "ocr" && !isOcrLoading && !ocrResult && (
                      <>
                        <button
                          type="button"
                          onClick={() => { setInputMode("choice"); if (medicationImagePreview) { URL.revokeObjectURL(medicationImagePreview); setMedicationImagePreview(null); } setMedicationImage(null); }}
                          className="text-xs text-[#4318FF] font-bold flex items-center gap-1 hover:underline"
                        >
                          {t("careEvents.wizard.changeMethod")}
                        </button>
                        <div className="flex items-start gap-2 bg-[#E9E3FF]/50 p-3 rounded-xl">
                          <Info className="w-4 h-4 text-[#4318FF] shrink-0 mt-0.5" />
                          <p className="text-xs font-bold text-[#4318FF] leading-relaxed">
                            {t("careEvents.wizard.ocrPhotoHint")}
                          </p>
                        </div>
                        {!medicationImagePreview ? (
                          <div className="grid grid-cols-2 gap-3">
                            <label className="flex flex-col items-center gap-2 p-5 bg-[#F4F7FE] hover:bg-[#E9E3FF] border-2 border-dashed border-[#4318FF]/30 rounded-xl cursor-pointer transition-all text-center">
                              <Camera className="w-7 h-7 text-[#4318FF]" />
                              <span className="text-xs font-bold text-[#4318FF]">{t("careEvents.wizard.useCamera")}</span>
                              <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" />
                            </label>
                            <label className="flex flex-col items-center gap-2 p-5 bg-[#F4F7FE] hover:bg-[#E9E3FF] border-2 border-dashed border-[#4318FF]/30 rounded-xl cursor-pointer transition-all text-center">
                              <Upload className="w-7 h-7 text-[#4318FF]" />
                              <span className="text-xs font-bold text-[#4318FF]">{t("careEvents.wizard.uploadImage")}</span>
                              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                            </label>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-3">
                            <div className="relative">
                              <img src={medicationImagePreview} alt={t("careEvents.wizard.medImageAlt")} className="max-h-44 rounded-xl object-contain border border-[#E0E5F2]" />
                              <button
                                type="button"
                                onClick={() => { URL.revokeObjectURL(medicationImagePreview); setMedicationImage(null); setMedicationImagePreview(null); }}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <p className="text-xs font-bold text-[#A3AED0]">{medicationImage?.name}</p>
                          </div>
                        )}
                        {medicationImage && (
                          <button
                            type="button"
                            onClick={handleNextStep}
                            className="w-full py-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] active:scale-[0.98] flex items-center justify-center gap-2"
                          >
                            <Camera className="w-4 h-4" /> {t("careEvents.wizard.scanLabelBtn")}
                          </button>
                        )}
                      </>
                    )}

                    {/* OCR - Loading spinner */}
                    {inputMode === "ocr" && isOcrLoading && (
                      <div className="flex flex-col items-center gap-4 py-10">
                        <Loader2 className="w-10 h-10 text-[#4318FF] animate-spin" />
                        <p className="text-sm font-bold text-[#2B3674]">{t("careEvents.wizard.scanningLabel")}</p>
                        <p className="text-xs text-[#A3AED0] text-center">{t("careEvents.wizard.scanningLabelSub")}</p>
                      </div>
                    )}

                    {/* OCR Phase B (success/error) and Manual: shared fields view */}
                    {(inputMode === "manual" || (inputMode === "ocr" && !isOcrLoading && ocrResult)) && (
                      <>
                        <button
                          type="button"
                          onClick={() => { setInputMode("choice"); setOcrResult(null); setMedName(""); setDose(""); setManufacturerName(""); setSelectedDrug(null); if (medicationImagePreview) { URL.revokeObjectURL(medicationImagePreview); setMedicationImagePreview(null); } setMedicationImage(null); }}
                          className="text-xs text-[#4318FF] font-bold flex items-center gap-1 hover:underline"
                        >
                          {t("careEvents.wizard.changeMethod")}
                        </button>

                        {ocrResult && !ocrResult.error && (
                          <div className="flex items-start gap-2 bg-green-50 p-3 rounded-xl border border-green-200">
                            <Check className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                            <p className="text-xs font-bold text-green-700 leading-relaxed">{t("careEvents.wizard.labelScannedSuccess")}</p>
                          </div>
                        )}
                        {ocrResult?.error && (
                          <div className="flex items-start gap-2 bg-orange-50 p-3 rounded-xl border border-orange-200">
                            <AlertCircle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                            <p className="text-xs font-bold text-orange-600 leading-relaxed">{t("careEvents.wizard.labelScanFailed")}</p>
                          </div>
                        )}

                        {/* Drug Name */}
                        <div className="relative z-20">
                          <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">{t("careEvents.wizard.medicationName")}</label>
                          <div className="relative">
                            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#A3AED0]" />
                            <input
                              type="text"
                              value={medName}
                              onChange={(e) => { setMedName(e.target.value); setSelectedDrug(null); }}
                              onBlur={() => setTimeout(() => setShowMedsDropdown(false), 200)}
                              placeholder={t("careEvents.wizard.medicationNamePlaceholder")}
                              className="w-full pl-11 pr-4 py-3.5 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50 transition-all placeholder:text-[#A3AED0]"
                            />
                          </div>
                          <div className="mt-2 flex items-start gap-2 bg-[#E9E3FF]/50 p-3 rounded-xl">
                            <Info className="w-4 h-4 text-[#4318FF] shrink-0 mt-0.5" />
                            <p className="text-xs font-bold text-[#4318FF] leading-relaxed">
                              {selectedDrug ? t("careEvents.wizard.selectedMedSuggested", { name: selectedDrug.drugName, dose: selectedDrug.dosage ?? "" }) : t("careEvents.wizard.typeToSearchMeds")}
                            </p>
                          </div>
                          <AnimatePresence>
                            {showMedsDropdown && drugSearchResults.length > 0 && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute top-[75px] left-0 right-0 bg-white rounded-xl shadow-[0_18px_40px_rgba(112,144,176,0.12)] border-none p-2 max-h-48 overflow-y-auto z-50"
                              >
                                {drugSearchResults.map(drug => (
                                  <div
                                    key={drug.drugId}
                                    onClick={() => {
                                      setSelectedDrug(drug);
                                      setMedName(drug.drugName);
                                      if (!dose && drug.dosage) setDose(drug.dosage);
                                      if (drug.manufacturerName) { manufacturerJustSelected.current = true; setManufacturerName(drug.manufacturerName); }
                                      if (frequency === "2 times/day" && drug.frequency) {
                                        setFrequency(drug.frequency);
                                        setSelectedMeals([]);
                                      }
                                      drugsService.getDrugById(drug.drugId)
                                        .then(detail => setDrugIntervalMinutes(detail.intervalMinutes ?? 0))
                                        .catch(() => setDrugIntervalMinutes(0));
                                      setShowMedsDropdown(false);
                                    }}
                                    className="px-4 py-3 hover:bg-indigo-50 rounded-lg cursor-pointer text-sm font-semibold text-slate-700 hover:text-indigo-700 flex items-center justify-between group"
                                  >
                                    <span>{drug.drugName}</span>
                                    <span className="text-xs text-[#A3AED0]">{drug.dosage}</span>
                                    <Check className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Dosage */}
                        <div>
                          <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">{t("careEvents.wizard.dosageStrengthLabel")}</label>
                          <input
                            type="text"
                            value={dose}
                            onChange={(e) => setDose(e.target.value)}
                            placeholder={t("careEvents.wizard.dosagePlaceholder")}
                            className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50 transition-all placeholder:text-[#A3AED0]"
                          />
                        </div>

                        {/* Manufacturer */}
                        <div className="relative z-10">
                          <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">
                            {t("careEvents.wizard.manufacturerLabel")} <span className="normal-case font-normal text-[#A3AED0]">{t("careEvents.wizard.optional")}</span>
                          </label>
                          <div className="relative">
                            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#A3AED0]" />
                            <input
                              type="text"
                              value={manufacturerName}
                              onChange={(e) => setManufacturerName(e.target.value)}
                              onBlur={() => setTimeout(() => setShowManufacturerDropdown(false), 200)}
                              placeholder={t("careEvents.wizard.manufacturerPlaceholder")}
                              className="w-full pl-11 pr-4 py-3.5 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50 transition-all placeholder:text-[#A3AED0]"
                            />
                          </div>
                          <AnimatePresence>
                            {showManufacturerDropdown && manufacturerSuggestions.length > 0 && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute top-[56px] left-0 right-0 bg-white rounded-xl shadow-[0_18px_40px_rgba(112,144,176,0.12)] border-none p-2 max-h-40 overflow-y-auto z-50"
                              >
                                {manufacturerSuggestions.map((mfr, i) => (
                                  <div
                                    key={i}
                                    onClick={() => { manufacturerJustSelected.current = true; setManufacturerName(mfr); setShowManufacturerDropdown(false); }}
                                    className="px-4 py-2.5 hover:bg-indigo-50 rounded-lg cursor-pointer text-sm font-semibold text-slate-700 hover:text-indigo-700"
                                  >
                                    {mfr}
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <button
                          type="button"
                          onClick={handleNextStep}
                          className="w-full py-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] active:scale-[0.98]"
                        >
                          {t("careEvents.wizard.next")}
                        </button>
                      </>
                    )}

                  </motion.div>
                )}

                {/* Step 2: Route & Dose */}
                {medicationStep === 2 && (
                  <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                    <div className="flex items-start gap-2 bg-[#E9E3FF]/50 p-3 rounded-xl">
                      <Info className="w-4 h-4 text-[#4318FF] shrink-0 mt-0.5" />
                      <p className="text-xs font-bold text-[#4318FF] leading-relaxed">
                        {t("careEvents.wizard.routeDoseHint")}
                      </p>
                    </div>

                    {/* Route toggle */}
                    <div className="flex rounded-xl overflow-hidden border border-[#E0E5F2]">
                      <button
                        type="button"
                        onClick={() => setDosagePart("oral")}
                        className={`flex-1 py-2.5 text-xs font-bold transition-all ${dosagePart === "oral" ? "bg-[#4318FF] text-white" : "bg-[#F4F7FE] text-[#A3AED0] hover:bg-[#E9E3FF]"}`}
                      >
                        {t("careEvents.wizard.oral")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDosagePart("other")}
                        className={`flex-1 py-2.5 text-xs font-bold transition-all ${dosagePart === "other" ? "bg-[#4318FF] text-white" : "bg-[#F4F7FE] text-[#A3AED0] hover:bg-[#E9E3FF]"}`}
                      >
                        {t("careEvents.wizard.otherRoute")}
                      </button>
                    </div>

                    {dosagePart === "oral" ? (
                      <div>
                        <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">{t("careEvents.wizard.quantityLabel")}</label>
                        <input
                          type="number"
                          min="1"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 1))}
                          placeholder={t("careEvents.wizard.quantityPlaceholder")}
                          className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50 transition-all placeholder:text-[#A3AED0]"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">{t("careEvents.wizard.intakeDescriptionLabel")}</label>
                        <input
                          type="text"
                          value={intakeMethod}
                          onChange={(e) => setIntakeMethod(e.target.value)}
                          placeholder={t("careEvents.wizard.intakePlaceholder")}
                          className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50 transition-all placeholder:text-[#A3AED0]"
                          autoFocus
                        />
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button type="button" onClick={handlePrevStep} className="flex-1 py-4 bg-[#F4F7FE] hover:bg-[#E9E3FF] text-[#4318FF] font-bold rounded-xl transition-all active:scale-[0.98]">{t("careEvents.wizard.back")}</button>
                      <button type="button" onClick={handleNextStep} className="flex-1 py-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] active:scale-[0.98]">{t("careEvents.wizard.next")}</button>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Schedule */}
                {medicationStep === 3 && (
                  <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                    <div>
                      <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">
                        <Calendar className="w-3.5 h-3.5 inline mr-1" />{t("careEvents.wizard.startDateLabel")}
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50 transition-all"
                      />
                    </div>

                    {/* End date toggle */}
                    <div
                      className="flex items-center justify-between p-4 bg-[#F4F7FE] rounded-xl cursor-pointer select-none"
                      onClick={() => {
                        const turningOn = isNeverEnding; // currently off â†’ turning end date on
                        setIsNeverEnding(v => !v);
                        setRecurrence(turningOn ? "daily" : "none");
                      }}
                    >
                      <div>
                        <p className="text-sm font-bold text-[#2B3674]">{t("careEvents.wizard.endDateTitle")}</p>
                        <p className="text-xs text-[#A3AED0] mt-0.5">{t("careEvents.wizard.endDateDesc")}</p>
                      </div>
                      <div className={`w-11 h-6 rounded-full transition-all relative ${!isNeverEnding ? "bg-[#4318FF]" : "bg-[#E0E5F2]"}`}>
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${!isNeverEnding ? "left-6" : "left-1"}`} />
                      </div>
                    </div>

                    {/* End date (only if not never ending) */}
                    {!isNeverEnding && (
                      <div>
                        <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">{t("careEvents.wizard.endDateLabel")}</label>
                        <input
                          type="date"
                          value={endDate}
                          min={startDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50 transition-all"
                        />
                      </div>
                    )}

                    {/* Recurrence */}
                    {!isNeverEnding && (
                      <div>
                        <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-3 block ml-1">{t("careEvents.wizard.repeat")}</label>
                        <motion.div className="space-y-2">
                          {([
                            { value: "daily", label: t("careEvents.daily") },
                            { value: "weekdays", label: t("careEvents.weekdays") },
                            { value: "weekly", label: t("enums.recurrence.weekly", { day: getDayName(startDate) }) },
                          ] as { value: "daily" | "weekdays" | "weekly"; label: string }[]).map(opt => (
                            <label
                              key={opt.value}
                              className={`flex items-center gap-3 p-3.5 rounded-xl transition-all cursor-pointer ${recurrence === opt.value ? "bg-[#E9E3FF] border border-[#4318FF]/30" : "bg-[#F4F7FE] hover:bg-[#E9E3FF]/50"}`}
                            >
                              <input
                                type="radio"
                                name="recurrence"
                                value={opt.value}
                                checked={recurrence === opt.value}
                                onChange={() => setRecurrence(opt.value)}
                                className="accent-[#4318FF] w-4 h-4"
                              />
                              <span className="text-sm font-bold text-[#2B3674]">{opt.label}</span>
                            </label>
                          ))}
                        </motion.div>
                      </div>
                    )}

                    <motion.div className="flex gap-3">
                      <button type="button" onClick={handlePrevStep} className="flex-1 py-4 bg-[#F4F7FE] hover:bg-[#E9E3FF] text-[#4318FF] font-bold rounded-xl transition-all active:scale-[0.98]">{t("careEvents.wizard.back")}</button>
                      <button type="button" onClick={handleNextStep} className="flex-1 py-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] active:scale-[0.98]">{t("careEvents.wizard.next")}</button>
                    </motion.div>
                  </motion.div>
                )}

                {/* Step 4: Frequency + Meal Timing */}
                {medicationStep === 4 && (
                  <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                    <div className="relative z-10">
                      <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">{t("careEvents.wizard.frequencyLabel")}</label>
                      <input
                        type="text"
                        value={frequency}
                        onChange={(e) => { setFrequency(e.target.value); setShowFreqDropdown(true); }}
                        onFocus={() => setShowFreqDropdown(true)}
                        onBlur={() => setTimeout(() => setShowFreqDropdown(false), 200)}
                        placeholder={t("careEvents.wizard.frequencyPlaceholder")}
                        className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50 transition-all placeholder:text-[#A3AED0]"
                      />
                      <AnimatePresence>
                        {showFreqDropdown && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute top-[70px] left-0 right-0 bg-white rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-slate-100 p-2 max-h-48 overflow-y-auto z-50"
                          >
                            {FREQUENCIES.map(freq => (
                              <div
                                key={freq}
                                onClick={() => { handleFrequencyChange(freq); setShowFreqDropdown(false); }}
                                className="px-4 py-2 hover:bg-indigo-50 rounded-lg cursor-pointer text-sm font-semibold text-slate-700 hover:text-indigo-700"
                              >
                                {translateFrequency(freq)}
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Meal Timing */}
                    <div>
                      <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-3 block ml-1">{t("careEvents.wizard.whenToTakeLabel")}</label>
                      <div className="flex gap-2">
                        {(["before meals", "after meals", "with meals"] as const).map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setMealTiming(opt)}
                            className={`flex-1 py-3 px-2 rounded-xl text-xs font-bold transition-all ${mealTiming === opt ? "bg-[#4318FF] text-white shadow-[0_4px_15px_rgba(67,24,255,0.3)]" : "bg-[#F4F7FE] text-[#A3AED0] hover:bg-[#E9E3FF] hover:text-[#4318FF]"}`}
                          >
                            {translateEnum("mealTiming", opt)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Meal Selection */}
                    <div>
                      <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-1 block ml-1">
                        {t("careEvents.wizard.anchorMealsLabel")}
                      </label>
                      <p className="text-[11px] text-[#A3AED0] mb-3 ml-1">
                        {t("careEvents.wizard.selectMealsHint", { count: parseInt(frequency.match(/\d+/)?.[0] || "1") })}
                      </p>
                      <div className="space-y-2">
                        {(["BREAKFAST", "LUNCH", "DINNER"] as const).map(meal => {
                          const entry = (mealSchedules.length > 0 ? mealSchedules : DEFAULT_MEAL_TIMES).find(e => e.mealType === meal)!;
                          const isSelected = selectedMeals.includes(meal);
                          const requiredCount = parseInt(frequency.match(/\d+/)?.[0] || "1");
                          const canSelect = isSelected || selectedMeals.length < requiredCount;
                          return (
                            <button
                              key={meal}
                              type="button"
                              disabled={!canSelect}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedMeals(prev => prev.filter(m => m !== meal));
                                } else if (canSelect) {
                                  setSelectedMeals(prev => [...prev, meal]);
                                }
                              }}
                              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all border-2 ${
                                isSelected
                                  ? "bg-[#4318FF] text-white border-[#4318FF] shadow-[0_4px_15px_rgba(67,24,255,0.25)]"
                                  : canSelect
                                  ? "bg-[#F4F7FE] text-[#2B3674] border-transparent hover:border-[#4318FF]/30 hover:bg-[#E9E3FF]"
                                  : "bg-[#F4F7FE] text-[#A3AED0] border-transparent opacity-50 cursor-not-allowed"
                              }`}
                            >
                              <span>{mealLabel(meal)}</span>
                              <span className={`text-xs font-bold ${isSelected ? "text-white/80" : "text-[#A3AED0]"}`}>
                                {hhmmTo12h(entry.mealTime)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {usingDefaultMealTimes && (
                        <div className="flex items-start gap-2 mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                          <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-700">{t("careEvents.wizard.defaultMealTimesWarning")}</p>
                        </div>
                      )}
                      {calculatedTimes.length > 0 && (
                        <div className="mt-3 p-3 bg-[#E9E3FF]/50 rounded-xl">
                          <p className="text-[10px] font-bold text-[#4318FF] uppercase tracking-widest mb-2">{t("careEvents.wizard.previewLabel")}</p>
                          <div className="space-y-1">
                            {calculatedTimes.map((time, i) => (
                              <p key={i} className="text-xs font-bold text-[#2B3674]">
                                {t("careEvents.wizard.dosePreview", { num: i + 1, time: hhmmTo12h(time) })}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button type="button" onClick={handlePrevStep} className="flex-1 py-4 bg-[#F4F7FE] hover:bg-[#E9E3FF] text-[#4318FF] font-bold rounded-xl transition-all active:scale-[0.98]">{t("careEvents.wizard.back")}</button>
                      <button type="button" onClick={handleNextStep} className="flex-1 py-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] active:scale-[0.98]">{t("careEvents.wizard.reviewAndConfirm")}</button>
                    </div>
                  </motion.div>
                )}


              </AnimatePresence>
            </form>
            </>}
            </>)}
            </div> {/* end scrollable wrapper */}
          </div>

          {/* Post-Medication Confirmation Modal */}
          <AnimatePresence>
            {showConfirmModal && (
              <motion.div
                key="confirm-modal-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 p-safe"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="w-full max-w-md bg-white rounded-[20px] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
                >
                  <h3 className="text-lg font-bold text-[#2B3674] mb-4">{t("careEvents.wizard.review")}</h3>

                  {/* Medication */}
                  <div
                    onClick={() => { setShowConfirmModal(false); handleEditField(1); }}
                    className={`p-4 rounded-xl hover:bg-[#E9E3FF] cursor-pointer transition-all group mb-3 ${ocrResult && !ocrResult.error && dose.trim().toLowerCase() !== ocrResult.dose.toLowerCase() ? "bg-[#FFF7ED] border border-orange-300" : "bg-[#F4F7FE]"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        {medicationImagePreview && (
                          <img src={medicationImagePreview} alt={t("careEvents.wizard.medImageAlt")} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-0.5">{t("careEvents.wizard.medicationLabel")}</p>
                          <p className="text-sm font-bold text-[#2B3674] truncate">{medName || t("careEvents.wizard.notSet")}</p>
                          <p className="text-xs text-[#A3AED0] mt-0.5">{dose || "-"}{manufacturerName ? ` · ${manufacturerName}` : ""}</p>
                        </div>
                      </div>
                      <span className="text-xs text-[#4318FF] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">{t("careEvents.wizard.edit")}</span>
                    </div>
                    {ocrResult && !ocrResult.error && dose.trim().toLowerCase() !== ocrResult.dose.toLowerCase() && (
                      <div className="mt-2 flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                        <AlertCircle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                        <div className="text-xs text-orange-700">
                          <p className="font-bold">{t("careEvents.wizard.dosageMismatchTitle")}</p>
                          <p className="mt-0.5">{t("careEvents.wizard.dosageMismatchDetail", { label: ocrResult.dose || "—", entered: dose || "—" })}</p>
                          <p className="mt-0.5 text-orange-500">{t("careEvents.wizard.verifyBeforeSave")}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Route & Administration */}
                  <div onClick={() => { setShowConfirmModal(false); handleEditField(2); }} className="p-4 bg-[#F4F7FE] rounded-xl hover:bg-[#E9E3FF] cursor-pointer transition-all group mb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-0.5">{t("careEvents.wizard.routeAdminLabel")}</p>
                        {dosagePart === "oral" ? (
                          <p className="text-sm font-bold text-[#2B3674]">{t("careEvents.wizard.oralUnitsPerDose", { count: quantity !== "" ? quantity : "-" })}</p>
                        ) : (
                          <p className="text-sm font-bold text-[#2B3674]">{t("careEvents.wizard.otherRouteIntake", { method: intakeMethod || t("careEvents.wizard.notSet") })}</p>
                        )}
                      </div>
                      <span className="text-xs text-[#4318FF] opacity-0 group-hover:opacity-100 transition-opacity">{t("careEvents.wizard.edit")}</span>
                    </div>
                  </div>

                  {/* Schedule */}
                  <div onClick={() => { setShowConfirmModal(false); handleEditField(3); }} className="p-4 bg-[#F4F7FE] rounded-xl hover:bg-[#E9E3FF] cursor-pointer transition-all group mb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-0.5">{t("careEvents.wizard.scheduleLabel")}</p>
                        <p className="text-sm font-bold text-[#2B3674]">
                          {t("careEvents.wizard.scheduleFrom", {
                            start: startDate,
                            end: isNeverEnding ? t("careEvents.wizard.scheduleOngoing") : endDate ? t("careEvents.wizard.scheduleTo", { end: endDate }) : "",
                          })}
                        </p>
                        <p className="text-xs text-[#A3AED0] mt-0.5">
                          {translateRecurrence(recurrence, startDate)}
                        </p>
                      </div>
                      <span className="text-xs text-[#4318FF] opacity-0 group-hover:opacity-100 transition-opacity">{t("careEvents.wizard.edit")}</span>
                    </div>
                  </div>

                  {/* Frequency + Meal Timing */}
                  <div onClick={() => { setShowConfirmModal(false); handleEditField(4); }} className="p-4 bg-[#F4F7FE] rounded-xl hover:bg-[#E9E3FF] cursor-pointer transition-all group mb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-0.5">{t("careEvents.wizard.frequencyLabel")}</p>
                        <p className="text-sm font-bold text-[#2B3674]">{t("careEvents.wizard.frequencyAndTiming", { frequency: translateFrequency(frequency), mealTiming: translateEnum("mealTiming", mealTiming) })}</p>
                      </div>
                      <span className="text-xs text-[#4318FF] opacity-0 group-hover:opacity-100 transition-opacity">{t("careEvents.wizard.edit")}</span>
                    </div>
                  </div>

                  {/* Scheduled Times (auto-calculated, inline-editable) */}
                  <div className={`p-4 rounded-xl transition-all mb-3 ${expandMealEdit ? "bg-[#E9E3FF]/60 border border-[#4318FF]/20" : "bg-[#F4F7FE]"}`}>
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest">{t("careEvents.wizard.scheduledTimesLabel")}</p>
                      <button
                        type="button"
                        onClick={() => setExpandMealEdit(v => !v)}
                        className="text-xs font-bold text-[#4318FF] hover:underline shrink-0 ml-3"
                      >
                        {expandMealEdit ? t("careEvents.wizard.done") : t("careEvents.wizard.edit")}
                      </button>
                    </div>

                    {/* Dose time summary */}
                    <div className="space-y-1.5 mb-3">
                      {calculatedTimes.map((time, idx) => {
                        const meal = orderedMealsForTimes[idx];
                        const offsetLabel =
                          mealTiming === "before meals"
                            ? t("careEvents.wizard.offsetBefore")
                            : mealTiming === "after meals"
                            ? t("careEvents.wizard.offsetAfter")
                            : t("careEvents.wizard.offsetWith");
                        return (
                          <div key={idx} className="flex items-center justify-between">
                            <span className="text-sm font-bold text-[#2B3674]">{t("careEvents.wizard.dosePreview", { num: idx + 1, time: hhmmTo12h(time) })}</span>
                            <span className="text-xs text-[#A3AED0]">{offsetLabel} {mealLabel(meal) ?? meal}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Inline meal anchor editor */}
                    {expandMealEdit && (
                      <div className="border-t border-[#4318FF]/10 pt-3 space-y-2">
                        <p className="text-[11px] font-bold text-[#4318FF] mb-2">
                          {t("careEvents.wizard.changeMealAnchors", { count: parseInt(frequency.match(/\d+/)?.[0] || "1") })}
                        </p>
                        {(["BREAKFAST", "LUNCH", "DINNER"] as const).map(meal => {
                          const entry = (mealSchedules.length > 0 ? mealSchedules : DEFAULT_MEAL_TIMES).find(e => e.mealType === meal)!;
                          const isSelected = selectedMeals.includes(meal);
                          const requiredCount = parseInt(frequency.match(/\d+/)?.[0] || "1");
                          const canSelect = isSelected || selectedMeals.length < requiredCount;
                          return (
                            <button
                              key={meal}
                              type="button"
                              disabled={!canSelect}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedMeals(prev => prev.filter(m => m !== meal));
                                } else if (canSelect) {
                                  setSelectedMeals(prev => [...prev, meal]);
                                }
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all border-2 ${
                                isSelected
                                  ? "bg-[#4318FF] text-white border-[#4318FF]"
                                  : canSelect
                                  ? "bg-white text-[#2B3674] border-transparent hover:border-[#4318FF]/30"
                                  : "bg-white text-[#A3AED0] border-transparent opacity-50 cursor-not-allowed"
                              }`}
                            >
                              <span>{mealLabel(meal)}</span>
                              <span className={`text-xs ${isSelected ? "text-white/80" : "text-[#A3AED0]"}`}>
                                {hhmmTo12h(entry.mealTime)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {ocrResult && !ocrResult.error && dose.trim().toLowerCase() !== ocrResult.dose.toLowerCase() && (
                    <label className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 cursor-pointer select-none mb-4">
                      <input
                        type="checkbox"
                        checked={dosageMismatchAcked}
                        onChange={(e) => setDosageMismatchAcked(e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-orange-500 shrink-0"
                      />
                      <span className="text-xs text-orange-700 leading-relaxed">
                        {t("careEvents.wizard.dosageMismatchAck", { label: ocrResult.dose || "—", entered: dose || "—" })}
                      </span>
                    </label>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowConfirmModal(false)}
                      className="flex-1 py-4 bg-[#F4F7FE] hover:bg-[#E9E3FF] text-[#4318FF] font-bold rounded-xl transition-all active:scale-[0.98]"
                    >
                      {t("careEvents.wizard.backToEdit")}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleSaveMedication(e)}
                      disabled={isSavingMed || (ocrResult != null && !ocrResult.error && dose.trim().toLowerCase() !== ocrResult.dose.toLowerCase() && !dosageMismatchAcked)}
                      className="flex-1 py-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSavingMed && <Loader2 className="w-4 h-4 animate-spin" />}
                      {isSavingMed ? t("careEvents.saving") : t("careEvents.confirmSave")}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>


          {/* Right column wrapper */}
          <div className="h-full">

          {/* Medication List */}
          <div className="bg-white rounded-[26px] p-6 border border-[#EEEAFB] shadow-[0_4px_24px_-16px_rgba(67,24,255,0.12)] h-[480px] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 mb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <Pill className="w-4 h-4 text-[#4318FF]" />
                <h2 className="text-[18px] font-extrabold tracking-tight text-[#1F2247]">{t("careEvents.wizard.medicationListTitle")}</h2>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#EDE9FE] text-[#4318FF] text-[10px] font-extrabold uppercase tracking-widest">
                {t("careEvents.wizard.activeCount", { count: meds.length })}
              </span>
            </div>

            {/* Search */}
            <div className="relative mb-3 shrink-0">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A3AED0] pointer-events-none" />
              <input
                value={medSearch}
                onChange={e => setMedSearch(e.target.value)}
                placeholder={t("careEvents.medSearchPlaceholder")}
                className="w-full pl-9 pr-3 py-2.5 bg-[#F8F6FF] border border-[#EEEAFB] rounded-xl text-[12px] font-bold text-[#1F2247] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/30 placeholder:text-[#A3AED0] placeholder:font-medium"
              />
            </div>

            {/* List */}
            <div className="space-y-2 overflow-y-auto flex-1 min-h-0 pr-1">
              {careEventsLoading ? (
                <ListSkeleton rows={4} />
              ) : (() => {
                const todayStr = getMYTDateString();
                const q = medSearch.trim().toLowerCase();
                const filtered = [...meds]
                  .filter(m => !m.endDate || m.endDate >= todayStr)
                  .filter(m => !q || m.name.toLowerCase().includes(q) || m.dose.toLowerCase().includes(q))
                  .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));

                // Group by planId so all reminder times for the same plan collapse into one row.
                // Fall back to a per-entry key for locally-added meds without a planId.
                const groupMap = new Map<number | string, typeof filtered>();
                filtered.forEach(m => {
                  const key = m.planId ?? `local-${m.id}`;
                  if (!groupMap.has(key)) groupMap.set(key, []);
                  groupMap.get(key)!.push(m);
                });
                const groups = Array.from(groupMap.values());

                if (groups.length === 0) return (
                  <div className="py-10 text-center text-[#A3AED0]">
                    <Pill className="w-7 h-7 mx-auto mb-2 text-[#C4B6FB]" />
                    <p className="text-[12px] font-bold">{medSearch ? t("careEvents.noMedMatch") : t("careEvents.noMedScheduled")}</p>
                  </div>
                );

                return groups.map(group => {
                  const rep = group[0]; // representative entry for name, dose, frequency, schedule
                  const groupKey = rep.planId ?? `local-${rep.id}`;
                  const isExpanded = expandedMedId === rep.id;
                  const times = group.map(m => m.time).filter(Boolean).sort();
                  const isAnyDeleting = group.some(m => deletingMedIds.has(m.remindId ?? m.id));

                  return (
                    <div key={String(groupKey)} className={`rounded-2xl border transition-all ${isExpanded ? "border-[#4318FF]/20 shadow-[0_4px_14px_-8px_rgba(67,24,255,0.18)]" : "bg-white border-[#EEEAFB] hover:border-[#4318FF]/25 hover:shadow-[0_10px_24px_-14px_rgba(67,24,255,0.18)]"}`}>
                      <button type="button" onClick={() => setExpandedMedId(isExpanded ? null : rep.id)} className="w-full p-3.5 text-left">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-[#EDE9FE] flex items-center justify-center text-[#4318FF] shrink-0">
                            <Pill className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-extrabold tracking-tight text-[#1F2247] truncate">{rep.name}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[11px] font-bold text-[#6B7299]">{rep.dose}</span>
                              {rep.frequency && <><span className="w-1 h-1 rounded-full bg-[#A3AED0]" /><span className="text-[11px] font-bold text-[#6B7299]">{translateFrequency(rep.frequency)}</span></>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="flex flex-wrap gap-1 justify-end max-w-[160px]">
                              {times.map((t, i) => (
                                <span key={i} className="font-mono text-[11px] font-extrabold px-2 py-1 rounded-lg bg-[#F8F6FF] border border-[#EEEAFB] text-[#1F2247]">
                                  {hhmmTo12h(t)}
                                </span>
                              ))}
                            </div>
                            {isExpanded
                              ? <ChevronUp className="w-4 h-4 text-[#A3AED0]" />
                              : <ChevronDown className="w-4 h-4 text-[#A3AED0]" />}
                          </div>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-3.5 pb-3.5">
                          <div className="rounded-xl bg-[#F8F6FF] p-3 grid grid-cols-1 min-[400px]:grid-cols-3 gap-3 text-[11px] font-bold mb-3">
                            <div>
                              <p className="uppercase tracking-widest text-[9px] text-[#A3AED0] mb-1">{t("careEvents.wizard.starts")}</p>
                              <p className="text-[#1F2247]">{rep.startDate ? formatDate(new Date(rep.startDate + "T00:00:00"), { day: "numeric", month: "short", year: "numeric" }) : "—"}</p>
                            </div>
                            <div>
                              <p className="uppercase tracking-widest text-[9px] text-[#A3AED0] mb-1">{t("careEvents.wizard.ends")}</p>
                              <p className="text-[#1F2247]">{rep.endDate ? formatDate(new Date(rep.endDate + "T00:00:00"), { day: "numeric", month: "short", year: "numeric" }) : t("careEvents.ongoing")}</p>
                            </div>
                            <div>
                              <p className="uppercase tracking-widest text-[9px] text-[#A3AED0] mb-1">{t("careEvents.wizard.repeat")}</p>
                              <p className="text-[#1F2247]">{translateRecurrence(rep.recurrence, rep.startDate)}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-end">
                            <button
                              type="button"
                              disabled={isAnyDeleting}
                              onClick={async () => {
                                setDeletingMedIds(prev => {
                                  const s = new Set(prev);
                                  group.forEach(m => s.add(m.remindId ?? m.id));
                                  return s;
                                });
                                try {
                                  await Promise.all(group.map(async m => {
                                    if (m.remindId) {
                                      try { await careEventsService.deleteMedication(m.remindId, caregiverId); } catch { /* ignore */ }
                                    }
                                    deleteMed(m.id);
                                  }));
                                  setExpandedMedId(null);
                                } finally {
                                  setDeletingMedIds(prev => {
                                    const s = new Set(prev);
                                    group.forEach(m => s.delete(m.remindId ?? m.id));
                                    return s;
                                  });
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-extrabold bg-white border border-red-100 hover:bg-red-50 text-red-500 transition flex items-center gap-1.5 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                            >
                              {isAnyDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                              {t("careEvents.wizard.remove")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          </div>{/* End right column wrapper */}

        </div>

        {/* History Section */}
        {/* <HistorySection
          events={events}
          onTogglePin={togglePin}
          onReuse={handleReuse}
        /> */}

        {/* -- NEW ROW: Location & Environment + AI Activity Suggestions -- */}
        <div id="environment-section" className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">

          {/* Location & Environment */}
          <div className="bg-white rounded-[20px] p-4 sm:p-6 shadow-[0_18px_40px_rgba(112,144,176,0.12)] border border-[#EEEAFB] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between gap-3 mb-5 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#F4F7FE] border border-[#EEEAFB] flex items-center justify-center text-[#4318FF] shadow-sm">
                  <MapPin className="w-[18px] h-[18px]" strokeWidth={2.4} />
                </div>
                <h2 className="text-[20px] font-extrabold tracking-tight text-[#1F2247]">{t("careEvents.environment.title")}</h2>
              </div>
              <button
                type="button"
                onClick={handleGetLocation}
                disabled={weatherLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#4318FF] to-[#7B5CFF] shadow-[0_8px_20px_-8px_rgba(67,24,255,0.55)] hover:shadow-[0_10px_24px_-8px_rgba(67,24,255,0.65)] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {weatherLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {t("careEvents.environment.locating")}</>
                ) : (
                  <><MapPin className="w-4 h-4" /> {t("careEvents.environment.getLocation")}</>
                )}
              </button>
            </div>

            {weatherLoading && (
              <SectionSpinner minHeightClass="min-h-[200px]" className="flex-1" />
            )}

            {/* Error state */}
            {!weatherLoading && weatherError && (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4 gap-3 py-8">
                <AlertCircle className="w-10 h-10 text-amber-400" />
                <p className="text-sm font-bold text-[#1F2247]">{weatherError}</p>
              </div>
            )}

            {/* Initial empty state */}
            {!weatherLoading && !weatherError && !weatherData && (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4 gap-3 py-8">
                <MapPin className="w-10 h-10 text-[#C4B6FB]" />
                <p className="text-[13px] font-semibold text-[#A3AED0] max-w-xs">
                  {t("careEvents.environment.emptyHint")}
                </p>
              </div>
            )}

            {/* Weather data */}
            {!weatherLoading && weatherData && (() => {
              const tone = getEnvTone(weatherData.temperature ?? 22, weatherData.weather, weatherData.aqi);
              const note = ENV_NOTE_STYLE[tone];
              return (
                <>
                  <div className="grid grid-cols-1 min-[400px]:grid-cols-3 gap-3 mb-5">
                    {/* Temperature */}
                    <div className="bg-white rounded-2xl p-4 border border-[#EEEAFB] shadow-[0_4px_18px_-12px_rgba(67,24,255,0.18)]">
                      <div className="flex items-center gap-2 mb-3">
                        <Sun className="w-4 h-4 text-orange-400" strokeWidth={2.4} />
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#A3AED0]">{t("careEvents.environment.temperature")}</span>
                      </div>
                      <p className="text-[22px] font-extrabold text-[#1F2247] leading-none">{Math.round(weatherData.temperature ?? 0)}°C</p>
                    </div>
                    {/* Weather */}
                    <div className="bg-white rounded-2xl p-4 border border-[#EEEAFB] shadow-[0_4px_18px_-12px_rgba(67,24,255,0.18)]">
                      <div className="flex items-center gap-2 mb-3">
                        <Cloud className="w-4 h-4 text-sky-400" strokeWidth={2.4} />
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#A3AED0]">{t("careEvents.environment.weather")}</span>
                      </div>
                      <p className="text-[16px] font-extrabold text-[#1F2247] leading-tight">{weatherData.weather}</p>
                    </div>
                    {/* AQI */}
                    <div className="bg-white rounded-2xl p-4 border border-[#EEEAFB] shadow-[0_4px_18px_-12px_rgba(67,24,255,0.18)]">
                      <div className="flex items-center gap-2 mb-3">
                        <Wind className="w-4 h-4 text-emerald-500" strokeWidth={2.4} />
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#A3AED0]">{t("careEvents.environment.aqi")}</span>
                      </div>
                      <p className="text-[22px] font-extrabold text-[#1F2247] leading-none">{weatherData.aqi ?? "—"}</p>
                      {weatherData.aqi === null && (
                        <p className="text-[10px] text-[#A3AED0] font-bold mt-1">{t("careEvents.environment.aqiUnavailable")}</p>
                      )}
                    </div>
                  </div>

                  {/* Adaptive note */}
                  <div className={`rounded-2xl p-4 flex items-start gap-3 border ${note.bg}`}>
                    <Info className={`w-4 h-4 mt-0.5 shrink-0 ${note.icon}`} strokeWidth={2.4} />
                    <p className={`text-[13px] leading-relaxed font-semibold ${note.text}`}>{t(note.msgKey)}</p>
                  </div>
                </>
              );
            })()}
          </div>

          {/* AI Activity Suggestions */}
          <div className="bg-white rounded-[20px] p-4 sm:p-6 shadow-[0_18px_40px_rgba(112,144,176,0.12)] border border-[#EEEAFB] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between gap-3 mb-5 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#F4F7FE] border border-[#EEEAFB] flex items-center justify-center text-[#7B2CBF] shadow-sm">
                  <Sparkles className="w-[18px] h-[18px]" strokeWidth={2.4} />
                </div>
                <h2 className="text-[20px] font-extrabold tracking-tight text-[#1F2247]">{t("careEvents.aiSuggestions.title")}</h2>
              </div>
              {aiSuggestions && aiSuggestions.length > 0 ? (
                <span className="px-2.5 py-1 rounded-full bg-[#F5F3FF] border border-[#EEEAFB] text-[#7B2CBF] text-[10px] font-extrabold uppercase tracking-widest">
                  {t("careEvents.aiSuggestions.ideasCount", { count: aiSuggestions.length })}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateSuggestions}
                  disabled={aiSuggestionsLoading || !userLocation}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#4318FF] to-[#7B5CFF] shadow-[0_8px_20px_-8px_rgba(67,24,255,0.55)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {aiSuggestionsLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("careEvents.aiSuggestions.generating")}</>
                    : <><Sparkles className="w-4 h-4" /> {t("careEvents.aiSuggestions.generate")}</>}
                </button>
              )}
            </div>

            {/* Empty / initial */}
            {!aiSuggestionsLoading && !aiSuggestions && !aiSuggestionsError && (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-4 py-8">
                <div className="w-14 h-14 rounded-2xl bg-[#F4F7FE] border border-[#EEEAFB] flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-[#7B2CBF]" />
                </div>
                <div>
                  <p className="text-[14px] font-extrabold text-[#1F2247] mb-1">{t("careEvents.aiSuggestions.personalisedTitle")}</p>
                  <p className="text-[12px] font-semibold text-[#A3AED0] max-w-xs">
                    {userLocation
                      ? t("careEvents.aiSuggestions.emptyWithLocation")
                      : t("careEvents.aiSuggestions.emptyNoLocation")}
                  </p>
                </div>
              </div>
            )}

            {/* Error */}
            {!aiSuggestionsLoading && aiSuggestionsError && (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4 gap-3 py-8">
                <AlertCircle className="w-8 h-8 text-red-400" />
                <p className="text-[13px] font-bold text-[#1F2247]">{aiSuggestionsError}</p>
              </div>
            )}

            {/* Loading */}
            {aiSuggestionsLoading && (
              <div className="flex-1 flex items-center justify-center gap-3 py-8">
                <Loader2 className="w-7 h-7 text-[#7B2CBF] animate-spin" />
                <p className="text-[13px] font-bold text-[#A3AED0]">{t("careEvents.aiSuggestions.loading")}</p>
              </div>
            )}

            {/* Suggestions list */}
            {!aiSuggestionsLoading && aiSuggestions && aiSuggestions.length > 0 && (
              <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-1" style={{scrollbarWidth:"thin", scrollbarColor:"#E0E5F2 transparent"}}>
                {aiSuggestions.map((s, idx) => {
                  const key = `${s.eventName}-${s.startTime}`;
                  const isProcessing = feedbackInProgress.has(key);
                  const isEditing = editingAiSuggestionIndex === idx;
                  const tags = getSuggestionTags(s, t, weatherData?.aqi ?? undefined);
                  const displayTime = formatMealDisplayTime(normalizeHmTime(s.startTime));
                  return (
                    <motion.div
                      key={key}
                      className="group bg-white rounded-2xl p-4 border border-[#F1E6FF] hover:border-[#7B2CBF]/30 hover:shadow-[0_12px_28px_-16px_rgba(123,44,191,0.30)] transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-extrabold tracking-tight text-[#1F2247] leading-snug">{s.eventName}</p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {tags.map(([label, style]) => (
                              <span key={label} className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${style}`}>{label}</span>
                            ))}
                            {(() => {
                              const conflict = aiSuggestionConflicts.get(key);
                              if (!conflict) return null;
                              return (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-700 border border-amber-300">
                                  <TriangleAlert className="w-2.5 h-2.5" />
                                  {t("careEvents.aiSuggestions.conflictWith", { title: conflict.title })}
                                </span>
                              );
                            })()}
                          </div>
                          <p className="text-[12px] font-semibold text-[#A3AED0] mt-2 leading-relaxed line-clamp-2">{s.remark}</p>
                          {isEditing && aiSuggestionEditDraft ? (
                            <div className="mt-3 bg-[#F8F6FF] rounded-xl px-3 py-2.5 border border-[#4318FF]/20 space-y-2">
                              <p className="text-[10px] font-bold text-[#4318FF] uppercase tracking-widest">
                                {t("careEvents.aiSuggestions.editTime")}
                              </p>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <select
                                  value={aiSuggestionEditDraft.editHour}
                                  onChange={(e) => setAiSuggestionEditField("editHour", e.target.value)}
                                  className="w-[52px] px-2 py-1.5 bg-white border border-[#E0E5F2] rounded-lg text-xs font-bold text-[#1F2247] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/30"
                                >
                                  {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                                </select>
                                <span className="text-[#4318FF] font-bold text-sm">:</span>
                                <select
                                  value={aiSuggestionEditDraft.editMinute}
                                  onChange={(e) => setAiSuggestionEditField("editMinute", e.target.value)}
                                  className="w-[52px] px-2 py-1.5 bg-white border border-[#E0E5F2] rounded-lg text-xs font-bold text-[#1F2247] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/30"
                                >
                                  {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
                                </select>
                                <div className="flex rounded-lg overflow-hidden border border-[#4318FF]/30">
                                  {(["AM", "PM"] as const).map((p) => (
                                    <button
                                      key={p}
                                      type="button"
                                      onClick={() => setAiSuggestionEditField("editPeriod", p)}
                                      className={`px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer
                                        ${aiSuggestionEditDraft.editPeriod === p
                                          ? "bg-[#4318FF] text-white"
                                          : "bg-white text-[#A3AED0] hover:bg-[#F4F2FF]"}`}
                                    >
                                      {formatPeriodLabel(p)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <p className="text-[10px] font-semibold text-[#A3AED0]">
                                {t("careEvents.aiSuggestions.durationMin", { minutes: s.durationMinutes })}
                              </p>
                              <div className="flex gap-2 pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => saveAiSuggestionEdit(idx)}
                                  className="flex-1 py-1.5 rounded-lg bg-[#4318FF] text-white text-xs font-bold hover:bg-[#3311DB] transition-colors"
                                >
                                  {t("common.save")}
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelAiSuggestionEdit}
                                  className="flex-1 py-1.5 rounded-lg bg-white border border-[#E0E5F2] text-[#707EAE] text-xs font-bold hover:bg-[#F4F7FE] transition-colors"
                                >
                                  {t("common.cancel")}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] font-bold text-[#A3AED0] mt-1">
                              {t("careEvents.aiSuggestions.timeAndDuration", {
                                time: displayTime,
                                minutes: s.durationMinutes,
                              })}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button
                            type="button"
                            title={t("careEvents.aiSuggestions.editTime")}
                            onClick={() => startAiSuggestionEdit(idx)}
                            disabled={isProcessing || isEditing}
                            className="w-8 h-8 rounded-lg flex items-center justify-center bg-white border border-[#E0E5F2] text-[#A3AED0] hover:bg-[#F4F2FF] hover:text-[#4318FF] hover:border-[#4318FF]/30 transition-all disabled:opacity-50"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title={t("careEvents.aiSuggestions.addToEvents")}
                            onClick={() => handleFeedback(s, "accept")}
                            disabled={isProcessing || isEditing}
                            className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-[#4318FF] to-[#7B5CFF] text-white shadow-[0_6px_14px_-6px_rgba(67,24,255,0.55)] hover:shadow-[0_8px_18px_-6px_rgba(67,24,255,0.65)] active:scale-95 transition-all disabled:opacity-50"
                          >
                            {isProcessing
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Plus className="w-3.5 h-3.5" strokeWidth={3} />}
                          </button>
                          {/* Reject */}
                          <button
                            type="button"
                            title={t("careEvents.aiSuggestions.reject")}
                            onClick={() => handleFeedback(s, "reject")}
                            disabled={isProcessing || isEditing}
                            className="w-8 h-8 rounded-lg flex items-center justify-center bg-white border border-[#FFE2E2] text-rose-500 hover:bg-rose-50 hover:border-rose-200 transition-all disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" strokeWidth={2.8} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* All processed */}
            {!aiSuggestionsLoading && aiSuggestions && aiSuggestions.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4 gap-3 py-8">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                  <Check className="w-6 h-6 text-emerald-500" strokeWidth={2.4} />
                </div>
                <p className="text-[14px] font-extrabold text-[#1F2247]">All suggestions reviewed!</p>
                <button
                  type="button"
                  onClick={handleGenerateSuggestions}
                  className="text-[12px] font-bold text-[#7B2CBF] underline"
                >
                  {t("careEvents.aiSuggestions.generateNew")}
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Combined Events Row */}
        <div id="events-section" className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start">

          {/* Left: Combined Add Event Form */}
          <div ref={eventFormRef} className="bg-white rounded-[20px] p-4 sm:p-6 shadow-[0_18px_40px_rgba(112,144,176,0.12)] border-none relative h-[680px] flex flex-col min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-[#2B3674] mb-4 flex items-center gap-2 shrink-0">
              <Plus className="w-5 h-5 text-[#4318FF]" /> {t("careEvents.addEventHeader")}
            </h2>

            {/* Tab bar */}
            <div className="flex flex-col sm:flex-row gap-1 p-1 bg-[#F4F7FE] rounded-2xl mb-6 shrink-0">
              {([
                { id: "caregiver" as const, label: t("careEvents.caregiverEventsTab"),       icon: <Calendar className="w-3.5 h-3.5" />, activeClass: "bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] text-white shadow-sm" },
                { id: "care"      as const, label: t("careEvents.patientCareEventsTab"),    icon: <Heart className="w-3.5 h-3.5" />,    activeClass: "bg-gradient-to-r from-orange-400 to-orange-500 text-white shadow-sm" },
                { id: "outdoor"   as const, label: t("careEvents.patientOutdoorEventsTab"), icon: <MapPin className="w-3.5 h-3.5" />,   activeClass: "bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-sm" },
              ]).map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveEventTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all cursor-pointer min-h-11 ${activeEventTab === tab.id ? tab.activeClass : "text-[#A3AED0] hover:text-[#2B3674]"}`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 px-1 pb-1">

            {/* -- Caregiver Event Form -- */}
            {activeEventTab === "caregiver" && (
              <form onSubmit={handleSaveCaregiverEvent} className="space-y-5">
                <div>
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">{t("careEvents.eventForm.eventTitle")}</label>
                  <input
                    type="text"
                    value={caregiverEventTitle}
                    onChange={(e) => setCaregiverEventTitle(e.target.value)}
                    placeholder={`${t("common.eg")} ${t("careEvents.wizard.groceryShopping")}`}
                    className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/40 transition-all placeholder:text-[#A3AED0] placeholder:font-normal"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">
                    <Calendar className="w-3.5 h-3.5 inline mr-1" />{t("careEvents.wizard.startDateLabel")}
                  </label>
                  <input
                    type="date"
                    value={caregiverEventStartDate}
                    onChange={(e) => setCaregiverEventStartDate(e.target.value)}
                    className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/40 transition-all"
                  />
                </div>
                <div
                  className="flex items-center justify-between p-4 bg-[#F4F7FE] rounded-xl cursor-pointer select-none"
                  onClick={() => { const on = caregiverEventIsNeverEnding; setCaregiverEventIsNeverEnding(v => !v); setCaregiverEventRecurrence(on ? "daily" : "none"); }}
                >
                  <div>
                    <p className="text-sm font-bold text-[#2B3674]">{t("careEvents.wizard.endDateTitle")}</p>
                    <p className="text-xs text-[#A3AED0] mt-0.5">{t("careEvents.eventForm.endDateForEvent")}</p>
                  </div>
                  <div className={`w-11 h-6 rounded-full transition-all relative ${!caregiverEventIsNeverEnding ? "bg-gradient-to-r from-[#4318FF] to-[#8B5CF6]" : "bg-[#E0E5F2]"}`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${!caregiverEventIsNeverEnding ? "left-6" : "left-1"}`} />
                  </div>
                </div>
                {!caregiverEventIsNeverEnding && (
                  <div>
                    <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">{t("careEvents.wizard.endDateLabel")}</label>
                    <input type="date" value={caregiverEventEndDate} min={caregiverEventStartDate} onChange={(e) => setCaregiverEventEndDate(e.target.value)} className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/40 transition-all" />
                  </div>
                )}
                {!caregiverEventIsNeverEnding && (
                  <div>
                    <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-3 block ml-1">{t("careEvents.wizard.repeat")}</label>
                    <div className="space-y-2">
                      {([
                        { value: "daily",    label: t("careEvents.daily") },
                        { value: "weekdays", label: t("careEvents.weekdays") },
                        { value: "weekly",   label: t("enums.recurrence.weekly", { day: getDayName(caregiverEventStartDate) }) },
                      ] as { value: "daily" | "weekdays" | "weekly"; label: string }[]).map(opt => (
                        <label key={opt.value} className={`flex items-center gap-3 p-3.5 rounded-xl transition-all cursor-pointer ${caregiverEventRecurrence === opt.value ? "bg-[#E9E3FF] border border-[#4318FF]/30" : "bg-[#F4F7FE] hover:bg-[#E9E3FF]/50"}`}>
                          <input type="radio" name="caregiverRecurrence" value={opt.value} checked={caregiverEventRecurrence === opt.value} onChange={() => setCaregiverEventRecurrence(opt.value)} className="accent-[#4318FF] w-4 h-4" />
                          <span className="text-sm font-bold text-[#2B3674]">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-3 block ml-1">
                    {t("careEvents.eventForm.eventTime", { time: formatDisplayTime(caregiverEventTimeHour, caregiverEventTimeMinute, caregiverEventTimePeriod) })}
                  </label>
                  <div className="p-4 bg-[#F4F7FE] rounded-xl">
                    <div className="grid grid-cols-1 min-[400px]:grid-cols-3 gap-2">
                      <div><p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">{t("careEvents.wizard.hour")}</p><select value={caregiverEventTimeHour} onChange={(e) => setCaregiverEventTimeHour(e.target.value)} className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/40">{HOURS.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                      <div><p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">{t("careEvents.wizard.min")}</p><select value={caregiverEventTimeMinute} onChange={(e) => setCaregiverEventTimeMinute(e.target.value)} className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/40">{MINUTES.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                      <div><p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">{t("careEvents.wizard.period")}</p><div className="flex rounded-lg overflow-hidden border border-[#E0E5F2]">{["AM","PM"].map(p => <button key={p} type="button" onClick={() => setCaregiverEventTimePeriod(p)} className={`flex-1 py-2.5 text-xs font-bold transition-all cursor-pointer ${caregiverEventTimePeriod === p ? "bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] text-white" : "bg-white text-[#A3AED0] hover:bg-[#F8F7FF]"}`}>{formatPeriodLabel(p as "AM" | "PM")}</button>)}</div></div>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-3 block ml-1">
                    {t("careEvents.eventForm.endTime", { time: formatDisplayTime(caregiverEventEndTimeHour, caregiverEventEndTimeMinute, caregiverEventEndTimePeriod) })}
                  </label>
                  <div className="p-4 bg-[#F4F7FE] rounded-xl">
                    <div className="grid grid-cols-1 min-[400px]:grid-cols-3 gap-2">
                      <div><p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">{t("careEvents.wizard.hour")}</p><select value={caregiverEventEndTimeHour} onChange={(e) => setCaregiverEventEndTimeHour(e.target.value)} className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/40">{HOURS.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                      <div><p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">{t("careEvents.wizard.min")}</p><select value={caregiverEventEndTimeMinute} onChange={(e) => setCaregiverEventEndTimeMinute(e.target.value)} className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/40">{MINUTES.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                      <div><p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">{t("careEvents.wizard.period")}</p><div className="flex rounded-lg overflow-hidden border border-[#E0E5F2]">{["AM","PM"].map(p => <button key={p} type="button" onClick={() => setCaregiverEventEndTimePeriod(p)} className={`flex-1 py-2.5 text-xs font-bold transition-all cursor-pointer ${caregiverEventEndTimePeriod === p ? "bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] text-white" : "bg-white text-[#A3AED0] hover:bg-[#F8F7FF]"}`}>{formatPeriodLabel(p as "AM" | "PM")}</button>)}</div></div>
                    </div>
                  </div>
                </div>
                <button type="submit" disabled={isSavingCaregiver} className="w-full py-4 mt-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {isSavingCaregiver && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSavingCaregiver ? t("careEvents.saving") : t("careEvents.saveCaregiverEvent")}
                </button>
              </form>
            )}

            {/* -- Care Event Form -- */}
            {activeEventTab === "care" && (
              <form onSubmit={handleSaveCareEvent} className="space-y-5">
              <div className="relative z-10">
                <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">{t("careEvents.eventForm.eventTitle")}</label>
                <input
                  ref={careTypeInputRef}
                  type="text"
                  value={careEventType}
                  onChange={(e) => { setCareEventType(e.target.value); setShowCareTypeDropdown(true); }}
                  onFocus={() => setShowCareTypeDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCareTypeDropdown(false), 200)}
                  placeholder={`${t("common.eg")} ${t("careEvents.bathing")}`}
                  className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all placeholder:text-[#A3AED0]"
                />
                <AnimatePresence>
                  {showCareTypeDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-[70px] left-0 right-0 bg-white rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-slate-100 p-2 max-h-48 overflow-y-auto z-50"
                    >
                      {CARE_EVENT_TYPES.map(type => (
                        <div
                          key={type}
                          onClick={() => { setCareEventType(type); setShowCareTypeDropdown(false); }}
                          className="px-4 py-2 hover:bg-orange-50 rounded-lg cursor-pointer text-sm font-semibold text-slate-700 hover:text-orange-700"
                        >
                          {translateEventType(type, CARE_EVENT_TYPE_KEYS)}
                        </div>
                      ))}
                      <div
                        key="custom"
                        onClick={() => { setCareEventType(""); setShowCareTypeDropdown(false); setTimeout(() => careTypeInputRef.current?.focus(), 0); }}
                        className="px-4 py-2 mt-1 border-t border-slate-100 hover:bg-orange-50 rounded-lg cursor-pointer text-sm font-semibold text-orange-500 hover:text-orange-700"
                      >
                        {t("careEvents.customTypeOption")}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Start Date */}
              <div>
                <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">
                  <Calendar className="w-3.5 h-3.5 inline mr-1" />{t("careEvents.wizard.startDateLabel")}
                </label>
                <input
                  type="date"
                  value={careEventStartDate}
                  onChange={(e) => setCareEventStartDate(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                />
              </div>

              {/* End date toggle */}
              <div
                className="flex items-center justify-between p-4 bg-[#F4F7FE] rounded-xl cursor-pointer select-none"
                onClick={() => {
                  const turningOn = careEventIsNeverEnding;
                  setCareEventIsNeverEnding(v => !v);
                  setCareEventRecurrence(turningOn ? "daily" : "none");
                }}
              >
                <div>
                  <p className="text-sm font-bold text-[#2B3674]">{t("careEvents.wizard.endDateTitle")}</p>
                  <p className="text-xs text-[#A3AED0] mt-0.5">{t("careEvents.eventForm.endDateForEvent")}</p>
                </div>
                <div className={`w-11 h-6 rounded-full transition-all relative ${!careEventIsNeverEnding ? "bg-orange-500" : "bg-[#E0E5F2]"}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${!careEventIsNeverEnding ? "left-6" : "left-1"}`} />
                </div>
              </div>

              {/* End date */}
              {!careEventIsNeverEnding && (
                <div>
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">End Date</label>
                  <input
                    type="date"
                    value={careEventEndDate}
                    min={careEventStartDate}
                    onChange={(e) => setCareEventEndDate(e.target.value)}
                    className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                  />
                </div>
              )}

              {/* Repeat */}
              {!careEventIsNeverEnding && (
                <div>
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-3 block ml-1">{t("careEvents.wizard.repeat")}</label>
                  <div className="space-y-2">
                    {([
                      { value: "daily", label: t("careEvents.daily") },
                      { value: "weekdays", label: t("careEvents.weekdays") },
                      { value: "weekly", label: t("enums.recurrence.weekly", { day: getDayName(careEventStartDate) }) },
                    ] as { value: "daily" | "weekdays" | "weekly"; label: string }[]).map(opt => (
                      <label
                        key={opt.value}
                        className={`flex items-center gap-3 p-3.5 rounded-xl transition-all cursor-pointer ${careEventRecurrence === opt.value ? "bg-orange-50 border border-orange-400/30" : "bg-[#F4F7FE] hover:bg-orange-50/50"}`}
                      >
                        <input
                          type="radio"
                          name="careRecurrence"
                          value={opt.value}
                          checked={careEventRecurrence === opt.value}
                          onChange={() => setCareEventRecurrence(opt.value)}
                          className="accent-orange-500 w-4 h-4"
                        />
                        <span className="text-sm font-bold text-[#2B3674]">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Event Time */}
              <div>
                <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-3 block ml-1">
                  {t("careEvents.eventForm.eventTime", { time: formatDisplayTime(careEventTimeHour, careEventTimeMinute, careEventTimePeriod) })}
                </label>
                <div className="p-4 bg-[#F4F7FE] rounded-xl">
                  <div className="grid grid-cols-1 min-[400px]:grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">{t("careEvents.wizard.hour")}</p>
                      <select
                        value={careEventTimeHour}
                        onChange={(e) => setCareEventTimeHour(e.target.value)}
                        className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      >
                        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">{t("careEvents.wizard.min")}</p>
                      <select
                        value={careEventTimeMinute}
                        onChange={(e) => setCareEventTimeMinute(e.target.value)}
                        className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      >
                        {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">{t("careEvents.wizard.period")}</p>
                      <div className="flex rounded-lg overflow-hidden border border-[#E0E5F2]">
                        {["AM", "PM"].map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setCareEventTimePeriod(p)}
                            className={`flex-1 py-2.5 text-xs font-bold transition-all ${careEventTimePeriod === p ? "bg-orange-500 text-white" : "bg-white text-[#A3AED0] hover:bg-orange-50"}`}
                          >
                                {formatPeriodLabel(p as "AM" | "PM")}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* End Time */}
              <div>
                <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-3 block ml-1">
                  {t("careEvents.eventForm.endTime", { time: formatDisplayTime(careEventEndTimeHour, careEventEndTimeMinute, careEventEndTimePeriod) })}
                </label>
                <div className="p-4 bg-[#F4F7FE] rounded-xl">
                  <div className="grid grid-cols-1 min-[400px]:grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">{t("careEvents.wizard.hour")}</p>
                      <select
                        value={careEventEndTimeHour}
                        onChange={(e) => setCareEventEndTimeHour(e.target.value)}
                        className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      >
                        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">{t("careEvents.wizard.min")}</p>
                      <select
                        value={careEventEndTimeMinute}
                        onChange={(e) => setCareEventEndTimeMinute(e.target.value)}
                        className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      >
                        {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">{t("careEvents.wizard.period")}</p>
                      <div className="flex rounded-lg overflow-hidden border border-[#E0E5F2]">
                        {["AM", "PM"].map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setCareEventEndTimePeriod(p)}
                            className={`flex-1 py-2.5 text-xs font-bold transition-all ${careEventEndTimePeriod === p ? "bg-orange-500 text-white" : "bg-white text-[#A3AED0] hover:bg-orange-50"}`}
                          >
                                {formatPeriodLabel(p as "AM" | "PM")}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingCare}
                className="w-full py-4 mt-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSavingCare && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSavingCare ? t("careEvents.saving") : t("careEvents.savePatientCareEvent")}
              </button>
            </form>
            )}

            {/* -- Outdoor Event Form -- */}
            {activeEventTab === "outdoor" && (
              <form onSubmit={handleSaveOutdoorEvent} className="space-y-5">
                <div className="relative z-10">
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">{t("careEvents.eventForm.eventTitle")}</label>
                  <input ref={outdoorTypeInputRef} type="text" value={outdoorEventType} onChange={(e) => { setOutdoorEventType(e.target.value); setShowOutdoorTypeDropdown(true); }} onFocus={() => setShowOutdoorTypeDropdown(true)} onBlur={() => setTimeout(() => setShowOutdoorTypeDropdown(false), 200)} placeholder={`${t("common.eg")} ${t("careEvents.doctorAppointment")}`} className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all placeholder:text-[#A3AED0]" />
                  <AnimatePresence>
                    {showOutdoorTypeDropdown && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-[70px] left-0 right-0 bg-white rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-slate-100 p-2 max-h-48 overflow-y-auto z-50">
                        {OUTDOOR_EVENT_TYPES.map(type => (
                          <motion.div key={type} onClick={() => { setOutdoorEventType(type); setShowOutdoorTypeDropdown(false); }} className="px-4 py-2 hover:bg-emerald-50 rounded-lg cursor-pointer text-sm font-semibold text-slate-700 hover:text-emerald-700">{translateEventType(type, OUTDOOR_EVENT_TYPE_KEYS)}</motion.div>
                        ))}
                        <div key="custom" onClick={() => { setOutdoorEventType(""); setShowOutdoorTypeDropdown(false); setTimeout(() => outdoorTypeInputRef.current?.focus(), 0); }} className="px-4 py-2 mt-1 border-t border-slate-100 hover:bg-emerald-50 rounded-lg cursor-pointer text-sm font-semibold text-emerald-600 hover:text-emerald-700">{t("careEvents.customTypeOption")}</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">
                    <Calendar className="w-3.5 h-3.5 inline mr-1" />{t("careEvents.wizard.startDateLabel")}
                  </label>
                  <input type="date" value={outdoorEventStartDate} onChange={(e) => setOutdoorEventStartDate(e.target.value)} className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                </div>
                <div className="flex items-center justify-between p-4 bg-[#F4F7FE] rounded-xl cursor-pointer select-none" onClick={() => { const on = outdoorEventIsNeverEnding; setOutdoorEventIsNeverEnding(v => !v); setOutdoorEventRecurrence(on ? "daily" : "none"); }}>
                  <div>
                    <p className="text-sm font-bold text-[#2B3674]">{t("careEvents.wizard.endDateTitle")}</p>
                    <p className="text-xs text-[#A3AED0] mt-0.5">{t("careEvents.eventForm.endDateForEvent")}</p>
                  </div>
                  <div className={`w-11 h-6 rounded-full transition-all relative ${!outdoorEventIsNeverEnding ? "bg-emerald-500" : "bg-[#E0E5F2]"}`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${!outdoorEventIsNeverEnding ? "left-6" : "left-1"}`} />
                  </div>
                </div>
                {!outdoorEventIsNeverEnding && (
                  <div>
                    <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">{t("careEvents.wizard.endDateLabel")}</label>
                    <input type="date" value={outdoorEventEndDate} min={outdoorEventStartDate} onChange={(e) => setOutdoorEventEndDate(e.target.value)} className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                  </div>
                )}
                {!outdoorEventIsNeverEnding && (
                  <div>
                    <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-3 block ml-1">{t("careEvents.wizard.repeat")}</label>
                    <div className="space-y-2">
                      {([
                        { value: "daily",    label: t("careEvents.daily") },
                        { value: "weekdays", label: t("careEvents.weekdays") },
                        { value: "weekly",   label: t("enums.recurrence.weekly", { day: getDayName(outdoorEventStartDate) }) },
                      ] as { value: "daily" | "weekdays" | "weekly"; label: string }[]).map(opt => (
                        <label key={opt.value} className={`flex items-center gap-3 p-3.5 rounded-xl transition-all cursor-pointer ${outdoorEventRecurrence === opt.value ? "bg-emerald-50 border border-emerald-400/30" : "bg-[#F4F7FE] hover:bg-emerald-50/50"}`}>
                          <input type="radio" name="outdoorRecurrence" value={opt.value} checked={outdoorEventRecurrence === opt.value} onChange={() => setOutdoorEventRecurrence(opt.value)} className="accent-emerald-500 w-4 h-4" />
                          <span className="text-sm font-bold text-[#2B3674]">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-3 block ml-1">
                    {t("careEvents.eventForm.eventTime", { time: formatDisplayTime(outdoorEventTimeHour, outdoorEventTimeMinute, outdoorEventTimePeriod) })}
                  </label>
                  <div className="p-4 bg-[#F4F7FE] rounded-xl">
                    <div className="grid grid-cols-1 min-[400px]:grid-cols-3 gap-2">
                      <div><p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">{t("careEvents.wizard.hour")}</p><select value={outdoorEventTimeHour} onChange={(e) => setOutdoorEventTimeHour(e.target.value)} className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-emerald-500/50">{HOURS.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                      <div><p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">{t("careEvents.wizard.min")}</p><select value={outdoorEventTimeMinute} onChange={(e) => setOutdoorEventTimeMinute(e.target.value)} className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-emerald-500/50">{MINUTES.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                      <div><p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">{t("careEvents.wizard.period")}</p><div className="flex rounded-lg overflow-hidden border border-[#E0E5F2]">{["AM","PM"].map(p => <button key={p} type="button" onClick={() => setOutdoorEventTimePeriod(p)} className={`flex-1 py-2.5 text-xs font-bold transition-all cursor-pointer ${outdoorEventTimePeriod === p ? "bg-emerald-500 text-white" : "bg-white text-[#A3AED0] hover:bg-emerald-50"}`}>{formatPeriodLabel(p as "AM" | "PM")}</button>)}</div></div>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-3 block ml-1">
                    {t("careEvents.eventForm.endTime", { time: formatDisplayTime(outdoorEventEndTimeHour, outdoorEventEndTimeMinute, outdoorEventEndTimePeriod) })}
                  </label>
                  <div className="p-4 bg-[#F4F7FE] rounded-xl">
                    <div className="grid grid-cols-1 min-[400px]:grid-cols-3 gap-2">
                      <div><p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">{t("careEvents.wizard.hour")}</p><select value={outdoorEventEndTimeHour} onChange={(e) => setOutdoorEventEndTimeHour(e.target.value)} className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-emerald-500/50">{HOURS.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                      <div><p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">{t("careEvents.wizard.min")}</p><select value={outdoorEventEndTimeMinute} onChange={(e) => setOutdoorEventEndTimeMinute(e.target.value)} className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-emerald-500/50">{MINUTES.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                      <div><p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">{t("careEvents.wizard.period")}</p><div className="flex rounded-lg overflow-hidden border border-[#E0E5F2]">{["AM","PM"].map(p => <button key={p} type="button" onClick={() => setOutdoorEventEndTimePeriod(p)} className={`flex-1 py-2.5 text-xs font-bold transition-all cursor-pointer ${outdoorEventEndTimePeriod === p ? "bg-emerald-500 text-white" : "bg-white text-[#A3AED0] hover:bg-emerald-50"}`}>{formatPeriodLabel(p as "AM" | "PM")}</button>)}</div></div>
                    </div>
                  </div>
                </div>
                <button type="submit" disabled={isSavingOutdoor} className="w-full py-4 mt-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(16,185,129,0.3)] hover:shadow-[0_6px_25px_rgba(16,185,129,0.4)] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {isSavingOutdoor && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSavingOutdoor ? t("careEvents.saving") : t("careEvents.savePatientOutdoorEvent")}
                </button>
              </form>
            )}
            </div> {/* end scrollable form wrapper */}
          </div>

          {/* Combined Event List */}
          <div className="bg-white rounded-[26px] p-4 sm:p-6 border border-[#EEEAFB] shadow-[0_4px_24px_-16px_rgba(67,24,255,0.12)] h-[680px] flex flex-col min-w-0">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 shrink-0">
              <motion.div className="flex items-center gap-2.5 min-w-0">
                <CalendarHeart className="w-4 h-4 text-[#4318FF] shrink-0" />
                <h2 className="text-base sm:text-[18px] font-extrabold tracking-tight text-[#1F2247]">{t("careEvents.eventList")}</h2>
              </motion.div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hideMealEvents}
                    onChange={e => setHideMealEvents(e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#4318FF] rounded cursor-pointer"
                  />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#6B7299]">{t("careEvents.hideMeals")}</span>
                </label>
                <span className="px-2.5 py-1 rounded-full bg-[#EDE9FE] text-[#4318FF] text-[10px] font-extrabold uppercase tracking-widest">
                  {t("careEvents.eventsCount", { count: filteredCombinedEvents.length })}
                </span>
              </div>
            </div>

            {/* Filter pills */}
            {(() => {
              const PILL_FILTERS = [
                { id: "all"       as const, label: t("careEvents.filterAll"),          color: "#4318FF" },
                { id: "caregiver" as const, label: t("careEvents.filterCaregiver"),    color: "#4318FF" },
                { id: "care"      as const, label: t("careEvents.filterPatientCare"),  color: "#F59E0B" },
                { id: "outdoor"   as const, label: t("careEvents.filterOutdoor"),      color: "#10B981" },
              ];
              const pillCounts: Record<string, number> = {
                all: filteredCombinedEvents.length,
                caregiver: filteredCombinedEvents.filter(e => e.eventKind === "caregiver").length,
                care: filteredCombinedEvents.filter(e => e.eventKind === "care").length,
                outdoor: filteredCombinedEvents.filter(e => e.eventKind === "outdoor").length,
              };
              return (
                <div className="flex gap-1.5 mb-4 flex-wrap shrink-0">
                  {PILL_FILTERS.map(f => {
                    const active = eventListFilter === f.id;
                    return (
                      <button key={f.id} type="button" onClick={() => setEventListFilter(f.id)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold transition-all flex items-center gap-1.5 border cursor-pointer
                          ${active ? "border-transparent text-white shadow-[0_8px_18px_-8px_rgba(67,24,255,0.3)]" : "bg-white text-[#1F2247] border-[#EEEAFB] hover:bg-[#F4F2FF]"}`}
                        style={active ? { background: f.color } : undefined}>
                        {f.label}
                        <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-white/20" : "bg-[#F4F2FF] text-[#A3AED0]"}`}>
                          {pillCounts[f.id]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {/* Grouped event list */}
            <div className="flex-1 min-h-0 overflow-auto pr-1 space-y-4">
              {isEventsListLoading ? (
                <ListSkeleton rows={5} />
              ) : filteredCombinedEvents.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#F4F2FF] flex items-center justify-center mx-auto mb-3">
                    <CalendarHeart className="w-6 h-6 text-[#C4B6FB]" />
                  </div>
                  <p className="text-[13px] font-bold text-[#A3AED0]">{t("careEvents.noEventsScheduled")}</p>
                </div>
              ) : (() => {
                const todayStr = getMYTDateString();
                const EVENT_META = {
                  caregiver: { color: "#4318FF", bg: "#EDE9FE", label: t("careEvents.filterCaregiver") },
                  care:      { color: "#F59E0B", bg: "#FEF3C7", label: t("careEvents.filterPatientCare") },
                  outdoor:   { color: "#10B981", bg: "#DCFCE7", label: t("careEvents.filterOutdoor") },
                };

                const groups = new Map<string, typeof filteredCombinedEvents>();
                filteredCombinedEvents.forEach(e => {
                  const dateKey = e.startDatetime ? e.startDatetime.slice(0, 10) : "no-date";
                  if (!groups.has(dateKey)) groups.set(dateKey, []);
                  groups.get(dateKey)!.push(e);
                });

                return Array.from(groups.entries()).map(([dateKey, items]) => {
                  const isToday = dateKey === todayStr;
                  const d = dateKey !== "no-date" ? new Date(dateKey + "T00:00:00") : null;
                  return (
                    <div key={dateKey}>
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#A3AED0] whitespace-nowrap">
                          {isToday ? `${t("common.today")} · ` : ""}{d ? d.toLocaleDateString(getIntlLocale(), { weekday: "long", day: "numeric", month: "short" }) : t("careEvents.noDate")}
                        </span>
                        <div className="flex-1 h-px bg-gradient-to-r from-[#EEEAFB] to-transparent" />
                        <span className="text-[10px] font-mono font-bold text-[#A3AED0]">{items.length}</span>
                      </div>
                      <div className="space-y-2">
                        {items.map((ev, index) => {
                          const meta = EVENT_META[ev.eventKind];
                          const isCaregiver = ev.eventKind === "caregiver";
                          const isCare = ev.eventKind === "care";
                          const isDeleting = isCaregiver
                            ? deletingCaregiverIds.has(ev.id)
                            : isCare
                            ? deletingCareIds.has(ev.backendId ?? ev.id)
                            : deletingOutdoorIds.has(ev.backendId ?? ev.id);

                          const fmtTime = (iso?: string) => {
                            if (!iso) return "";
                            const [h, m] = iso.slice(11, 16).split(":").map(Number);
                            const period = h >= 12 ? "PM" : "AM";
                            const h12 = h % 12 || 12;
                            return `${h12}:${String(m).padStart(2, "0")} ${period}`;
                          };
                          const startTime = fmtTime(ev.startDatetime) || ev.time;
                          const endTime = fmtTime(ev.endDatetime);

                          return (
                            <div key={`${ev.eventKind}-${ev.id}-${index}`}
                              className="group flex items-stretch gap-3 p-3 rounded-2xl bg-white border border-[#EEEAFB] hover:border-[#4318FF]/20 hover:shadow-[0_10px_22px_-14px_rgba(67,24,255,0.18)] transition-all">
                              {/* Date column */}
                              {d && (
                                <div className="shrink-0 w-14 text-center flex flex-col items-center justify-center rounded-xl py-1.5"
                                  style={{ background: meta.bg + "80" }}>
                                  <span className="text-[9px] font-extrabold uppercase tracking-widest" style={{ color: meta.color, opacity: 0.8 }}>
                                    {d.toLocaleString(getIntlLocale(), { month: "short" })}
                                  </span>
                                  <span className="font-mono text-[18px] font-extrabold leading-none mt-0.5" style={{ color: meta.color }}>
                                    {d.getDate()}
                                  </span>
                                  <span className="text-[9px] font-bold mt-0.5" style={{ color: meta.color, opacity: 0.7 }}>
                                    {d.toLocaleString(getIntlLocale(), { weekday: "short" })}
                                  </span>
                                </div>
                              )}
                              {/* Body */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-[14px] font-extrabold tracking-tight text-[#1F2247] truncate">{translateMealTitle(ev.title) ?? ev.title}</p>
                                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-widest"
                                    style={{ background: meta.bg, color: meta.color }}>
                                    {meta.label}
                                  </span>
                                  {isToday && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-[#FBBF24] text-[#1F2247] text-[9px] font-extrabold uppercase tracking-widest">{t("common.today")}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                  {startTime && (
                                    <span className="flex items-center gap-1 text-[11px] font-bold text-[#6B7299]">
                                      <Clock className="w-3 h-3 shrink-0" />
                                      <span className="font-mono">{startTime}{endTime && endTime !== startTime ? ` – ${endTime}` : ""}</span>
                                    </span>
                                  )}
                                  {ev.recurrence && ev.recurrence !== "none" && (
                                    <span className="flex items-center gap-1 text-[11px] font-bold text-[#6B7299]">
                                      <Info className="w-3 h-3 shrink-0" />
                                      {translateRecurrence(ev.recurrence, ev.startDatetime?.slice(0, 10))}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {/* Delete */}
                              <div className="flex items-center shrink-0">
                                <button
                                  type="button"
                                  disabled={isDeleting}
                                  onClick={async () => {
                                    if (isCaregiver) {
                                      setDeletingCaregiverIds(prev => new Set(prev).add(ev.id));
                                      try {
                                        await caregiverScheduleService.deleteSchedule(ev.id, caregiverId);
                                        setAgenda(prev => prev.filter(a => a.id !== ev.id));
                                        toast.success(t("careEvents.eventDeleted"));
                                      } catch { toast.error(t("careEvents.eventDeleteFailed")); }
                                      finally { setDeletingCaregiverIds(prev => { const s = new Set(prev); s.delete(ev.id); return s; }); }
                                    } else if (isCare) {
                                      const key = ev.backendId ?? ev.id;
                                      setDeletingCareIds(prev => new Set(prev).add(key));
                                      try {
                                        if (ev.backendId) await careEventsService.deleteHomeCare(ev.backendId, caregiverId);
                                        deleteEvent(ev.id);
                                      } finally { setDeletingCareIds(prev => { const s = new Set(prev); s.delete(key); return s; }); }
                                    } else {
                                      const key = ev.backendId ?? ev.id;
                                      setDeletingOutdoorIds(prev => new Set(prev).add(key));
                                      try {
                                        if (ev.backendId) await careEventsService.deleteOutdoor(ev.backendId, caregiverId);
                                        deleteEvent(ev.id);
                                      } finally { setDeletingOutdoorIds(prev => { const s = new Set(prev); s.delete(key); return s; }); }
                                    }
                                  }}
                                  className="w-8 h-8 rounded-lg hover:bg-red-50 text-[#C5CADC] hover:text-red-500 flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-all disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

        </div>

      </div>

      {/* Medication Overlap Warning Modal (AC2) */}
      <AnimatePresence>
        {showOverlapModal && (
          <motion.div
            key="overlap-modal-overlay"
            className="fixed inset-0 z-[9500] flex items-center justify-center p-4 p-safe"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => { setShowOverlapModal(false); setPendingOverlapAction(null); }}
            />
            <motion.div
              key="overlap-modal-card"
              className="relative bg-white rounded-[20px] p-6 shadow-2xl max-w-sm w-full mx-4 z-10"
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <TriangleAlert className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-bold text-[#2B3674]">Priority Warning</h3>
                  <p className="text-xs text-[#A3AED0]">Medication schedule conflict</p>
                </div>
              </div>
              <p className="text-sm text-[#2B3674] mb-5">
                This overlaps with a scheduled medication dose. Adding an event here may disrupt the medication routine. Are you sure you want to continue?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowOverlapModal(false); setPendingOverlapAction(null); }}
                  className="flex-1 py-2.5 rounded-xl border border-[#E0E5F2] text-sm font-bold text-[#A3AED0] hover:bg-[#F4F7FE] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setShowOverlapModal(false);
                    if (pendingOverlapAction) await pendingOverlapAction();
                    setPendingOverlapAction(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-sm font-bold text-white transition-all"
                >
                  Continue Anyway
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Schedule Clash Warning Modal */}
      <AnimatePresence>
        {showScheduleClashModal && scheduleClashInfo && (
          <motion.div
            key="schedule-clash-overlay"
            className="fixed inset-0 z-[9500] flex items-center justify-center p-4 p-safe"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => { setShowScheduleClashModal(false); setPendingScheduleClashAction(null); setScheduleClashInfo(null); }}
            />
            <motion.div
              key="schedule-clash-card"
              className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 z-10 border border-rose-100 overflow-hidden"
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
            >
              <div className="flex items-start gap-3 p-5 border-b border-rose-100 bg-rose-50/80">
                <TriangleAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-[#2B3674]">{t("careEvents.scheduleClashTitle")}</h3>
                  <p className="text-sm text-[#707EAE] mt-0.5">{t("careEvents.scheduleClashSubtitle")}</p>
                </div>
              </div>
              <div className="p-5">
                <div className="rounded-xl border border-[#EEEAFB] p-3 text-sm text-[#2B3674] bg-[#F8FAFF] mb-4">
                  <p className="font-semibold text-rose-700">{scheduleClashInfo.title}</p>
                  <p className="text-[#707EAE] mt-1">
                    {scheduleClashInfo.startTime} – {scheduleClashInfo.endTime}
                    {" · "}{scheduleClashInfo.date}
                  </p>
                </div>
                <p className="text-sm text-[#2B3674]">{t("careEvents.scheduleClashBody")}</p>
              </div>
              <div className="px-5 pb-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowScheduleClashModal(false); setPendingScheduleClashAction(null); setScheduleClashInfo(null); }}
                  className="flex-1 py-2.5 rounded-xl border border-[#E0E5F2] text-sm font-bold text-[#A3AED0] hover:bg-[#F4F7FE] transition-all"
                >
                  {t("careEvents.scheduleClashCancel")}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setShowScheduleClashModal(false);
                    setScheduleClashInfo(null);
                    if (pendingScheduleClashAction) await pendingScheduleClashAction();
                    setPendingScheduleClashAction(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-sm font-bold text-white transition-all"
                >
                  {t("careEvents.scheduleClashContinue")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Duplicate Medication Modal */}
      <AnimatePresence>
        {showDuplicateMedModal && (
          <motion.div
            key="duplicate-med-overlay"
            className="fixed inset-0 z-[9500] flex items-center justify-center p-4 p-safe"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={duplicateMedType === "name-and-dose" ? undefined : () => { setShowDuplicateMedModal(false); setDuplicateMedType(null); setPendingDuplicateSave(null); }}
            />
            <motion.div
              key="duplicate-med-card"
              className="relative bg-white rounded-[20px] p-6 shadow-2xl max-w-sm w-full mx-4 z-10"
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${duplicateMedType === "name-and-dose" ? "bg-red-100" : "bg-amber-100"}`}>
                  <TriangleAlert className={`w-5 h-5 ${duplicateMedType === "name-and-dose" ? "text-red-600" : "text-amber-600"}`} />
                </div>
                <div>
                  <h3 className="font-bold text-[#2B3674]">
                    {duplicateMedType === "name-and-dose" ? "Duplicate Medication" : "Same Medication Name"}
                  </h3>
                  <p className="text-xs text-[#A3AED0]">
                    {duplicateMedType === "name-and-dose" ? "Hard block — cannot be added" : "Different dosage detected"}
                  </p>
                </div>
              </div>
              <p className="text-sm text-[#2B3674] mb-5">
                {duplicateMedType === "name-and-dose"
                  ? "A medication with the same name and dosage is already scheduled during this period. Please remove the existing plan before adding a new one."
                  : "A medication with the same name (but a different dosage) is already scheduled during this period. Are you sure you want to continue?"}
              </p>
              <div className="flex gap-3">
                {duplicateMedType === "name-and-dose" ? (
                  <button
                    type="button"
                    onClick={() => { setShowDuplicateMedModal(false); setDuplicateMedType(null); }}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-bold text-white transition-all"
                  >
                    Got It
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => { setShowDuplicateMedModal(false); setDuplicateMedType(null); setPendingDuplicateSave(null); }}
                      className="flex-1 py-2.5 rounded-xl border border-[#E0E5F2] text-sm font-bold text-[#A3AED0] hover:bg-[#F4F7FE] transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setShowDuplicateMedModal(false);
                        setDuplicateMedType(null);
                        if (pendingDuplicateSave) await pendingDuplicateSave();
                        setPendingDuplicateSave(null);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-sm font-bold text-white transition-all"
                    >
                      Proceed Anyway
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Test Observation Note Modal */}
      {testObsAlert && (
        <ObservationNoteModal
          alert={testObsAlert}
          caregiverId={caregiverId}
          onDismiss={() => setTestObsAlert(null)}
        />
      )}

    </div>
  );
}
