import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useNavigate } from "react-router-dom";
import {
  Calendar as CalendarIcon,
  Clock,
  Pill,
  CheckCircle2,
  Circle,
  Heart,
  X,
  MapPin,
  Trash2,
  Loader2,
  Bell,
  Coffee,
  Utensils,
  Moon,
  ChevronLeft,
  ChevronRight,
  Shield,
  Phone,
  ChefHat,
  Apple,
  FolderOpen,
  Banknote,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { formatMonthYear, formatMonthShort, formatWeekday } from "@/lib/dateLocale";
import { useCareEvents } from "@/hooks/useCareEvents";
import { careEventsService } from "@/services/careEvents";
import { caregiverScheduleService } from "@/services/caregiverSchedule";
import {
  listCaregiverEventOccurrences,
  upsertCaregiverEventOccurrence,
} from "@/services/caregiverEventOccurrences";
import { dashboardService } from "@/services/dashboard";
import { getMealSchedules, generateWeeklyMeals, type MealScheduleEntry } from "@/services/mealSchedule";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  useMedicationAlert,
  useMedicationAlertSnoozeScheduler,
  useObservationAlert,
} from "@/context/MedicationAlertContext";
import { ObservationNoteModal } from "@/components/ObservationNoteModal";
import type { CareEvent } from "@/context/careEventsContext";
import {
  addDaysMYT,
  completionLookupKey,
  getMYTDateString,
  isEventOnDay,
  occurrenceIsoForDay,
  resolveMedicationRecurrence,
  type EventOccurrenceSourceType,
} from "@/lib/eventRecurrence";

// ─── Constants ───────────────────────────────────────────────────────────────

type CalendarView = "Week" | "Month";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getMYTNow(): Date {
  const utcMs = Date.now() + new Date().getTimezoneOffset() * 60_000;
  return new Date(utcMs + 8 * 3_600_000);
}

function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function useIsMobile(breakpointPx = 640) {
  const query = `(max-width: ${breakpointPx - 1}px)`;
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return isMobile;
}


function resolveOutdoorSourceId(e: CareEvent): number {
  if (e.backendId != null) return e.backendId;
  if (e.id > 100_000) return e.id - 100_000;
  return e.id;
}

// ─── Row type (same as before) ────────────────────────────────────────────────

type DashboardScheduleRow = {
  rowKey: string;
  sourceType: EventOccurrenceSourceType;
  sourceId: number;
  occurrenceStart: string;
  title: string;
  time: string;
  completed: boolean;
  source: "caregiver" | "medication" | "home" | "outdoor";
};

// ─── HeroSection ─────────────────────────────────────────────────────────────

