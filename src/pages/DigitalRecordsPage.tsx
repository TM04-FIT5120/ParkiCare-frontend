import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { Download, FileSpreadsheet, List, AlignLeft, ChevronDown, Loader2, CalendarSync } from "lucide-react";
import { toast } from "sonner";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ensureDatePickerLocales, getActiveLang, getIntlLocale } from "@/lib/dateLocale";

ensureDatePickerLocales();
import {
  careEventsService,
  type HomeCareScheduleResponse,
  type OutdoorScheduleResponse,
  type MedicationReportDTO,
} from "@/services/careEvents";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { TableSkeleton } from "@/components/LoadingState";
import { listCaregiverEventOccurrences } from "@/services/caregiverEventOccurrences";
import { completionLookupKey, addDaysMYT } from "@/lib/eventRecurrence";

type MedicationReportScope = "sinceLastExport" | "last30Days" | "custom" | "fullHistory";

export function DigitalRecordsPage() {
  const { t } = useTranslation();
  const { patient, user } = useAuth();
  const { currentLang } = useLanguage();

  const medicationScopeOptions: Array<{ value: MedicationReportScope; label: string }> = [
    { value: "sinceLastExport", label: t("digitalRecords.cumulativeSync") },
    { value: "last30Days", label: t("digitalRecords.last30Days") },
    { value: "custom", label: t("digitalRecords.customRange") },
    { value: "fullHistory", label: t("digitalRecords.fullHistory") },
  ];
  const patientId = patient?.patientId;
  const caregiverId = user?.caregiverId ?? 0;

  const CARE_ACTIVITY_KEYS: Record<string, string> = {
    "Bathing": "careEvents.bathing",
    "Nursing Care": "careEvents.nursingCare",
    "Toileting Assist": "careEvents.toiletingAssist",
    "Meals": "careEvents.meals",
    "Exercise": "careEvents.exercise",
    "Physical Therapy": "careEvents.physicalTherapy",
  };
  const OUTDOOR_ACTIVITY_KEYS: Record<string, string> = {
    "Doctor Appointment": "careEvents.doctorAppointment",
    "Walk in Park": "careEvents.walkInPark",
    "Social Visit": "careEvents.socialVisit",
    "Shopping": "careEvents.shopping",
    "Recreation": "careEvents.recreation",
    "Family Outing": "careEvents.familyOuting",
  };
  const translateActivityTitle = (title: string, map: Record<string, string>) => {
    const key = map[title];
    return key ? t(key) : title;
  };

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
  const [isLoadingCareRecords, setIsLoadingCareRecords] = useState(true);
  const [isLoadingOutdoorRecords, setIsLoadingOutdoorRecords] = useState(true);
  type DateRangeKey = "last30Days" | "custom" | "fullHistory";
  const [dateRange2, setDateRange2] = useState<DateRangeKey>("last30Days");
  const [dateRange3, setDateRange3] = useState<DateRangeKey>("last30Days");
  const [showDropdown2, setShowDropdown2] = useState(false);
  const [showDropdown3, setShowDropdown3] = useState(false);
  const [startDate2, setStartDate2] = useState<Date | null>(null);
  const [endDate2, setEndDate2] = useState<Date | null>(null);
  const [startDate3, setStartDate3] = useState<Date | null>(null);
  const [endDate3, setEndDate3] = useState<Date | null>(null);
  const dateRangeOptions23: Array<{ value: DateRangeKey; label: string }> = [
    { value: "last30Days", label: t("digitalRecords.last30Days") },
    { value: "custom", label: t("digitalRecords.customRange") },
    { value: "fullHistory", label: t("digitalRecords.fullHistory") },
  ];

  // --- Completion lookup for Tables 2 & 3 ---
  const [completionKeys, setCompletionKeys] = useState<Set<string>>(new Set());

  // Fetch home care, outdoor records + completion keys on mount
  useEffect(() => {
    if (!patientId) {
      setIsLoadingCareRecords(false);
      setIsLoadingOutdoorRecords(false);
      return;
    }
    setIsLoadingCareRecords(true);
    setIsLoadingOutdoorRecords(true);
    careEventsService
      .getHomeCare(patientId)
      .then(setCareEventRecords)
      .catch(() => {})
      .finally(() => setIsLoadingCareRecords(false));
    careEventsService
      .getOutdoor(patientId)
      .then(setOutdoorRecords)
      .catch(() => {})
      .finally(() => setIsLoadingOutdoorRecords(false));
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
  }, [patientId, caregiverId, currentLang]);

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
      .catch(() => toast.error(t("digitalRecords.failedLoadReport")))
      .finally(() => setIsLoadingReport(false));
  }, [patientId, reportMode1, startDate1, endDate1, currentLang, t]);

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
      toast.success(t("digitalRecords.exportSuccess"));
    } catch {
      toast.error(t("digitalRecords.exportFailed"));
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
  const narrativeText = (() => {
    if (!medicationReport) return t("common.noData");
    const successDays = medicationReport.dailySummaries.filter(d => d.status === "SUCCESS").length;
    const incompleteDays = medicationReport.dailySummaries.filter(d => d.status === "INCOMPLETE").length;
    const rate = medicationReport.overallCompletionRate;
    const conclusion = rate >= 90
      ? t("digitalRecords.narrativeConclusionGood")
      : rate >= 70
      ? t("digitalRecords.narrativeConclusionFair")
      : t("digitalRecords.narrativeConclusionLow");
    return t("digitalRecords.narrativeTemplate", {
      startDate: medicationReport.startDate,
      endDate: medicationReport.endDate,
      rate: rate.toFixed(1),
      successDays,
      incompleteDays,
      conclusion,
    });
  })();

  // Format last export timestamp
  const lastExportLabel = medicationReport?.lastExportTime
    ? new Date(medicationReport.lastExportTime).toLocaleString(getIntlLocale(), {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : t("digitalRecords.noExport");
  const selectedMedicationScope =
    medicationScopeOptions.find(option => option.value === reportMode1) ?? medicationScopeOptions[0];

  return (
    <div className="space-y-6 sm:space-y-8 pb-10 min-w-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#2B3674]">{t("digitalRecords.title")}</h1>
          <p className="text-sm sm:text-base text-[#A3AED0] font-bold mt-1">{t("digitalRecords.subtitle")}</p>
        </div>
      </div>

      {/* ─── Table 1: Medication Records ─── */}
      <div className="bg-white rounded-[20px] shadow-[0_18px_40px_rgba(112,144,176,0.12)] border-none overflow-hidden">
        <div className="border-b border-[#E0E5F2] p-4 sm:p-6 bg-white">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 sm:gap-6 mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-[#2B3674]">{t("digitalRecords.medicationRecords")}</h2>
              <p className="text-xs sm:text-sm text-[#A3AED0] font-bold">{t("digitalRecords.medicationRecordsSubtitle")}</p>
            </div>
            <div className="text-xs font-bold text-[#A3AED0] bg-[#F4F7FE] px-3 py-1.5 rounded-lg shrink-0">
              {t("digitalRecords.lastExport")} <span className="text-[#4318FF]">{lastExportLabel}</span>
            </div>
          </div>

          {/* Date range selector */}
          <div className="mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-sm font-bold text-[#A3AED0] uppercase tracking-wide">{t("digitalRecords.dataScope")}</span>
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
                  <span className="text-sm font-bold text-[#2B3674]">{t("common.startDate")}:</span>
                  <DatePicker
                    selected={startDate1}
                    onChange={(date: Date | null) => setStartDate1(date)}
                    selectsStart
                    startDate={startDate1}
                    endDate={endDate1}
                    locale={getActiveLang()}
                    className="w-full sm:w-auto px-4 py-2 bg-white border-2 border-[#E0E5F2] rounded-xl text-sm font-bold text-[#2B3674] hover:border-[#4318FF] transition-all focus:outline-none focus:border-[#4318FF]"
                    placeholderText={t("digitalRecords.selectStartDate")}
                    dateFormat="dd/MM/yyyy"
                  />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-sm font-bold text-[#2B3674]">{t("common.endDate")}:</span>
                  <DatePicker
                    selected={endDate1}
                    onChange={(date: Date | null) => setEndDate1(date)}
                    selectsEnd
                    startDate={startDate1}
                    endDate={endDate1}
                    minDate={startDate1 ?? undefined}
                    locale={getActiveLang()}
                    className="w-full sm:w-auto px-4 py-2 bg-white border-2 border-[#E0E5F2] rounded-xl text-sm font-bold text-[#2B3674] hover:border-[#4318FF] transition-all focus:outline-none focus:border-[#4318FF]"
                    placeholderText={t("digitalRecords.selectEndDate")}
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
                { id: "detailed", icon: FileSpreadsheet, label: t("digitalRecords.tabReport") },
                { id: "summary", icon: List, label: t("digitalRecords.tabSummary") },
                { id: "narrative", icon: AlignLeft, label: t("digitalRecords.tabNarrative") },
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
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={handleExportMedication}
              disabled={isExporting || isLoadingReport}
              className="flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] active:scale-95 w-full lg:w-auto text-sm sm:text-base disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{isExporting ? t("digitalRecords.exporting") : t("digitalRecords.exportPdf")}</span>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-8">
          {/* Period info */}
          {medicationReport && (
            <div className="mb-6">
              <p className="text-xs text-[#A3AED0] font-bold">
                {selectedMedicationScope.label} • {t("digitalRecords.period")} {medicationReport.startDate} – {medicationReport.endDate}
              </p>
            </div>
          )}

          {isLoadingReport && <TableSkeleton rows={6} />}

          {!isLoadingReport && activeTab1 === "detailed" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="rounded-[20px] border border-[#E0E5F2] overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[600px]">
                  <thead className="bg-[#F4F7FE] border-b border-[#E0E5F2] text-xs uppercase tracking-wider font-bold text-[#A3AED0]">
                    <tr>
                      <th className="p-3 sm:p-4">{t("digitalRecords.dateCol")}</th>
                      <th className="p-3 sm:p-4">{t("digitalRecords.medication")}</th>
                      <th className="p-3 sm:p-4">{t("digitalRecords.targetFreq")}</th>
                      <th className="p-3 sm:p-4">{t("digitalRecords.actualCount")}</th>
                      <th className="p-3 sm:p-4">{t("digitalRecords.statusCol")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E5F2]">
                    {!medicationReport || medicationReport.dailyBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-sm font-bold text-[#A3AED0]">
                          {t("digitalRecords.noMedRecords")}
                        </td>
                      </tr>
                    ) : medicationReport.dailyBreakdown.map((row, i) => (
                      <tr key={`med-${i}`} className="hover:bg-[#F4F7FE]/50 transition-colors">
                        <td className="p-3 sm:p-4 font-bold text-[#2B3674]">{row.date}</td>
                        <td className="p-3 sm:p-4 font-bold text-[#4318FF]">{row.drugName}</td>
                        <td className="p-3 sm:p-4 font-bold text-[#2B3674]">{t("digitalRecords.timesPerDay", { count: row.targetFrequency })}</td>
                        <td className="p-3 sm:p-4 font-bold text-[#2B3674]">{t("digitalRecords.actualCountFormat", { actual: row.actualCount, target: row.targetFrequency })}</td>
                        <td className="p-3 sm:p-4">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                            row.status === "SUCCESS"
                              ? "bg-green-50 text-green-600"
                              : "bg-red-50 text-red-500"
                          }`}>
                            {row.status === "SUCCESS" ? t("digitalRecords.statusSuccess") : t("digitalRecords.statusIncomplete")}
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
                <h3 className="text-xl sm:text-2xl font-black text-[#2B3674] uppercase tracking-tight">{t("digitalRecords.medSummaryTitle")}</h3>
                <p className="text-sm sm:text-base text-[#A3AED0] font-bold mt-2">{t("digitalRecords.medSummarySubtitle")}</p>
              </div>

              {/* Executive summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 sm:p-6 rounded-[20px] bg-[#E9E3FF] border-none text-center">
                  <p className="text-xs sm:text-sm font-bold text-[#4318FF] uppercase tracking-widest mb-1">{t("digitalRecords.freqAchievement")}</p>
                  <p className="text-3xl sm:text-4xl font-black text-[#4318FF]">
                    {medicationReport ? `${medicationReport.overallCompletionRate.toFixed(1)}%` : "-"}
                  </p>
                </div>
                <div className="p-4 sm:p-6 rounded-[20px] bg-green-50 border-none text-center">
                  <p className="text-xs sm:text-sm font-bold text-green-600 uppercase tracking-widest mb-1">{t("digitalRecords.successDays")}</p>
                  <p className="text-3xl sm:text-4xl font-black text-green-600">
                    {medicationReport ? medicationReport.dailySummaries.filter(d => d.status === "SUCCESS").length : "-"}
                  </p>
                </div>
                <div className="p-4 sm:p-6 rounded-[20px] bg-red-50 border-none text-center">
                  <p className="text-xs sm:text-sm font-bold text-red-500 uppercase tracking-widest mb-1">{t("digitalRecords.incompleteDays")}</p>
                  <p className="text-3xl sm:text-4xl font-black text-red-500">
                    {medicationReport ? medicationReport.dailySummaries.filter(d => d.status === "INCOMPLETE").length : "-"}
                  </p>
                </div>
              </div>

              {/* Per-medication breakdown */}
              {medicationReport && medicationReport.medicationSummaries.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-[#A3AED0] uppercase tracking-widest mb-3">{t("digitalRecords.perMedBreakdown")}</h4>
                  <div className="rounded-[20px] border border-[#E0E5F2] overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[500px]">
                      <thead className="bg-[#F4F7FE] border-b border-[#E0E5F2] text-xs uppercase tracking-wider font-bold text-[#A3AED0]">
                        <tr>
                          <th className="p-3">{t("digitalRecords.drugCol")}</th>
                          <th className="p-3">{t("digitalRecords.target")}</th>
                          <th className="p-3">{t("digitalRecords.actual")}</th>
                          <th className="p-3">{t("digitalRecords.rate")}</th>
                          <th className="p-3">{t("digitalRecords.successDays")}</th>
                          <th className="p-3">{t("digitalRecords.incompleteDays")}</th>
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
                  <h4 className="text-sm font-bold text-[#A3AED0] uppercase tracking-widest mb-3">{t("digitalRecords.dailyBreakdown")}</h4>
                  <div className="rounded-[20px] border border-[#E0E5F2] overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[400px]">
                      <thead className="bg-[#F4F7FE] border-b border-[#E0E5F2] text-xs uppercase tracking-wider font-bold text-[#A3AED0]">
                        <tr>
                          <th className="p-3">{t("digitalRecords.dateCol")}</th>
                          <th className="p-3">{t("digitalRecords.target")}</th>
                          <th className="p-3">{t("digitalRecords.actual")}</th>
                          <th className="p-3">{t("digitalRecords.statusCol")}</th>
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
                                {d.status === "SUCCESS" ? t("digitalRecords.statusSuccess") : t("digitalRecords.statusIncomplete")}
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
                <p className="text-center text-sm font-bold text-[#A3AED0] py-8">{t("digitalRecords.noSummaryData")}</p>
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
              <h2 className="text-lg sm:text-xl font-bold text-[#2B3674]">{t("digitalRecords.careEventRecords")}</h2>
              <p className="text-xs sm:text-sm text-[#A3AED0] font-bold">{t("digitalRecords.careEventSubtitle")}</p>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="text-sm font-bold text-[#A3AED0] uppercase tracking-wide">{t("digitalRecords.dateRange")}</span>
              <div className="relative w-full sm:w-auto">
                <button
                  onClick={() => setShowDropdown2(!showDropdown2)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-[#E0E5F2] rounded-xl text-sm font-bold text-[#2B3674] hover:border-[#4318FF] transition-all w-full sm:min-w-[200px] justify-between"
                >
                  {dateRangeOptions23.find(o => o.value === dateRange2)?.label}
                  <ChevronDown className="w-4 h-4 text-[#A3AED0]" />
                </button>
                {showDropdown2 && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white border-2 border-[#E0E5F2] rounded-xl shadow-lg z-10 overflow-hidden">
                    {dateRangeOptions23.map(option => (
                      <button key={option.value} onClick={() => { setDateRange2(option.value); setShowDropdown2(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm font-bold transition-colors ${dateRange2 === option.value ? "bg-[#E9E3FF] text-[#4318FF]" : "text-[#2B3674] hover:bg-[#F4F7FE]"}`}>
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {dateRange2 === "custom" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-sm font-bold text-[#2B3674]">{t("common.startDate")}:</span>
                  <DatePicker selected={startDate2} onChange={(d: Date | null) => setStartDate2(d)} selectsStart startDate={startDate2} endDate={endDate2} locale={getActiveLang()} className="w-full sm:w-auto px-4 py-2 bg-white border-2 border-[#E0E5F2] rounded-xl text-sm font-bold text-[#2B3674] hover:border-[#4318FF] transition-all focus:outline-none focus:border-[#4318FF]" placeholderText={t("digitalRecords.selectStartDate")} dateFormat="dd/MM/yyyy" />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-sm font-bold text-[#2B3674]">{t("common.endDate")}:</span>
                  <DatePicker selected={endDate2} onChange={(d: Date | null) => setEndDate2(d)} selectsEnd startDate={startDate2} endDate={endDate2} minDate={startDate2 ?? undefined} locale={getActiveLang()} className="w-full sm:w-auto px-4 py-2 bg-white border-2 border-[#E0E5F2] rounded-xl text-sm font-bold text-[#2B3674] hover:border-[#4318FF] transition-all focus:outline-none focus:border-[#4318FF]" placeholderText={t("digitalRecords.selectEndDate")} dateFormat="dd/MM/yyyy" />
                </div>
              </motion.div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 bg-[#F4F7FE] p-1.5 rounded-xl self-start">
            {[
              { id: "detailed", icon: FileSpreadsheet, label: t("digitalRecords.tabReport") },
              { id: "summary", icon: List, label: t("digitalRecords.tabSummary") },
              { id: "narrative", icon: AlignLeft, label: t("digitalRecords.tabNarrative") },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab2(tab.id as "detailed" | "summary" | "narrative")}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${activeTab2 === tab.id ? "bg-white text-[#4318FF] shadow-sm border-none" : "text-[#A3AED0] hover:text-[#2B3674] hover:bg-[#E9E3FF]"}`}>
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-8">
          {isLoadingCareRecords && <TableSkeleton rows={6} />}

          {!isLoadingCareRecords && activeTab2 === "detailed" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="rounded-[20px] border border-[#E0E5F2] overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[600px]">
                  <thead className="bg-[#F4F7FE] border-b border-[#E0E5F2] text-xs uppercase tracking-wider font-bold text-[#A3AED0]">
                    <tr>
                      <th className="p-3 sm:p-4">{t("digitalRecords.dateCol")}</th>
                      <th className="p-3 sm:p-4">{t("common.time")}</th>
                      <th className="p-3 sm:p-4">{t("digitalRecords.activityCol")}</th>
                      <th className="p-3 sm:p-4">{t("common.notes")}</th>
                      <th className="p-3 sm:p-4">{t("common.status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E5F2]">
                    {careEventRecords.length === 0 ? (
                      <tr><td colSpan={5} className="p-8 text-center text-sm font-bold text-[#A3AED0]">{t("digitalRecords.noCareRecords")}</td></tr>
                    ) : careEventRecords.map((rec, i) => {
                      const done = isCareCompleted(rec.id, rec.startDatetime);
                      return (
                        <tr key={`care-${rec.id || i}`} className="hover:bg-[#F4F7FE]/50 transition-colors">
                          <td className="p-3 sm:p-4 font-bold text-[#2B3674]">{rec.startDatetime.slice(0, 10)}</td>
                          <td className="p-3 sm:p-4 font-bold text-[#A3AED0]">{rec.startDatetime.slice(11, 16)}</td>
                          <td className="p-3 sm:p-4 font-bold text-[#4318FF]">{translateActivityTitle(rec.homeCareTitle, CARE_ACTIVITY_KEYS)}</td>
                          <td className="p-3 sm:p-4 font-bold text-[#A3AED0]">{rec.careNote || "-"}</td>
                          <td className="p-3 sm:p-4">
                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${done ? "bg-green-50 text-green-600" : "bg-[#F4F7FE] text-[#A3AED0]"}`}>
                              {done ? t("digitalRecords.completedLabel") : t("digitalRecords.scheduledLabel")}
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

          {!isLoadingCareRecords && activeTab2 === "summary" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl sm:text-2xl font-black text-[#2B3674] uppercase tracking-tight">{t("digitalRecords.careEventSummaryTitle")}</h3>
                <p className="text-sm sm:text-base text-[#A3AED0] font-bold mt-2">{t("digitalRecords.careEventSummarySubtitle")}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 sm:p-6 rounded-[20px] bg-[#E9E3FF] border-none text-center">
                  <p className="text-xs sm:text-sm font-bold text-[#4318FF] uppercase tracking-widest mb-1">{t("digitalRecords.totalActivities")}</p>
                  <p className="text-3xl sm:text-4xl font-black text-[#4318FF]">{careEventRecords.length}</p>
                </div>
                <div className="p-4 sm:p-6 rounded-[20px] bg-green-50 border-none text-center">
                  <p className="text-xs sm:text-sm font-bold text-green-600 uppercase tracking-widest mb-1">{t("digitalRecords.completedLabel")}</p>
                  <p className="text-3xl sm:text-4xl font-black text-green-600">{completedCareCount}</p>
                </div>
                <div className="p-4 sm:p-6 rounded-[20px] bg-[#F4F7FE] border-none text-center">
                  <p className="text-xs sm:text-sm font-bold text-[#A3AED0] uppercase tracking-widest mb-1">{t("digitalRecords.scheduledLabel")}</p>
                  <p className="text-3xl sm:text-4xl font-black text-[#2B3674]">{careEventRecords.length - completedCareCount}</p>
                </div>
              </div>
            </motion.div>
          )}

          {!isLoadingCareRecords && activeTab2 === "narrative" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto">
              <div className="prose prose-slate max-w-none text-[#2B3674] leading-relaxed font-medium text-sm sm:text-base">
                <p className="first-letter:text-3xl sm:first-letter:text-5xl first-letter:font-black first-letter:text-[#4318FF] first-letter:mr-2 first-letter:float-left">
                  {careEventRecords.length === 0
                    ? t("digitalRecords.careNarrativeEmpty")
                    : t("digitalRecords.careNarrative", {
                        total: careEventRecords.length,
                        completed: completedCareCount,
                        scheduled: careEventRecords.length - completedCareCount,
                      })}
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
              <h2 className="text-lg sm:text-xl font-bold text-[#2B3674]">{t("digitalRecords.outdoorActivities")}</h2>
              <p className="text-xs sm:text-sm text-[#A3AED0] font-bold">{t("digitalRecords.outdoorSubtitle")}</p>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="text-sm font-bold text-[#A3AED0] uppercase tracking-wide">{t("digitalRecords.dateRange")}</span>
              <div className="relative w-full sm:w-auto">
                <button
                  onClick={() => setShowDropdown3(!showDropdown3)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-[#E0E5F2] rounded-xl text-sm font-bold text-[#2B3674] hover:border-[#4318FF] transition-all w-full sm:min-w-[200px] justify-between"
                >
                  {dateRangeOptions23.find(o => o.value === dateRange3)?.label}
                  <ChevronDown className="w-4 h-4 text-[#A3AED0]" />
                </button>
                {showDropdown3 && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white border-2 border-[#E0E5F2] rounded-xl shadow-lg z-10 overflow-hidden">
                    {dateRangeOptions23.map(option => (
                      <button key={option.value} onClick={() => { setDateRange3(option.value); setShowDropdown3(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm font-bold transition-colors ${dateRange3 === option.value ? "bg-[#E9E3FF] text-[#4318FF]" : "text-[#2B3674] hover:bg-[#F4F7FE]"}`}>
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {dateRange3 === "custom" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-sm font-bold text-[#2B3674]">{t("common.startDate")}:</span>
                  <DatePicker selected={startDate3} onChange={(d: Date | null) => setStartDate3(d)} selectsStart startDate={startDate3} endDate={endDate3} locale={getActiveLang()} className="w-full sm:w-auto px-4 py-2 bg-white border-2 border-[#E0E5F2] rounded-xl text-sm font-bold text-[#2B3674] hover:border-[#4318FF] transition-all focus:outline-none focus:border-[#4318FF]" placeholderText={t("digitalRecords.selectStartDate")} dateFormat="dd/MM/yyyy" />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-sm font-bold text-[#2B3674]">{t("common.endDate")}:</span>
                  <DatePicker selected={endDate3} onChange={(d: Date | null) => setEndDate3(d)} selectsEnd startDate={startDate3} endDate={endDate3} minDate={startDate3 ?? undefined} locale={getActiveLang()} className="w-full sm:w-auto px-4 py-2 bg-white border-2 border-[#E0E5F2] rounded-xl text-sm font-bold text-[#2B3674] hover:border-[#4318FF] transition-all focus:outline-none focus:border-[#4318FF]" placeholderText={t("digitalRecords.selectEndDate")} dateFormat="dd/MM/yyyy" />
                </div>
              </motion.div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 bg-[#F4F7FE] p-1.5 rounded-xl self-start">
            {[
              { id: "detailed", icon: FileSpreadsheet, label: t("digitalRecords.tabReport") },
              { id: "summary", icon: List, label: t("digitalRecords.tabSummary") },
              { id: "narrative", icon: AlignLeft, label: t("digitalRecords.tabNarrative") },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab3(tab.id as "detailed" | "summary" | "narrative")}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${activeTab3 === tab.id ? "bg-white text-[#4318FF] shadow-sm border-none" : "text-[#A3AED0] hover:text-[#2B3674] hover:bg-[#E9E3FF]"}`}>
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-8">
          {isLoadingOutdoorRecords && <TableSkeleton rows={6} />}

          {!isLoadingOutdoorRecords && activeTab3 === "detailed" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="rounded-[20px] border border-[#E0E5F2] overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[600px]">
                  <thead className="bg-[#F4F7FE] border-b border-[#E0E5F2] text-xs uppercase tracking-wider font-bold text-[#A3AED0]">
                    <tr>
                      <th className="p-3 sm:p-4">{t("digitalRecords.dateCol")}</th>
                      <th className="p-3 sm:p-4">{t("common.time")}</th>
                      <th className="p-3 sm:p-4">{t("digitalRecords.eventCol")}</th>
                      <th className="p-3 sm:p-4">{t("common.notes")}</th>
                      <th className="p-3 sm:p-4">{t("common.status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E5F2]">
                    {outdoorRecords.length === 0 ? (
                      <tr><td colSpan={5} className="p-8 text-center text-sm font-bold text-[#A3AED0]">{t("digitalRecords.noOutdoorRecords")}</td></tr>
                    ) : outdoorRecords.map((rec, i) => {
                      const done = isOutdoorCompleted(rec.id, rec.startDatetime);
                      return (
                        <tr key={`outdoor-${rec.id || i}`} className="hover:bg-[#F4F7FE]/50 transition-colors">
                          <td className="p-3 sm:p-4 font-bold text-[#2B3674]">{rec.startDatetime.slice(0, 10)}</td>
                          <td className="p-3 sm:p-4 font-bold text-[#A3AED0]">{rec.startDatetime.slice(11, 16)}</td>
                          <td className="p-3 sm:p-4 font-bold text-[#4318FF]">{translateActivityTitle(rec.outdoorTitle, OUTDOOR_ACTIVITY_KEYS)}</td>
                          <td className="p-3 sm:p-4 font-bold text-[#A3AED0]">{rec.prepareNote || "-"}</td>
                          <td className="p-3 sm:p-4">
                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${done ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-500"}`}>
                              {done ? t("digitalRecords.completedLabel") : t("digitalRecords.upcomingLabel")}
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

          {!isLoadingOutdoorRecords && activeTab3 === "summary" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl sm:text-2xl font-black text-[#2B3674] uppercase tracking-tight">{t("digitalRecords.outdoorSummaryTitle")}</h3>
                <p className="text-sm sm:text-base text-[#A3AED0] font-bold mt-2">{t("digitalRecords.outdoorSummarySubtitle")}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 sm:p-6 rounded-[20px] bg-[#E9E3FF] border-none text-center">
                  <p className="text-xs sm:text-sm font-bold text-[#4318FF] uppercase tracking-widest mb-1">{t("digitalRecords.totalEvents")}</p>
                  <p className="text-3xl sm:text-4xl font-black text-[#4318FF]">{outdoorRecords.length}</p>
                </div>
                <div className="p-4 sm:p-6 rounded-[20px] bg-green-50 border-none text-center">
                  <p className="text-xs sm:text-sm font-bold text-green-600 uppercase tracking-widest mb-1">{t("digitalRecords.completedLabel")}</p>
                  <p className="text-3xl sm:text-4xl font-black text-green-600">{completedOutdoorCount}</p>
                </div>
                <div className="p-4 sm:p-6 rounded-[20px] bg-blue-50 border-none text-center">
                  <p className="text-xs sm:text-sm font-bold text-blue-600 uppercase tracking-widest mb-1">{t("digitalRecords.upcomingLabel")}</p>
                  <p className="text-3xl sm:text-4xl font-black text-blue-600">{outdoorRecords.length - completedOutdoorCount}</p>
                </div>
              </div>
            </motion.div>
          )}

          {!isLoadingOutdoorRecords && activeTab3 === "narrative" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto">
              <div className="prose prose-slate max-w-none text-[#2B3674] leading-relaxed font-medium text-sm sm:text-base">
                <p className="first-letter:text-3xl sm:first-letter:text-5xl first-letter:font-black first-letter:text-[#4318FF] first-letter:mr-2 first-letter:float-left">
                  {outdoorRecords.length === 0
                    ? t("digitalRecords.outdoorNarrativeEmpty")
                    : t("digitalRecords.outdoorNarrative", {
                        total: outdoorRecords.length,
                        completed: completedOutdoorCount,
                        upcoming: outdoorRecords.length - completedOutdoorCount,
                      })}
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
