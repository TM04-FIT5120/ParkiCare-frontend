import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Pill, Clock, Plus, Info, Check, Search, AlertCircle, Trash2, CalendarHeart, Upload, MapPin, Calendar, X, Loader2, Camera, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useCareEvents } from "@/hooks/useCareEvents";
import { useAuth } from "@/context/AuthContext";
import { drugsService, type DrugBase } from "@/services/drugs";
import { careEventsService } from "@/services/careEvents";
import { scanMedicineLabel } from "@/services/ocr";
import { HistorySection } from "@/components/HistorySection";
import type { CareEvent } from "@/context/careEventsContext";
import { getMYTDateString } from "@/lib/eventRecurrence";
import { getMealSchedules, type MealScheduleEntry } from "@/services/mealSchedule";

const CARE_EVENT_TYPES = ["Bathing", "Nursing Care", "Toileting Assist", "Meals", "Exercise", "Physical Therapy"];
const OUTDOOR_EVENT_TYPES = ["Doctor Appointment", "Walk in Park", "Social Visit", "Shopping", "Recreation", "Family Outing"];
const FREQUENCIES = ["1 time/day", "2 times/day", "3 times/day"];
const HOURS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

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
  const { meds, addMed, deleteMed, events, addEvent, deleteEvent, togglePin, patientId } = useCareEvents();
  const { user } = useAuth();
  const caregiverId = user?.caregiverId ?? 0;

  // Refs for scroll-to on reuse
  const careEventFormRef = useRef<HTMLDivElement>(null);
  const outdoorEventFormRef = useRef<HTMLDivElement>(null);

  // Scroll to section when navigated with a URL hash (e.g. /care-events#medication-section)
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
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

  // --- Care Event state ---
  const [careEventTitle, setCareEventTitle] = useState("");
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
  const [outdoorEventTitle, setOutdoorEventTitle] = useState("");
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

  // Loading states for API-wired buttons
  const [isSavingMed, setIsSavingMed] = useState(false);
  const [isSavingCare, setIsSavingCare] = useState(false);
  const [isSavingOutdoor, setIsSavingOutdoor] = useState(false);
  const [deletingMedIds, setDeletingMedIds] = useState<Set<number>>(new Set());
  const [deletingCareIds, setDeletingCareIds] = useState<Set<number>>(new Set());
  const [deletingOutdoorIds, setDeletingOutdoorIds] = useState<Set<number>>(new Set());

  // Separate events into care and outdoor
  const careEvents = events.filter(ev => CARE_EVENT_TYPES.includes(ev.type) || ev.eventType === "home");
  const outdoorEvents = events.filter(ev => OUTDOOR_EVENT_TYPES.includes(ev.type) || ev.eventType === "outdoor");

  // Prefill form from a history item and scroll to it
  const handleReuse = (event: CareEvent) => {
    if (event.eventType === "home") {
      setCareEventTitle(event.title);
      if (event.type && event.type !== "Home Care") setCareEventType(event.type);
      setCareEventStartDate(getMYTDateString());
      setCareEventIsNeverEnding(true);
      setCareEventEndDate("");
      setCareEventRecurrence("none");
      setTimeout(() => {
        careEventFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
      toast.success("Care event prefilled. Review and save.");
    } else if (event.eventType === "outdoor") {
      setOutdoorEventTitle(event.title);
      if (event.type && event.type !== "Outdoor") setOutdoorEventType(event.type);
      setOutdoorEventStartDate(getMYTDateString());
      setOutdoorEventIsNeverEnding(true);
      setOutdoorEventEndDate("");
      setOutdoorEventRecurrence("none");
      setTimeout(() => {
        outdoorEventFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
      toast.success("Outdoor event prefilled. Review and save.");
    }
  };

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
          const created = await careEventsService.createMedication(
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
          addMed({
            remindId: created.remindId,
            drugId: created.drugId,
            name: selectedDrug.drugName,
            dose: finalDosage,
            frequency,
            time: remindTime,
            startDate: created.startDate,
            endDate: created.endDate ?? undefined,
            recurrence: created.recurrence ?? "none",
          });
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
    if (!careEventTitle || !careEventType) {
      toast.error("Please fill in all care event fields");
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
            careEventTitle,
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
        addEvent({ title: careEventTitle, type: careEventType, time: displayTime });
        toast.success("Care event saved locally");
      }

      setCareEventTitle("");
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
    if (!outdoorEventTitle || !outdoorEventType) {
      toast.error("Please fill in all outdoor event fields");
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
            outdoorEventTitle,
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
        addEvent({ title: outdoorEventTitle, type: outdoorEventType, time: displayTime });
        toast.success("Outdoor event saved locally");
      }

      setOutdoorEventTitle("");
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
        <div id="medication-section" className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start">

          {/* Add Medication Form */}
          <div className="bg-white rounded-[20px] p-4 sm:p-6 shadow-[0_18px_40px_rgba(112,144,176,0.12)] border-none relative overflow-hidden">
            <h2 className="text-xl font-bold text-[#2B3674] mb-6 flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#4318FF]" /> Add Medication
            </h2>

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

            {/* Progress Indicator + Form — only when form is interactive */}
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

                {/* Step 1: Medication — choice / OCR / manual */}
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

                    {/* OCR — Phase A: image capture */}
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

                    {/* OCR — Loading spinner */}
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
                              {selectedDrug ? `Selected: ${selectedDrug.drugName} — suggested dose: ${selectedDrug.dosage}` : "Type to search medications from the database."}
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
                    <div>
                      <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-3 block ml-1">Repeat</label>
                      <div className="space-y-2">
                        {([
                          { value: "daily", label: "Daily" },
                          { value: "weekdays", label: "Weekdays (Mon – Fri)" },
                          { value: "weekly", label: `Weekly on ${getDayName(startDate)}` },
                          { value: "none", label: "No repeat" },
                        ] as { value: "daily" | "weekdays" | "weekly" | "none"; label: string }[]).map(opt => {
                          // end date OFF → only "none" is selectable; end date ON → "none" is disabled
                          const disabled = isNeverEnding ? opt.value !== "none" : opt.value === "none";
                          return (
                            <label
                              key={opt.value}
                              className={`flex items-center gap-3 p-3.5 rounded-xl transition-all ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} ${recurrence === opt.value ? "bg-[#E9E3FF] border border-[#4318FF]/30" : disabled ? "bg-[#F4F7FE]" : "bg-[#F4F7FE] hover:bg-[#E9E3FF]/50"}`}
                            >
                              <input
                                type="radio"
                                name="recurrence"
                                value={opt.value}
                                checked={recurrence === opt.value}
                                onChange={() => setRecurrence(opt.value)}
                                disabled={disabled}
                                className="accent-[#4318FF] w-4 h-4"
                              />
                              <span className={`text-sm font-bold ${disabled ? "text-[#A3AED0]" : "text-[#2B3674]"}`}>{opt.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

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
                          <p className="text-xs text-[#A3AED0] mt-0.5">{dose || "—"}{manufacturerName ? ` · ${manufacturerName}` : ""}</p>
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
                          <p className="text-sm font-bold text-[#2B3674]">Oral · {quantity !== "" ? quantity : "—"} unit(s) per dose</p>
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
          <div className="space-y-4">

          {/* Medication List */}
          <div className="bg-white rounded-[20px] p-6 shadow-[0_18px_40px_rgba(112,144,176,0.12)] border-none">
            <h2 className="text-xl font-bold text-[#2B3674] mb-6 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Pill className="w-5 h-5 text-[#4318FF]" /> Medication List
              </span>
              <span className="px-3 py-1 bg-[#E9E3FF] text-[#4318FF] rounded-full text-xs font-bold">
                {meds.length} Active
              </span>
            </h2>

            <div className="space-y-4">
              {meds.length === 0 ? (
                <div className="p-8 text-center bg-[#F4F7FE] rounded-2xl border-none">
                  <AlertCircle className="w-8 h-8 text-[#A3AED0] mx-auto mb-3" />
                  <p className="text-sm font-bold text-[#A3AED0]">No medications scheduled.</p>
                </div>
              ) : (
                meds.map((med, index) => (
                  <div key={`med-${med.id || index}`} className="p-4 sm:p-5 rounded-[20px] bg-white border border-[#E0E5F2] hover:border-[#4318FF]/30 hover:shadow-[0_8px_20px_rgba(112,144,176,0.08)] transition-all group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 sm:gap-5">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#E9E3FF] flex items-center justify-center shrink-0">
                        <Pill className="w-5 h-5 sm:w-6 sm:h-6 text-[#4318FF]" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base sm:text-lg text-[#2B3674]">{med.name}</h3>
                        <div className="flex items-center gap-2 sm:gap-3 mt-1.5 flex-wrap">
                          <span className="text-xs font-bold text-[#4318FF] bg-[#F4F7FE] px-2 py-0.5 rounded-md">{med.dose}</span>
                          <span className="text-xs font-bold text-[#4318FF] bg-[#F4F7FE] px-2 py-0.5 rounded-md">{med.frequency}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 ml-auto">
                      <div className="flex items-center gap-1.5 text-[#4318FF] font-bold bg-[#E9E3FF] px-3 py-1.5 rounded-lg border-none">
                        <Clock className="w-4 h-4 text-[#4318FF]" />
                        {med.time}
                      </div>
                      <button
                        type="button"
                        disabled={deletingMedIds.has(med.remindId ?? med.id)}
                        onClick={async () => {
                          const key = med.remindId ?? med.id;
                          setDeletingMedIds(prev => new Set(prev).add(key));
                          try {
                            if (med.remindId) {
                              try { await careEventsService.deleteMedication(med.remindId, caregiverId); } catch { /* ignore */ }
                            }
                            deleteMed(med.id);
                          } finally {
                            setDeletingMedIds(prev => { const s = new Set(prev); s.delete(key); return s; });
                          }
                        }}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg sm:opacity-0 sm:group-hover:opacity-100 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {deletingMedIds.has(med.remindId ?? med.id)
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          </div>{/* End right column wrapper */}

        </div>

        {/* History Section */}
        <HistorySection
          events={events}
          onTogglePin={togglePin}
          onReuse={handleReuse}
        />

        {/* Care Events Row */}
        <div id="care-event-section" className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start">

          {/* Add Care Event Form */}
          <div ref={careEventFormRef} className="bg-white rounded-[20px] p-4 sm:p-6 shadow-[0_18px_40px_rgba(112,144,176,0.12)] border-none relative">
            <h2 className="text-xl font-bold text-[#2B3674] mb-6 flex items-center gap-2">
              <Plus className="w-5 h-5 text-orange-500" /> Add Care Event
            </h2>

            <form onSubmit={handleSaveCareEvent} className="space-y-5">
              <div>
                <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">Event Title</label>
                <input
                  type="text"
                  value={careEventTitle}
                  onChange={(e) => setCareEventTitle(e.target.value)}
                  placeholder="e.g., Morning Bath"
                  className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all placeholder:text-[#A3AED0]"
                />
              </div>

              <div className="relative z-10">
                <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">Category / Type</label>
                <input
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
                        onClick={() => { setCareEventType(""); setShowCareTypeDropdown(false); }}
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
              <div>
                <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-3 block ml-1">Repeat</label>
                <div className="space-y-2">
                  {([
                    { value: "daily", label: "Daily" },
                    { value: "weekdays", label: "Weekdays (Mon – Fri)" },
                    { value: "weekly", label: `Weekly on ${getDayName(careEventStartDate)}` },
                    { value: "none", label: "No repeat" },
                  ] as { value: "daily" | "weekdays" | "weekly" | "none"; label: string }[]).map(opt => {
                    const disabled = careEventIsNeverEnding ? opt.value !== "none" : opt.value === "none";
                    return (
                      <label
                        key={opt.value}
                        className={`flex items-center gap-3 p-3.5 rounded-xl transition-all ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} ${careEventRecurrence === opt.value ? "bg-orange-50 border border-orange-400/30" : disabled ? "bg-[#F4F7FE]" : "bg-[#F4F7FE] hover:bg-orange-50/50"}`}
                      >
                        <input
                          type="radio"
                          name="careRecurrence"
                          value={opt.value}
                          checked={careEventRecurrence === opt.value}
                          onChange={() => setCareEventRecurrence(opt.value)}
                          disabled={disabled}
                          className="accent-orange-500 w-4 h-4"
                        />
                        <span className={`text-sm font-bold ${disabled ? "text-[#A3AED0]" : "text-[#2B3674]"}`}>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

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
                {isSavingCare ? "Saving..." : "Save Care Event"}
              </button>
            </form>
          </div>

          {/* Care Events List */}
          <div className="bg-white rounded-[20px] p-6 shadow-[0_18px_40px_rgba(112,144,176,0.12)] border-none">
            <h2 className="text-xl font-bold text-[#2B3674] mb-6 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CalendarHeart className="w-5 h-5 text-orange-500" /> Care Event List
              </span>
              <span className="px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-xs font-bold">
                {careEvents.length} Events
              </span>
            </h2>

            <div className="space-y-4">
              {careEvents.length === 0 ? (
                <div className="p-8 text-center bg-[#F4F7FE] rounded-[20px] border-none">
                  <AlertCircle className="w-8 h-8 text-[#A3AED0] mx-auto mb-3" />
                  <p className="text-sm font-bold text-[#A3AED0]">No care events scheduled.</p>
                </div>
              ) : (
                careEvents.map((ev, index) => (
                  <div key={`care-event-${ev.id || index}`} className="p-4 sm:p-5 rounded-[20px] bg-white border border-[#E0E5F2] hover:shadow-[0_8px_20px_rgba(112,144,176,0.08)] transition-all group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 sm:gap-5">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                        <CalendarHeart className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base sm:text-lg text-[#2B3674]">{ev.title}</h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 ml-auto">
                      <div className="flex items-center gap-1.5 text-[#2B3674] font-bold bg-[#F4F7FE] px-3 py-1.5 rounded-lg border-none">
                        <Clock className="w-4 h-4 text-[#A3AED0]" />
                        {ev.time}
                      </div>
                      <button
                        type="button"
                        disabled={deletingCareIds.has(ev.backendId ?? ev.id)}
                        onClick={async () => {
                          const key = ev.backendId ?? ev.id;
                          setDeletingCareIds(prev => new Set(prev).add(key));
                          try {
                            if (ev.backendId && ev.eventType === "home") {
                              try { await careEventsService.deleteHomeCare(ev.backendId, caregiverId); } catch { /* ignore */ }
                            }
                            deleteEvent(ev.id);
                          } finally {
                            setDeletingCareIds(prev => { const s = new Set(prev); s.delete(key); return s; });
                          }
                        }}
                        className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg sm:opacity-0 sm:group-hover:opacity-100 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {deletingCareIds.has(ev.backendId ?? ev.id)
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Outdoor Events Row */}
        <div id="outdoor-event-section" className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start">

          {/* Add Outdoor Event Form */}
          <div ref={outdoorEventFormRef} className="bg-white rounded-[20px] p-4 sm:p-6 shadow-[0_18px_40px_rgba(112,144,176,0.12)] border-none relative">
            <h2 className="text-xl font-bold text-[#2B3674] mb-6 flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-500" /> Add Outdoor Event
            </h2>

            <form onSubmit={handleSaveOutdoorEvent} className="space-y-5">
              <div>
                <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">Event Title</label>
                <input
                  type="text"
                  value={outdoorEventTitle}
                  onChange={(e) => setOutdoorEventTitle(e.target.value)}
                  placeholder="e.g., Visit to Clinic"
                  className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all placeholder:text-[#A3AED0]"
                />
              </div>

              <div className="relative z-10">
                <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">Category / Type</label>
                <input
                  type="text"
                  value={outdoorEventType}
                  onChange={(e) => { setOutdoorEventType(e.target.value); setShowOutdoorTypeDropdown(true); }}
                  onFocus={() => setShowOutdoorTypeDropdown(true)}
                  onBlur={() => setTimeout(() => setShowOutdoorTypeDropdown(false), 200)}
                  placeholder="e.g., Doctor Appointment"
                  className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all placeholder:text-[#A3AED0]"
                />
                <AnimatePresence>
                  {showOutdoorTypeDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-[70px] left-0 right-0 bg-white rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-slate-100 p-2 max-h-48 overflow-y-auto z-50"
                    >
                      {OUTDOOR_EVENT_TYPES.map(type => (
                        <div
                          key={type}
                          onClick={() => { setOutdoorEventType(type); setShowOutdoorTypeDropdown(false); }}
                          className="px-4 py-2 hover:bg-green-50 rounded-lg cursor-pointer text-sm font-semibold text-slate-700 hover:text-green-700"
                        >
                          {type}
                        </div>
                      ))}
                      <div
                        key="custom"
                        onClick={() => { setOutdoorEventType(""); setShowOutdoorTypeDropdown(false); }}
                        className="px-4 py-2 mt-1 border-t border-slate-100 hover:bg-green-50 rounded-lg cursor-pointer text-sm font-semibold text-green-600 hover:text-green-700"
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
                  value={outdoorEventStartDate}
                  onChange={(e) => setOutdoorEventStartDate(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                />
              </div>

              {/* End date toggle */}
              <div
                className="flex items-center justify-between p-4 bg-[#F4F7FE] rounded-xl cursor-pointer select-none"
                onClick={() => {
                  const turningOn = outdoorEventIsNeverEnding;
                  setOutdoorEventIsNeverEnding(v => !v);
                  setOutdoorEventRecurrence(turningOn ? "daily" : "none");
                }}
              >
                <div>
                  <p className="text-sm font-bold text-[#2B3674]">End date</p>
                  <p className="text-xs text-[#A3AED0] mt-0.5">Set an end date for this event</p>
                </div>
                <div className={`w-11 h-6 rounded-full transition-all relative ${!outdoorEventIsNeverEnding ? "bg-green-500" : "bg-[#E0E5F2]"}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${!outdoorEventIsNeverEnding ? "left-6" : "left-1"}`} />
                </div>
              </div>

              {/* End date */}
              {!outdoorEventIsNeverEnding && (
                <div>
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">End Date</label>
                  <input
                    type="date"
                    value={outdoorEventEndDate}
                    min={outdoorEventStartDate}
                    onChange={(e) => setOutdoorEventEndDate(e.target.value)}
                    className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                  />
                </div>
              )}

              {/* Repeat */}
              <div>
                <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-3 block ml-1">Repeat</label>
                <div className="space-y-2">
                  {([
                    { value: "daily", label: "Daily" },
                    { value: "weekdays", label: "Weekdays (Mon – Fri)" },
                    { value: "weekly", label: `Weekly on ${getDayName(outdoorEventStartDate)}` },
                    { value: "none", label: "No repeat" },
                  ] as { value: "daily" | "weekdays" | "weekly" | "none"; label: string }[]).map(opt => {
                    const disabled = outdoorEventIsNeverEnding ? opt.value !== "none" : opt.value === "none";
                    return (
                      <label
                        key={opt.value}
                        className={`flex items-center gap-3 p-3.5 rounded-xl transition-all ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} ${outdoorEventRecurrence === opt.value ? "bg-green-50 border border-green-400/30" : disabled ? "bg-[#F4F7FE]" : "bg-[#F4F7FE] hover:bg-green-50/50"}`}
                      >
                        <input
                          type="radio"
                          name="outdoorRecurrence"
                          value={opt.value}
                          checked={outdoorEventRecurrence === opt.value}
                          onChange={() => setOutdoorEventRecurrence(opt.value)}
                          disabled={disabled}
                          className="accent-green-500 w-4 h-4"
                        />
                        <span className={`text-sm font-bold ${disabled ? "text-[#A3AED0]" : "text-[#2B3674]"}`}>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Event Time */}
              <div>
                <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-3 block ml-1">
                  Event Time - {formatDisplayTime(outdoorEventTimeHour, outdoorEventTimeMinute, outdoorEventTimePeriod)}
                </label>
                <div className="p-4 bg-[#F4F7FE] rounded-xl">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Hour</p>
                      <select
                        value={outdoorEventTimeHour}
                        onChange={(e) => setOutdoorEventTimeHour(e.target.value)}
                        className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-green-500/50"
                      >
                        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Minute</p>
                      <select
                        value={outdoorEventTimeMinute}
                        onChange={(e) => setOutdoorEventTimeMinute(e.target.value)}
                        className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-green-500/50"
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
                            onClick={() => setOutdoorEventTimePeriod(p)}
                            className={`flex-1 py-2.5 text-xs font-bold transition-all ${outdoorEventTimePeriod === p ? "bg-green-500 text-white" : "bg-white text-[#A3AED0] hover:bg-green-50"}`}
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
                  End Time  {formatDisplayTime(outdoorEventEndTimeHour, outdoorEventEndTimeMinute, outdoorEventEndTimePeriod)}
                </label>
                <div className="p-4 bg-[#F4F7FE] rounded-xl">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Hour</p>
                      <select
                        value={outdoorEventEndTimeHour}
                        onChange={(e) => setOutdoorEventEndTimeHour(e.target.value)}
                        className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-green-500/50"
                      >
                        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Minute</p>
                      <select
                        value={outdoorEventEndTimeMinute}
                        onChange={(e) => setOutdoorEventEndTimeMinute(e.target.value)}
                        className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-green-500/50"
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
                            onClick={() => setOutdoorEventEndTimePeriod(p)}
                            className={`flex-1 py-2.5 text-xs font-bold transition-all ${outdoorEventEndTimePeriod === p ? "bg-green-500 text-white" : "bg-white text-[#A3AED0] hover:bg-green-50"}`}
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
                disabled={isSavingOutdoor}
                className="w-full py-4 mt-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSavingOutdoor && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSavingOutdoor ? "Saving..." : "Save Outdoor Event"}
              </button>
            </form>
          </div>

          {/* Outdoor Events List */}
          <div className="bg-white rounded-[20px] p-6 shadow-[0_18px_40px_rgba(112,144,176,0.12)] border-none">
            <h2 className="text-xl font-bold text-[#2B3674] mb-6 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-green-500" /> Outdoor Event List
              </span>
              <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-bold">
                {outdoorEvents.length} Events
              </span>
            </h2>

            <div className="space-y-4">
              {outdoorEvents.length === 0 ? (
                <div className="p-8 text-center bg-[#F4F7FE] rounded-[20px] border-none">
                  <AlertCircle className="w-8 h-8 text-[#A3AED0] mx-auto mb-3" />
                  <p className="text-sm font-bold text-[#A3AED0]">No outdoor events scheduled.</p>
                </div>
              ) : (
                outdoorEvents.map((ev, index) => (
                  <div key={`outdoor-event-${ev.id || index}`} className="p-4 sm:p-5 rounded-[20px] bg-white border border-[#E0E5F2] hover:shadow-[0_8px_20px_rgba(112,144,176,0.08)] transition-all group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 sm:gap-5">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-green-500" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base sm:text-lg text-[#2B3674]">{ev.title}</h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 ml-auto">
                      <div className="flex items-center gap-1.5 text-[#2B3674] font-bold bg-[#F4F7FE] px-3 py-1.5 rounded-lg border-none">
                        <Clock className="w-4 h-4 text-[#A3AED0]" />
                        {ev.time}
                      </div>
                      <button
                        type="button"
                        disabled={deletingOutdoorIds.has(ev.backendId ?? ev.id)}
                        onClick={async () => {
                          const key = ev.backendId ?? ev.id;
                          setDeletingOutdoorIds(prev => new Set(prev).add(key));
                          try {
                            if (ev.backendId && ev.eventType === "outdoor") {
                              try { await careEventsService.deleteOutdoor(ev.backendId, caregiverId); } catch { /* ignore */ }
                            }
                            deleteEvent(ev.id);
                          } finally {
                            setDeletingOutdoorIds(prev => { const s = new Set(prev); s.delete(key); return s; });
                          }
                        }}
                        className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg sm:opacity-0 sm:group-hover:opacity-100 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {deletingOutdoorIds.has(ev.backendId ?? ev.id)
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