function HeroSection({ navigate }: { navigate: (path: string) => void }) {
  const shouldReduceMotion = useReducedMotion();
  const { t } = useTranslation();
  const pills = [
    { icon: <CalendarIcon className="w-4 h-4" />, title: t("dashboard.pill1Title"), sub: t("dashboard.pill1Sub") },
    { icon: <Heart className="w-4 h-4" />,        title: t("dashboard.pill2Title"), sub: t("dashboard.pill2Sub") },
    { icon: <Shield className="w-4 h-4" />,       title: t("dashboard.pill3Title"), sub: t("dashboard.pill3Sub") },
  ];

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div
        className="relative overflow-hidden rounded-[26px]"
        style={{ background: "linear-gradient(120deg, #DCCEFB 0%, #E5D8FA 55%, #F4E2EE 100%)" }}
      >
        {/* Decorative rings behind photo */}
        <svg className="absolute right-[34%] top-[18%] w-44 h-44 opacity-20 pointer-events-none" viewBox="0 0 100 100" fill="none" stroke="#fff" strokeWidth="0.5">
          <circle cx="50" cy="50" r="46" /><circle cx="50" cy="50" r="34" /><circle cx="50" cy="50" r="22" />
        </svg>

        <div className="grid grid-cols-12 items-stretch min-h-[220px]">
          {/* Left: Welcome + pills */}
          <div className="col-span-12 md:col-span-6 px-7 py-8 md:py-9">
            <h1 className="text-2xl sm:text-[32px] md:text-[40px] font-extrabold leading-tight tracking-tight text-[#1F2247]">
              {t("dashboard.welcomeTitle")}
            </h1>
            <p className="mt-2 text-sm text-[#4F567E]">
              {t("dashboard.welcomeSubtitle")}
            </p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3">
              {pills.map((p) => (
                <div key={p.title} className="flex items-start gap-2.5">
                  <span className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-[#4318FF] shrink-0 shadow-sm">
                    {p.icon}
                  </span>
                  <span className="leading-tight pt-0.5">
                    <span className="block text-[13px] font-extrabold text-[#1F2247]">{p.title}</span>
                    <span className="block text-[11px] text-[#6B7299] font-medium mt-0.5">{p.sub}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Middle: Hero photo */}
          <div className="hidden md:block md:col-span-3 relative overflow-hidden">
            <img
              src="/hero-photo.png"
              alt="Caregiver and patient"
              className="absolute inset-0 w-full h-full object-cover object-center"
              onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0"; }}
            />
          </div>

          {/* Right: Need support? */}
          <div className="col-span-12 md:col-span-3 p-4 md:p-5 flex">
            <div className="flex-1 bg-white rounded-2xl p-5 flex flex-col border border-white/80 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F4F2FF] flex items-center justify-center text-[#4318FF] shrink-0">
                  <Heart className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[16px] font-extrabold leading-tight text-[#1F2247]">{t("dashboard.supportTitle")}</h3>
                  <p className="text-[12px] text-[#6B7299] mt-1.5 leading-snug">
                    {t("dashboard.supportDesc")}
                  </p>
                </div>
              </div>
              <div className="mt-auto pt-4 flex items-center gap-2">
                <a
                  href="tel:1800180066"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#4318FF] hover:bg-[#3412C7] text-white text-[12px] font-extrabold transition-colors shadow-sm"
                >
                  <Phone className="w-3 h-3" /> {t("dashboard.callNow")}
                </a>
                <button
                  type="button"
                  onClick={() => navigate("/knowledge-hub#miasa-support")}
                  className="flex-1 inline-flex items-center justify-center py-2 rounded-lg bg-white text-[#4318FF] text-[12px] font-extrabold border border-[#E9E3FF] hover:bg-[#F4F2FF] transition-colors cursor-pointer"
                >
                  {t("dashboard.readMore")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Date Card ────────────────────────────────────────────────────────────────

function DateCard({
  dateStr,
  isSelected,
  isToday,
  medCount,
  careCount,
  onClick,
}: {
  dateStr: string;
  isSelected: boolean;
  isToday: boolean;
  medCount: number;
  careCount: number;
  onClick: () => void;
}) {
  const { t, i18n } = useTranslation();
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDate();
  const month = formatMonthShort(d, i18n.language);
  const weekday = formatWeekday(d, "short", i18n.language);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative shrink-0 text-left transition-all duration-200 flex-1 min-w-0 h-full rounded-2xl p-4
        ${isSelected
          ? "bg-gradient-to-br from-[#4318FF] to-[#6D3DFF] text-white shadow-[0_18px_40px_-14px_rgba(67,24,255,0.45)]"
          : "bg-white text-[#1F2247] border border-[#EEEAFB] hover:border-[#4318FF]/40 hover:shadow-md"}
        cursor-pointer
      `}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="leading-tight">
          <p className="text-[20px] font-extrabold leading-tight">{month} {day}</p>
          <p className={`text-[12px] font-bold mt-0.5 ${isSelected ? "text-white/75" : "text-[#6B7299]"}`}>{weekday}</p>
        </div>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? "bg-white/15" : "bg-[#F4F2FF]"}`}>
          <CalendarIcon className={`w-4 h-4 ${isSelected ? "text-white" : "text-[#4318FF]"}`} />
        </div>
      </div>

      <div className={`mt-3 pt-3 space-y-1.5 border-t ${isSelected ? "border-white/20" : "border-[#EEEAFB]"}`}>
        <div className="flex items-center gap-2">
          <Pill className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-white/80" : "text-[#4318FF]"}`} />
          <span className={`text-[11px] font-bold ${isSelected ? "text-white" : "text-[#1F2247]"}`}>{medCount} {medCount !== 1 ? t("dashboard.medication_other") : t("dashboard.medication_one")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Heart className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-white/80" : "text-[#F59E0B]"}`} />
          <span className={`text-[11px] font-bold ${isSelected ? "text-white" : "text-[#1F2247]"}`}>{careCount} {careCount !== 1 ? t("dashboard.careEvent_other") : t("dashboard.careEvent_one")}</span>
        </div>
      </div>

      {isToday && !isSelected && (
        <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-md bg-[#FBBF24] text-[#1F2247] text-[9px] font-extrabold uppercase tracking-wider shadow-sm">
          {t("common.today")}
        </span>
      )}
    </button>
  );
}

// ─── Month Grid ───────────────────────────────────────────────────────────────

function MonthGrid({
  selectedDate,
  onSelectDate,
  year,
  month,
  todayStr,
  getDateEventBreakdown,
}: {
  selectedDate: string;
  onSelectDate: (d: string) => void;
  year: number;
  month: number;
  todayStr: string;
  getDateEventBreakdown: (d: string) => { med: number; home: number; outdoor: number; caregiver: number };
}) {
  const { t } = useTranslation();
  const weekdayShort = t("calendar.weekdaysShort", { returnObjects: true }) as string[];
  const firstOfMonth = new Date(year, month, 1);
  const startDow = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: { dateStr: string; outside: boolean }[] = [];
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    cells.push({ dateStr: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`, outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ dateStr: `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`, outside: false });
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1].dateStr;
    cells.push({ dateStr: addDaysStr(last, 1), outside: true });
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {weekdayShort.map((d) => (
          <div key={d} className="text-[8px] font-extrabold uppercase tracking-widest text-[#A3AED0] text-center py-0.5">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((c, i) => {
          const active = c.dateStr === selectedDate;
          const isToday = c.dateStr === todayStr;
          const bd = !c.outside ? getDateEventBreakdown(c.dateStr) : { med: 0, home: 0, outdoor: 0, caregiver: 0 };
          const hasEvents = bd.med > 0 || bd.home > 0 || bd.outdoor > 0 || bd.caregiver > 0;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectDate(c.dateStr)}
              className={`
                relative aspect-square rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer
                ${active
                  ? "bg-gradient-to-br from-[#4318FF] to-[#6D3DFF] text-white shadow-md"
                  : c.outside
                    ? "bg-transparent text-[#C5CADC] hover:bg-[#F8F6FF]"
                    : "bg-white text-[#1F2247] hover:bg-[#F4F2FF] border border-[#EEEAFB] hover:border-[#4318FF]/30"}
              `}
            >
              <span className={`text-[20px] font-extrabold leading-none ${isToday && !active ? "text-[#4318FF]" : ""}`}>
                {new Date(c.dateStr + "T00:00:00").getDate()}
              </span>
              {isToday && !active && (
                <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-[#FBBF24]" />
              )}
              {!c.outside && hasEvents && (
                <div className="flex items-center justify-center gap-[2px] mt-5 flex-wrap px-0.5">
                  {Array.from({ length: Math.min(bd.med, 4) }).map((_, di) => (
                    <span key={`med-${di}`} className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: active ? "rgba(255,255,255,1)" : "#4318FF" }} />
                  ))}
                  {Array.from({ length: Math.min(bd.home, 4) }).map((_, di) => (
                    <span key={`home-${di}`} className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: active ? "rgba(255,255,255,0.8)" : "#F59E0B" }} />
                  ))}
                  {Array.from({ length: Math.min(bd.outdoor, 4) }).map((_, di) => (
                    <span key={`out-${di}`} className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: active ? "rgba(255,255,255,0.8)" : "#10B981" }} />
                  ))}
                  {Array.from({ length: Math.min(bd.caregiver, 4) }).map((_, di) => (
                    <span key={`cg-${di}`} className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: active ? "rgba(255,255,255,0.8)" : "#3B82F6" }} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Calendar Section ────────────────────────────────────────────────────

function CareCalendarSection({
  selectedDate,
  setSelectedDate,
  view,
  setView,
  anchorMonth,
  setAnchorMonth,
  todayStr,
  getDateMedCount,
  getDateCareCount,
  getDateEventBreakdown,
}: {
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  view: CalendarView;
  setView: (v: CalendarView) => void;
  anchorMonth: { year: number; month: number };
  setAnchorMonth: (m: { year: number; month: number }) => void;
  todayStr: string;
  getDateMedCount: (d: string) => number;
  getDateCareCount: (d: string) => number;
  getDateEventBreakdown: (d: string) => { med: number; home: number; outdoor: number; caregiver: number };
}) {
  const shouldReduceMotion = useReducedMotion();
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();

  // Week view: 7 days centred on today (desktop); selected day ±1 (mobile)
  const visibleDates = useMemo(
    () =>
      isMobile
        ? [-1, 0, 1].map((o) => addDaysStr(selectedDate, o))
        : [-3, -2, -1, 0, 1, 2, 3].map((o) => addDaysStr(todayStr, o)),
    [isMobile, selectedDate, todayStr],
  );

  const navPrev = () => {
    if (view === "Month") {
      const d = new Date(anchorMonth.year, anchorMonth.month - 1, 1);
      setAnchorMonth({ year: d.getFullYear(), month: d.getMonth() });
    }
  };
  const navNext = () => {
    if (view === "Month") {
      const d = new Date(anchorMonth.year, anchorMonth.month + 1, 1);
      setAnchorMonth({ year: d.getFullYear(), month: d.getMonth() });
    }
  };

  const anchorMonthDate = new Date(anchorMonth.year, anchorMonth.month, 1);
  const subtitle =
    view === "Month"
      ? formatMonthYear(anchorMonthDate, i18n.language)
      : t("dashboard.tapDay");

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="flex flex-col bg-white rounded-[26px] p-6 border border-[#EEEAFB] shadow-[0_4px_24px_-16px_rgba(67,24,255,0.12)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5 shrink-0">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-tight text-[#1F2247]">{t("dashboard.calendarTitle")}</h2>
          <p className="text-[12px] text-[#6B7299] mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#F4F2FF] rounded-full p-1">
            {(["Week", "Month"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-4 py-1.5 text-[12px] font-extrabold rounded-full transition-all cursor-pointer
                  ${view === v
                    ? "bg-white text-[#4318FF] shadow-sm"
                    : "text-[#A3AED0] hover:text-[#4318FF]"
                  }`}
              >
                {v === "Week" ? t("dashboard.weekView") : t("dashboard.monthView")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar body */}
      {view === "Month" ? (() => {
        const bd = getDateEventBreakdown(selectedDate);
        const total = bd.med + bd.home + bd.outdoor + bd.caregiver;
        const selD = new Date(selectedDate + "T00:00:00");
        const isSelToday = selectedDate === todayStr;

        const LEGEND = [
          { color: "#4318FF", bg: "#EDE9FE", label: t("dashboard.patientMedication"), count: bd.med,       Icon: Pill },
          { color: "#F59E0B", bg: "#FEF3C7", label: t("dashboard.patientHomeCare"),   count: bd.home,      Icon: Heart },
          { color: "#10B981", bg: "#DCFCE7", label: t("dashboard.patientOutdoor"),    count: bd.outdoor,   Icon: MapPin },
          { color: "#3B82F6", bg: "#EFF6FF", label: t("dashboard.caregiverEvent"),    count: bd.caregiver, Icon: CalendarIcon },
        ];

        return (
          <div>
            {/* Month nav row */}
            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                onClick={navPrev}
                className="w-8 h-8 rounded-full bg-white border border-[#EEEAFB] hover:bg-[#F4F2FF] flex items-center justify-center text-[#4318FF] cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <p className="flex-1 text-[13px] font-extrabold text-[#1F2247] text-center">
                {formatMonthYear(anchorMonthDate, i18n.language)}
              </p>
              <button
                type="button"
                onClick={navNext}
                className="w-8 h-8 rounded-full bg-white border border-[#EEEAFB] hover:bg-[#F4F2FF] flex items-center justify-center text-[#4318FF] cursor-pointer shrink-0"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Grid: left = month calendar, right = legend + day summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <MonthGrid
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                year={anchorMonth.year}
                month={anchorMonth.month}
                todayStr={todayStr}
                getDateEventBreakdown={getDateEventBreakdown}
              />

              {/* Right panel — hidden on mobile */}
              <div className="hidden md:flex flex-col gap-3 h-full min-w-0">

                {/* ── Legend ─────────────────────────────────────────────────── */}
                <div className="rounded-2xl border border-[#EEEAFB] bg-gradient-to-br from-[#F8F6FF] to-white p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#A3AED0] mb-3">
                    {t("dashboard.colorLegend")}
                  </p>
                  <div className="space-y-1.5">
                    {LEGEND.map(({ color, bg, label, Icon }) => (
                      <div
                        key={label}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                        style={{ background: bg }}
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <Icon className="w-3 h-3 shrink-0" style={{ color }} />
                        <span className="text-[12px] font-bold text-[#1F2247]">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Day Summary ────────────────────────────────────────────── */}
                <div className="flex-1 rounded-2xl border border-[#EEEAFB] overflow-hidden">
                  {/* Coloured header band */}
                  <div
                    className="px-4 pt-4 pb-3"
                    style={{
                      background: isSelToday
                        ? "linear-gradient(135deg,#4318FF 0%,#6D3DFF 100%)"
                        : "linear-gradient(135deg,#F8F6FF 0%,#EDE9FE 100%)",
                    }}
                  >
                    <p
                      className="text-[10px] font-extrabold uppercase tracking-widest mb-1"
                      style={{ color: isSelToday ? "rgba(255,255,255,0.7)" : "#A3AED0" }}
                    >
                      {isSelToday ? t("common.today") : formatWeekday(selD, "long", i18n.language)}
                    </p>
                    <div className="flex items-end justify-between">
                      <div>
                        <span
                          className="text-[32px] font-extrabold leading-none"
                          style={{ color: isSelToday ? "#fff" : "#1F2247" }}
                        >
                          {selD.getDate()}
                        </span>
                        <span
                          className="text-[13px] font-semibold ml-1.5"
                          style={{ color: isSelToday ? "rgba(255,255,255,0.75)" : "#6B7299" }}
                        >
                          {`${formatMonthShort(selD, i18n.language)} ${selD.getFullYear()}`}
                        </span>
                      </div>
                      {/* Total badge */}
                      <div
                        className="rounded-xl px-2.5 py-1 flex items-center gap-1.5"
                        style={{
                          background: isSelToday ? "rgba(255,255,255,0.2)" : "#4318FF",
                        }}
                      >
                        <CalendarIcon className="w-3 h-3" style={{ color: isSelToday ? "#fff" : "#fff" }} />
                        <span className="text-[12px] font-extrabold text-white">{total}</span>
                      </div>
                    </div>
                  </div>

                  {/* Breakdown rows */}
                  <div className="p-3 bg-white space-y-1.5">
                    {total === 0 ? (
                      <div className="py-5 flex flex-col items-center gap-2 text-center">
                        <div className="w-9 h-9 rounded-xl bg-[#F4F2FF] flex items-center justify-center">
                          <Moon className="w-4 h-4 text-[#A3AED0]" />
                        </div>
                        <p className="text-[11px] font-bold text-[#A3AED0]">{t("dashboard.noEventsDay")}</p>
                      </div>
                    ) : (
                      LEGEND.map(({ color, bg, label, Icon, count }) =>
                        count === 0 ? null : (
                          <div
                            key={label}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                            style={{ background: bg }}
                          >
                            <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
                            <span className="flex-1 text-[12px] font-semibold text-[#1F2247]">{label}</span>
                            <span
                              className="text-[12px] font-extrabold px-2 py-0.5 rounded-lg text-white"
                              style={{ backgroundColor: color }}
                            >
                              {count}
                            </span>
                          </div>
                        )
                      )
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        );
      })() : (
        <div className="flex-1 min-h-0">
          <div className={`grid gap-3 h-full ${isMobile ? "grid-cols-3" : "grid-cols-7"}`}>
            {visibleDates.map((d) => (
              <DateCard
                key={d}
                dateStr={d}
                isSelected={d === selectedDate}
                isToday={d === todayStr}
                medCount={getDateMedCount(d)}
                careCount={getDateCareCount(d)}
                onClick={() => setSelectedDate(d)}
              />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Day Timeline ─────────────────────────────────────────────────────────────

function DayTimeline({
  schedule,
  isLoading,
  selectedDate,
  todayStr,
  pendingCount,
  overdueCount,
  onTaskClick,
  onDelete,
  deletingKeys,
}: {
  schedule: DashboardScheduleRow[];
  isLoading: boolean;
  selectedDate: string;
  todayStr: string;
  pendingCount: number;
  overdueCount: number;
  onTaskClick: (row: DashboardScheduleRow) => void;
  onDelete: (row: DashboardScheduleRow) => void;
  deletingKeys: Set<string>;
}) {
  const shouldReduceMotion = useReducedMotion();
  const { t, i18n } = useTranslation();
  const isToday = selectedDate === todayStr;
  const now = getMYTNow();
  const TIMELINE_STYLES: Record<DashboardScheduleRow["source"], { bg: string; color: string; label: string; icon: React.ReactNode }> = {
    medication: { bg: "#EDE9FE", color: "#4318FF", label: t("dashboard.patientMedication"), icon: <Pill className="w-4 h-4" /> },
    home:       { bg: "#FEF3C7", color: "#B45309", label: t("dashboard.patientHomeCare"),   icon: <Heart className="w-4 h-4" /> },
    outdoor:    { bg: "#DCFCE7", color: "#047857", label: t("dashboard.patientOutdoor"),    icon: <MapPin className="w-4 h-4" /> },
    caregiver:  { bg: "#EFF6FF", color: "#1D4ED8", label: t("dashboard.caregiverEvent"),    icon: <CalendarIcon className="w-4 h-4" /> },
  };
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const d = new Date(selectedDate + "T00:00:00");
  const dateLabel = isToday
    ? t("common.today")
    : formatWeekday(d, "long", i18n.language);
  const dateSubLabel = `${formatMonthShort(d, i18n.language)} ${d.getDate()}`;

  const completed = schedule.filter((e) => e.completed).length;
  const progressPct = schedule.length ? Math.round((completed / schedule.length) * 100) : 0;

  function isNextEvent(item: DashboardScheduleRow): boolean {
    if (!isToday || item.completed) return false;
    const [hh, mm] = item.time.split(":").map(Number);
    const eMin = hh * 60 + mm;
    if (eMin < nowMinutes) return false;
    return !schedule.some((other) => {
      if (other.completed || other.rowKey === item.rowKey) return false;
      const [oh, om] = other.time.split(":").map(Number);
      const oMin = oh * 60 + om;
      return oMin >= nowMinutes && oMin < eMin;
    });
  }

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="bg-white rounded-[26px] p-6 border border-[#EEEAFB] shadow-[0_4px_24px_-16px_rgba(67,24,255,0.12)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-tight text-[#1F2247]">
            {dateLabel}
            <span className="text-[#A3AED0] font-medium"> · {dateSubLabel}</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="text-[12px] text-[#6B7299]">
              {schedule.length} {t("dashboard.scheduled")} ·{" "}
              <span className="text-[#10B981] font-bold">{completed} {t("dashboard.done")}</span>{" "}
              · <span className="text-[#F59E0B] font-bold">{schedule.length - completed} {t("dashboard.toGo")}</span>
            </p>
            <AnimatePresence mode="popLayout">
              {pendingCount > 0 && (
                <motion.span
                  key="pending"
                  initial={shouldReduceMotion ? {} : { scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full border border-amber-200"
                >
                  {pendingCount} {t("dashboard.pending")}
                </motion.span>
              )}
              {overdueCount > 0 && (
                <motion.span
                  key="overdue"
                  initial={shouldReduceMotion ? {} : { scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full border border-red-200"
                >
                  {overdueCount} {t("dashboard.overdue")}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
        {schedule.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:block w-28 h-2 rounded-full overflow-hidden bg-gradient-to-r from-[#EDE9FE] to-[#FCE7F3]">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progressPct}%`,
                  background: "linear-gradient(90deg, #4318FF, #8B5CF6 60%, #F472B6)",
                }}
              />
            </div>
            <span className="font-mono text-[11px] font-bold text-[#4318FF] min-w-[36px] text-right">{progressPct}%</span>
          </div>
        )}
      </div>

      {/* Timeline content */}
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-[#F8F7FF] animate-pulse">
              <div className="w-9 h-9 rounded-xl bg-[#E9E3FF] shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-[#E9E3FF] rounded-md w-3/5" />
                <div className="h-3 bg-[#E9E3FF] rounded-md w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : schedule.length === 0 ? (
        <div className="py-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#F4F2FF] flex items-center justify-center mx-auto mb-3">
            <Moon className="w-5 h-5 text-[#A3AED0]" />
          </div>
          <p className="text-sm font-bold text-[#A3AED0]">{t("dashboard.noTasks")}</p>
          <p className="text-xs text-[#A3AED0]/70 mt-1">{t("dashboard.addEvents")}</p>
        </div>
      ) : (
        <ol className="relative space-y-2.5">
          {/* Vertical rail */}
          <div
            className="absolute top-3 bottom-3 w-px bg-gradient-to-b from-[#4318FF]/15 via-[#4318FF]/20 to-transparent"
            style={{ left: "87px" }}
          />

          {schedule.map((item) => {
            const s = TIMELINE_STYLES[item.source];
            const isNext = isNextEvent(item);
            const [hh] = item.time.split(":").map(Number);
            const ampm = hh < 12 ? "AM" : "PM";

            return (
              <li key={item.rowKey} className="relative group">
                <div className="flex items-start gap-4">
                  {/* Time */}
                  <div className="w-[64px] shrink-0 text-right pt-2.5 leading-none">
                    <div className="font-mono text-[12px] font-extrabold text-[#1F2247] whitespace-nowrap">{item.time}</div>
                    <div className="text-[10px] uppercase tracking-wider text-[#A3AED0] font-bold mt-1.5 whitespace-nowrap">{ampm}</div>
                  </div>

                  {/* Dot */}
                  <div className="w-4 shrink-0 pt-3 flex justify-center relative z-10">
                    {item.completed ? (
                      <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#4318FF] to-[#8B5CF6] flex items-center justify-center ring-4 ring-white">
                        <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                      </div>
                    ) : isNext ? (
                      <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-[#F59E0B]/40 animate-ping" />
                        <div className="relative w-4 h-4 rounded-full bg-[#F59E0B] ring-4 ring-white" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-white border-2 border-[#E0E5F2] ring-4 ring-white" />
                    )}
                  </div>

                  {/* Card */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onTaskClick(item)}
                    onKeyDown={(e) => e.key === "Enter" && onTaskClick(item)}
                    className={`
                      flex-1 min-w-0 flex items-center gap-3 p-3 rounded-2xl border transition-all
                      hover:translate-x-0.5 hover:shadow-md cursor-pointer pr-10
                      ${item.completed
                        ? "bg-[#FAFAFD] border-[#EEEAFB]"
                        : isNext
                          ? "bg-gradient-to-r from-[#FFFBEB] to-white border-[#F59E0B]/30 shadow-md"
                          : "bg-white border-[#EEEAFB]"}
                    `}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: s.bg, color: s.color }}
                    >
                      {s.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-[14px] font-extrabold tracking-tight truncate ${item.completed ? "text-[#A3AED0] line-through" : "text-[#1F2247]"}`}>
                          {item.title === "Breakfast" ? t("dashboard.breakfast") : item.title === "Lunch" ? t("dashboard.lunch") : item.title === "Dinner" ? t("dashboard.dinner") : item.title}
                        </p>
                        <span
                          className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-widest whitespace-nowrap"
                          style={{ background: s.bg, color: s.color }}
                        >
                          {s.label}
                        </span>
                        {isNext && (
                          <span className="px-1.5 py-0.5 rounded-md bg-[#F59E0B] text-white text-[9px] font-extrabold uppercase tracking-widest animate-pulse whitespace-nowrap">
                            {t("dashboard.upNext")}
                          </span>
                        )}
                        {item.completed && (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-[#4318FF] bg-[#E9E3FF] px-2 py-0.5 rounded-md">{t("common.done")}</span>
                        )}
                      </div>
                      <p className="text-[12px] text-[#6B7299] mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3 shrink-0" />
                        {item.time}
                      </p>
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                    disabled={deletingKeys.has(item.rowKey)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-70 opacity-0 group-hover:opacity-100 cursor-pointer"
                    aria-label="Delete event"
                  >
                    {deletingKeys.has(item.rowKey)
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </motion.div>
  );
}

// ─── Quick Actions Grid ───────────────────────────────────────────────────────

function QuickActionsGrid({ navigate }: { navigate: (path: string) => void }) {
  const shouldReduceMotion = useReducedMotion();
  const { t } = useTranslation();
  const QUICK_ACTIONS = [
    { title: t("dashboard.qa1Title"), desc: t("dashboard.qa1Desc"), icon: Pill,       color: "#4318FF", bg: "#EDE9FE", path: "/care-events#medication-section" },
    { title: t("dashboard.qa2Title"), desc: t("dashboard.qa2Desc"), icon: Heart,      color: "#F97316", bg: "#FFF7ED", path: "/care-events#events-section" },
    { title: t("dashboard.qa3Title"), desc: t("dashboard.qa3Desc"), icon: MapPin,     color: "#10B981", bg: "#ECFDF5", path: "/care-events#environment-section" },
    { title: t("dashboard.qa4Title"), desc: t("dashboard.qa4Desc"), icon: FolderOpen, color: "#3B82F6", bg: "#EFF6FF", path: "/digital-records" },
    { title: t("dashboard.qa5Title"), desc: t("dashboard.qa5Desc"), icon: Apple,      color: "#8B5CF6", bg: "#F5F3FF", path: "/nutrition-library" },
    { title: t("dashboard.qa6Title"), desc: t("dashboard.qa6Desc"), icon: ChefHat,   color: "#F59E0B", bg: "#FEF3C7", path: "/recipes" },
  ];

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="h-full flex flex-col bg-white rounded-[26px] p-4 sm:p-6 border border-[#EEEAFB] shadow-[0_4px_24px_-16px_rgba(67,24,255,0.12)] min-w-0"
    >
      <h2 className="text-lg sm:text-[20px] font-extrabold tracking-tight text-[#1F2247] mb-4 sm:mb-5 shrink-0">
        {t("dashboard.quickActionsTitle")}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 auto-rows-fr">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.title}
            type="button"
            onClick={() => navigate(a.path)}
            className="group flex items-center gap-4 p-4 rounded-2xl bg-white border border-[#EEEAFB] hover:border-[#4318FF]/30 hover:shadow-md transition-all text-left cursor-pointer w-full h-full"
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: a.bg, color: a.color }}
            >
              <a.icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[15px] font-extrabold tracking-tight text-[#1F2247]">{a.title}</h3>
              <p className="text-[12px] text-[#6B7299] mt-0.5 leading-snug">{a.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[#A3AED0] group-hover:text-[#4318FF] group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Steps To Take Next ──────────────────────────────────────────────────────

function StepsToTakeNext({
  mealConfigured,
  hasMedications,
  hasAIActivities,
  hasEvents,
  navigate,
}: {
  mealConfigured: boolean;
  hasMedications: boolean;
  hasAIActivities: boolean;
  hasEvents: boolean;
  navigate: (path: string) => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const { t } = useTranslation();

  const steps = [
    {
      icon: Utensils,
      title: t("dashboard.stepMealTitle"),
      desc: t("dashboard.stepMealDesc"),
      done: mealConfigured,
      href: "/care-events#meal-schedule-section",
    },
    {
      icon: Pill,
      title: t("dashboard.stepMedTitle"),
      desc: t("dashboard.stepMedDesc"),
      done: hasMedications,
      href: "/care-events#medication-section",
    },
    {
      icon: Coffee,
      title: t("dashboard.stepAITitle"),
      desc: t("dashboard.stepAIDesc"),
      done: hasAIActivities,
      href: "/care-events#environment-section",
    },
    {
      icon: CalendarIcon,
      title: t("dashboard.stepEventsTitle"),
      desc: t("dashboard.stepEventsDesc"),
      done: hasEvents,
      href: "/care-events#events-section",
    },
  ];

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="h-full flex flex-col bg-white rounded-[26px] p-5 border border-[#EEEAFB] shadow-[0_4px_24px_-16px_rgba(67,24,255,0.12)]"
    >
      <div className="mb-4 shrink-0">
        <h3 className="text-[20px] font-extrabold tracking-tight text-[#1F2247]">{t("dashboard.stepsTitle")}</h3>
        <p className="text-xs text-[#A3AED0] font-medium mt-0.5">{t("dashboard.stepsSubtitle")}</p>
      </div>
      <div className="flex-1 flex flex-col gap-2.5">
        {steps.map((step, i) => (
          <motion.button
            key={i}
            type="button"
            onClick={() => navigate(step.href)}
            initial={shouldReduceMotion ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 + i * 0.07 }}
            className="flex items-center gap-3 p-3 rounded-2xl border border-[#EEEAFB] hover:bg-[#F8F6FF] hover:border-[#D6CBFF] transition-all cursor-pointer text-left w-full group"
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all
                ${step.done
                  ? "bg-emerald-100"
                  : "bg-gradient-to-br from-[#4318FF] to-[#8B5CF6]"}`}
            >
              {step.done
                ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                : <step.icon className="w-4 h-4 text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-[13px] font-extrabold leading-tight ${step.done ? "text-[#A3AED0] line-through" : "text-[#1F2247]"}`}>
                {i + 1}. {step.title}
              </p>
              <p className="text-[11px] text-[#A3AED0] font-medium mt-0.5 truncate">{step.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[#A3AED0] group-hover:text-[#4318FF] transition-colors shrink-0" />
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Main DashboardPage ───────────────────────────────────────────────────────

export function DashboardPage() {
  const {
    meds: patientMedications,
    events: patientEventsStore,
    deleteMed,
    deleteEvent,
    loading: careEventsLoading,
  } = useCareEvents();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentLang } = useLanguage();
  const { t } = useTranslation();
  const caregiverId = user?.caregiverId ?? 0;
  const shouldReduceMotion = useReducedMotion();

  // ── BPT banner ─────────────────────────────────────────────────────────────
  const [showBptBanner, setShowBptBanner] = useState(
    () => localStorage.getItem("bptBannerDismissed") !== "true"
  );
  const handleDismissBptBanner = () => {
    localStorage.setItem("bptBannerDismissed", "true");
    setShowBptBanner(false);
  };

  // ── Calendar state ──────────────────────────────────────────────────────────
  const todayStr = getMYTDateString();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [calendarView, setCalendarView] = useState<CalendarView>("Week");
  const [anchorMonth, setAnchorMonth] = useState(() => {
    const t = new Date(todayStr + "T00:00:00");
    return { year: t.getFullYear(), month: t.getMonth() };
  });

  // ── Agenda / completion state ───────────────────────────────────────────────
  const [confirmRow, setConfirmRow] = useState<DashboardScheduleRow | null>(null);
  const [confirmMode, setConfirmMode] = useState<"complete" | "undo" | null>(null);
  const [completionKeys, setCompletionKeys] = useState<Set<string>>(() => new Set());
  const [isCompletionsLoading, setIsCompletionsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [deletingKeys, setDeletingKeys] = useState<Set<string>>(new Set());
  const [pendingCount, setPendingCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [isAlertConfirming, setIsAlertConfirming] = useState(false);

  const { pendingAlert, dismissAlert } = useMedicationAlert();
  const { pendingObservationAlert, dismissObservationAlert } = useObservationAlert();
  const scheduleAlertReshow = useMedicationAlertSnoozeScheduler();

  const [agenda, setAgenda] = useState<
    { id: number; title: string; time: string; startDatetime: string; endDatetime: string; recurrence: string | null }[]
  >([]);
  const [isAgendaLoading, setIsAgendaLoading] = useState(true);

  // ── Data fetching ───────────────────────────────────────────────────────────

  const refreshCompletions = useCallback(async () => {
    if (!caregiverId) {
      setIsCompletionsLoading(false);
      return;
    }
    setIsCompletionsLoading(true);
    try {
      const from = addDaysMYT(-14);
      const to = addDaysMYT(60);
      const list = await listCaregiverEventOccurrences(caregiverId, from, to);
      const next = new Set<string>();
      for (const o of list) {
        if (o.completed !== 1) continue;
        next.add(completionLookupKey(o.sourceType as EventOccurrenceSourceType, o.sourceId, o.occurrenceStart));
      }
      setCompletionKeys(next);
    } catch {
      // keep existing keys on failure
    } finally {
      setIsCompletionsLoading(false);
    }
  }, [caregiverId]);

  const refreshAgenda = useCallback(() => {
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
            })),
        );
      })
      .catch((err) => {
        console.warn("Failed to load caregiver schedules:", err);
      })
      .finally(() => setIsAgendaLoading(false));
  }, [caregiverId]);

  useEffect(() => {
    if (!caregiverId) return;
    const d = new Date(todayStr + "T00:00:00");
    const dow = d.getDay();
    const monday = new Date(d.getTime() + (dow === 0 ? -6 : 1 - dow) * 86400000);
    const weekKey = `parkicare_meal_week_${caregiverId}_${monday.toISOString().slice(0, 10)}`;
    if (!sessionStorage.getItem(weekKey)) {
      sessionStorage.setItem(weekKey, "1");
      generateWeeklyMeals(caregiverId).then(refreshAgenda).catch(() => refreshAgenda());
    } else {
      refreshAgenda();
    }
    dashboardService.getPendingTasks(caregiverId).then((tasks) => setPendingCount(tasks.length)).catch(() => {});
    dashboardService.getOverdueTasks(caregiverId).then((tasks) => setOverdueCount(tasks.length)).catch(() => {});
  }, [caregiverId, currentLang, refreshAgenda, todayStr]);

  const [dashMealSchedules, setDashMealSchedules] = useState<MealScheduleEntry[]>([]);
  useEffect(() => {
    if (!caregiverId) return;
    getMealSchedules(caregiverId).then(setDashMealSchedules).catch(() => {});
  }, [caregiverId]);

  useEffect(() => {
    refreshCompletions();
  }, [refreshCompletions, currentLang]);

  const isScheduleLoading = isCompletionsLoading || careEventsLoading || isAgendaLoading;

  // ── Calendar date summary helpers ───────────────────────────────────────────

  const getDateMedCount = useCallback((dateStr: string): number => {
    let count = 0;
    for (const med of patientMedications) {
      if (!med.time) continue;
      const startDate = med.startDate ?? dateStr;
      const rec = resolveMedicationRecurrence(med.recurrence, startDate, med.endDate ?? null);
      if (isEventOnDay(dateStr, startDate, med.endDate, rec)) count++;
    }
    return count;
  }, [patientMedications]);

  const getDateCareCount = useCallback((dateStr: string): number => {
    let count = 0;
    for (const ev of patientEventsStore) {
      if (!ev.startDatetime) continue;
      const startDate = ev.startDatetime.slice(0, 10);
      const endDatePart = ev.endDatetime?.slice(0, 10);
      const seriesEnd = endDatePart && endDatePart > startDate ? endDatePart : undefined;
      if (isEventOnDay(dateStr, startDate, seriesEnd, ev.recurrence)) count++;
    }
    for (const item of agenda) {
      const startDate = item.startDatetime.slice(0, 10);
      const endDatePart = item.endDatetime?.slice(0, 10);
      const seriesEnd = endDatePart && endDatePart > startDate ? endDatePart : undefined;
      if (isEventOnDay(dateStr, startDate, seriesEnd, item.recurrence ?? "none")) count++;
    }
    return count;
  }, [patientEventsStore, agenda]);

  const getDateEventBreakdown = useCallback((dateStr: string): { med: number; home: number; outdoor: number; caregiver: number } => {
    let med = 0, home = 0, outdoor = 0, caregiver = 0;
    for (const m of patientMedications) {
      if (!m.time) continue;
      const startDate = m.startDate ?? dateStr;
      const rec = resolveMedicationRecurrence(m.recurrence, startDate, m.endDate ?? null);
      if (isEventOnDay(dateStr, startDate, m.endDate, rec)) med++;
    }
    for (const ev of patientEventsStore) {
      if (!ev.startDatetime) continue;
      const startDate = ev.startDatetime.slice(0, 10);
      const endDatePart = ev.endDatetime?.slice(0, 10);
      const seriesEnd = endDatePart && endDatePart > startDate ? endDatePart : undefined;
      if (!isEventOnDay(dateStr, startDate, seriesEnd, ev.recurrence)) continue;
      if (ev.eventType === "outdoor") outdoor++; else home++;
    }
    for (const item of agenda) {
      const startDate = item.startDatetime.slice(0, 10);
      const endDatePart = item.endDatetime?.slice(0, 10);
      const seriesEnd = endDatePart && endDatePart > startDate ? endDatePart : undefined;
      if (isEventOnDay(dateStr, startDate, seriesEnd, item.recurrence ?? "none")) caregiver++;
    }
    return { med, home, outdoor, caregiver };
  }, [patientMedications, patientEventsStore, agenda]);

  // ── Schedule rows for selected date ────────────────────────────────────────

  const caregiverSchedule = useMemo((): DashboardScheduleRow[] => {
    const rows: DashboardScheduleRow[] = [];

    for (const item of agenda) {
      const startDate = item.startDatetime.slice(0, 10);
      const endDatePart = item.endDatetime?.slice(0, 10);
      const seriesEndDate = endDatePart && endDatePart > startDate ? endDatePart : undefined;
      const rec = item.recurrence ?? "none";
      if (!isEventOnDay(selectedDate, startDate, seriesEndDate, rec)) continue;
      const startTime = item.startDatetime.slice(11, 16);
      const occurrenceStart = occurrenceIsoForDay(selectedDate, startTime);
      const rowKey = completionLookupKey("CAREGIVER_SCHEDULE", item.id, occurrenceStart);
      rows.push({ rowKey, sourceType: "CAREGIVER_SCHEDULE", sourceId: item.id, occurrenceStart, title: item.title, time: item.time, completed: completionKeys.has(rowKey), source: "caregiver" });
    }

    for (const med of patientMedications) {
      if (!med.time) continue;
      const startDate = med.startDate ?? selectedDate;
      const medRecurrence = resolveMedicationRecurrence(med.recurrence, startDate, med.endDate ?? null);
      if (!isEventOnDay(selectedDate, startDate, med.endDate, medRecurrence)) continue;
      const sid = med.remindId ?? med.id;
      const occurrenceStart = occurrenceIsoForDay(selectedDate, med.time);
      const rowKey = completionLookupKey("MEDICATION_PLAN", sid, occurrenceStart);
      rows.push({ rowKey, sourceType: "MEDICATION_PLAN", sourceId: sid, occurrenceStart, title: `${med.name}${med.dose ? ` · ${med.dose}` : ""}`, time: med.time, completed: completionKeys.has(rowKey), source: "medication" });
    }

    for (const ev of patientEventsStore) {
      if (!ev.startDatetime) continue;
      const startDate = ev.startDatetime.slice(0, 10);
      const endDatePart = ev.endDatetime?.slice(0, 10);
      const seriesEndDate = endDatePart && endDatePart > startDate ? endDatePart : undefined;
      if (!isEventOnDay(selectedDate, startDate, seriesEndDate, ev.recurrence)) continue;
      const startTime = ev.startDatetime.slice(11, 16);
      const occurrenceStart = occurrenceIsoForDay(selectedDate, startTime);
      const isOutdoor = ev.eventType === "outdoor";
      const sourceType: EventOccurrenceSourceType = isOutdoor ? "PATIENT_OUTDOOR" : "PATIENT_HOME_CARE";
      const sourceId = isOutdoor ? resolveOutdoorSourceId(ev) : (ev.backendId ?? ev.id);
      const rowKey = completionLookupKey(sourceType, sourceId, occurrenceStart);
      rows.push({ rowKey, sourceType, sourceId, occurrenceStart, title: ev.title, time: ev.time ?? startTime, completed: completionKeys.has(rowKey), source: isOutdoor ? "outdoor" : "home" });
    }

    return rows.sort((a, b) => a.time.localeCompare(b.time));
  }, [agenda, patientMedications, patientEventsStore, completionKeys, selectedDate]);

  // ── Event handlers ──────────────────────────────────────────────────────────

  const handleTaskClick = (row: DashboardScheduleRow) => {
    setConfirmRow(row);
    setConfirmMode(row.completed ? "undo" : "complete");
  };

  const handleConfirmComplete = async () => {
    if (confirmRow == null || !caregiverId) return;
    const wantComplete = confirmMode === "complete";
    const key = confirmRow.rowKey;
    const snapshot = new Set(completionKeys);
    if (wantComplete) {
      setCompletionKeys((s) => new Set(s).add(key));
    } else {
      setCompletionKeys((s) => { const n = new Set(s); n.delete(key); return n; });
    }
    setIsConfirming(true);
    try {
      await upsertCaregiverEventOccurrence({
        caregiverId,
        sourceType: confirmRow.sourceType,
        sourceId: confirmRow.sourceId,
        occurrenceStart: confirmRow.occurrenceStart,
        completed: wantComplete,
      });
      toast.success(confirmMode === "undo" ? t("dashboard.taskIncomplete") : t("dashboard.taskComplete"));
      dashboardService.getPendingTasks(caregiverId).then((tasks) => setPendingCount(tasks.length)).catch(() => {});
      dashboardService.getOverdueTasks(caregiverId).then((tasks) => setOverdueCount(tasks.length)).catch(() => {});
    } catch (err) {
      setCompletionKeys(snapshot);
      toast.error(err instanceof Error ? err.message : t("dashboard.couldNotSave"));
    } finally {
      setIsConfirming(false);
    }
    setConfirmRow(null);
    setConfirmMode(null);
  };

  const handleCancelComplete = () => { setConfirmRow(null); setConfirmMode(null); };

  const handleAlertConfirm = async () => {
    if (!pendingAlert || !caregiverId) return;
    const remindId = Number(pendingAlert.remindId);
    const alertCaregiverId = Number(pendingAlert.caregiverId);
    const med = patientMedications.find((m) => (m.remindId ?? m.id) === remindId);
    // Always use today for alert confirmation (not selected date)
    const occurrenceStart = med?.time ? occurrenceIsoForDay(todayStr, med.time) : null;
    const completionKey = occurrenceStart ? completionLookupKey("MEDICATION_PLAN", remindId, occurrenceStart) : null;
    const snapshot = new Set(completionKeys);
    if (completionKey) setCompletionKeys((prev) => { const next = new Set(prev); next.add(completionKey); return next; });
    setIsAlertConfirming(true);
    try {
      await careEventsService.confirmMedication(remindId, alertCaregiverId);
      if (occurrenceStart) {
        await upsertCaregiverEventOccurrence({ caregiverId, sourceType: "MEDICATION_PLAN", sourceId: remindId, occurrenceStart, completed: true });
      }
      dashboardService.getPendingTasks(caregiverId).then((t) => setPendingCount(t.length)).catch(() => {});
      dashboardService.getOverdueTasks(caregiverId).then((t) => setOverdueCount(t.length)).catch(() => {});
      toast.success(t("dashboard.medConfirmed"));
      dismissAlert();
    } catch {
      setCompletionKeys(snapshot);
      toast.error(t("dashboard.couldNotConfirm"));
    } finally {
      setIsAlertConfirming(false);
    }
  };

  const handleAlertSnooze = async () => {
    if (!pendingAlert) return;
    const snapshot = { ...pendingAlert };
    dismissAlert();
    try {
      await careEventsService.snoozeMedication(Number(snapshot.remindId), Number(snapshot.caregiverId));
    } catch { /* non-critical */ }
    scheduleAlertReshow(snapshot, 5 * 60 * 1000);
  };

  const handleDeleteItem = useCallback(async (item: DashboardScheduleRow) => {
    if (!caregiverId) return;
    setDeletingKeys((prev) => new Set(prev).add(item.rowKey));
    try {
      if (item.source === "caregiver") {
        await caregiverScheduleService.deleteSchedule(item.sourceId, caregiverId);
        setAgenda((prev) => prev.filter((a) => a.id !== item.sourceId));
      } else if (item.source === "medication") {
        await careEventsService.deleteMedication(item.sourceId, caregiverId);
        const med = patientMedications.find((m) => (m.remindId ?? m.id) === item.sourceId);
        if (med) deleteMed(med.id);
      } else if (item.source === "home") {
        await careEventsService.deleteHomeCare(item.sourceId, caregiverId);
        const ev = patientEventsStore.find((e) => (e.backendId ?? e.id) === item.sourceId);
        if (ev) deleteEvent(ev.id);
      } else if (item.source === "outdoor") {
        await careEventsService.deleteOutdoor(item.sourceId, caregiverId);
        const ev = patientEventsStore.find((e) =>
          (e.backendId != null ? e.backendId : e.id > 100_000 ? e.id - 100_000 : e.id) === item.sourceId
        );
        if (ev) deleteEvent(ev.id);
      }
      toast.success(t("dashboard.eventDeleted"));
    } catch {
      toast.error(t("dashboard.eventDeleteFailed"));
    } finally {
      setDeletingKeys((prev) => { const s = new Set(prev); s.delete(item.rowKey); return s; });
    }
  }, [caregiverId, patientMedications, patientEventsStore, deleteMed, deleteEvent]);

  const confirmTaskTitle = confirmRow?.title;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── BPT Banner ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showBptBanner && (
          <motion.div
            key="bpt-banner"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 bg-gradient-to-r from-blue-300 to-indigo-200 border border-blue-200 rounded-[20px] px-5 py-4 shadow-[0_8px_24px_-10px_rgba(99,102,241,0.18)]"
          >
            <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0 pr-8 sm:pr-0">
              <div className="w-10 h-10 rounded-xl bg-blue-200 flex items-center justify-center shrink-0">
                <Banknote className="w-5 h-5 text-blue-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-blue-900 font-extrabold text-sm leading-snug">{t("bptBanner.title")}</p>
                <p className="hidden sm:block text-blue-700 text-xs font-medium mt-0.5 leading-snug">{t("bptBanner.desc")}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismissBptBanner}
              aria-label={t("bptBanner.dismiss")}
              className="absolute top-4 right-4 sm:static sm:order-last w-7 h-7 rounded-lg bg-blue-200 hover:bg-blue-300 flex items-center justify-center transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5 text-blue-700" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/knowledge-hub#bpt-allowance")}
              className="sm:hidden w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t("bptBanner.cta")}
            </button>
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => navigate("/knowledge-hub#bpt-allowance")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {t("bptBanner.cta")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <HeroSection navigate={navigate} />

      {/* ── Layout grid ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-3 sm:gap-5">

        {/* Row 1 - Quick Actions (8) + Meal Schedule (4) */}
        <div className="col-span-12 lg:col-span-8 h-full">
          <QuickActionsGrid navigate={navigate} />
        </div>
        <div className="col-span-12 lg:col-span-4 h-full">
          <StepsToTakeNext
            mealConfigured={dashMealSchedules.length > 0}
            hasMedications={patientMedications.length > 0}
            hasAIActivities={localStorage.getItem(`parkicare_ai_activity_added_${caregiverId}`) === "true"}
            hasEvents={patientEventsStore.length > 0}
            navigate={navigate}
          />
        </div>

        {/* Row 2 - Calendar (full width) */}
        <div className="col-span-12">
          <CareCalendarSection
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            view={calendarView}
            setView={setCalendarView}
            anchorMonth={anchorMonth}
            setAnchorMonth={setAnchorMonth}
            todayStr={todayStr}
            getDateMedCount={getDateMedCount}
            getDateCareCount={getDateCareCount}
            getDateEventBreakdown={getDateEventBreakdown}
          />
        </div>

        {/* Row 3 - Today's Schedule (full width) */}
        <div className="col-span-12">
          <DayTimeline
            schedule={caregiverSchedule}
            isLoading={isScheduleLoading}
            selectedDate={selectedDate}
            todayStr={todayStr}
            pendingCount={pendingCount}
            overdueCount={overdueCount}
            onTaskClick={handleTaskClick}
            onDelete={handleDeleteItem}
            deletingKeys={deletingKeys}
          />
        </div>

      </div>

      {/* ── Task Completion Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {confirmRow !== null && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={handleCancelComplete}
              className="fixed inset-0 bg-black/50 backdrop-blur-md z-50"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 p-safe pointer-events-none">
              <motion.div
                initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.9, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 24 }}
                transition={{ type: "spring", stiffness: 340, damping: 28 }}
                className="w-full max-w-md pointer-events-auto"
              >
                <div className="bg-white/95 backdrop-blur-sm rounded-[24px] p-6 shadow-[0_32px_80px_rgba(0,0,0,0.22)] border border-[#E9E3FF]/60">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${confirmMode === "undo" ? "bg-amber-100" : "bg-gradient-to-br from-[#4318FF] to-[#8B5CF6]"}`}>
                        {confirmMode === "undo"
                          ? <Circle className="w-5 h-5 text-amber-600" />
                          : <CheckCircle2 className="w-5 h-5 text-white" />}
                      </div>
                      <h3 className="text-lg font-bold text-[#1F2247]">
                        {confirmMode === "undo" ? t("dashboard.undoTask") : t("dashboard.completeTask")}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelComplete}
                      className="p-2 hover:bg-[#F4F7FE] rounded-xl transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5 text-[#A3AED0]" />
                    </button>
                  </div>
                  {confirmTaskTitle && (
                    <div className="mb-4 p-3 bg-[#F8F7FF] rounded-xl border border-[#E9E3FF]/50">
                      <p className="text-sm font-bold text-[#1F2247] truncate">{confirmTaskTitle}</p>
                    </div>
                  )}
                  <p className="text-sm text-[#A3AED0] font-medium mb-5">
                    {confirmMode === "undo" ? t("dashboard.markIncomplete") : t("dashboard.markComplete")}
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleCancelComplete}
                      disabled={isConfirming}
                      className="flex-1 py-3 bg-[#F4F7FE] hover:bg-[#E9E3FF] text-[#4318FF] font-bold rounded-xl transition-all disabled:opacity-70 cursor-pointer"
                    >
                      {t("common.cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmComplete}
                      disabled={isConfirming}
                      className="flex-1 py-3 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer"
                    >
                      {isConfirming && <Loader2 className="w-4 h-4 animate-spin" />}
                      {isConfirming ? t("dashboard.saving") : confirmMode === "undo" ? t("dashboard.yesUndo") : t("dashboard.yesComplete")}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* ── Observation Note Modal ────────────────────────────────────────────── */}
      {pendingObservationAlert && (
        <ObservationNoteModal
          alert={pendingObservationAlert}
          caregiverId={caregiverId}
          onDismiss={dismissObservationAlert}
        />
      )}

      {/* ── Medication Alert Modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {pendingAlert && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/65 backdrop-blur-md z-[9999]"
            />
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 p-safe pointer-events-none">
              <motion.div
                initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.88, y: 32 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.88, y: 32 }}
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
                className="w-full max-w-md pointer-events-auto"
              >
                <div className="bg-white rounded-[28px] shadow-[0_40px_100px_rgba(0,0,0,0.30)] overflow-hidden border border-[#E9E3FF]/40">
                  <div className="relative bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] px-6 sm:px-8 py-5 sm:py-6 flex items-center gap-4 overflow-hidden">
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                      animate={shouldReduceMotion ? {} : { x: ["-120%", "120%"] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear", repeatDelay: 2 }}
                    />
                    <motion.div
                      className="relative w-14 h-14 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0"
                      animate={shouldReduceMotion ? {} : { scale: [1, 1.08, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Bell className="w-7 h-7 text-white" />
                    </motion.div>
                    <div>
                      <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-0.5">{t("dashboard.medicationAlert")}</p>
                      <p className="text-xl font-bold text-white">{pendingAlert.title}</p>
                    </div>
                  </div>
                  <div className="px-6 sm:px-8 py-5 sm:py-6">
                    <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-wider mb-2">{t("dashboard.timeToAdminister")}</p>
                    <div className="p-4 bg-[#F8F7FF] rounded-xl border border-[#E9E3FF]/50 mb-4">
                      <p className="text-[#1F2247] font-bold text-base leading-relaxed">{pendingAlert.body}</p>
                    </div>
                    <p className="text-sm text-[#A3AED0] font-medium">{t("dashboard.confirmOrSnooze")}</p>
                  </div>
                  <div className="px-6 sm:px-8 pb-6 sm:pb-8 flex gap-3 sm:gap-4">
                    <button
                      type="button"
                      onClick={handleAlertSnooze}
                      disabled={isAlertConfirming}
                      className="flex-1 py-4 px-6 bg-[#F4F7FE] hover:bg-[#E9E3FF] text-[#4318FF] font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {t("dashboard.snooze")}
                    </button>
                    <button
                      type="button"
                      onClick={handleAlertConfirm}
                      disabled={isAlertConfirming}
                      className="flex-1 py-4 px-6 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isAlertConfirming && <Loader2 className="w-5 h-5 animate-spin" />}
                      {isAlertConfirming ? t("dashboard.confirming") : t("dashboard.confirm")}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
