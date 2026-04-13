import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Pill, Clock, Plus, Info, Check, Search, AlertCircle, Trash2, CalendarHeart, Upload, MapPin, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useCareEvents } from "@/hooks/useCareEvents";
import { useAuth } from "@/context/AuthContext";
import { drugsService, type DrugBase } from "@/services/drugs";
import { careEventsService } from "@/services/careEvents";

const CARE_EVENT_TYPES = ["Bathing", "Nursing Care", "Toileting Assist", "Meals", "Exercise", "Physical Therapy"];
const OUTDOOR_EVENT_TYPES = ["Doctor Appointment", "Walk in Park", "Social Visit", "Shopping", "Recreation", "Family Outing"];
const FREQUENCIES = ["1 time/day", "2 times/day", "3 times/day", "4 times/day", "As needed"];
const HOURS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

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

export function CareEventsPage() {
  const { meds, addMed, deleteMed, events, addEvent, deleteEvent, patientId } = useCareEvents();
  const { user } = useAuth();
  const caregiverId = user?.caregiverId ?? 0;

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
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isNeverEnding, setIsNeverEnding] = useState(true);
  const [endDate, setEndDate] = useState("");
  const [recurrence, setRecurrence] = useState<"daily" | "weekdays" | "weekly" | "none">("daily");
  // Frequency & meal timing
  const [frequency, setFrequency] = useState("2 times/day");
  const [mealTiming, setMealTiming] = useState<"before meals" | "after meals" | "with meals">("after meals");
  // Times
  const [medTimes, setMedTimes] = useState<{ hour: string; minute: string; period: string }[]>([
    { hour: "08", minute: "00", period: "AM" },
    { hour: "08", minute: "00", period: "PM" },
  ]);
  // Image upload (client-side only)
  const [medicationImage, setMedicationImage] = useState<File | null>(null);
  const [medicationImagePreview, setMedicationImagePreview] = useState<string | null>(null);
  // Dropdowns
  const [showMedsDropdown, setShowMedsDropdown] = useState(false);
  const [drugSearchResults, setDrugSearchResults] = useState<DrugBase[]>([]);
  const [showFreqDropdown, setShowFreqDropdown] = useState(false);
  const [medicationStep, setMedicationStep] = useState(1);
  const drugSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manufacturerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const [careEventStartDate, setCareEventStartDate] = useState(() => new Date().toISOString().slice(0, 10));
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
  const [outdoorEventStartDate, setOutdoorEventStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [outdoorEventIsNeverEnding, setOutdoorEventIsNeverEnding] = useState(true);
  const [outdoorEventEndDate, setOutdoorEventEndDate] = useState("");
  const [outdoorEventRecurrence, setOutdoorEventRecurrence] = useState<"daily" | "weekdays" | "weekly" | "none">("none");

  // Separate events into care and outdoor
  const careEvents = events.filter(ev => CARE_EVENT_TYPES.includes(ev.type) || ev.eventType === "home");
  const outdoorEvents = events.filter(ev => OUTDOOR_EVENT_TYPES.includes(ev.type) || ev.eventType === "outdoor");

  // Debounced drug name search
  useEffect(() => {
    if (drugSearchTimer.current) clearTimeout(drugSearchTimer.current);
    if (!medName.trim()) {
      setDrugSearchResults([]);
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
  }, [medName]);

  // Debounced manufacturer name search
  useEffect(() => {
    if (manufacturerSearchTimer.current) clearTimeout(manufacturerSearchTimer.current);
    if (!manufacturerName.trim()) {
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

  const handleFrequencyChange = (newFreq: string) => {
    setFrequency(newFreq);
    const count = parseInt(newFreq.match(/\d+/)?.[0] || "1");
    setMedTimes(Array(count).fill(null).map(() => ({ hour: "08", minute: "00", period: "AM" })));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (medicationImagePreview) URL.revokeObjectURL(medicationImagePreview);
    setMedicationImage(file);
    setMedicationImagePreview(URL.createObjectURL(file));
  };

  const resetMedicationForm = () => {
    setMedicationStep(1);
    setMedName("");
    setSelectedDrug(null);
    setManufacturerName("");
    setManufacturerSuggestions([]);
    setDose("");
    setDosagePart("oral");
    setQuantity(1);
    setIntakeMethod("");
    setStartDate(new Date().toISOString().slice(0, 10));
    setIsNeverEnding(true);
    setEndDate("");
    setRecurrence("daily");
    setFrequency("2 times/day");
    setMealTiming("after meals");
    setMedTimes([{ hour: "08", minute: "00", period: "AM" }, { hour: "08", minute: "00", period: "PM" }]);
    if (medicationImagePreview) URL.revokeObjectURL(medicationImagePreview);
    setMedicationImage(null);
    setMedicationImagePreview(null);
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
    const validTimes = medTimes.filter(t => t.hour && t.minute && t.period);
    if (validTimes.length === 0) {
      toast.error("Please add at least one administration time");
      return;
    }

    const adminTimesStr = validTimes.map(t => to24h(t.hour, t.minute, t.period)).join(",");
    const remindTime = to24h(validTimes[0].hour, validTimes[0].minute, validTimes[0].period);
    const finalDosage = dosagePart === "oral" ? dose.trim() : intakeMethod.trim();
    const finalQuantity = dosagePart === "oral" && quantity !== "" ? Number(quantity) : null;
    const finalIntakeMethod = dosagePart === "other" ? intakeMethod.trim() : null;
    const finalEndDate = isNeverEnding ? null : endDate || null;
    const finalRecurrence = recurrence === "none" ? null : recurrence;

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
        });
        toast.success("Medication scheduled successfully!");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save medication");
        return;
      }
    } else {
      validTimes.forEach(t => {
        addMed({ name: medName, dose: finalDosage, frequency, time: to24h(t.hour, t.minute, t.period) });
      });
      toast.success("Medication saved locally");
    }

    resetMedicationForm();
  };

  const handleNextStep = () => {
    if (medicationStep === 1) {
      // Image upload is optional — always allow proceeding
    }
    if (medicationStep === 2 && !medName.trim()) {
      toast.error("Please enter medication name");
      return;
    }
    if (medicationStep === 3) {
      if (dosagePart === "oral" && (!dose.trim() || quantity === "")) {
        toast.error("Please fill in both dosage and quantity for oral medication");
        return;
      }
      if (dosagePart === "other" && !intakeMethod.trim()) {
        toast.error("Please describe the intake method");
        return;
      }
    }
    if (medicationStep === 4) {
      if (!startDate) {
        toast.error("Please select a start date");
        return;
      }
      if (!isNeverEnding && endDate && endDate < startDate) {
        toast.error("End date cannot be before start date");
        return;
      }
    }
    if (medicationStep === 5 && !frequency.trim()) {
      toast.error("Please select frequency");
      return;
    }
    if (medicationStep === 6) {
      const validTimes = medTimes.filter(t => t.hour && t.minute && t.period);
      if (validTimes.length === 0) {
        toast.error("Please set at least one administration time");
        return;
      }
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
    setCareEventStartDate(new Date().toISOString().slice(0, 10));
    setCareEventIsNeverEnding(true);
    setCareEventEndDate("");
    setCareEventRecurrence("none");
    setCareEventEndTimeHour("09");
    setCareEventEndTimeMinute("00");
    setCareEventEndTimePeriod("AM");
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
    setOutdoorEventStartDate(new Date().toISOString().slice(0, 10));
    setOutdoorEventIsNeverEnding(true);
    setOutdoorEventEndDate("");
    setOutdoorEventRecurrence("none");
    setOutdoorEventEndTimeHour("09");
    setOutdoorEventEndTimeMinute("00");
    setOutdoorEventEndTimePeriod("AM");
  };

  const TOTAL_STEPS = 7;
  const STEP_LABELS = ["Photo", "Name", "Dosage", "Schedule", "Frequency", "Time", "Review"];

  return (
    <div className="pb-10">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#2B3674]">Care Events</h1>
        <p className="text-sm sm:text-base text-[#A3AED0] font-bold mt-1">Setup precise medication and care schedules.</p>
      </div>

      <div className="space-y-6 sm:space-y-8">

        {/* Medication Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start">

          {/* Add Medication Form */}
          <div className="bg-white rounded-[20px] p-4 sm:p-6 shadow-[0_18px_40px_rgba(112,144,176,0.12)] border-none relative">
            <h2 className="text-xl font-bold text-[#2B3674] mb-6 flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#4318FF]" /> Add Medication
            </h2>

            {/* Progress Indicator */}
            <div className="flex items-center justify-between mb-6">
              {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((step) => (
                <div key={step} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      medicationStep === step
                        ? "bg-[#4318FF] text-white scale-110"
                        : medicationStep > step
                        ? "bg-[#E9E3FF] text-[#4318FF]"
                        : "bg-[#F4F7FE] text-[#A3AED0]"
                    }`}>
                      {medicationStep > step ? <Check className="w-3.5 h-3.5" /> : step}
                    </div>
                    <span className={`text-[10px] font-bold hidden sm:block ${medicationStep === step ? "text-[#4318FF]" : "text-[#A3AED0]"}`}>
                      {STEP_LABELS[step - 1]}
                    </span>
                  </div>
                  {step < TOTAL_STEPS && (
                    <div className={`h-0.5 flex-1 mx-1 mb-3 transition-all ${medicationStep > step ? "bg-[#4318FF]" : "bg-[#F4F7FE]"}`} />
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); if (medicationStep === TOTAL_STEPS) handleSaveMedication(e); }} className="space-y-5">
              <AnimatePresence mode="wait">

                {/* Step 1: Image Upload */}
                {medicationStep === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                    <div>
                      <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">
                        Medication Photo <span className="text-[#A3AED0] normal-case font-normal">(optional)</span>
                      </label>

                      <div className="space-y-3 mb-4">
                        <div className="flex items-start gap-2 bg-[#E9E3FF]/50 p-3 rounded-xl">
                          <Info className="w-4 h-4 text-[#4318FF] shrink-0 mt-0.5" />
                          <p className="text-xs font-bold text-[#4318FF] leading-relaxed">
                            Upload one photo showing the medication name label to help you fill in the next step.
                          </p>
                        </div>
                        <div className="flex items-start gap-2 bg-[#F4F7FE] p-3 rounded-xl">
                          <Info className="w-4 h-4 text-[#A3AED0] shrink-0 mt-0.5" />
                          <p className="text-xs font-bold text-[#A3AED0] leading-relaxed">
                            We do not store or transmit this photo. It is used locally for input validation only.
                          </p>
                        </div>
                      </div>

                      <label className="w-full px-4 py-6 bg-[#F4F7FE] border-2 border-dashed border-[#4318FF]/30 rounded-xl text-sm font-bold text-[#4318FF] hover:bg-[#E9E3FF]/30 transition-all cursor-pointer flex flex-col items-center justify-center gap-2">
                        {medicationImagePreview ? (
                          <img src={medicationImagePreview} alt="Medication" className="max-h-32 rounded-lg object-contain" />
                        ) : (
                          <>
                            <Upload className="w-6 h-6" />
                            <span>Choose medication photo</span>
                            <span className="text-xs text-[#A3AED0] font-normal">Images only (JPG, PNG, etc.)</span>
                          </>
                        )}
                        {medicationImage && (
                          <span className="text-xs text-[#4318FF]">{medicationImage.name}</span>
                        )}
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="w-full py-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98]"
                    >
                      Next
                    </button>
                  </motion.div>
                )}

                {/* Step 2: Medication Name + Manufacturer */}
                {medicationStep === 2 && (
                  <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                    {/* Drug Name */}
                    <div className="relative z-20">
                      <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">
                        Medication Name
                      </label>
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#A3AED0]" />
                        <input
                          type="text"
                          value={medName}
                          onChange={(e) => { setMedName(e.target.value); setSelectedDrug(null); }}
                          onBlur={() => setTimeout(() => setShowMedsDropdown(false), 200)}
                          placeholder="e.g., Levodopa"
                          className="w-full pl-11 pr-4 py-3.5 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50 transition-all placeholder:text-[#A3AED0]"
                          autoFocus
                        />
                      </div>
                      <div className="mt-2 flex items-start gap-2 bg-[#E9E3FF]/50 p-3 rounded-xl">
                        <Info className="w-4 h-4 text-[#4318FF] shrink-0 mt-0.5" />
                        <p className="text-xs font-bold text-[#4318FF] leading-relaxed">
                          {selectedDrug
                            ? `Selected: ${selectedDrug.drugName} — suggested dose: ${selectedDrug.dosage}`
                            : "Type to search medications from the database."}
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
                                  if (drug.manufacturerName) setManufacturerName(drug.manufacturerName);
                                  if (frequency === "2 times/day" && drug.frequency) {
                                    const count = parseInt(drug.frequency.match(/\d+/)?.[0] || "2");
                                    setFrequency(drug.frequency);
                                    setMedTimes(Array(count).fill(null).map(() => ({ hour: "08", minute: "00", period: "AM" })));
                                  }
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

                    {/* Manufacturer Name */}
                    <div className="relative z-10">
                      <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">
                        Manufacturer Name <span className="text-[#A3AED0] normal-case font-normal">(optional)</span>
                      </label>
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#A3AED0]" />
                        <input
                          type="text"
                          value={manufacturerName}
                          onChange={(e) => { setManufacturerName(e.target.value); }}
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
                            {manufacturerSuggestions.map((name, i) => (
                              <div
                                key={i}
                                onClick={() => { setManufacturerName(name); setShowManufacturerDropdown(false); }}
                                className="px-4 py-2.5 hover:bg-indigo-50 rounded-lg cursor-pointer text-sm font-semibold text-slate-700 hover:text-indigo-700"
                              >
                                {name}
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="flex gap-3">
                      <button type="button" onClick={handlePrevStep} className="flex-1 py-4 bg-[#F4F7FE] hover:bg-[#E9E3FF] text-[#4318FF] font-bold rounded-xl transition-all active:scale-[0.98]">Back</button>
                      <button type="button" onClick={handleNextStep} className="flex-1 py-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] active:scale-[0.98]">Next</button>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Dosage */}
                {medicationStep === 3 && (
                  <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                    <div className="flex items-start gap-2 bg-[#E9E3FF]/50 p-3 rounded-xl">
                      <Info className="w-4 h-4 text-[#4318FF] shrink-0 mt-0.5" />
                      <p className="text-xs font-bold text-[#4318FF] leading-relaxed">
                        Fill <strong>Part 1</strong> for oral medication (tablet/capsule), or <strong>Part 2</strong> for other routes (nasal spray, topical, etc.). Only one part is required.
                      </p>
                    </div>

                    {/* Part toggle */}
                    <div className="flex rounded-xl overflow-hidden border border-[#E0E5F2]">
                      <button
                        type="button"
                        onClick={() => setDosagePart("oral")}
                        className={`flex-1 py-2.5 text-xs font-bold transition-all ${dosagePart === "oral" ? "bg-[#4318FF] text-white" : "bg-[#F4F7FE] text-[#A3AED0] hover:bg-[#E9E3FF]"}`}
                      >
                        Part 1 — Oral
                      </button>
                      <button
                        type="button"
                        onClick={() => setDosagePart("other")}
                        className={`flex-1 py-2.5 text-xs font-bold transition-all ${dosagePart === "other" ? "bg-[#4318FF] text-white" : "bg-[#F4F7FE] text-[#A3AED0] hover:bg-[#E9E3FF]"}`}
                      >
                        Part 2 — Other Route
                      </button>
                    </div>

                    {dosagePart === "oral" ? (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">Dosage (strength)</label>
                          <input
                            type="text"
                            value={dose}
                            onChange={(e) => setDose(e.target.value)}
                            placeholder="e.g., 100mg, 50mg"
                            className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50 transition-all placeholder:text-[#A3AED0]"
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">Quantity (units per dose)</label>
                          <input
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 1))}
                            placeholder="e.g., 1"
                            className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50 transition-all placeholder:text-[#A3AED0]"
                          />
                        </div>
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

                {/* Step 4: Schedule */}
                {medicationStep === 4 && (
                  <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
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
                      onClick={() => setIsNeverEnding(v => !v)}
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
                        ] as { value: "daily" | "weekdays" | "weekly" | "none"; label: string }[]).map(opt => (
                          <label
                            key={opt.value}
                            className={`flex items-center gap-3 p-3.5 rounded-xl cursor-pointer transition-all ${recurrence === opt.value ? "bg-[#E9E3FF] border border-[#4318FF]/30" : "bg-[#F4F7FE] hover:bg-[#E9E3FF]/50"}`}
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

                    <div className="flex gap-3">
                      <button type="button" onClick={handlePrevStep} className="flex-1 py-4 bg-[#F4F7FE] hover:bg-[#E9E3FF] text-[#4318FF] font-bold rounded-xl transition-all active:scale-[0.98]">Back</button>
                      <button type="button" onClick={handleNextStep} className="flex-1 py-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] active:scale-[0.98]">Next</button>
                    </div>
                  </motion.div>
                )}

                {/* Step 5: Frequency + Meal Timing */}
                {medicationStep === 5 && (
                  <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
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
                        autoFocus
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

                    <div className="flex gap-3">
                      <button type="button" onClick={handlePrevStep} className="flex-1 py-4 bg-[#F4F7FE] hover:bg-[#E9E3FF] text-[#4318FF] font-bold rounded-xl transition-all active:scale-[0.98]">Back</button>
                      <button type="button" onClick={handleNextStep} className="flex-1 py-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] active:scale-[0.98]">Next</button>
                    </div>
                  </motion.div>
                )}

                {/* Step 6: Administration Times */}
                {medicationStep === 6 && (
                  <motion.div key="step6" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                    <div>
                      <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-3 block ml-1">
                        Administration Times
                      </label>
                      <div className="space-y-4">
                        {medTimes.map((t, idx) => (
                          <div key={idx} className="p-4 bg-[#F4F7FE] rounded-xl space-y-3">
                            <p className="text-xs font-bold text-[#4318FF]">Dose {idx + 1} — {formatDisplayTime(t.hour, t.minute, t.period)}</p>
                            <div className="grid grid-cols-3 gap-2">
                              {/* Hour */}
                              <div>
                                <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Hour</p>
                                <select
                                  value={t.hour}
                                  onChange={(e) => {
                                    const updated = [...medTimes];
                                    updated[idx] = { ...updated[idx], hour: e.target.value };
                                    setMedTimes(updated);
                                  }}
                                  className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50"
                                >
                                  {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                              </div>
                              {/* Minute */}
                              <div>
                                <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Minute</p>
                                <select
                                  value={t.minute}
                                  onChange={(e) => {
                                    const updated = [...medTimes];
                                    updated[idx] = { ...updated[idx], minute: e.target.value };
                                    setMedTimes(updated);
                                  }}
                                  className="w-full px-2 py-2.5 bg-white border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50"
                                >
                                  {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                              </div>
                              {/* AM/PM */}
                              <div>
                                <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Period</p>
                                <div className="flex rounded-lg overflow-hidden border border-[#E0E5F2]">
                                  {["AM", "PM"].map(p => (
                                    <button
                                      key={p}
                                      type="button"
                                      onClick={() => {
                                        const updated = [...medTimes];
                                        updated[idx] = { ...updated[idx], period: p };
                                        setMedTimes(updated);
                                      }}
                                      className={`flex-1 py-2.5 text-xs font-bold transition-all ${t.period === p ? "bg-[#4318FF] text-white" : "bg-white text-[#A3AED0] hover:bg-[#F4F7FE]"}`}
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
                    </div>

                    <div className="flex gap-3">
                      <button type="button" onClick={handlePrevStep} className="flex-1 py-4 bg-[#F4F7FE] hover:bg-[#E9E3FF] text-[#4318FF] font-bold rounded-xl transition-all active:scale-[0.98]">Back</button>
                      <button type="button" onClick={handleNextStep} className="flex-1 py-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] active:scale-[0.98]">Next</button>
                    </div>
                  </motion.div>
                )}

                {/* Step 7: Review & Confirm */}
                {medicationStep === 7 && (
                  <motion.div key="step7" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                    <h3 className="text-lg font-bold text-[#2B3674] mb-2">Review Your Medication</h3>

                    {/* Image */}
                    <div onClick={() => handleEditField(1)} className="p-4 bg-[#F4F7FE] rounded-xl hover:bg-[#E9E3FF] cursor-pointer transition-all group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {medicationImagePreview ? (
                            <img src={medicationImagePreview} alt="Med" className="w-10 h-10 rounded-lg object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-[#E9E3FF] flex items-center justify-center">
                              <Upload className="w-4 h-4 text-[#4318FF]" />
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-0.5">Photo</p>
                            <p className="text-sm font-bold text-[#2B3674]">{medicationImage?.name || "No photo uploaded"}</p>
                          </div>
                        </div>
                        <span className="text-xs text-[#4318FF] opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                      </div>
                    </div>

                    {/* Name + Manufacturer */}
                    <div onClick={() => handleEditField(2)} className="p-4 bg-[#F4F7FE] rounded-xl hover:bg-[#E9E3FF] cursor-pointer transition-all group">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-0.5">Medication</p>
                          <p className="text-sm font-bold text-[#2B3674]">{medName || "Not set"}</p>
                          {manufacturerName && <p className="text-xs text-[#A3AED0] mt-0.5">{manufacturerName}</p>}
                        </div>
                        <span className="text-xs text-[#4318FF] opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                      </div>
                    </div>

                    {/* Dosage */}
                    <div onClick={() => handleEditField(3)} className="p-4 bg-[#F4F7FE] rounded-xl hover:bg-[#E9E3FF] cursor-pointer transition-all group">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-0.5">Dosage</p>
                          {dosagePart === "oral" ? (
                            <p className="text-sm font-bold text-[#2B3674]">{dose || "—"} × {quantity !== "" ? quantity : "—"} unit(s)</p>
                          ) : (
                            <p className="text-sm font-bold text-[#2B3674]">{intakeMethod || "Not set"}</p>
                          )}
                        </div>
                        <span className="text-xs text-[#4318FF] opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                      </div>
                    </div>

                    {/* Schedule */}
                    <div onClick={() => handleEditField(4)} className="p-4 bg-[#F4F7FE] rounded-xl hover:bg-[#E9E3FF] cursor-pointer transition-all group">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-0.5">Schedule</p>
                          <p className="text-sm font-bold text-[#2B3674]">
                            From {startDate} {isNeverEnding ? "— ongoing" : endDate ? `to ${endDate}` : ""}
                          </p>
                          <p className="text-xs text-[#A3AED0] mt-0.5 capitalize">
                            {recurrence === "none" ? "No repeat" : recurrence === "weekly" ? `Weekly on ${getDayName(startDate)}` : recurrence}
                          </p>
                        </div>
                        <span className="text-xs text-[#4318FF] opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                      </div>
                    </div>

                    {/* Frequency + Meal Timing */}
                    <div onClick={() => handleEditField(5)} className="p-4 bg-[#F4F7FE] rounded-xl hover:bg-[#E9E3FF] cursor-pointer transition-all group">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-0.5">Frequency</p>
                          <p className="text-sm font-bold text-[#2B3674]">{frequency} — {mealTiming}</p>
                        </div>
                        <span className="text-xs text-[#4318FF] opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                      </div>
                    </div>

                    {/* Times */}
                    <div onClick={() => handleEditField(6)} className="p-4 bg-[#F4F7FE] rounded-xl hover:bg-[#E9E3FF] cursor-pointer transition-all group">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-1">Administration Times</p>
                          <div className="flex flex-wrap gap-2">
                            {medTimes.map((t, idx) => (
                              <span key={idx} className="text-xs font-bold text-[#4318FF] bg-white px-2.5 py-1 rounded-md border border-[#E9E3FF]">
                                {formatDisplayTime(t.hour, t.minute, t.period)}
                              </span>
                            ))}
                          </div>
                        </div>
                        <span className="text-xs text-[#4318FF] opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-1">
                      <button type="button" onClick={handlePrevStep} className="flex-1 py-4 bg-[#F4F7FE] hover:bg-[#E9E3FF] text-[#4318FF] font-bold rounded-xl transition-all active:scale-[0.98]">Back</button>
                      <button type="submit" className="flex-1 py-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98]">
                        Confirm & Save
                      </button>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </form>
          </div>

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
                        onClick={async () => {
                          if (med.remindId) {
                            try { await careEventsService.deleteMedication(med.remindId, caregiverId); } catch { /* ignore */ }
                          }
                          deleteMed(med.id);
                        }}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Care Events Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start">

          {/* Add Care Event Form */}
          <div className="bg-white rounded-[20px] p-4 sm:p-6 shadow-[0_18px_40px_rgba(112,144,176,0.12)] border-none relative">
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
                        ✏ Custom — type your own
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
                onClick={() => setCareEventIsNeverEnding(v => !v)}
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
                  ] as { value: "daily" | "weekdays" | "weekly" | "none"; label: string }[]).map(opt => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-3 p-3.5 rounded-xl cursor-pointer transition-all ${careEventRecurrence === opt.value ? "bg-orange-50 border border-orange-400/30" : "bg-[#F4F7FE] hover:bg-orange-50/50"}`}
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

              {/* Event Time */}
              <div>
                <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-3 block ml-1">
                  Event Time — {formatDisplayTime(careEventTimeHour, careEventTimeMinute, careEventTimePeriod)}
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
                  End Time — {formatDisplayTime(careEventEndTimeHour, careEventEndTimeMinute, careEventEndTimePeriod)}
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
                className="w-full py-4 mt-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98]"
              >
                Save Care Event
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
                        onClick={async () => {
                          if (ev.backendId && ev.eventType === "home") {
                            try { await careEventsService.deleteHomeCare(ev.backendId, caregiverId); } catch { /* ignore */ }
                          }
                          deleteEvent(ev.id);
                        }}
                        className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Outdoor Events Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start">

          {/* Add Outdoor Event Form */}
          <div className="bg-white rounded-[20px] p-4 sm:p-6 shadow-[0_18px_40px_rgba(112,144,176,0.12)] border-none relative">
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
                        ✏ Custom — type your own
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
                onClick={() => setOutdoorEventIsNeverEnding(v => !v)}
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
                  ] as { value: "daily" | "weekdays" | "weekly" | "none"; label: string }[]).map(opt => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-3 p-3.5 rounded-xl cursor-pointer transition-all ${outdoorEventRecurrence === opt.value ? "bg-green-50 border border-green-400/30" : "bg-[#F4F7FE] hover:bg-green-50/50"}`}
                    >
                      <input
                        type="radio"
                        name="outdoorRecurrence"
                        value={opt.value}
                        checked={outdoorEventRecurrence === opt.value}
                        onChange={() => setOutdoorEventRecurrence(opt.value)}
                        className="accent-green-500 w-4 h-4"
                      />
                      <span className="text-sm font-bold text-[#2B3674]">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Event Time */}
              <div>
                <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-3 block ml-1">
                  Event Time — {formatDisplayTime(outdoorEventTimeHour, outdoorEventTimeMinute, outdoorEventTimePeriod)}
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
                  End Time — {formatDisplayTime(outdoorEventEndTimeHour, outdoorEventEndTimeMinute, outdoorEventEndTimePeriod)}
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
                className="w-full py-4 mt-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98]"
              >
                Save Outdoor Event
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
                        onClick={async () => {
                          if (ev.backendId && ev.eventType === "outdoor") {
                            try { await careEventsService.deleteOutdoor(ev.backendId, caregiverId); } catch { /* ignore */ }
                          }
                          deleteEvent(ev.id);
                        }}
                        className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
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
