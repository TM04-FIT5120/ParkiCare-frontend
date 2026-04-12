import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Pill, Clock, Plus, Info, Check, Search, AlertCircle, Trash2, CalendarHeart, Upload, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useCareEvents } from "@/hooks/useCareEvents";
import { drugsService, type DrugBase } from "@/services/drugs";
import { careEventsService } from "@/services/careEvents";
const CARE_EVENT_TYPES = ["Bathing", "Nursing Care", "Toileting Assist", "Meals", "Exercise", "Physical Therapy"];
const OUTDOOR_EVENT_TYPES = ["Doctor Appointment", "Walk in Park", "Social Visit", "Shopping", "Recreation", "Family Outing"];
const FREQUENCIES = ["1 time/day", "2 times/day", "3 times/day", "4 times/day", "As needed"];

export function CareEventsPage() {
  const { meds, addMed, deleteMed, events, addEvent, deleteEvent, patientId } = useCareEvents();

  // Medication state
  const [medName, setMedName] = useState("");
  const [selectedDrug, setSelectedDrug] = useState<DrugBase | null>(null);
  const [dose, setDose] = useState("");
  const [frequency, setFrequency] = useState("2 times/day");
  const [medTimes, setMedTimes] = useState(["", ""]);
  const [showMedsDropdown, setShowMedsDropdown] = useState(false);
  const [drugSearchResults, setDrugSearchResults] = useState<DrugBase[]>([]);
  const [showFreqDropdown, setShowFreqDropdown] = useState(false);
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [medicationStep, setMedicationStep] = useState(1);
  const drugSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Care Event state
  const [careEventTitle, setCareEventTitle] = useState("");
  const [careEventType, setCareEventType] = useState("Bathing");
  const [careEventTime, setCareEventTime] = useState("");
  const [showCareTypeDropdown, setShowCareTypeDropdown] = useState(false);

  // Outdoor Event state
  const [outdoorEventTitle, setOutdoorEventTitle] = useState("");
  const [outdoorEventType, setOutdoorEventType] = useState("Doctor Appointment");
  const [outdoorEventTime, setOutdoorEventTime] = useState("");
  const [showOutdoorTypeDropdown, setShowOutdoorTypeDropdown] = useState(false);

  // Separate events into care and outdoor
  const careEvents = events.filter(ev => CARE_EVENT_TYPES.includes(ev.type) || ev.eventType === "home");
  const outdoorEvents = events.filter(ev => OUTDOOR_EVENT_TYPES.includes(ev.type) || ev.eventType === "outdoor");

  // Debounced live drug search
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
    return () => {
      if (drugSearchTimer.current) clearTimeout(drugSearchTimer.current);
    };
  }, [medName]);

  // Update time slots when frequency changes
  const handleFrequencyChange = (newFreq: string) => {
    setFrequency(newFreq);
    const timesPerDay = parseInt(newFreq.match(/\d+/)?.[0] || "1");
    setMedTimes(Array(timesPerDay).fill(""));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPrescriptionFile(file);
      toast.success(`Prescription "${file.name}" uploaded`);
    }
  };

  const handleSaveMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName || !dose || !frequency) {
      toast.error("Please fill in all medication fields");
      return;
    }

    const validTimes = medTimes.filter(t => t !== "");
    if (validTimes.length === 0) {
      toast.error("Please add at least one administration time");
      return;
    }

    if (!prescriptionFile) {
      toast.error("Please upload a prescription file");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const adminTimes = validTimes.join(",");
    const remindTime = validTimes[0];

    if (patientId && selectedDrug) {
      try {
        const created = await careEventsService.createMedication(
          patientId,
          selectedDrug.drugId,
          dose,
          frequency,
          adminTimes,
          remindTime,
          today,
          "",
        );
        addMed({
          remindId: created.remindId,
          drugId: created.drugId,
          name: selectedDrug.drugName,
          dose,
          frequency,
          time: remindTime,
        });
        toast.success("Medication scheduled successfully!");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save medication");
        return;
      }
    } else {
      // Fallback: local-only if no patientId or drug not resolved via API
      validTimes.forEach(time => {
        addMed({ name: medName, dose, frequency, time });
      });
      toast.success("Medication saved locally");
    }

    setMedName("");
    setSelectedDrug(null);
    setDose("");
    setFrequency("2 times/day");
    setMedTimes(["", ""]);
    setPrescriptionFile(null);
    setMedicationStep(1);
  };

  const handleNextStep = () => {
    // Validation for each step
    if (medicationStep === 1 && !medName.trim()) {
      toast.error("Please enter medication name");
      return;
    }
    if (medicationStep === 2 && !dose.trim()) {
      toast.error("Please enter dosage");
      return;
    }
    if (medicationStep === 3 && !frequency.trim()) {
      toast.error("Please select frequency");
      return;
    }
    if (medicationStep === 4) {
      const validTimes = medTimes.filter(t => t !== "");
      if (validTimes.length === 0) {
        toast.error("Please add at least one administration time");
        return;
      }
    }
    if (medicationStep === 5 && !prescriptionFile) {
      toast.error("Please upload a prescription file");
      return;
    }
    
    setMedicationStep(medicationStep + 1);
  };

  const handlePrevStep = () => {
    setMedicationStep(medicationStep - 1);
  };

  const handleEditField = (step: number) => {
    setMedicationStep(step);
  };

  const handleSaveCareEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!careEventTitle || !careEventType || !careEventTime) {
      toast.error("Please fill in all care event fields");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const startDatetime = `${today}T${careEventTime}:00`;
    const endDt = new Date(`${today}T${careEventTime}:00`);
    endDt.setHours(endDt.getHours() + 1);
    const endDatetimeFinal = endDt.toISOString().slice(0, 19);

    if (patientId) {
      try {
        const created = await careEventsService.createHomeCare(
          patientId,
          careEventTitle,
          startDatetime,
          endDatetimeFinal,
          "",
        );
        addEvent({
          backendId: created.id,
          eventType: "home",
          title: created.homeCareTitle,
          type: careEventType,
          time: careEventTime,
          startDatetime: created.startDatetime,
          endDatetime: created.endDatetime,
        });
        toast.success("Care event scheduled successfully!");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save care event");
        return;
      }
    } else {
      addEvent({ title: careEventTitle, type: careEventType, time: careEventTime });
      toast.success("Care event saved locally");
    }

    setCareEventTitle("");
    setCareEventTime("");
    setCareEventType("Bathing");
  };

  const handleSaveOutdoorEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outdoorEventTitle || !outdoorEventType || !outdoorEventTime) {
      toast.error("Please fill in all outdoor event fields");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const startDatetime = `${today}T${outdoorEventTime}:00`;
    const endDt = new Date(`${today}T${outdoorEventTime}:00`);
    endDt.setHours(endDt.getHours() + 1);
    const endDatetime = endDt.toISOString().slice(0, 19);

    if (patientId) {
      try {
        const created = await careEventsService.createOutdoor(
          patientId,
          outdoorEventTitle,
          startDatetime,
          endDatetime,
          "",
        );
        addEvent({
          backendId: created.id,
          eventType: "outdoor",
          title: created.outdoorTitle,
          type: outdoorEventType,
          time: outdoorEventTime,
          startDatetime: created.startDatetime,
          endDatetime: created.endDatetime,
        });
        toast.success("Outdoor event scheduled successfully!");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save outdoor event");
        return;
      }
    } else {
      addEvent({ title: outdoorEventTitle, type: outdoorEventType, time: outdoorEventTime });
      toast.success("Outdoor event saved locally");
    }

    setOutdoorEventTitle("");
    setOutdoorEventTime("");
    setOutdoorEventType("Doctor Appointment");
  };

  return (
    <div className="pb-10">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#2B3674]">Care Events</h1>
        <p className="text-sm sm:text-base text-[#A3AED0] font-bold mt-1">Setup precise medication and care schedules.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 lg:gap-8">
        
        {/* Left Column: Forms */}
        <div className="md:col-span-7 space-y-6">

          {/* Add Medication Form */}
          <div className="bg-white rounded-[20px] p-4 sm:p-6 shadow-[0_18px_40px_rgba(112,144,176,0.12)] border-none relative">
            <h2 className="text-xl font-bold text-[#2B3674] mb-6 flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#4318FF]" /> Add Medication
            </h2>
            
            {/* Progress Indicator */}
            <div className="flex items-center justify-between mb-6">
              {[1, 2, 3, 4, 5, 6].map((step) => (
                <div key={step} className="flex items-center flex-1 last:flex-none">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    medicationStep === step 
                      ? 'bg-[#4318FF] text-white scale-110' 
                      : medicationStep > step 
                      ? 'bg-[#E9E3FF] text-[#4318FF]' 
                      : 'bg-[#F4F7FE] text-[#A3AED0]'
                  }`}>
                    {medicationStep > step ? <Check className="w-4 h-4" /> : step}
                  </div>
                  {step < 6 && (
                    <div className={`h-0.5 flex-1 mx-1 transition-all ${
                      medicationStep > step ? 'bg-[#4318FF]' : 'bg-[#F4F7FE]'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              if (medicationStep === 6) {
                handleSaveMedication(e);
              }
            }} className="space-y-5">
              
              <AnimatePresence mode="wait">
                {/* Step 1: Medication Name */}
                {medicationStep === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-5"
                  >
                    <div className="relative z-20">
                      <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">
                        Medication Name
                      </label>
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#A3AED0]" />
                        <input
                          type="text"
                          value={medName}
                          onChange={(e) => {
                            setMedName(e.target.value);
                            setSelectedDrug(null);
                          }}
                          onBlur={() => setTimeout(() => setShowMedsDropdown(false), 200)}
                          placeholder="e.g., Levodopa"
                          className="w-full pl-11 pr-4 py-3.5 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50 transition-all placeholder:text-[#A3AED0]"
                        />
                      </div>

                      <div className="mt-2 flex items-start gap-2 bg-[#E9E3FF]/50 p-3 rounded-xl border-none">
                        <Info className="w-4 h-4 text-[#4318FF] shrink-0 mt-0.5" />
                        <p className="text-xs font-bold text-[#4318FF] leading-relaxed">
                          {selectedDrug
                            ? `Selected: ${selectedDrug.drugName} — suggested dose: ${selectedDrug.dosage}`
                            : "Tip: Type to search medications from the database."}
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
                                  if (!dose) setDose(drug.dosage);
                                  if (frequency === "2 times/day" && drug.frequency) {
                                    setFrequency(drug.frequency);
                                    const count = parseInt(drug.frequency.match(/\d+/)?.[0] || "2");
                                    setMedTimes(Array(count).fill(""));
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
                    
                    <button 
                      type="button"
                      onClick={handleNextStep}
                      className="w-full py-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98]"
                    >
                      Next
                    </button>
                  </motion.div>
                )}

                {/* Step 2: Dosage */}
                {medicationStep === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-5"
                  >
                    <div>
                      <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">Dosage</label>
                      <input 
                        type="text" 
                        value={dose}
                        onChange={(e) => setDose(e.target.value)}
                        placeholder="e.g., 100mg"
                        className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50 transition-all placeholder:text-[#A3AED0]"
                        autoFocus
                      />
                    </div>
                    
                    <div className="flex gap-3">
                      <button 
                        type="button"
                        onClick={handlePrevStep}
                        className="flex-1 py-4 bg-[#F4F7FE] hover:bg-[#E9E3FF] text-[#4318FF] font-bold rounded-xl transition-all active:scale-[0.98]"
                      >
                        Back
                      </button>
                      <button 
                        type="button"
                        onClick={handleNextStep}
                        className="flex-1 py-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98]"
                      >
                        Next
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Frequency */}
                {medicationStep === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-5"
                  >
                    <div className="relative z-10">
                      <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">Frequency</label>
                      <input 
                        type="text"
                        value={frequency}
                        onChange={(e) => {
                          setFrequency(e.target.value);
                          setShowFreqDropdown(true);
                        }}
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
                                onClick={() => {
                                  handleFrequencyChange(freq);
                                  setShowFreqDropdown(false);
                                }}
                                className="px-4 py-2 hover:bg-indigo-50 rounded-lg cursor-pointer text-sm font-semibold text-slate-700 hover:text-indigo-700"
                              >
                                {freq}
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    
                    <div className="flex gap-3">
                      <button 
                        type="button"
                        onClick={handlePrevStep}
                        className="flex-1 py-4 bg-[#F4F7FE] hover:bg-[#E9E3FF] text-[#4318FF] font-bold rounded-xl transition-all active:scale-[0.98]"
                      >
                        Back
                      </button>
                      <button 
                        type="button"
                        onClick={handleNextStep}
                        className="flex-1 py-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98]"
                      >
                        Next
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 4: Administration Times */}
                {medicationStep === 4 && (
                  <motion.div
                    key="step4"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-5"
                  >
                    <div>
                      <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">
                        Administration Times
                      </label>
                      <div className="space-y-3">
                        {medTimes.map((time, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#4318FF] w-16">Time {index + 1}:</span>
                            <input 
                              type="time" 
                              value={time}
                              onChange={(e) => {
                                const newTimes = [...medTimes];
                                newTimes[index] = e.target.value;
                                setMedTimes(newTimes);
                              }}
                              className="flex-1 px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50 transition-all"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <button 
                        type="button"
                        onClick={handlePrevStep}
                        className="flex-1 py-4 bg-[#F4F7FE] hover:bg-[#E9E3FF] text-[#4318FF] font-bold rounded-xl transition-all active:scale-[0.98]"
                      >
                        Back
                      </button>
                      <button 
                        type="button"
                        onClick={handleNextStep}
                        className="flex-1 py-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98]"
                      >
                        Next
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 5: Upload Prescription */}
                {medicationStep === 5 && (
                  <motion.div
                    key="step5"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-5"
                  >
                    <div>
                      <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">
                        Upload Prescription <span className="text-red-500">*</span>
                      </label>
                      <label className="w-full px-4 py-6 bg-[#F4F7FE] border-2 border-dashed border-[#4318FF]/30 rounded-xl text-sm font-bold text-[#4318FF] hover:bg-[#E9E3FF]/30 transition-all cursor-pointer flex flex-col items-center justify-center gap-2">
                        <Upload className="w-6 h-6" />
                        <span>{prescriptionFile ? prescriptionFile.name : "Choose prescription file"}</span>
                        <span className="text-xs text-[#A3AED0]">Required field</span>
                        <input 
                          type="file" 
                          accept="image/*,.pdf"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                    
                    <div className="flex gap-3">
                      <button 
                        type="button"
                        onClick={handlePrevStep}
                        className="flex-1 py-4 bg-[#F4F7FE] hover:bg-[#E9E3FF] text-[#4318FF] font-bold rounded-xl transition-all active:scale-[0.98]"
                      >
                        Back
                      </button>
                      <button 
                        type="button"
                        onClick={handleNextStep}
                        className="flex-1 py-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98]"
                      >
                        Next
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 6: Preview & Confirm */}
                {medicationStep === 6 && (
                  <motion.div
                    key="step6"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-5"
                  >
                    <h3 className="text-lg font-bold text-[#2B3674] mb-4">Review Your Medication</h3>
                    
                    <div className="space-y-3">
                      <div 
                        onClick={() => handleEditField(1)}
                        className="p-4 bg-[#F4F7FE] rounded-xl hover:bg-[#E9E3FF] cursor-pointer transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-1">Medication Name</p>
                            <p className="text-sm font-bold text-[#2B3674]">{medName || "Not set"}</p>
                          </div>
                          <span className="text-xs text-[#4318FF] opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                        </div>
                      </div>
                      
                      <div 
                        onClick={() => handleEditField(2)}
                        className="p-4 bg-[#F4F7FE] rounded-xl hover:bg-[#E9E3FF] cursor-pointer transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-1">Dosage</p>
                            <p className="text-sm font-bold text-[#2B3674]">{dose || "Not set"}</p>
                          </div>
                          <span className="text-xs text-[#4318FF] opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                        </div>
                      </div>
                      
                      <div 
                        onClick={() => handleEditField(3)}
                        className="p-4 bg-[#F4F7FE] rounded-xl hover:bg-[#E9E3FF] cursor-pointer transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-1">Frequency</p>
                            <p className="text-sm font-bold text-[#2B3674]">{frequency || "Not set"}</p>
                          </div>
                          <span className="text-xs text-[#4318FF] opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                        </div>
                      </div>
                      
                      <div 
                        onClick={() => handleEditField(4)}
                        className="p-4 bg-[#F4F7FE] rounded-xl hover:bg-[#E9E3FF] cursor-pointer transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-1">Administration Times</p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {medTimes.filter(t => t).map((time, idx) => (
                                <span key={idx} className="text-xs font-bold text-[#4318FF] bg-white px-2 py-1 rounded-md">
                                  {time}
                                </span>
                              ))}
                              {medTimes.filter(t => t).length === 0 && (
                                <span className="text-sm font-bold text-[#2B3674]">Not set</span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-[#4318FF] opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                        </div>
                      </div>
                      
                      <div 
                        onClick={() => handleEditField(5)}
                        className="p-4 bg-[#F4F7FE] rounded-xl hover:bg-[#E9E3FF] cursor-pointer transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-1">Prescription File</p>
                            <p className="text-sm font-bold text-[#2B3674]">{prescriptionFile?.name || "Not uploaded"}</p>
                          </div>
                          <span className="text-xs text-[#4318FF] opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <button 
                        type="button"
                        onClick={handlePrevStep}
                        className="flex-1 py-4 bg-[#F4F7FE] hover:bg-[#E9E3FF] text-[#4318FF] font-bold rounded-xl transition-all active:scale-[0.98]"
                      >
                        Back
                      </button>
                      <button 
                        type="submit"
                        className="flex-1 py-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98]"
                      >
                        Confirm & Save
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
            </form>
          </div>

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
                  onChange={(e) => {
                    setCareEventType(e.target.value);
                    setShowCareTypeDropdown(true);
                  }}
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
                          onClick={() => {
                            setCareEventType(type);
                            setShowCareTypeDropdown(false);
                          }}
                          className="px-4 py-2 hover:bg-orange-50 rounded-lg cursor-pointer text-sm font-semibold text-slate-700 hover:text-orange-700"
                        >
                          {type}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div>
                <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">Event Time</label>
                <input 
                  type="time" 
                  value={careEventTime}
                  onChange={(e) => setCareEventTime(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                />
              </div>

              <button 
                type="submit"
                className="w-full py-4 mt-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98]"
              >
                Save Care Event
              </button>
            </form>
          </div>

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
                  onChange={(e) => {
                    setOutdoorEventType(e.target.value);
                    setShowOutdoorTypeDropdown(true);
                  }}
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
                          onClick={() => {
                            setOutdoorEventType(type);
                            setShowOutdoorTypeDropdown(false);
                          }}
                          className="px-4 py-2 hover:bg-green-50 rounded-lg cursor-pointer text-sm font-semibold text-slate-700 hover:text-green-700"
                        >
                          {type}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div>
                <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">Event Time</label>
                <input 
                  type="time" 
                  value={outdoorEventTime}
                  onChange={(e) => setOutdoorEventTime(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                />
              </div>

              <button 
                type="submit"
                className="w-full py-4 mt-4 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98]"
              >
                Save Outdoor Event
              </button>
            </form>
          </div>

        </div>

        {/* Right Column: Lists */}
        <div className="md:col-span-5 space-y-6">
          
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
                            try {
                              await careEventsService.confirmMedication(med.remindId);
                            } catch { /* ignore, still remove locally */ }
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
                        <div className="mt-1.5">
                          <span className="text-xs font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-md border-none">{ev.type}</span>
                        </div>
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
                            try { await careEventsService.deleteHomeCare(ev.backendId); } catch { /* ignore */ }
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
                        <div className="mt-1.5">
                          <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md border-none">{ev.type}</span>
                        </div>
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
                            try { await careEventsService.deleteOutdoor(ev.backendId); } catch { /* ignore */ }
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