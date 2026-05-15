import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Download, FileSpreadsheet, List, AlignLeft, ChevronDown, Loader2, CalendarSync } from "lucide-react";
import { toast } from "sonner";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  careEventsService,
  type HomeCareScheduleResponse,
  type OutdoorScheduleResponse,
  type MedicationReportDTO,
} from "@/services/careEvents";
import { useAuth } from "@/context/AuthContext";
import { listCaregiverEventOccurrences } from "@/services/caregiverEventOccurrences";
import { completionLookupKey, addDaysMYT } from "@/lib/eventRecurrence";

type MedicationReportScope = "sinceLastExport" | "last30Days" | "custom" | "fullHistory";

const medicationScopeOptions: Array<{ value: MedicationReportScope; label: string }> = [
  { value: "sinceLastExport", label: "Cumulative Sync (Since Last Export)" },
  { value: "last30Days", label: "Last 30 Days" },
  { value: "custom", label: "Custom Range" },
  { value: "fullHistory", label: "Full History" },
];

export function DigitalRecordsPage() {
  const { patient, user } = useAuth();
  const patientId = patient?.patientId;
  const caregiverId = user?.caregiverId ?? 0;

  // --- Tab state ---
  const [activeTab1, setActiveTab1] = useState<"detailed" | "summary" | "narrative">("detailed");
  const [activeTab2, setActiveTab2] = useState<"detailed" | "summary" | "narrative">("detailed");
  const [activeTab3, setActiveTab3] = useState<"detailed" | "summary" | "narrative">("detailed");

  // --- Table 1: Medication report ---
  const [medicationReport, setMedicationReport] = useState<MedicationReportDTO | null>(null);
  const [reportMode1, setReportMode1] = useState<MedicationReportScope>("fullHistory");
  const [showDropdown1, setShowDropdown1] = useState(false);
  const [startDate1, setStartDate1] = useState<Date | null>(null);
  const [endDate1, setEndDate1] = useState<Date | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // --- Tables 2 & 3: raw records + date range dropdowns ---
  const [careEventRecords, setCareEventRecords] = useState<HomeCareScheduleResponse[]>([]);
  const [outdoorRecords, setOutdoorRecords] = useState<OutdoorScheduleResponse[]>([]);
  const [dateRange2, setDateRange2] = useState("Last 30 Days");
  const [dateRange3, setDateRange3] = useState("Last 30 Days");
  const [showDropdown2, setShowDropdown2] = useState(false);
  const [showDropdown3, setShowDropdown3] = useState(false);
  const [startDate2, setStartDate2] = useState<Date | null>(null);
  const [endDate2, setEndDate2] = useState<Date | null>(null);
  const [startDate3, setStartDate3] = useState<Date | null>(null);
  const [endDate3, setEndDate3] = useState<Date | null>(null);
  const dateRangeOptions23 = ["Last 30 Days", "Custom Range", "Full History"];

  // --- Completion lookup for Tables 2 & 3 ---
  const [completionKeys, setCompletionKeys] = useState<Set<string>>(new Set());

  // Fetch home care, outdoor records + completion keys on mount
  useEffect(() => {
    if (!patientId) return;
    careEventsService.getHomeCare(patientId).then(setCareEventRecords).catch(() => {});
    careEventsService.getOutdoor(patientId).then(setOutdoorRecords).catch(() => {});
    if (caregiverId) {
      const from = addDaysMYT(-90);
      const to = addDaysMYT(60);
      listCaregiverEventOccurrences(caregiverId, from, to)
        .then(occurrences => {
          const keys = new Set(
            occurrences
              .filter(o => o.completed === 1)
              .map(o => completionLookupKey(o.sourceType, o.sourceId, o.occurrenceStart)),
          );
          setCompletionKeys(keys);
        })
        .catch(() => {});
    }
  }, [patientId, caregiverId]);

  // Fetch medication report whenever mode or custom dates change
  useEffect(() => {
    if (!patientId) return;
    if (reportMode1 === "custom" && (!startDate1 || !endDate1)) return;
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    let mode: "custom" | "sinceLastExport" = "sinceLastExport";
    let start: string | undefined;
    let end: string | undefined;

    if (reportMode1 === "custom") {
      mode = "custom";
      start = startDate1 ? fmt(startDate1) : undefined;
      end = endDate1 ? fmt(endDate1) : undefined;
    } else if (reportMode1 === "last30Days") {
      mode = "custom";
      start = addDaysMYT(-29);
      end = addDaysMYT(0);
    } else if (reportMode1 === "fullHistory") {
      mode = "custom";
      start = "2026-04-01";
      end = addDaysMYT(0);
    }

    setIsLoadingReport(true);
    careEventsService
      .getMedicationReport(patientId, mode, start, end)
      .then(setMedicationReport)
      .catch(() => toast.error("Failed to load medication report"))
      .finally(() => setIsLoadingReport(false));
  }, [patientId, reportMode1, startDate1, endDate1]);

  // PDF export for Table 1
  const handleExportMedication = async () => {
    if (!patientId || isExporting) return;
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    let mode: "custom" | "sinceLastExport" = "sinceLastExport";
    let start: string | undefined;
    let end: string | undefined;

    if (reportMode1 === "custom") {
      start = startDate1 ? fmt(startDate1) : undefined;
      end = endDate1 ? fmt(endDate1) : undefined;
      mode = "custom";
    } else if (reportMode1 === "last30Days") {
      mode = "custom";
      start = addDaysMYT(-29);
      end = addDaysMYT(0);
    } else if (reportMode1 === "fullHistory") {
      mode = "custom";
      start = "2026-04-01";
      end = addDaysMYT(0);
    }

    setIsExporting(true);
    try {
      const blob = await careEventsService.downloadMedicationReportPdf(patientId, mode, start, end);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `medication_report_${patientId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      // Re-fetch to show updated lastExportTime
      const updated = await careEventsService.getMedicationReport(patientId, mode, start, end);
      setMedicationReport(updated);
      toast.success("Medication report exported successfully");
    } catch {
      toast.error("Failed to export report");
    } finally {
      setIsExporting(false);
    }
  };

  // Completion helpers for Tables 2 & 3
  const isCareCompleted = (id: number, startDatetime: string) =>
    completionKeys.has(completionLookupKey("PATIENT_HOME_CARE", id, startDatetime));
  const isOutdoorCompleted = (id: number, startDatetime: string) =>
    completionKeys.has(completionLookupKey("PATIENT_OUTDOOR", id, startDatetime));

  // Derived counts for summary views
  const completedCareCount = careEventRecords.filter(r => isCareCompleted(r.id, r.startDatetime)).length;
  const completedOutdoorCount = outdoorRecords.filter(r => isOutdoorCompleted(r.id, r.startDatetime)).length;

  // Narrative text for Table 1
  const narrativeText = medicationReport
    ? `From ${medicationReport.startDate} to ${medicationReport.endDate}, ` +
      `${medicationReport.overallCompletionRate.toFixed(1)}% of prescribed medication doses were administered. ` +
      `${medicationReport.dailySummaries.filter(d => d.status === "SUCCESS").length} day(s) achieved full frequency adherence, ` +
      `while ${medicationReport.dailySummaries.filter(d => d.status === "INCOMPLETE").length} day(s) were incomplete.`
    : "No medication data available for the selected period.";

  // Format last export timestamp
  const lastExportLabel = medicationReport?.lastExportTime
    ? new Date(medicationReport.lastExportTime).toLocaleString("en-MY", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "No previous export";
  const selectedMedicationScope =
    medicationScopeOptions.find(option => option.value === reportMode1) ?? medicationScopeOptions[0];

  return (
    <div className="space-y-6 sm:space-y-8 pb-10 px-4 sm:px-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#2B3674]">Digital Records</h1>
          <p className="text-sm sm:text-base text-[#A3AED0] font-bold mt-1">Export structured data for your next neurologist visit.</p>
        </div>
      </div>

      {/* ─── Table 1: Medication Records ─── */}
      <div className="bg-white rounded-[20px] shadow-[0_18px_40px_rgba(112,144,176,0.12)] border-none overflow-hidden">
        <div className="border-b border-[#E0E5F2] p-4 sm:p-6 bg-white">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 sm:gap-6 mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-[#2B3674]">Medication Records</h2>
              <p className="text-xs sm:text-sm text-[#A3AED0] font-bold">Comprehensive Medication Adherence Records</p>
            </div>
            <div className="text-xs font-bold text-[#A3AED0] bg-[#F4F7FE] px-3 py-1.5 rounded-lg shrink-0">
              Last Export: <span className="text-[#4318FF]">{lastExportLabel}</span>
            </div>
          </div>

          {/* Date range selector */}
          <div className="mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-sm font-bold text-[#A3AED0] uppercase tracking-wide">Data Scope:</span>
            <div className="relative w-full sm:w-auto">
              <button
                onClick={() => setShowDropdown1(!showDropdown1)}
                className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-[#E0E5F2] rounded-xl text-sm font-bold text-[#2B3674] hover:border-[#4318FF] transition-all w-full sm:min-w-[200px] justify-between"
              >
                <span className="flex items-center gap-2">
                  <CalendarSync className="w-4 h-4 text-[#4318FF]" />
                  {selectedMedicationScope.label}
                </span>
                <ChevronDown className="w-4 h-4 text-[#A3AED0]" />
              </button>
              {showDropdown1 && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white border-2 border-[#E0E5F2] rounded-xl shadow-lg z-10 overflow-hidden">
                  {medicationScopeOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setReportMode1(option.value);
                        setShowDropdown1(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm font-bold transition-colors ${
                        reportMode1 === option.value ? "bg-[#E9E3FF] text-[#4318FF]" : "text-[#2B3674] hover:bg-[#F4F7FE]"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            </div>

            {reportMode1 === "custom" && (
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

          {/* Tab selector + export button */}
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
              onClick={handleExportMedication}
              disabled={isExporting || isLoadingReport}
              className="flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] active:scale-95 w-full lg:w-auto text-sm sm:text-base disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span className="hidden sm:inline">{isExporting ? "Exporting..." : "Export PDF Report"}</span>
              <span className="sm:hidden">{isExporting ? "..." : "Export"}</span>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-8">
          {/* Period info */}
          {medicationReport && (
            <div className="mb-6">
              <p className="text-xs text-[#A3AED0] font-bold">
                {selectedMedicationScope.label} • Period: {medicationReport.startDate} – {medicationReport.endDate}
              </p>
            </div>
          )}

          {/* Loading skeleton */}
          {isLoadingReport && (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-10 bg-[#F4F7FE] rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {!isLoadingReport && activeTab1 === "detailed" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="rounded-[20px] border border-[#E0E5F2] overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[600px]">
                  <thead className="bg-[#F4F7FE] border-b border-[#E0E5F2] text-xs uppercase tracking-wider font-bold text-[#A3AED0]">
                    <tr>
                      <th className="p-3 sm:p-4">Date</th>
                      <th className="p-3 sm:p-4">Medication</th>
                      <th className="p-3 sm:p-4">Target Freq.</th>
                      <th className="p-3 sm:p-4">Actual Count</th>
                      <th className="p-3 sm:p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E5F2]">
                    {!medicationReport || medicationReport.dailyBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-sm font-bold text-[#A3AED0]">
                          No medication records for this period.
                        </td>
                      </tr>
                    ) : medicationReport.dailyBreakdown.map((row, i) => (
                      <tr key={`med-${i}`} className="hover:bg-[#F4F7FE]/50 transition-colors">
                        <td className="p-3 sm:p-4 font-bold text-[#2B3674]">{row.date}</td>
                        <td className="p-3 sm:p-4 font-bold text-[#4318FF]">{row.drugName}</td>
                        <td className="p-3 sm:p-4 font-bold text-[#2B3674]">{row.targetFrequency}x/day</td>
                        <td className="p-3 sm:p-4 font-bold text-[#2B3674]">{row.actualCount}/{row.targetFrequency}</td>
                        <td className="p-3 sm:p-4">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                            row.status === "SUCCESS"
                              ? "bg-green-50 text-green-600"
                              : "bg-red-50 text-red-500"
                          }`}>
                            {row.status === "SUCCESS" ? "Success" : "Incomplete"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {!isLoadingReport && activeTab1 === "summary" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl sm:text-2xl font-black text-[#2B3674] uppercase tracking-tight">Medication Summary</h3>
                <p className="text-sm sm:text-base text-[#A3AED0] font-bold mt-2">High-level overview for clinical review</p>
              </div>

              {/* Executive summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 sm:p-6 rounded-[20px] bg-[#E9E3FF] border-none text-center">
                  <p className="text-xs sm:text-sm font-bold text-[#4318FF] uppercase tracking-widest mb-1">Frequency Achievement</p>
                  <p className="text-3xl sm:text-4xl font-black text-[#4318FF]">
                    {medicationReport ? `${medicationReport.overallCompletionRate.toFixed(1)}%` : "-"}
                  </p>
                </div>
                <div className="p-4 sm:p-6 rounded-[20px] bg-green-50 border-none text-center">
                  <p className="text-xs sm:text-sm font-bold text-green-600 uppercase tracking-widest mb-1">Success Days</p>
                  <p className="text-3xl sm:text-4xl font-black text-green-600">
                    {medicationReport ? medicationReport.dailySummaries.filter(d => d.status === "SUCCESS").length : "-"}
                  </p>
                </div>
                <div className="p-4 sm:p-6 rounded-[20px] bg-red-50 border-none text-center">
                  <p className="text-xs sm:text-sm font-bold text-red-500 uppercase tracking-widest mb-1">Incomplete Days</p>
                  <p className="text-3xl sm:text-4xl font-black text-red-500">
                    {medicationReport ? medicationReport.dailySummaries.filter(d => d.status === "INCOMPLETE").length : "-"}
                  </p>
                </div>
              </div>

              {/* Per-medication breakdown */}
              {medicationReport && medicationReport.medicationSummaries.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-[#A3AED0] uppercase tracking-widest mb-3">Per-Medication Breakdown</h4>
                  <div className="rounded-[20px] border border-[#E0E5F2] overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[500px]">
                      <thead className="bg-[#F4F7FE] border-b border-[#E0E5F2] text-xs uppercase tracking-wider font-bold text-[#A3AED0]">
                        <tr>
                          <th className="p-3">Drug</th>
                          <th className="p-3">Target</th>
                          <th className="p-3">Actual</th>
                          <th className="p-3">Rate</th>
                          <th className="p-3">Success Days</th>
                          <th className="p-3">Incomplete Days</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E0E5F2]">
                        {medicationReport.medicationSummaries.map((s, i) => (
                          <tr key={i} className="hover:bg-[#F4F7FE]/50">
                            <td className="p-3 font-bold text-[#4318FF]">{s.drugName}</td>
                            <td className="p-3 font-bold text-[#2B3674]">{s.targetCount}</td>
                            <td className="p-3 font-bold text-[#2B3674]">{s.actualCount}</td>
                            <td className="p-3 font-bold text-[#2B3674]">{s.completionRate.toFixed(1)}%</td>
                            <td className="p-3 font-bold text-green-600">{s.successDays}</td>
                            <td className="p-3 font-bold text-red-500">{s.incompleteDays}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Daily summary */}
              {medicationReport && medicationReport.dailySummaries.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-[#A3AED0] uppercase tracking-widest mb-3">Daily Breakdown</h4>
                  <div className="rounded-[20px] border border-[#E0E5F2] overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[400px]">
                      <thead className="bg-[#F4F7FE] border-b border-[#E0E5F2] text-xs uppercase tracking-wider font-bold text-[#A3AED0]">
                        <tr>
                          <th className="p-3">Date</th>
                          <th className="p-3">Target</th>
                          <th className="p-3">Actual</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E0E5F2]">
                        {medicationReport.dailySummaries.map((d, i) => (
                          <tr key={i} className="hover:bg-[#F4F7FE]/50">
                            <td className="p-3 font-bold text-[#2B3674]">{d.date}</td>
                            <td className="p-3 font-bold text-[#2B3674]">{d.targetCount}</td>
                            <td className="p-3 font-bold text-[#2B3674]">{d.actualCount}</td>
                            <td className="p-3">
                              <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                                d.status === "SUCCESS" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
                              }`}>
                                {d.status === "SUCCESS" ? "Success" : "Incomplete"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!medicationReport && (
                <p className="text-center text-sm font-bold text-[#A3AED0] py-8">No data available for this period.</p>
              )}
            </motion.div>
          )}

          {!isLoadingReport && activeTab1 === "narrative" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto">
              <div className="prose prose-slate max-w-none text-[#2B3674] leading-relaxed font-medium text-sm sm:text-base">
                <p className="first-letter:text-3xl sm:first-letter:text-5xl first-letter:font-black first-letter:text-[#4318FF] first-letter:mr-2 first-letter:float-left">
                  {narrativeText}
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* ─── Table 2: Care Event Records ─── */}
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
                  className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-[#E0E5F2] rounded-xl text-sm font-bold text-[#2B3674] hover:border-[#4318FF] transition-all w-full sm:min-w-[200px] justify-between"
                >
                  {dateRange2}
                  <ChevronDown className="w-4 h-4 text-[#A3AED0]" />
                </button>
                {showDropdown2 && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white border-2 border-[#E0E5F2] rounded-xl shadow-lg z-10 overflow-hidden">
                    {dateRangeOptions23.map(option => (
                      <button key={option} onClick={() => { setDateRange2(option); setShowDropdown2(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm font-bold transition-colors ${dateRange2 === option ? "bg-[#E9E3FF] text-[#4318FF]" : "text-[#2B3674] hover:bg-[#F4F7FE]"}`}>
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {dateRange2 === "Custom Range" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-sm font-bold text-[#2B3674]">Start Date:</span>
                  <DatePicker selected={startDate2} onChange={(d: Date | null) => setStartDate2(d)} selectsStart startDate={startDate2} endDate={endDate2} className="w-full sm:w-auto px-4 py-2 bg-white border-2 border-[#E0E5F2] rounded-xl text-sm font-bold text-[#2B3674] hover:border-[#4318FF] transition-all focus:outline-none focus:border-[#4318FF]" placeholderText="Select start date" dateFormat="dd/MM/yyyy" />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-sm font-bold text-[#2B3674]">End Date:</span>
                  <DatePicker selected={endDate2} onChange={(d: Date | null) => setEndDate2(d)} selectsEnd startDate={startDate2} endDate={endDate2} minDate={startDate2 ?? undefined} className="w-full sm:w-auto px-4 py-2 bg-white border-2 border-[#E0E5F2] rounded-xl text-sm font-bold text-[#2B3674] hover:border-[#4318FF] transition-all focus:outline-none focus:border-[#4318FF]" placeholderText="Select end date" dateFormat="dd/MM/yyyy" />
                </div>
              </motion.div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 bg-[#F4F7FE] p-1.5 rounded-xl self-start">
            {[
              { id: "detailed", icon: FileSpreadsheet, label: "Report" },
              { id: "summary", icon: List, label: "Concise Summary" },
              { id: "narrative", icon: AlignLeft, label: "Narrative" },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab2(tab.id as "detailed" | "summary" | "narrative")}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${activeTab2 === tab.id ? "bg-white text-[#4318FF] shadow-sm border-none" : "text-[#A3AED0] hover:text-[#2B3674] hover:bg-[#E9E3FF]"}`}>
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.id === "detailed" ? "Report" : tab.id === "summary" ? "Summary" : "Narrative"}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-8">
          {activeTab2 === "detailed" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="rounded-[20px] border border-[#E0E5F2] overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[600px]">
                  <thead className="bg-[#F4F7FE] border-b border-[#E0E5F2] text-xs uppercase tracking-wider font-bold text-[#A3AED0]">
                    <tr>
                      <th className="p-3 sm:p-4">Date</th>
                      <th className="p-3 sm:p-4">Time</th>
                      <th className="p-3 sm:p-4">Activity</th>
                      <th className="p-3 sm:p-4">Notes</th>
                      <th className="p-3 sm:p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E5F2]">
                    {careEventRecords.length === 0 ? (
                      <tr><td colSpan={5} className="p-8 text-center text-sm font-bold text-[#A3AED0]">No care event records found.</td></tr>
                    ) : careEventRecords.map((rec, i) => {
                      const done = isCareCompleted(rec.id, rec.startDatetime);
                      return (
                        <tr key={`care-${rec.id || i}`} className="hover:bg-[#F4F7FE]/50 transition-colors">
                          <td className="p-3 sm:p-4 font-bold text-[#2B3674]">{rec.startDatetime.slice(0, 10)}</td>
                          <td className="p-3 sm:p-4 font-bold text-[#A3AED0]">{rec.startDatetime.slice(11, 16)}</td>
                          <td className="p-3 sm:p-4 font-bold text-[#4318FF]">{rec.homeCareTitle}</td>
                          <td className="p-3 sm:p-4 font-bold text-[#A3AED0]">{rec.careNote || "-"}</td>
                          <td className="p-3 sm:p-4">
                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${done ? "bg-green-50 text-green-600" : "bg-[#F4F7FE] text-[#A3AED0]"}`}>
                              {done ? "Completed" : "Scheduled"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab2 === "summary" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl sm:text-2xl font-black text-[#2B3674] uppercase tracking-tight">Care Event Summary</h3>
                <p className="text-sm sm:text-base text-[#A3AED0] font-bold mt-2">Activity overview for the recorded period</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 sm:p-6 rounded-[20px] bg-[#E9E3FF] border-none text-center">
                  <p className="text-xs sm:text-sm font-bold text-[#4318FF] uppercase tracking-widest mb-1">Total Activities</p>
                  <p className="text-3xl sm:text-4xl font-black text-[#4318FF]">{careEventRecords.length}</p>
                </div>
                <div className="p-4 sm:p-6 rounded-[20px] bg-green-50 border-none text-center">
                  <p className="text-xs sm:text-sm font-bold text-green-600 uppercase tracking-widest mb-1">Completed</p>
                  <p className="text-3xl sm:text-4xl font-black text-green-600">{completedCareCount}</p>
                </div>
                <div className="p-4 sm:p-6 rounded-[20px] bg-[#F4F7FE] border-none text-center">
                  <p className="text-xs sm:text-sm font-bold text-[#A3AED0] uppercase tracking-widest mb-1">Scheduled</p>
                  <p className="text-3xl sm:text-4xl font-black text-[#2B3674]">{careEventRecords.length - completedCareCount}</p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab2 === "narrative" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto">
              <div className="prose prose-slate max-w-none text-[#2B3674] leading-relaxed font-medium text-sm sm:text-base">
                <p className="first-letter:text-3xl sm:first-letter:text-5xl first-letter:font-black first-letter:text-[#4318FF] first-letter:mr-2 first-letter:float-left">
                  {careEventRecords.length === 0
                    ? "No care event records are available for the selected period."
                    : `A total of ${careEventRecords.length} care event(s) are on record. ` +
                      `${completedCareCount} were completed and ` +
                      `${careEventRecords.length - completedCareCount} remain scheduled.`}
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* ─── Table 3: Outdoor Activities ─── */}
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
                  className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-[#E0E5F2] rounded-xl text-sm font-bold text-[#2B3674] hover:border-[#4318FF] transition-all w-full sm:min-w-[200px] justify-between"
                >
                  {dateRange3}
                  <ChevronDown className="w-4 h-4 text-[#A3AED0]" />
                </button>
                {showDropdown3 && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white border-2 border-[#E0E5F2] rounded-xl shadow-lg z-10 overflow-hidden">
                    {dateRangeOptions23.map(option => (
                      <button key={option} onClick={() => { setDateRange3(option); setShowDropdown3(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm font-bold transition-colors ${dateRange3 === option ? "bg-[#E9E3FF] text-[#4318FF]" : "text-[#2B3674] hover:bg-[#F4F7FE]"}`}>
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {dateRange3 === "Custom Range" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-sm font-bold text-[#2B3674]">Start Date:</span>
                  <DatePicker selected={startDate3} onChange={(d: Date | null) => setStartDate3(d)} selectsStart startDate={startDate3} endDate={endDate3} className="w-full sm:w-auto px-4 py-2 bg-white border-2 border-[#E0E5F2] rounded-xl text-sm font-bold text-[#2B3674] hover:border-[#4318FF] transition-all focus:outline-none focus:border-[#4318FF]" placeholderText="Select start date" dateFormat="dd/MM/yyyy" />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-sm font-bold text-[#2B3674]">End Date:</span>
                  <DatePicker selected={endDate3} onChange={(d: Date | null) => setEndDate3(d)} selectsEnd startDate={startDate3} endDate={endDate3} minDate={startDate3 ?? undefined} className="w-full sm:w-auto px-4 py-2 bg-white border-2 border-[#E0E5F2] rounded-xl text-sm font-bold text-[#2B3674] hover:border-[#4318FF] transition-all focus:outline-none focus:border-[#4318FF]" placeholderText="Select end date" dateFormat="dd/MM/yyyy" />
                </div>
              </motion.div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 bg-[#F4F7FE] p-1.5 rounded-xl self-start">
            {[
              { id: "detailed", icon: FileSpreadsheet, label: "Report" },
              { id: "summary", icon: List, label: "Concise Summary" },
              { id: "narrative", icon: AlignLeft, label: "Narrative" },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab3(tab.id as "detailed" | "summary" | "narrative")}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${activeTab3 === tab.id ? "bg-white text-[#4318FF] shadow-sm border-none" : "text-[#A3AED0] hover:text-[#2B3674] hover:bg-[#E9E3FF]"}`}>
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.id === "detailed" ? "Report" : tab.id === "summary" ? "Summary" : "Narrative"}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-8">
          {activeTab3 === "detailed" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="rounded-[20px] border border-[#E0E5F2] overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[600px]">
                  <thead className="bg-[#F4F7FE] border-b border-[#E0E5F2] text-xs uppercase tracking-wider font-bold text-[#A3AED0]">
                    <tr>
                      <th className="p-3 sm:p-4">Date</th>
                      <th className="p-3 sm:p-4">Time</th>
                      <th className="p-3 sm:p-4">Event</th>
                      <th className="p-3 sm:p-4">Notes</th>
                      <th className="p-3 sm:p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E5F2]">
                    {outdoorRecords.length === 0 ? (
                      <tr><td colSpan={5} className="p-8 text-center text-sm font-bold text-[#A3AED0]">No outdoor activity records found.</td></tr>
                    ) : outdoorRecords.map((rec, i) => {
                      const done = isOutdoorCompleted(rec.id, rec.startDatetime);
                      return (
                        <tr key={`outdoor-${rec.id || i}`} className="hover:bg-[#F4F7FE]/50 transition-colors">
                          <td className="p-3 sm:p-4 font-bold text-[#2B3674]">{rec.startDatetime.slice(0, 10)}</td>
                          <td className="p-3 sm:p-4 font-bold text-[#A3AED0]">{rec.startDatetime.slice(11, 16)}</td>
                          <td className="p-3 sm:p-4 font-bold text-[#4318FF]">{rec.outdoorTitle}</td>
                          <td className="p-3 sm:p-4 font-bold text-[#A3AED0]">{rec.prepareNote || "-"}</td>
                          <td className="p-3 sm:p-4">
                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${done ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-500"}`}>
                              {done ? "Completed" : "Upcoming"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab3 === "summary" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl sm:text-2xl font-black text-[#2B3674] uppercase tracking-tight">Outdoor Activity Summary</h3>
                <p className="text-sm sm:text-base text-[#A3AED0] font-bold mt-2">Calendar events and outdoor engagement</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 sm:p-6 rounded-[20px] bg-[#E9E3FF] border-none text-center">
                  <p className="text-xs sm:text-sm font-bold text-[#4318FF] uppercase tracking-widest mb-1">Total Events</p>
                  <p className="text-3xl sm:text-4xl font-black text-[#4318FF]">{outdoorRecords.length}</p>
                </div>
                <div className="p-4 sm:p-6 rounded-[20px] bg-green-50 border-none text-center">
                  <p className="text-xs sm:text-sm font-bold text-green-600 uppercase tracking-widest mb-1">Completed</p>
                  <p className="text-3xl sm:text-4xl font-black text-green-600">{completedOutdoorCount}</p>
                </div>
                <div className="p-4 sm:p-6 rounded-[20px] bg-blue-50 border-none text-center">
                  <p className="text-xs sm:text-sm font-bold text-blue-600 uppercase tracking-widest mb-1">Upcoming</p>
                  <p className="text-3xl sm:text-4xl font-black text-blue-600">{outdoorRecords.length - completedOutdoorCount}</p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab3 === "narrative" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto">
              <div className="prose prose-slate max-w-none text-[#2B3674] leading-relaxed font-medium text-sm sm:text-base">
                <p className="first-letter:text-3xl sm:first-letter:text-5xl first-letter:font-black first-letter:text-[#4318FF] first-letter:mr-2 first-letter:float-left">
                  {outdoorRecords.length === 0
                    ? "No outdoor activity records are available for the selected period."
                    : `A total of ${outdoorRecords.length} outdoor event(s) are on record. ` +
                      `${completedOutdoorCount} were completed and ` +
                      `${outdoorRecords.length - completedOutdoorCount} are upcoming.`}
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
