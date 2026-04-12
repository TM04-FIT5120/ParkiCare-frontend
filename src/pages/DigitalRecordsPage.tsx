import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Download, FileSpreadsheet, List, AlignLeft, CheckCircle2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { careEventsService, type MedicationPlan, type HomeCareScheduleResponse, type OutdoorScheduleResponse } from "@/services/careEvents";
import { useAuth } from "@/context/AuthContext";

export function DigitalRecordsPage() {
  const { patient } = useAuth();
  const [activeTab1, setActiveTab1] = useState<"detailed" | "summary" | "narrative">("detailed");
  const [activeTab2, setActiveTab2] = useState<"detailed" | "summary" | "narrative">("detailed");
  const [activeTab3, setActiveTab3] = useState<"detailed" | "summary" | "narrative">("detailed");

  const [dateRange1, setDateRange1] = useState("Since Last Medical Visit");
  const [dateRange2, setDateRange2] = useState("Since Last Medical Visit");
  const [dateRange3, setDateRange3] = useState("Since Last Medical Visit");

  const [showDropdown1, setShowDropdown1] = useState(false);
  const [showDropdown2, setShowDropdown2] = useState(false);
  const [showDropdown3, setShowDropdown3] = useState(false);

  const [startDate1, setStartDate1] = useState<Date | null>(null);
  const [endDate1, setEndDate1] = useState<Date | null>(null);
  const [startDate2, setStartDate2] = useState<Date | null>(null);
  const [endDate2, setEndDate2] = useState<Date | null>(null);
  const [startDate3, setStartDate3] = useState<Date | null>(null);
  const [endDate3, setEndDate3] = useState<Date | null>(null);

  const dateRangeOptions = [
    "Since Last Medical Visit",
    "Last 30 Days",
    "Custom Range",
    "Full History"
  ];

  const [medicationRecords, setMedicationRecords] = useState<MedicationPlan[]>([]);
  const [careEventRecords, setCareEventRecords] = useState<HomeCareScheduleResponse[]>([]);
  const [outdoorRecords, setOutdoorRecords] = useState<OutdoorScheduleResponse[]>([]);

  useEffect(() => {
    const patientId = patient?.patientId;
    if (!patientId) return;
    careEventsService.getMedications(patientId).then(setMedicationRecords).catch(() => {});
    careEventsService.getHomeCare(patientId).then(setCareEventRecords).catch(() => {});
    careEventsService.getOutdoor(patientId).then(setOutdoorRecords).catch(() => {});
  }, [patient?.patientId]);

  const handleExport = (tableType: string) => {
    toast.success(`Generating ${tableType} Report...`);
    setTimeout(() => {
      toast("Report Downloaded Successfully", { icon: <CheckCircle2 className="w-5 h-5 text-green-500" /> });
    }, 1500);
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-10 px-4 sm:px-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#2B3674]">Digital Records</h1>
          <p className="text-sm sm:text-base text-[#A3AED0] font-bold mt-1">Export structured data for your next neurologist visit.</p>
        </div>
      </div>

      {/* Table 1: Medication */}
      <div className="bg-white rounded-[20px] shadow-[0_18px_40px_rgba(112,144,176,0.12)] border-none overflow-hidden">
        <div className="border-b border-[#E0E5F2] p-4 sm:p-6 bg-white">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6 mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-[#2B3674]">Medication Records</h2>
              <p className="text-xs sm:text-sm text-[#A3AED0] font-bold">Comprehensive Medication Adherence Records</p>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="text-sm font-bold text-[#A3AED0] uppercase tracking-wide">Date Range:</span>
              <div className="relative w-full sm:w-auto">
                <button
                  onClick={() => setShowDropdown1(!showDropdown1)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-[#E0E5F2] rounded-xl text-sm font-bold text-[#2B3674] hover:border-[#4318FF] transition-all w-full sm:min-w-[240px] justify-between"
                >
                  {dateRange1}
                  <ChevronDown className="w-4 h-4 text-[#A3AED0]" />
                </button>
                {showDropdown1 && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white border-2 border-[#E0E5F2] rounded-xl shadow-lg z-10 overflow-hidden">
                    {dateRangeOptions.map((option) => (
                      <button
                        key={option}
                        onClick={() => {
                          setDateRange1(option);
                          setShowDropdown1(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm font-bold transition-colors ${
                          dateRange1 === option
                            ? "bg-[#E9E3FF] text-[#4318FF]"
                            : "text-[#2B3674] hover:bg-[#F4F7FE]"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {dateRange1 === "Custom Range" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-4 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-sm font-bold text-[#2B3674]">Start Date:</span>
                  <DatePicker
                    selected={startDate1}
                    onChange={(date: Date | null) => setStartDate1(date)}
                    selectsStart
                    startDate={startDate1}
                    endDate={endDate1}
                    className="w-full sm:w-auto px-4 py-2 bg-white border-2 border-[#E0E5F2] rounded-xl text-sm font-bold text-[#2B3674] hover:border-[#4318FF] transition-all focus:outline-none focus:border-[#4318FF]"
                    placeholderText="Select start date"
                    dateFormat="dd/MM/yyyy"
                  />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-sm font-bold text-[#2B3674]">End Date:</span>
                  <DatePicker
                    selected={endDate1}
                    onChange={(date: Date | null) => setEndDate1(date)}
                    selectsEnd
                    startDate={startDate1}
                    endDate={endDate1}
                    minDate={startDate1 ?? undefined}
                    className="w-full sm:w-auto px-4 py-2 bg-white border-2 border-[#E0E5F2] rounded-xl text-sm font-bold text-[#2B3674] hover:border-[#4318FF] transition-all focus:outline-none focus:border-[#4318FF]"
                    placeholderText="Select end date"
                    dateFormat="dd/MM/yyyy"
                  />
                </div>
              </motion.div>
            )}
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 bg-[#F4F7FE] p-1.5 rounded-xl self-start">
              {[
                { id: "detailed", icon: FileSpreadsheet, label: "Report" },
                { id: "summary", icon: List, label: "Concise Summary" },
                { id: "narrative", icon: AlignLeft, label: "Narrative" },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab1(tab.id as "detailed" | "summary" | "narrative")}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                    activeTab1 === tab.id
                      ? "bg-white text-[#4318FF] shadow-sm border-none"
                      : "text-[#A3AED0] hover:text-[#2B3674] hover:bg-[#E9E3FF]"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.id === "detailed" ? "Report" : tab.id === "summary" ? "Summary" : "Narrative"}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => handleExport("Medication")}
              className="flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] active:scale-95 w-full lg:w-auto text-sm sm:text-base"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{activeTab1 === "detailed" ? "Export Report" : activeTab1 === "summary" ? "Export Concise Summary" : "Export Narrative"}</span>
              <span className="sm:hidden">Export</span>
            </button>
          </div>
        </div>

        <div className="p-8">
          <div className="mb-6">
            <p className="text-xs text-[#A3AED0] font-bold">Since Last Medical Visit â€¢ Period: March 20 - March 28, 2026</p>
          </div>

          {activeTab1 === "detailed" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="rounded-[20px] border border-[#E0E5F2] overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[600px]">
                  <thead className="bg-[#F4F7FE] border-b border-[#E0E5F2] text-xs uppercase tracking-wider font-bold text-[#A3AED0]">
                    <tr>
                      <th className="p-3 sm:p-4">Date</th>
                      <th className="p-3 sm:p-4">Time</th>
                      <th className="p-3 sm:p-4">Medication</th>
                      <th className="p-3 sm:p-4">Status</th>
                      <th className="p-3 sm:p-4">Deviation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E5F2]">
                    {medicationRecords.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-sm font-bold text-[#A3AED0]">No medication records found.</td>
                      </tr>
                    ) : medicationRecords.map((rec, index) => (
                      <tr key={`med-${rec.remindId || index}`} className="hover:bg-[#F4F7FE]/50 transition-colors">
                        <td className="p-3 sm:p-4 font-bold text-[#2B3674]">{rec.startDate}</td>
                        <td className="p-3 sm:p-4 font-bold text-[#A3AED0]">{rec.remindTime}</td>
                        <td className="p-3 sm:p-4 font-bold text-[#4318FF]">Drug #{rec.drugId}</td>
                        <td className="p-3 sm:p-4">
                          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-600">
                            Scheduled
                          </span>
                        </td>
                        <td className="p-3 sm:p-4 font-bold text-[#A3AED0]">{rec.dosage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab1 === "summary" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-8">
              <div className="text-center mb-8">
                <h3 className="text-xl sm:text-2xl font-black text-[#2B3674] uppercase tracking-tight">Medication Summary</h3>
                <p className="text-sm sm:text-base text-[#A3AED0] font-bold mt-2">High-level overview for clinical review</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8">
                <div className="p-4 sm:p-6 rounded-[20px] bg-[#E9E3FF] border-none text-center">
                  <p className="text-xs sm:text-sm font-bold text-[#4318FF] uppercase tracking-widest mb-1">Overall Adherence</p>
                  <p className="text-3xl sm:text-4xl font-black text-[#4318FF]">83%</p>
                </div>
                <div className="p-4 sm:p-6 rounded-[20px] bg-orange-50 border-none text-center">
                  <p className="text-xs sm:text-sm font-bold text-orange-500 uppercase tracking-widest mb-1">Avg. Delay Time</p>
                  <p className="text-3xl sm:text-4xl font-black text-orange-600">23m</p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab1 === "narrative" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto">
              <div className="prose prose-slate max-w-none text-[#2B3674] leading-relaxed font-medium text-sm sm:text-base">
                <p className="first-letter:text-3xl sm:first-letter:text-5xl first-letter:font-black first-letter:text-[#4318FF] first-letter:mr-2 first-letter:float-left">
                  During the recorded period, the patient maintained a generally consistent routine with their prescribed Levodopa regimen, achieving an 83% overall adherence rate.
                </p>
                <p className="mt-4">
                  However, notable time deviations occurred specifically during the afternoon and evening doses on <strong className="text-[#4318FF]">March 24th</strong>. The afternoon dose (scheduled for 14:00) was missed entirely, while the evening dose experienced a significant delay of <strong className="text-orange-500">45 minutes</strong> (administered at 20:45 instead of 20:00).
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Table 2: Care Event */}
      <div className="bg-white rounded-[20px] shadow-[0_18px_40px_rgba(112,144,176,0.12)] border-none overflow-hidden">
        <div className="border-b border-[#E0E5F2] p-4 sm:p-6 bg-white">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6 mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-[#2B3674]">Care Event Records</h2>
              <p className="text-xs sm:text-sm text-[#A3AED0] font-bold">Indoor Activity and Movement Tracking</p>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="text-sm font-bold text-[#A3AED0] uppercase tracking-wide">Date Range:</span>
              <div className="relative w-full sm:w-auto">
                <button
                  onClick={() => setShowDropdown2(!showDropdown2)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-[#E0E5F2] rounded-xl text-sm font-bold text-[#2B3674] hover:border-[#4318FF] transition-all w-full sm:min-w-[240px] justify-between"
                >
                  {dateRange2}
                  <ChevronDown className="w-4 h-4 text-[#A3AED0]" />
                </button>
                {showDropdown2 && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white border-2 border-[#E0E5F2] rounded-xl shadow-lg z-10 overflow-hidden">
                    {dateRangeOptions.map((option) => (
                      <button
                        key={option}
                        onClick={() => {
                          setDateRange2(option);
                          setShowDropdown2(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm font-bold transition-colors ${
                          dateRange2 === option
                            ? "bg-[#E9E3FF] text-[#4318FF]"
                            : "text-[#2B3674] hover:bg-[#F4F7FE]"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {dateRange2 === "Custom Range" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-4 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-sm font-bold text-[#2B3674]">Start Date:</span>
                  <DatePicker
                    selected={startDate2}
                    onChange={(date: Date | null) => setStartDate2(date)}
                    selectsStart
                    startDate={startDate2}
                    endDate={endDate2}
                    className="w-full sm:w-auto px-4 py-2 bg-white border-2 border-[#E0E5F2] rounded-xl text-sm font-bold text-[#2B3674] hover:border-[#4318FF] transition-all focus:outline-none focus:border-[#4318FF]"
                    placeholderText="Select start date"
                    dateFormat="dd/MM/yyyy"
                  />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-sm font-bold text-[#2B3674]">End Date:</span>
                  <DatePicker
                    selected={endDate2}
                    onChange={(date: Date | null) => setEndDate2(date)}
                    selectsEnd
                    startDate={startDate2}
                    endDate={endDate2}
                    minDate={startDate2 ?? undefined}
                    className="w-full sm:w-auto px-4 py-2 bg-white border-2 border-[#E0E5F2] rounded-xl text-sm font-bold text-[#2B3674] hover:border-[#4318FF] transition-all focus:outline-none focus:border-[#4318FF]"
                    placeholderText="Select end date"
                    dateFormat="dd/MM/yyyy"
                  />
                </div>
              </motion.div>
            )}
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 bg-[#F4F7FE] p-1.5 rounded-xl self-start">
              {[
                { id: "detailed", icon: FileSpreadsheet, label: "Report" },
                { id: "summary", icon: List, label: "Concise Summary" },
                { id: "narrative", icon: AlignLeft, label: "Narrative" },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab2(tab.id as "detailed" | "summary" | "narrative")}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                    activeTab2 === tab.id
                      ? "bg-white text-[#4318FF] shadow-sm border-none"
                      : "text-[#A3AED0] hover:text-[#2B3674] hover:bg-[#E9E3FF]"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.id === "detailed" ? "Report" : tab.id === "summary" ? "Summary" : "Narrative"}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => handleExport("Care Event")}
              className="flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] active:scale-95 w-full lg:w-auto text-sm sm:text-base"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{activeTab2 === "detailed" ? "Export Report" : activeTab2 === "summary" ? "Export Concise Summary" : "Export Narrative"}</span>
              <span className="sm:hidden">Export</span>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-8">
          <div className="mb-4 sm:mb-6">
            <p className="text-xs text-[#A3AED0] font-bold">Since Last Medical Visit â€¢ Period: March 20 - March 28, 2026</p>
          </div>

          {activeTab2 === "detailed" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="rounded-[20px] border border-[#E0E5F2] overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[600px]">
                  <thead className="bg-[#F4F7FE] border-b border-[#E0E5F2] text-xs uppercase tracking-wider font-bold text-[#A3AED0]">
                    <tr>
                      <th className="p-3 sm:p-4">Date</th>
                      <th className="p-3 sm:p-4">Time</th>
                      <th className="p-3 sm:p-4">Activity</th>
                      <th className="p-3 sm:p-4">Duration</th>
                      <th className="p-3 sm:p-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E5F2]">
                    {careEventRecords.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-sm font-bold text-[#A3AED0]">No care event records found.</td>
                      </tr>
                    ) : careEventRecords.map((rec, index) => (
                      <tr key={`care-${rec.id || index}`} className="hover:bg-[#F4F7FE]/50 transition-colors">
                        <td className="p-3 sm:p-4 font-bold text-[#2B3674]">{rec.startDatetime.slice(0, 10)}</td>
                        <td className="p-3 sm:p-4 font-bold text-[#A3AED0]">{rec.startDatetime.slice(11, 16)}</td>
                        <td className="p-3 sm:p-4 font-bold text-[#4318FF]">{rec.homeCareTitle}</td>
                        <td className="p-3 sm:p-4 font-bold text-[#2B3674]">—</td>
                        <td className="p-3 sm:p-4 font-bold text-[#A3AED0]">{rec.careNote || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab2 === "summary" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-8">
              <div className="text-center mb-8">
                <h3 className="text-xl sm:text-2xl font-black text-[#2B3674] uppercase tracking-tight">Care Event Summary</h3>
                <p className="text-sm sm:text-base text-[#A3AED0] font-bold mt-2">Activity overview for the recorded period</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8">
                <div className="p-4 sm:p-6 rounded-[20px] bg-[#E9E3FF] border-none text-center">
                  <p className="text-xs sm:text-sm font-bold text-[#4318FF] uppercase tracking-widest mb-1">Total Activities</p>
                  <p className="text-3xl sm:text-4xl font-black text-[#4318FF]">5</p>
                </div>
                <div className="p-4 sm:p-6 rounded-[20px] bg-green-50 border-none text-center">
                  <p className="text-xs sm:text-sm font-bold text-green-600 uppercase tracking-widest mb-1">Avg. Duration</p>
                  <p className="text-3xl sm:text-4xl font-black text-green-600">28m</p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab2 === "narrative" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto">
              <div className="prose prose-slate max-w-none text-[#2B3674] leading-relaxed font-medium text-sm sm:text-base">
                <p className="first-letter:text-3xl sm:first-letter:text-5xl first-letter:font-black first-letter:text-[#4318FF] first-letter:mr-2 first-letter:float-left">
                  The patient demonstrated consistent engagement in physical activities throughout the recorded period. Morning walks were completed regularly, with durations ranging from 20 to 30 minutes.
                </p>
                <p className="mt-4">
                  Physical therapy sessions were completed as scheduled on <strong className="text-[#4318FF]">March 24th</strong>, lasting 45 minutes. Additional light exercise and stretching activities were incorporated on March 25th, showing good adherence to the recommended activity regimen.
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Table 3: Outdoor Activity */}
      <div className="bg-white rounded-[20px] shadow-[0_18px_40px_rgba(112,144,176,0.12)] border-none overflow-hidden">
        <div className="border-b border-[#E0E5F2] p-4 sm:p-6 bg-white">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6 mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-[#2B3674]">Outdoor Activities</h2>
              <p className="text-xs sm:text-sm text-[#A3AED0] font-bold">Outdoor Activities and Movement</p>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="text-sm font-bold text-[#A3AED0] uppercase tracking-wide">Date Range:</span>
              <div className="relative w-full sm:w-auto">
                <button
                  onClick={() => setShowDropdown3(!showDropdown3)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-[#E0E5F2] rounded-xl text-sm font-bold text-[#2B3674] hover:border-[#4318FF] transition-all w-full sm:min-w-[240px] justify-between"
                >
                  {dateRange3}
                  <ChevronDown className="w-4 h-4 text-[#A3AED0]" />
                </button>
                {showDropdown3 && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white border-2 border-[#E0E5F2] rounded-xl shadow-lg z-10 overflow-hidden">
                    {dateRangeOptions.map((option) => (
                      <button
                        key={option}
                        onClick={() => {
                          setDateRange3(option);
                          setShowDropdown3(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm font-bold transition-colors ${
                          dateRange3 === option
                            ? "bg-[#E9E3FF] text-[#4318FF]"
                            : "text-[#2B3674] hover:bg-[#F4F7FE]"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {dateRange3 === "Custom Range" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-4 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-sm font-bold text-[#2B3674]">Start Date:</span>
                  <DatePicker
                    selected={startDate3}
                    onChange={(date: Date | null) => setStartDate3(date)}
                    selectsStart
                    startDate={startDate3}
                    endDate={endDate3}
                    className="w-full sm:w-auto px-4 py-2 bg-white border-2 border-[#E0E5F2] rounded-xl text-sm font-bold text-[#2B3674] hover:border-[#4318FF] transition-all focus:outline-none focus:border-[#4318FF]"
                    placeholderText="Select start date"
                    dateFormat="dd/MM/yyyy"
                  />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-sm font-bold text-[#2B3674]">End Date:</span>
                  <DatePicker
                    selected={endDate3}
                    onChange={(date: Date | null) => setEndDate3(date)}
                    selectsEnd
                    startDate={startDate3}
                    endDate={endDate3}
                    minDate={startDate3 ?? undefined}
                    className="w-full sm:w-auto px-4 py-2 bg-white border-2 border-[#E0E5F2] rounded-xl text-sm font-bold text-[#2B3674] hover:border-[#4318FF] transition-all focus:outline-none focus:border-[#4318FF]"
                    placeholderText="Select end date"
                    dateFormat="dd/MM/yyyy"
                  />
                </div>
              </motion.div>
            )}
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 bg-[#F4F7FE] p-1.5 rounded-xl self-start">
              {[
                { id: "detailed", icon: FileSpreadsheet, label: "Report" },
                { id: "summary", icon: List, label: "Concise Summary" },
                { id: "narrative", icon: AlignLeft, label: "Narrative" },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab3(tab.id as "detailed" | "summary" | "narrative")}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                    activeTab3 === tab.id
                      ? "bg-white text-[#4318FF] shadow-sm border-none"
                      : "text-[#A3AED0] hover:text-[#2B3674] hover:bg-[#E9E3FF]"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.id === "detailed" ? "Report" : tab.id === "summary" ? "Summary" : "Narrative"}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => handleExport("Outdoor Activity")}
              className="flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] active:scale-95 w-full lg:w-auto text-sm sm:text-base"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{activeTab3 === "detailed" ? "Export Report" : activeTab3 === "summary" ? "Export Concise Summary" : "Export Narrative"}</span>
              <span className="sm:hidden">Export</span>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-8">
          <div className="mb-4 sm:mb-6">
            <p className="text-xs text-[#A3AED0] font-bold">Since Last Medical Visit â€¢ Period: March 20 - March 28, 2026</p>
          </div>

          {activeTab3 === "detailed" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="rounded-[20px] border border-[#E0E5F2] overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[600px]">
                  <thead className="bg-[#F4F7FE] border-b border-[#E0E5F2] text-xs uppercase tracking-wider font-bold text-[#A3AED0]">
                    <tr>
                      <th className="p-3 sm:p-4">Date</th>
                      <th className="p-3 sm:p-4">Time</th>
                      <th className="p-3 sm:p-4">Event</th>
                      <th className="p-3 sm:p-4">Location</th>
                      <th className="p-3 sm:p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E5F2]">
                    {outdoorRecords.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-sm font-bold text-[#A3AED0]">No outdoor activity records found.</td>
                      </tr>
                    ) : outdoorRecords.map((rec, index) => (
                      <tr key={`outdoor-${rec.id || index}`} className="hover:bg-[#F4F7FE]/50 transition-colors">
                        <td className="p-3 sm:p-4 font-bold text-[#2B3674]">{rec.startDatetime.slice(0, 10)}</td>
                        <td className="p-3 sm:p-4 font-bold text-[#A3AED0]">{rec.startDatetime.slice(11, 16)}</td>
                        <td className="p-3 sm:p-4 font-bold text-[#4318FF]">{rec.outdoorTitle}</td>
                        <td className="p-3 sm:p-4 font-bold text-[#2B3674]">{rec.prepareNote || "—"}</td>
                        <td className="p-3 sm:p-4">
                          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-green-50 text-green-600">
                            Scheduled
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab3 === "summary" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-8">
              <div className="text-center mb-8">
                <h3 className="text-xl sm:text-2xl font-black text-[#2B3674] uppercase tracking-tight">Outdoor Activity Summary</h3>
                <p className="text-sm sm:text-base text-[#A3AED0] font-bold mt-2">Calendar events and outdoor engagement</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8">
                <div className="p-4 sm:p-6 rounded-[20px] bg-[#E9E3FF] border-none text-center">
                  <p className="text-xs sm:text-sm font-bold text-[#4318FF] uppercase tracking-widest mb-1">Completed Events</p>
                  <p className="text-3xl sm:text-4xl font-black text-[#4318FF]">2</p>
                </div>
                <div className="p-4 sm:p-6 rounded-[20px] bg-blue-50 border-none text-center">
                  <p className="text-xs sm:text-sm font-bold text-blue-600 uppercase tracking-widest mb-1">Upcoming Events</p>
                  <p className="text-3xl sm:text-4xl font-black text-blue-600">0</p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab3 === "narrative" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto">
              <div className="prose prose-slate max-w-none text-[#2B3674] leading-relaxed font-medium text-sm sm:text-base">
                <p className="first-letter:text-3xl sm:first-letter:text-5xl first-letter:font-black first-letter:text-[#4318FF] first-letter:mr-2 first-letter:float-left">
                  The patient maintained active engagement with outdoor activities and appointments during the recorded period. A scheduled doctor visit was completed on March 24th at the Medical Center, followed by a park outing on March 25th.
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
