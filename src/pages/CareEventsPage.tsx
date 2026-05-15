import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Pill, Clock, Plus, Info, Check, Search, AlertCircle, Trash2, CalendarHeart, Upload, MapPin, Calendar, X, Loader2, Camera, Pencil, Heart, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useCareEvents } from "@/hooks/useCareEvents";
import { useAuth } from "@/context/AuthContext";
import { drugsService, type DrugBase } from "@/services/drugs";
import { careEventsService } from "@/services/careEvents";
import { caregiverScheduleService } from "@/services/caregiverSchedule";
import { scanMedicineLabel } from "@/services/ocr";
// import { HistorySection } from "@/components/HistorySection";
// import type { CareEvent } from "@/context/careEventsContext";
import { getMYTDateString } from "@/lib/eventRecurrence";
import { getMealSchedules, type MealScheduleEntry } from "@/services/mealSchedule";

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

const MEAL_LABELS: Record<string, string> = {
  BREAKFAST: "Breakfast",
  LUNCH:     "Lunch",
  DINNER:    "Dinner",
};

const MEAL_OFFSET: Record<string, number> = {
  "before meals": -60,
  "after meals":  60,
  "with meals":   0,
};

function getDayName(dateStr: string): string {
  if (!dateStr) return "selected day";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

function to24h(hour: string, minute: string, period: string): string {
  let h = parseInt(hour, 10);
  if (period === "AM" && h === 12) h = 0;
  if (period === "PM" && h !== 12) h += 12;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

function formatDisplayTime(hour: string, minute: string, period: string): string {
  return `${hour}:${minute} ${period}`;
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
  return `${String(h).padStart(2, "0")}:${mStr} ${period}`;
}

function calculateDoseTimes(
  selectedMeals: string[],
  mealSchedules: MealScheduleEntry[],
  mealTiming: string,
  intervalMinutes: number
): { times: string[]; orderedMeals: string[] } {
  const offset = MEAL_OFFSET[mealTiming] ?? 0;

  const pairs = selectedMeals.map(meal => {
    const entry =
      mealSchedules.find(e => e.mealType === meal) ??
      DEFAULT_MEAL_TIMES.find(e => e.mealType === meal)!;
    const [h, m] = entry.mealTime.split(":").map(Number);
    return { meal, totalMinutes: ((h * 60 + m) + offset + 1440) % 1440 };
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

export function CareEventsPage() {
  const { meds, addMed, deleteMed, events, addEvent, deleteEvent, patientId, refresh } = useCareEvents();
  const { user } = useAuth();
  const caregiverId = user?.caregiverId ?? 0;

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
    if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
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

  // Separate events into care and outdoor
  const careEvents = events.filter(ev => CARE_EVENT_TYPES.includes(ev.type) || ev.eventType === "home");
  const outdoorEvents = events.filter(ev => OUTDOOR_EVENT_TYPES.includes(ev.type) || ev.eventType === "outdoor");


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

  // Fetch meal schedules for auto-scheduling
  useEffect(() => {
    if (!caregiverId) return;
    getMealSchedules(caregiverId)
      .then(schedules => {
        if (schedules.length > 0) {
          setMealSchedules(schedules);
          setUsingDefaultMealTimes(false);
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
    if (!testSelectedDrug) {
      toast.error("Please select a medication from the search results");
      return;
    }
    const adminTimesArr = testMedTimes.map(t => to24h(t.hour, t.minute, t.period));
    const adminTimesStr = adminTimesArr.join(",");
    const remindTime = adminTimesArr[0];
    const todayStr = getMYTDateString();
    setIsSavingTestMed(true);
    try {
      if (patientId) {
        const created = await careEventsService.createMedication(
          patientId, testSelectedDrug.drugId,
          testSelectedDrug.dosage ?? "", testFrequency,
          adminTimesStr, remindTime, todayStr,
          "", null, null, null, null, null,
        );
        addMed({
          remindId: created.remindId, drugId: created.drugId,
          name: testSelectedDrug.drugName, dose: testSelectedDrug.dosage ?? "",
          frequency: testFrequency, time: remindTime,
          startDate: created.startDate, endDate: created.endDate ?? undefined,
          recurrence: created.recurrence ?? "none",
        });
        toast.success("Test medication scheduled!");
      } else {
        adminTimesArr.forEach(t => addMed({ name: testMedName, dose: "", frequency: testFrequency, time: t }));
        toast.success("Test medication saved locally");
      }
      resetTestMedicationForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save medication");
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

  const handleSaveMedication = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!medName) {
      toast.error("Please enter medication name");
      return;
    }
    const oralValid = dosagePart === "oral" && dose.trim() && quantity !== "";
    const otherValid = dosagePart === "other" && intakeMethod.trim();
    if (!oralValid && !otherValid) {
      toast.error("Please complete the dosage section");
      return;
    }
    if (!frequency.trim()) {
      toast.error("Please select frequency");
      return;
    }
    if (calculatedTimes.length === 0) {
      toast.error("Please complete the meal selection to schedule times");
      return;
    }

    const adminTimesStr = calculatedTimes.join(",");
    const remindTime = calculatedTimes[0];
    const finalDosage = dosagePart === "oral" ? dose.trim() : intakeMethod.trim();
    const finalQuantity = dosagePart === "oral" && quantity !== "" ? Number(quantity) : null;
    const finalIntakeMethod = dosagePart === "other" ? intakeMethod.trim() : null;
    const finalEndDate = isNeverEnding ? startDate : (endDate || null);
    const finalRecurrence = recurrence;

    setIsSavingMed(true);
    try {
      if (patientId && selectedDrug) {
        try {
          await careEventsService.createMedication(
            patientId,
            selectedDrug.drugId,
            finalDosage,
            frequency,
            adminTimesStr,
            remindTime,
            startDate,
            "",
            mealTiming,
            finalQuantity,
            finalIntakeMethod,
            finalEndDate,
            finalRecurrence,
          );
          // Backend creates one entry per time in adminTimes — refresh to get all of them
          refresh();
          toast.success("Medication scheduled successfully!");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to save medication");
          return;
        }
      } else {
        calculatedTimes.forEach(t => {
          addMed({ name: medName, dose: finalDosage, frequency, time: t });
        });
        toast.success("Medication saved locally");
      }

      resetMedicationForm();
    } finally {
      setIsSavingMed(false);
    }
  };

  const handleNextStep = async () => {
    if (medicationStep === 1) {
      if (inputMode === "choice") return;

      if (inputMode === "ocr") {
        // Phase A → trigger OCR, don't advance yet
        if (!ocrResult && !isOcrLoading) {
          if (!medicationImage) {
            toast.error("Please select or take a photo first");
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
        toast.error("Please enter medication name");
        return;
      }
      if (!dose.trim()) {
        toast.error("Please enter the dosage (e.g. 100mg)");
        return;
      }
    }

    if (medicationStep === 2) {
      if (dosagePart === "oral" && quantity === "") {
        toast.error("Please enter the quantity for oral medication");
        return;
      }
      if (dosagePart === "other" && !intakeMethod.trim()) {
        toast.error("Please describe the intake method");
        return;
      }
    }
    if (medicationStep === 3) {
      if (!startDate) {
        toast.error("Please select a start date");
        return;
      }
      if (!isNeverEnding && endDate && endDate < startDate) {
        toast.error("End date cannot be before start date");
        return;
      }
    }
    if (medicationStep === 4) {
      if (!frequency.trim()) {
        toast.error("Please select frequency");
        return;
      }
      const requiredCount = parseInt(frequency.match(/\d+/)?.[0] || "1");
      if (selectedMeals.length !== requiredCount) {
        toast.error(`Please select exactly ${requiredCount} meal(s) to anchor your doses`);
        return;
      }
      if (calculatedTimes.length === 0) {
        toast.error("Could not calculate dose times. Please try again.");
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
      toast.error("Please select a care event type");
      return;
    }
    const time24 = to24h(careEventTimeHour, careEventTimeMinute, careEventTimePeriod);
    const endTime24 = to24h(careEventEndTimeHour, careEventEndTimeMinute, careEventEndTimePeriod);
    const startDatetime = `${careEventStartDate}T${time24}:00`;
    const endDateBase = (!careEventIsNeverEnding && careEventEndDate) ? careEventEndDate : careEventStartDate;
    const endDatetimeFinal = `${endDateBase}T${endTime24}:00`;
    const displayTime = formatDisplayTime(careEventTimeHour, careEventTimeMinute, careEventTimePeriod);

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
            time: displayTime,
            startDatetime: created.startDatetime,
            endDatetime: created.endDatetime,
            recurrence: created.recurrence,
          });
          toast.success("Care event scheduled successfully!");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to save care event");
          return;
        }
      } else {
        addEvent({ title: careEventType, type: careEventType, time: displayTime });
        toast.success("Care event saved locally");
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

  const handleSaveOutdoorEvent = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!outdoorEventType) {
      toast.error("Please select an outdoor event type");
      return;
    }
    const time24 = to24h(outdoorEventTimeHour, outdoorEventTimeMinute, outdoorEventTimePeriod);
    const endTime24 = to24h(outdoorEventEndTimeHour, outdoorEventEndTimeMinute, outdoorEventEndTimePeriod);
    const startDatetime = `${outdoorEventStartDate}T${time24}:00`;
    const endDateBase = (!outdoorEventIsNeverEnding && outdoorEventEndDate) ? outdoorEventEndDate : outdoorEventStartDate;
    const endDatetimeFinal = `${endDateBase}T${endTime24}:00`;
    const displayTime = formatDisplayTime(outdoorEventTimeHour, outdoorEventTimeMinute, outdoorEventTimePeriod);

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
            time: displayTime,
            startDatetime: created.startDatetime,
            endDatetime: created.endDatetime,
            recurrence: created.recurrence,
          });
          toast.success("Outdoor event scheduled successfully!");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to save outdoor event");
          return;
        }
      } else {
        addEvent({ title: outdoorEventType, type: outdoorEventType, time: displayTime });
        toast.success("Outdoor event saved locally");
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

  // Fetch caregiver agenda
  const refreshCaregiverAgenda = useCallback(() => {
    if (!caregiverId) return;
    caregiverScheduleService.getSchedules(caregiverId).then((schedules) => {
      setAgenda(schedules.map((s) => ({
        id: s.id,
        title: s.scheduleTitle,
        time: s.startDatetime.slice(11, 16),
        startDatetime: s.startDatetime,
        endDatetime: s.endDatetime,
        recurrence: s.recurrence ?? null,
      })).sort((a, b) => a.time.localeCompare(b.time)));
    }).catch(() => {});
  }, [caregiverId]);

  useEffect(() => { refreshCaregiverAgenda(); }, [refreshCaregiverAgenda]);

  const handleSaveCaregiverEvent = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!caregiverEventTitle.trim()) {
      toast.error("Please enter an event title");
      return;
    }
    if (!caregiverId) {
      toast.error("Caregiver account not found. Please log in again.");
      return;
    }
    const startTime24 = to24h(caregiverEventTimeHour, caregiverEventTimeMinute, caregiverEventTimePeriod);
    const endTime24 = to24h(caregiverEventEndTimeHour, caregiverEventEndTimeMinute, caregiverEventEndTimePeriod);
    const startDatetime = `${caregiverEventStartDate}T${startTime24}:00`;
    const endDateBase = (!caregiverEventIsNeverEnding && caregiverEventEndDate) ? caregiverEventEndDate : caregiverEventStartDate;
    const endDatetime = `${endDateBase}T${endTime24}:00`;
    const recurrence = caregiverEventRecurrence !== "none" ? caregiverEventRecurrence : null;

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
      toast.success("Caregiver event added successfully");
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
      toast.error("Failed to add caregiver event");
    } finally {
      setIsSavingCaregiver(false);
    }
  };

  const MEAL_TITLES = ["Breakfast", "Lunch", "Dinner"];

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
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(today.getDate() + 7);

    return combinedEvents
      .filter(e => {
        // Drop past events (keep those with no datetime info)
        if (e.startDatetime) {
          const evDate = new Date(e.startDatetime);
          evDate.setHours(0, 0, 0, 0);
          if (evDate < today) return false;
        }
        const isMeal = e.eventKind === "caregiver" && MEAL_TITLES.includes(e.title);
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
  const STEP_LABELS = ["Medication", "Route & Dose", "Schedule", "Frequency"];

  return (
    <div className="pb-10">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#2B3674]">Care Events</h1>
        <p className="text-sm sm:text-base text-[#A3AED0] font-bold mt-1">Setup precise medication and care schedules.</p>
      </div>

      <div className="space-y-6 sm:space-y-8">

        {/* Medication Row */}
        <div id="medication-section" className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-stretch">

          {/* Add Medication Form */}
          <div className="bg-white rounded-[20px] p-4 sm:p-6 shadow-[0_18px_40px_rgba(112,144,176,0.12)] border-none relative h-[480px] flex flex-col">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <h2 className="text-xl font-bold text-[#2B3674] flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#4318FF]" /> Add Medication
                {isTestMode && (
                  <span className="ml-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full uppercase tracking-widest">
                    Test Medication Reminder
                  </span>
                )}
              </h2>
              <button
                type="button"
                onClick={handleToggleTestMode}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all border ${
                  isTestMode
                    ? "bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200"
                    : "bg-[#F4F7FE] text-[#A3AED0] border-[#E0E5F2] hover:bg-[#E9E3FF] hover:text-[#4318FF]"
                }`}
              >
                {isTestMode ? "Exit Test Mode" : "Test Medication Reminder"}
              </button>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 px-1 pb-1">

            {/* Test Mode Form */}
            {isTestMode && (
              <form onSubmit={handleTestSaveMedication} className="space-y-5">
                {/* Drug name search */}
                <div className="relative z-20">
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">Medication Name</label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#A3AED0]" />
                    <input
                      type="text" value={testMedName}
                      onChange={(e) => { setTestMedName(e.target.value); setTestSelectedDrug(null); }}
                      onBlur={() => setTimeout(() => setTestShowMedsDropdown(false), 200)}
                      placeholder="e.g., Levodopa"
                      className="w-full pl-11 pr-4 py-3.5 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50 transition-all placeholder:text-[#A3AED0]"
                    />
                  </div>
                  <div className="mt-2 flex items-start gap-2 bg-[#E9E3FF]/50 p-3 rounded-xl">
                    <Info className="w-4 h-4 text-[#4318FF] shrink-0 mt-0.5" />
                    <p className="text-xs font-bold text-[#4318FF] leading-relaxed">
                      {testSelectedDrug
                        ? `Selected: ${testSelectedDrug.drugName} - ${testSelectedDrug.dosage}`
                        : "Type to search medications from the database."}
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
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">Frequency</label>
                  <div className="flex rounded-xl overflow-hidden border border-[#E0E5F2]">
                    {FREQUENCIES.map(freq => (
                      <button key={freq} type="button" onClick={() => handleTestFrequencyChange(freq)}
                        className={`flex-1 py-2.5 text-xs font-bold transition-all ${testFrequency === freq ? "bg-[#4318FF] text-white" : "bg-[#F4F7FE] text-[#A3AED0] hover:bg-[#E9E3FF]"}`}
                      >
                        {freq.replace(" times/day", "×/day").replace(" time/day", "×/day")}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Per-dose time pickers */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-1 block ml-1">Dose Times</label>
                  {testMedTimes.map((t, idx) => (
                    <div key={idx} className="p-4 bg-[#F4F7FE] rounded-xl">
                      <p className="text-xs font-bold text-[#4318FF] mb-3">
                        Dose {idx + 1} - {formatDisplayTime(t.hour, t.minute, t.period)}
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Hour</p>
                          <select value={t.hour}
                            onChange={(e) => setTestMedTimes(prev => prev.map((item, i) => i === idx ? { ...item, hour: e.target.value } : item))}
                            className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50"
                          >
                            {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Min</p>
                          <select value={t.minute}
                            onChange={(e) => setTestMedTimes(prev => prev.map((item, i) => i === idx ? { ...item, minute: e.target.value } : item))}
                            className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50"
                          >
                            {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Period</p>
                          <div className="flex rounded-lg overflow-hidden border border-[#E0E5F2] h-[42px]">
                            {(["AM", "PM"] as const).map(p => (
                              <button key={p} type="button"
                                onClick={() => setTestMedTimes(prev => prev.map((item, i) => i === idx ? { ...item, period: p } : item))}
                                className={`flex-1 text-xs font-bold transition-all ${t.period === p ? "bg-[#4318FF] text-white" : "bg-white text-[#A3AED0] hover:bg-[#E9E3FF]"}`}
                              >
                                {p}
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
                  {isSavingTestMed ? "Saving..." : "Save Test Medication"}
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
                  <h3 className="text-lg font-bold text-[#2B3674] mb-2">Medication Safety Notice</h3>
                  <p className="text-sm text-[#A3AED0] leading-relaxed mb-6 max-w-xs">
                    Please be cautious when adding medications. Always verify the medication name, dosage, and frequency are correct before confirming.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setShowPreMedWarning(false); setFormInteractive(true); }}
                    className="w-full max-w-xs py-3.5 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] active:scale-[0.98]"
                  >
                    I Understand, Proceed
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
                  Add medications to the care plan with scheduled reminders and administration times.
                </p>
                <button
                  type="button"
                  onClick={() => setShowPreMedWarning(true)}
                  className="px-6 py-3.5 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] active:scale-[0.98] flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add Medication
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
                        title: `Go back to ${STEP_LABELS[step - 1]}`,
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
                          <p className="text-sm font-bold text-[#2B3674] mb-1">How would you like to add the medication?</p>
                          <p className="text-xs text-[#A3AED0]">Choose a method to enter medication details</p>
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
                              <p className="text-sm font-bold text-[#2B3674]">Scan Label (OCR)</p>
                              <p className="text-xs text-[#A3AED0] mt-0.5">Use camera or upload a photo</p>
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
                              <p className="text-sm font-bold text-[#2B3674]">Manual Input</p>
                              <p className="text-xs text-[#A3AED0] mt-0.5">Type details directly</p>
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
                          ← Change Method
                        </button>
                        <div className="flex items-start gap-2 bg-[#E9E3FF]/50 p-3 rounded-xl">
                          <Info className="w-4 h-4 text-[#4318FF] shrink-0 mt-0.5" />
                          <p className="text-xs font-bold text-[#4318FF] leading-relaxed">
                            Take or upload a photo of the medication label. We'll extract the drug name, dosage, and manufacturer automatically.
                          </p>
                        </div>
                        {!medicationImagePreview ? (
                          <div className="grid grid-cols-2 gap-3">
                            <label className="flex flex-col items-center gap-2 p-5 bg-[#F4F7FE] hover:bg-[#E9E3FF] border-2 border-dashed border-[#4318FF]/30 rounded-xl cursor-pointer transition-all text-center">
                              <Camera className="w-7 h-7 text-[#4318FF]" />
                              <span className="text-xs font-bold text-[#4318FF]">Use Camera</span>
                              <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" />
                            </label>
                            <label className="flex flex-col items-center gap-2 p-5 bg-[#F4F7FE] hover:bg-[#E9E3FF] border-2 border-dashed border-[#4318FF]/30 rounded-xl cursor-pointer transition-all text-center">
                              <Upload className="w-7 h-7 text-[#4318FF]" />
                              <span className="text-xs font-bold text-[#4318FF]">Upload Image</span>
                              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                            </label>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-3">
                            <div className="relative">
                              <img src={medicationImagePreview} alt="Medication label" className="max-h-44 rounded-xl object-contain border border-[#E0E5F2]" />
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
                            <Camera className="w-4 h-4" /> Scan Label
                          </button>
                        )}
                      </>
                    )}

                    {/* OCR - Loading spinner */}
                    {inputMode === "ocr" && isOcrLoading && (
                      <div className="flex flex-col items-center gap-4 py-10">
                        <Loader2 className="w-10 h-10 text-[#4318FF] animate-spin" />
                        <p className="text-sm font-bold text-[#2B3674]">Scanning your medication label…</p>
                        <p className="text-xs text-[#A3AED0] text-center">ParkiCare is analysing the image using AI. This takes a few seconds.</p>
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
                          ← Change Method
                        </button>

                        {ocrResult && !ocrResult.error && (
                          <div className="flex items-start gap-2 bg-green-50 p-3 rounded-xl border border-green-200">
                            <Check className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                            <p className="text-xs font-bold text-green-700 leading-relaxed">Label scanned successfully. Please verify and edit the details below if needed.</p>
                          </div>
                        )}
                        {ocrResult?.error && (
                          <div className="flex items-start gap-2 bg-orange-50 p-3 rounded-xl border border-orange-200">
                            <AlertCircle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                            <p className="text-xs font-bold text-orange-600 leading-relaxed">Could not recognise the label. Please enter the details manually below.</p>
                          </div>
                        )}

                        {/* Drug Name */}
                        <div className="relative z-20">
                          <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">Medication Name</label>
                          <div className="relative">
                            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#A3AED0]" />
                            <input
                              type="text"
                              value={medName}
                              onChange={(e) => { setMedName(e.target.value); setSelectedDrug(null); }}
                              onBlur={() => setTimeout(() => setShowMedsDropdown(false), 200)}
                              placeholder="e.g., Levodopa"
                              className="w-full pl-11 pr-4 py-3.5 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50 transition-all placeholder:text-[#A3AED0]"
                            />
                          </div>
                          <div className="mt-2 flex items-start gap-2 bg-[#E9E3FF]/50 p-3 rounded-xl">
                            <Info className="w-4 h-4 text-[#4318FF] shrink-0 mt-0.5" />
                            <p className="text-xs font-bold text-[#4318FF] leading-relaxed">
                              {selectedDrug ? `Selected: ${selectedDrug.drugName} - suggested dose: ${selectedDrug.dosage}` : "Type to search medications from the database."}
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
                          <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">Dosage (strength)</label>
                          <input
                            type="text"
                            value={dose}
                            onChange={(e) => setDose(e.target.value)}
                            placeholder="e.g., 100mg, 50mg"
                            className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50 transition-all placeholder:text-[#A3AED0]"
                          />
                        </div>

                        {/* Manufacturer */}
                        <div className="relative z-10">
                          <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">
                            Manufacturer / Company <span className="normal-case font-normal text-[#A3AED0]">(optional)</span>
                          </label>
                          <div className="relative">
                            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#A3AED0]" />
                            <input
                              type="text"
                              value={manufacturerName}
                              onChange={(e) => setManufacturerName(e.target.value)}
                              onBlur={() => setTimeout(() => setShowManufacturerDropdown(false), 200)}
                              placeholder="e.g., Novartis"
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
                          Next
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
                        Select <strong>Oral</strong> for tablets/capsules and enter units per dose, or <strong>Other Route</strong> for nasal spray, topical, etc.
                      </p>
                    </div>

                    {/* Route toggle */}
                    <div className="flex rounded-xl overflow-hidden border border-[#E0E5F2]">
                      <button
                        type="button"
                        onClick={() => setDosagePart("oral")}
                        className={`flex-1 py-2.5 text-xs font-bold transition-all ${dosagePart === "oral" ? "bg-[#4318FF] text-white" : "bg-[#F4F7FE] text-[#A3AED0] hover:bg-[#E9E3FF]"}`}
                      >
                        Oral
                      </button>
                      <button
                        type="button"
                        onClick={() => setDosagePart("other")}
                        className={`flex-1 py-2.5 text-xs font-bold transition-all ${dosagePart === "other" ? "bg-[#4318FF] text-white" : "bg-[#F4F7FE] text-[#A3AED0] hover:bg-[#E9E3FF]"}`}
                      >
                        Other Route
                      </button>
                    </div>

                    {dosagePart === "oral" ? (
                      <div>
                        <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">Quantity (units per dose)</label>
                        <input
                          type="number"
                          min="1"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 1))}
                          placeholder="e.g., 1"
                          className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50 transition-all placeholder:text-[#A3AED0]"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">Intake Description</label>
                        <input
                          type="text"
                          value={intakeMethod}
                          onChange={(e) => setIntakeMethod(e.target.value)}
                          placeholder="e.g., 2 puffs nasal spray, 1 patch topical"
                          className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50 transition-all placeholder:text-[#A3AED0]"
                          autoFocus
                        />
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button type="button" onClick={handlePrevStep} className="flex-1 py-4 bg-[#F4F7FE] hover:bg-[#E9E3FF] text-[#4318FF] font-bold rounded-xl transition-all active:scale-[0.98]">Back</button>
                      <button type="button" onClick={handleNextStep} className="flex-1 py-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] active:scale-[0.98]">Next</button>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Schedule */}
                {medicationStep === 3 && (
                  <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                    <div>
                      <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">
                        <Calendar className="w-3.5 h-3.5 inline mr-1" />Start Date
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
                        const turningOn = isNeverEnding; // currently off → turning end date on
                        setIsNeverEnding(v => !v);
                        setRecurrence(turningOn ? "daily" : "none");
                      }}
                    >
                      <div>
                        <p className="text-sm font-bold text-[#2B3674]">End date</p>
                        <p className="text-xs text-[#A3AED0] mt-0.5">Set an end date for this medication plan</p>
                      </div>
                      <div className={`w-11 h-6 rounded-full transition-all relative ${!isNeverEnding ? "bg-[#4318FF]" : "bg-[#E0E5F2]"}`}>
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${!isNeverEnding ? "left-6" : "left-1"}`} />
                      </div>
                    </div>

                    {/* End date (only if not never ending) */}
                    {!isNeverEnding && (
                      <div>
                        <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">End Date</label>
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
                        <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-3 block ml-1">Repeat</label>
                        <div className="space-y-2">
                          {([
                            { value: "daily", label: "Daily" },
                            { value: "weekdays", label: "Weekdays (Mon – Fri)" },
                            { value: "weekly", label: `Weekly on ${getDayName(startDate)}` },
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
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button type="button" onClick={handlePrevStep} className="flex-1 py-4 bg-[#F4F7FE] hover:bg-[#E9E3FF] text-[#4318FF] font-bold rounded-xl transition-all active:scale-[0.98]">Back</button>
                      <button type="button" onClick={handleNextStep} className="flex-1 py-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] active:scale-[0.98]">Next</button>
                    </div>
                  </motion.div>
                )}

                {/* Step 4: Frequency + Meal Timing */}
                {medicationStep === 4 && (
                  <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                    <div className="relative z-10">
                      <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">Frequency</label>
                      <input
                        type="text"
                        value={frequency}
                        onChange={(e) => { setFrequency(e.target.value); setShowFreqDropdown(true); }}
                        onFocus={() => setShowFreqDropdown(true)}
                        onBlur={() => setTimeout(() => setShowFreqDropdown(false), 200)}
                        placeholder="e.g., 2 times/day"
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
                                {freq}
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Meal Timing */}
                    <div>
                      <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-3 block ml-1">When to take</label>
                      <div className="flex gap-2">
                        {(["before meals", "after meals", "with meals"] as const).map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setMealTiming(opt)}
                            className={`flex-1 py-3 px-2 rounded-xl text-xs font-bold transition-all capitalize ${mealTiming === opt ? "bg-[#4318FF] text-white shadow-[0_4px_15px_rgba(67,24,255,0.3)]" : "bg-[#F4F7FE] text-[#A3AED0] hover:bg-[#E9E3FF] hover:text-[#4318FF]"}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Meal Selection */}
                    <div>
                      <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-1 block ml-1">
                        Anchor meals
                      </label>
                      <p className="text-[11px] text-[#A3AED0] mb-3 ml-1">
                        Select {parseInt(frequency.match(/\d+/)?.[0] || "1")} meal{parseInt(frequency.match(/\d+/)?.[0] || "1") > 1 ? "s" : ""} to schedule doses around
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
                              <span>{MEAL_LABELS[meal]}</span>
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
                          <p className="text-xs text-amber-700">Using default meal times. Update them in Meal Schedule settings.</p>
                        </div>
                      )}
                      {calculatedTimes.length > 0 && (
                        <div className="mt-3 p-3 bg-[#E9E3FF]/50 rounded-xl">
                          <p className="text-[10px] font-bold text-[#4318FF] uppercase tracking-widest mb-2">Preview</p>
                          <div className="space-y-1">
                            {calculatedTimes.map((t, i) => (
                              <p key={i} className="text-xs font-bold text-[#2B3674]">
                                Dose {i + 1} – {hhmmTo12h(t)}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button type="button" onClick={handlePrevStep} className="flex-1 py-4 bg-[#F4F7FE] hover:bg-[#E9E3FF] text-[#4318FF] font-bold rounded-xl transition-all active:scale-[0.98]">Back</button>
                      <button type="button" onClick={handleNextStep} className="flex-1 py-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] active:scale-[0.98]">Review & Confirm</button>
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
                className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="w-full max-w-md bg-white rounded-[20px] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
                >
                  <h3 className="text-lg font-bold text-[#2B3674] mb-4">Review Your Medication</h3>

                  {/* Medication */}
                  <div
                    onClick={() => { setShowConfirmModal(false); handleEditField(1); }}
                    className={`p-4 rounded-xl hover:bg-[#E9E3FF] cursor-pointer transition-all group mb-3 ${ocrResult && !ocrResult.error && dose.trim().toLowerCase() !== ocrResult.dose.toLowerCase() ? "bg-[#FFF7ED] border border-orange-300" : "bg-[#F4F7FE]"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        {medicationImagePreview && (
                          <img src={medicationImagePreview} alt="Med" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-0.5">Medication</p>
                          <p className="text-sm font-bold text-[#2B3674] truncate">{medName || "Not set"}</p>
                          <p className="text-xs text-[#A3AED0] mt-0.5">{dose || "-"}{manufacturerName ? ` · ${manufacturerName}` : ""}</p>
                        </div>
                      </div>
                      <span className="text-xs text-[#4318FF] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">Edit</span>
                    </div>
                    {ocrResult && !ocrResult.error && dose.trim().toLowerCase() !== ocrResult.dose.toLowerCase() && (
                      <div className="mt-2 flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                        <AlertCircle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                        <div className="text-xs text-orange-700">
                          <p className="font-bold">Dosage mismatch detected</p>
                          <p className="mt-0.5">Label scanned: <strong>{ocrResult.dose}</strong> → Entered: <strong>{dose}</strong></p>
                          <p className="mt-0.5 text-orange-500">Please verify before saving.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Route & Administration */}
                  <div onClick={() => { setShowConfirmModal(false); handleEditField(2); }} className="p-4 bg-[#F4F7FE] rounded-xl hover:bg-[#E9E3FF] cursor-pointer transition-all group mb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-0.5">Route & Administration</p>
                        {dosagePart === "oral" ? (
                          <p className="text-sm font-bold text-[#2B3674]">Oral · {quantity !== "" ? quantity : "-"} unit(s) per dose</p>
                        ) : (
                          <p className="text-sm font-bold text-[#2B3674]">Other route · {intakeMethod || "Not set"}</p>
                        )}
                      </div>
                      <span className="text-xs text-[#4318FF] opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                    </div>
                  </div>

                  {/* Schedule */}
                  <div onClick={() => { setShowConfirmModal(false); handleEditField(3); }} className="p-4 bg-[#F4F7FE] rounded-xl hover:bg-[#E9E3FF] cursor-pointer transition-all group mb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-0.5">Schedule</p>
                        <p className="text-sm font-bold text-[#2B3674]">
                          From {startDate} {isNeverEnding ? "- ongoing" : endDate ? `to ${endDate}` : ""}
                        </p>
                        <p className="text-xs text-[#A3AED0] mt-0.5 capitalize">
                          {recurrence === "none" ? "No repeat" : recurrence === "weekly" ? `Weekly on ${getDayName(startDate)}` : recurrence}
                        </p>
                      </div>
                      <span className="text-xs text-[#4318FF] opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                    </div>
                  </div>

                  {/* Frequency + Meal Timing */}
                  <div onClick={() => { setShowConfirmModal(false); handleEditField(4); }} className="p-4 bg-[#F4F7FE] rounded-xl hover:bg-[#E9E3FF] cursor-pointer transition-all group mb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-0.5">Frequency</p>
                        <p className="text-sm font-bold text-[#2B3674]">{frequency} · {mealTiming}</p>
                      </div>
                      <span className="text-xs text-[#4318FF] opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                    </div>
                  </div>

                  {/* Scheduled Times (auto-calculated, inline-editable) */}
                  <div className={`p-4 rounded-xl transition-all mb-3 ${expandMealEdit ? "bg-[#E9E3FF]/60 border border-[#4318FF]/20" : "bg-[#F4F7FE]"}`}>
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest">Scheduled Times</p>
                      <button
                        type="button"
                        onClick={() => setExpandMealEdit(v => !v)}
                        className="text-xs font-bold text-[#4318FF] hover:underline shrink-0 ml-3"
                      >
                        {expandMealEdit ? "Done" : "Edit"}
                      </button>
                    </div>

                    {/* Dose time summary */}
                    <div className="space-y-1.5 mb-3">
                      {calculatedTimes.map((t, idx) => {
                        const meal = orderedMealsForTimes[idx];
                        const offsetLabel = mealTiming === "before meals" ? "1hr before" : mealTiming === "after meals" ? "1hr after" : "with";
                        return (
                          <div key={idx} className="flex items-center justify-between">
                            <span className="text-sm font-bold text-[#2B3674]">Dose {idx + 1} – {hhmmTo12h(t)}</span>
                            <span className="text-xs text-[#A3AED0]">{offsetLabel} {MEAL_LABELS[meal] ?? meal}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Inline meal anchor editor */}
                    {expandMealEdit && (
                      <div className="border-t border-[#4318FF]/10 pt-3 space-y-2">
                        <p className="text-[11px] font-bold text-[#4318FF] mb-2">
                          Change meal anchors (select {parseInt(frequency.match(/\d+/)?.[0] || "1")})
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
                              <span>{MEAL_LABELS[meal]}</span>
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
                        I have reviewed the dosage difference (Label: <strong>{ocrResult.dose}</strong> vs Entered: <strong>{dose}</strong>) and confirm my input is correct.
                      </span>
                    </label>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowConfirmModal(false)}
                      className="flex-1 py-4 bg-[#F4F7FE] hover:bg-[#E9E3FF] text-[#4318FF] font-bold rounded-xl transition-all active:scale-[0.98]"
                    >
                      Back to Edit
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleSaveMedication(e)}
                      disabled={isSavingMed || (ocrResult != null && !ocrResult.error && dose.trim().toLowerCase() !== ocrResult.dose.toLowerCase() && !dosageMismatchAcked)}
                      className="flex-1 py-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSavingMed && <Loader2 className="w-4 h-4 animate-spin" />}
                      {isSavingMed ? "Saving..." : "Confirm & Save"}
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
                <h2 className="text-[18px] font-extrabold tracking-tight text-[#1F2247]">Medication List</h2>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#EDE9FE] text-[#4318FF] text-[10px] font-extrabold uppercase tracking-widest">
                {meds.length} active
              </span>
            </div>

            {/* Search */}
            <div className="relative mb-3 shrink-0">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A3AED0] pointer-events-none" />
              <input
                value={medSearch}
                onChange={e => setMedSearch(e.target.value)}
                placeholder="Search medications…"
                className="w-full pl-9 pr-3 py-2.5 bg-[#F8F6FF] border border-[#EEEAFB] rounded-xl text-[12px] font-bold text-[#1F2247] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/30 placeholder:text-[#A3AED0] placeholder:font-medium"
              />
            </div>

            {/* List */}
            <div className="space-y-2 overflow-y-auto flex-1 min-h-0 pr-1">
              {(() => {
                const todayStr = new Date().toISOString().slice(0, 10);
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
                    <p className="text-[12px] font-bold">{medSearch ? "No medications match." : "No medications scheduled."}</p>
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
                              {rep.frequency && <><span className="w-1 h-1 rounded-full bg-[#A3AED0]" /><span className="text-[11px] font-bold text-[#6B7299]">{rep.frequency}</span></>}
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
                          <div className="rounded-xl bg-[#F8F6FF] p-3 grid grid-cols-3 gap-3 text-[11px] font-bold mb-3">
                            <div>
                              <p className="uppercase tracking-widest text-[9px] text-[#A3AED0] mb-1">Starts</p>
                              <p className="text-[#1F2247]">{rep.startDate ? new Date(rep.startDate + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—"}</p>
                            </div>
                            <div>
                              <p className="uppercase tracking-widest text-[9px] text-[#A3AED0] mb-1">Ends</p>
                              <p className="text-[#1F2247]">{rep.endDate ? new Date(rep.endDate + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "Ongoing"}</p>
                            </div>
                            <div>
                              <p className="uppercase tracking-widest text-[9px] text-[#A3AED0] mb-1">Repeat</p>
                              <p className="text-[#1F2247] capitalize">{rep.recurrence ?? "—"}</p>
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
                              Remove
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

        {/* Combined Events Row */}
        <div id="events-section" className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start">

          {/* Left: Combined Add Event Form */}
          <div ref={eventFormRef} className="bg-white rounded-[20px] p-4 sm:p-6 shadow-[0_18px_40px_rgba(112,144,176,0.12)] border-none relative h-[680px] flex flex-col">
            <h2 className="text-xl font-bold text-[#2B3674] mb-4 flex items-center gap-2 shrink-0">
              <Plus className="w-5 h-5 text-[#4318FF]" /> Add Event
            </h2>

            {/* Tab bar */}
            <div className="flex gap-1 p-1 bg-[#F4F7FE] rounded-2xl mb-6 shrink-0">
              {([
                { id: "caregiver" as const, label: "Caregiver Events",        icon: <Calendar className="w-3.5 h-3.5" />, activeClass: "bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] text-white shadow-sm" },
                { id: "care"      as const, label: "Patient Care Events",    icon: <Heart className="w-3.5 h-3.5" />,    activeClass: "bg-gradient-to-r from-orange-400 to-orange-500 text-white shadow-sm" },
                { id: "outdoor"   as const, label: "Patient Outdoor Events", icon: <MapPin className="w-3.5 h-3.5" />,   activeClass: "bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-sm" },
              ]).map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveEventTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeEventTab === tab.id ? tab.activeClass : "text-[#A3AED0] hover:text-[#2B3674]"}`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 px-1 pb-1">

            {/* ── Caregiver Event Form ── */}
            {activeEventTab === "caregiver" && (
              <form onSubmit={handleSaveCaregiverEvent} className="space-y-5">
                <div>
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">Event Title</label>
                  <input
                    type="text"
                    value={caregiverEventTitle}
                    onChange={(e) => setCaregiverEventTitle(e.target.value)}
                    placeholder="e.g., Grocery Shopping"
                    className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/40 transition-all placeholder:text-[#A3AED0] placeholder:font-normal"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">
                    <Calendar className="w-3.5 h-3.5 inline mr-1" />Start Date
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
                    <p className="text-sm font-bold text-[#2B3674]">End date</p>
                    <p className="text-xs text-[#A3AED0] mt-0.5">Set an end date for this event</p>
                  </div>
                  <div className={`w-11 h-6 rounded-full transition-all relative ${!caregiverEventIsNeverEnding ? "bg-gradient-to-r from-[#4318FF] to-[#8B5CF6]" : "bg-[#E0E5F2]"}`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${!caregiverEventIsNeverEnding ? "left-6" : "left-1"}`} />
                  </div>
                </div>
                {!caregiverEventIsNeverEnding && (
                  <div>
                    <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">End Date</label>
                    <input type="date" value={caregiverEventEndDate} min={caregiverEventStartDate} onChange={(e) => setCaregiverEventEndDate(e.target.value)} className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/40 transition-all" />
                  </div>
                )}
                {!caregiverEventIsNeverEnding && (
                  <div>
                    <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-3 block ml-1">Repeat</label>
                    <div className="space-y-2">
                      {([
                        { value: "daily",    label: "Daily" },
                        { value: "weekdays", label: "Weekdays (Mon – Fri)" },
                        { value: "weekly",   label: `Weekly on ${getDayName(caregiverEventStartDate)}` },
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
                    Event Time - {formatDisplayTime(caregiverEventTimeHour, caregiverEventTimeMinute, caregiverEventTimePeriod)}
                  </label>
                  <div className="p-4 bg-[#F4F7FE] rounded-xl">
                    <div className="grid grid-cols-3 gap-2">
                      <div><p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Hour</p><select value={caregiverEventTimeHour} onChange={(e) => setCaregiverEventTimeHour(e.target.value)} className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/40">{HOURS.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                      <div><p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Minute</p><select value={caregiverEventTimeMinute} onChange={(e) => setCaregiverEventTimeMinute(e.target.value)} className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/40">{MINUTES.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                      <div><p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Period</p><div className="flex rounded-lg overflow-hidden border border-[#E0E5F2]">{["AM","PM"].map(p => <button key={p} type="button" onClick={() => setCaregiverEventTimePeriod(p)} className={`flex-1 py-2.5 text-xs font-bold transition-all cursor-pointer ${caregiverEventTimePeriod === p ? "bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] text-white" : "bg-white text-[#A3AED0] hover:bg-[#F8F7FF]"}`}>{p}</button>)}</div></div>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-3 block ml-1">
                    End Time - {formatDisplayTime(caregiverEventEndTimeHour, caregiverEventEndTimeMinute, caregiverEventEndTimePeriod)}
                  </label>
                  <div className="p-4 bg-[#F4F7FE] rounded-xl">
                    <div className="grid grid-cols-3 gap-2">
                      <div><p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Hour</p><select value={caregiverEventEndTimeHour} onChange={(e) => setCaregiverEventEndTimeHour(e.target.value)} className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/40">{HOURS.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                      <div><p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Minute</p><select value={caregiverEventEndTimeMinute} onChange={(e) => setCaregiverEventEndTimeMinute(e.target.value)} className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/40">{MINUTES.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                      <div><p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Period</p><div className="flex rounded-lg overflow-hidden border border-[#E0E5F2]">{["AM","PM"].map(p => <button key={p} type="button" onClick={() => setCaregiverEventEndTimePeriod(p)} className={`flex-1 py-2.5 text-xs font-bold transition-all cursor-pointer ${caregiverEventEndTimePeriod === p ? "bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] text-white" : "bg-white text-[#A3AED0] hover:bg-[#F8F7FF]"}`}>{p}</button>)}</div></div>
                    </div>
                  </div>
                </div>
                <button type="submit" disabled={isSavingCaregiver} className="w-full py-4 mt-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {isSavingCaregiver && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSavingCaregiver ? "Saving..." : "Save Caregiver Event"}
                </button>
              </form>
            )}

            {/* ── Care Event Form ── */}
            {activeEventTab === "care" && (
              <form onSubmit={handleSaveCareEvent} className="space-y-5">
              <div className="relative z-10">
                <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">Event Title</label>
                <input
                  ref={careTypeInputRef}
                  type="text"
                  value={careEventType}
                  onChange={(e) => { setCareEventType(e.target.value); setShowCareTypeDropdown(true); }}
                  onFocus={() => setShowCareTypeDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCareTypeDropdown(false), 200)}
                  placeholder="e.g., Bathing"
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
                          {type}
                        </div>
                      ))}
                      <div
                        key="custom"
                        onClick={() => { setCareEventType(""); setShowCareTypeDropdown(false); setTimeout(() => careTypeInputRef.current?.focus(), 0); }}
                        className="px-4 py-2 mt-1 border-t border-slate-100 hover:bg-orange-50 rounded-lg cursor-pointer text-sm font-semibold text-orange-500 hover:text-orange-700"
                      >
                        ✏ Custom: type your own
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Start Date */}
              <div>
                <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">
                  <Calendar className="w-3.5 h-3.5 inline mr-1" />Start Date
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
                  <p className="text-sm font-bold text-[#2B3674]">End date</p>
                  <p className="text-xs text-[#A3AED0] mt-0.5">Set an end date for this event</p>
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
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-3 block ml-1">Repeat</label>
                  <div className="space-y-2">
                    {([
                      { value: "daily", label: "Daily" },
                      { value: "weekdays", label: "Weekdays (Mon – Fri)" },
                      { value: "weekly", label: `Weekly on ${getDayName(careEventStartDate)}` },
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
                  Event Time - {formatDisplayTime(careEventTimeHour, careEventTimeMinute, careEventTimePeriod)}
                </label>
                <div className="p-4 bg-[#F4F7FE] rounded-xl">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Hour</p>
                      <select
                        value={careEventTimeHour}
                        onChange={(e) => setCareEventTimeHour(e.target.value)}
                        className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      >
                        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Minute</p>
                      <select
                        value={careEventTimeMinute}
                        onChange={(e) => setCareEventTimeMinute(e.target.value)}
                        className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      >
                        {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Period</p>
                      <div className="flex rounded-lg overflow-hidden border border-[#E0E5F2]">
                        {["AM", "PM"].map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setCareEventTimePeriod(p)}
                            className={`flex-1 py-2.5 text-xs font-bold transition-all ${careEventTimePeriod === p ? "bg-orange-500 text-white" : "bg-white text-[#A3AED0] hover:bg-orange-50"}`}
                          >
                            {p}
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
                  End Time - {formatDisplayTime(careEventEndTimeHour, careEventEndTimeMinute, careEventEndTimePeriod)}
                </label>
                <div className="p-4 bg-[#F4F7FE] rounded-xl">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Hour</p>
                      <select
                        value={careEventEndTimeHour}
                        onChange={(e) => setCareEventEndTimeHour(e.target.value)}
                        className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      >
                        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Minute</p>
                      <select
                        value={careEventEndTimeMinute}
                        onChange={(e) => setCareEventEndTimeMinute(e.target.value)}
                        className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      >
                        {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Period</p>
                      <div className="flex rounded-lg overflow-hidden border border-[#E0E5F2]">
                        {["AM", "PM"].map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setCareEventEndTimePeriod(p)}
                            className={`flex-1 py-2.5 text-xs font-bold transition-all ${careEventEndTimePeriod === p ? "bg-orange-500 text-white" : "bg-white text-[#A3AED0] hover:bg-orange-50"}`}
                          >
                            {p}
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
                {isSavingCare ? "Saving..." : "Save Patient Care Event"}
              </button>
            </form>
            )}

            {/* ── Outdoor Event Form ── */}
            {activeEventTab === "outdoor" && (
              <form onSubmit={handleSaveOutdoorEvent} className="space-y-5">
                <div className="relative z-10">
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">Event Title</label>
                  <input ref={outdoorTypeInputRef} type="text" value={outdoorEventType} onChange={(e) => { setOutdoorEventType(e.target.value); setShowOutdoorTypeDropdown(true); }} onFocus={() => setShowOutdoorTypeDropdown(true)} onBlur={() => setTimeout(() => setShowOutdoorTypeDropdown(false), 200)} placeholder="e.g., Doctor Appointment" className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all placeholder:text-[#A3AED0]" />
                  <AnimatePresence>
                    {showOutdoorTypeDropdown && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-[70px] left-0 right-0 bg-white rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-slate-100 p-2 max-h-48 overflow-y-auto z-50">
                        {OUTDOOR_EVENT_TYPES.map(type => (
                          <div key={type} onClick={() => { setOutdoorEventType(type); setShowOutdoorTypeDropdown(false); }} className="px-4 py-2 hover:bg-emerald-50 rounded-lg cursor-pointer text-sm font-semibold text-slate-700 hover:text-emerald-700">{type}</div>
                        ))}
                        <div key="custom" onClick={() => { setOutdoorEventType(""); setShowOutdoorTypeDropdown(false); setTimeout(() => outdoorTypeInputRef.current?.focus(), 0); }} className="px-4 py-2 mt-1 border-t border-slate-100 hover:bg-emerald-50 rounded-lg cursor-pointer text-sm font-semibold text-emerald-600 hover:text-emerald-700">✏ Custom: type your own</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">
                    <Calendar className="w-3.5 h-3.5 inline mr-1" />Start Date
                  </label>
                  <input type="date" value={outdoorEventStartDate} onChange={(e) => setOutdoorEventStartDate(e.target.value)} className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                </div>
                <div className="flex items-center justify-between p-4 bg-[#F4F7FE] rounded-xl cursor-pointer select-none" onClick={() => { const on = outdoorEventIsNeverEnding; setOutdoorEventIsNeverEnding(v => !v); setOutdoorEventRecurrence(on ? "daily" : "none"); }}>
                  <div>
                    <p className="text-sm font-bold text-[#2B3674]">End date</p>
                    <p className="text-xs text-[#A3AED0] mt-0.5">Set an end date for this event</p>
                  </div>
                  <div className={`w-11 h-6 rounded-full transition-all relative ${!outdoorEventIsNeverEnding ? "bg-emerald-500" : "bg-[#E0E5F2]"}`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${!outdoorEventIsNeverEnding ? "left-6" : "left-1"}`} />
                  </div>
                </div>
                {!outdoorEventIsNeverEnding && (
                  <div>
                    <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">End Date</label>
                    <input type="date" value={outdoorEventEndDate} min={outdoorEventStartDate} onChange={(e) => setOutdoorEventEndDate(e.target.value)} className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                  </div>
                )}
                {!outdoorEventIsNeverEnding && (
                  <div>
                    <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-3 block ml-1">Repeat</label>
                    <div className="space-y-2">
                      {([
                        { value: "daily",    label: "Daily" },
                        { value: "weekdays", label: "Weekdays (Mon – Fri)" },
                        { value: "weekly",   label: `Weekly on ${getDayName(outdoorEventStartDate)}` },
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
                    Event Time - {formatDisplayTime(outdoorEventTimeHour, outdoorEventTimeMinute, outdoorEventTimePeriod)}
                  </label>
                  <div className="p-4 bg-[#F4F7FE] rounded-xl">
                    <div className="grid grid-cols-3 gap-2">
                      <div><p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Hour</p><select value={outdoorEventTimeHour} onChange={(e) => setOutdoorEventTimeHour(e.target.value)} className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-emerald-500/50">{HOURS.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                      <div><p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Minute</p><select value={outdoorEventTimeMinute} onChange={(e) => setOutdoorEventTimeMinute(e.target.value)} className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-emerald-500/50">{MINUTES.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                      <div><p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Period</p><div className="flex rounded-lg overflow-hidden border border-[#E0E5F2]">{["AM","PM"].map(p => <button key={p} type="button" onClick={() => setOutdoorEventTimePeriod(p)} className={`flex-1 py-2.5 text-xs font-bold transition-all cursor-pointer ${outdoorEventTimePeriod === p ? "bg-emerald-500 text-white" : "bg-white text-[#A3AED0] hover:bg-emerald-50"}`}>{p}</button>)}</div></div>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-3 block ml-1">
                    End Time - {formatDisplayTime(outdoorEventEndTimeHour, outdoorEventEndTimeMinute, outdoorEventEndTimePeriod)}
                  </label>
                  <div className="p-4 bg-[#F4F7FE] rounded-xl">
                    <div className="grid grid-cols-3 gap-2">
                      <div><p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Hour</p><select value={outdoorEventEndTimeHour} onChange={(e) => setOutdoorEventEndTimeHour(e.target.value)} className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-emerald-500/50">{HOURS.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                      <div><p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Minute</p><select value={outdoorEventEndTimeMinute} onChange={(e) => setOutdoorEventEndTimeMinute(e.target.value)} className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-emerald-500/50">{MINUTES.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                      <div><p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Period</p><div className="flex rounded-lg overflow-hidden border border-[#E0E5F2]">{["AM","PM"].map(p => <button key={p} type="button" onClick={() => setOutdoorEventEndTimePeriod(p)} className={`flex-1 py-2.5 text-xs font-bold transition-all cursor-pointer ${outdoorEventEndTimePeriod === p ? "bg-emerald-500 text-white" : "bg-white text-[#A3AED0] hover:bg-emerald-50"}`}>{p}</button>)}</div></div>
                    </div>
                  </div>
                </div>
                <button type="submit" disabled={isSavingOutdoor} className="w-full py-4 mt-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(16,185,129,0.3)] hover:shadow-[0_6px_25px_rgba(16,185,129,0.4)] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {isSavingOutdoor && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSavingOutdoor ? "Saving..." : "Save Patient Outdoor Event"}
                </button>
              </form>
            )}
            </div> {/* end scrollable form wrapper */}
          </div>

          {/* Combined Event List */}
          <div className="bg-white rounded-[26px] p-6 border border-[#EEEAFB] shadow-[0_4px_24px_-16px_rgba(67,24,255,0.12)] h-[680px] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 mb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <CalendarHeart className="w-4 h-4 text-[#4318FF]" />
                <h2 className="text-[18px] font-extrabold tracking-tight text-[#1F2247]">Event List</h2>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hideMealEvents}
                    onChange={e => setHideMealEvents(e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#4318FF] rounded cursor-pointer"
                  />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#6B7299]">Hide meals</span>
                </label>
                <span className="px-2.5 py-1 rounded-full bg-[#EDE9FE] text-[#4318FF] text-[10px] font-extrabold uppercase tracking-widest">
                  {filteredCombinedEvents.length} events
                </span>
              </div>
            </div>

            {/* Filter pills */}
            {(() => {
              const PILL_FILTERS = [
                { id: "all"       as const, label: "All",          color: "#4318FF" },
                { id: "caregiver" as const, label: "Caregiver",    color: "#4318FF" },
                { id: "care"      as const, label: "Patient Care", color: "#F59E0B" },
                { id: "outdoor"   as const, label: "Outdoor",      color: "#10B981" },
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
              {filteredCombinedEvents.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#F4F2FF] flex items-center justify-center mx-auto mb-3">
                    <CalendarHeart className="w-6 h-6 text-[#C4B6FB]" />
                  </div>
                  <p className="text-[13px] font-bold text-[#A3AED0]">No events scheduled.</p>
                </div>
              ) : (() => {
                const todayStr = new Date().toISOString().slice(0, 10);
                const EVENT_META = {
                  caregiver: { color: "#4318FF", bg: "#EDE9FE", label: "Caregiver" },
                  care:      { color: "#F59E0B", bg: "#FEF3C7", label: "Patient Care" },
                  outdoor:   { color: "#10B981", bg: "#DCFCE7", label: "Outdoor" },
                } as const;

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
                          {isToday ? "Today · " : ""}{d ? d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" }) : "No date"}
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
                                    {d.toLocaleString("en-US", { month: "short" })}
                                  </span>
                                  <span className="font-mono text-[18px] font-extrabold leading-none mt-0.5" style={{ color: meta.color }}>
                                    {d.getDate()}
                                  </span>
                                  <span className="text-[9px] font-bold mt-0.5" style={{ color: meta.color, opacity: 0.7 }}>
                                    {d.toLocaleString("en-US", { weekday: "short" })}
                                  </span>
                                </div>
                              )}
                              {/* Body */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-[14px] font-extrabold tracking-tight text-[#1F2247] truncate">{ev.title}</p>
                                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-widest"
                                    style={{ background: meta.bg, color: meta.color }}>
                                    {meta.label}
                                  </span>
                                  {isToday && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-[#FBBF24] text-[#1F2247] text-[9px] font-extrabold uppercase tracking-widest">Today</span>
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
                                    <span className="flex items-center gap-1 text-[11px] font-bold text-[#6B7299] capitalize">
                                      <Info className="w-3 h-3 shrink-0" />
                                      {ev.recurrence}
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
                                        toast.success("Event deleted");
                                      } catch { toast.error("Could not delete event"); }
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
    </div>
  );
}
