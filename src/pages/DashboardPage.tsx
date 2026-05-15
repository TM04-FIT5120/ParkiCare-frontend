import { useState, useEffect, useMemo, useCallback } from "react";
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
  Pencil,
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
} from "lucide-react";
import { toast } from "sonner";
import { useCareEvents } from "@/hooks/useCareEvents";
import { careEventsService } from "@/services/careEvents";
import { caregiverScheduleService } from "@/services/caregiverSchedule";
import {
  listCaregiverEventOccurrences,
  upsertCaregiverEventOccurrence,
} from "@/services/caregiverEventOccurrences";
import { dashboardService } from "@/services/dashboard";
import { getMealSchedules, updateMealTime, generateWeeklyMeals } from "@/services/mealSchedule";
import { useAuth } from "@/context/AuthContext";
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

const HOURS = ["01","02","03","04","05","06","07","08","09","10","11","12"];
const MINUTES = ["00","05","10","15","20","25","30","35","40","45","50","55"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEKDAY_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

type CalendarView = "Week" | "Month";

type MealRow = {
  mealType: string;
  label: string;
  mealTime: string;
  editHour: string;
  editMinute: string;
  editPeriod: "AM" | "PM";
  editing: boolean;
  saving: boolean;
};

const DEFAULT_MEALS: Omit<MealRow, "editing" | "saving">[] = [
  { mealType: "BREAKFAST", label: "Breakfast", mealTime: "08:00", editHour: "08", editMinute: "00", editPeriod: "AM" },
  { mealType: "LUNCH",     label: "Lunch",     mealTime: "13:00", editHour: "01", editMinute: "00", editPeriod: "PM" },
  { mealType: "DINNER",    label: "Dinner",    mealTime: "19:00", editHour: "07", editMinute: "00", editPeriod: "PM" },
];

const MEAL_ICON_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  BREAKFAST: { icon: Coffee,   color: "#F59E0B", bg: "#FEF3C7" },
  LUNCH:     { icon: Utensils, color: "#FB7185", bg: "#FFE4E6" },
  DINNER:    { icon: Moon,     color: "#6366F1", bg: "#E0E7FF" },
};

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
  return `${h}:${mStr} ${period}`;
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

const TIMELINE_STYLES: Record<DashboardScheduleRow["source"], {
  bg: string; color: string; label: string; icon: React.ReactNode;
}> = {
  medication: { bg: "#EDE9FE", color: "#4318FF", label: "Patient Medication", icon: <Pill className="w-4 h-4" /> },
  home:       { bg: "#FEF3C7", color: "#B45309", label: "Patient Care",       icon: <Heart className="w-4 h-4" /> },
  outdoor:    { bg: "#DCFCE7", color: "#047857", label: "Patient Outdoor",    icon: <MapPin className="w-4 h-4" /> },
  caregiver:  { bg: "#EFF6FF", color: "#1D4ED8", label: "Caregiver",          icon: <CalendarIcon className="w-4 h-4" /> },
};

// ─── HeroSection ─────────────────────────────────────────────────────────────

function HeroSection({ navigate }: { navigate: (path: string) => void }) {
  const shouldReduceMotion = useReducedMotion();
  const pills = [
    { icon: <CalendarIcon className="w-4 h-4" />, title: "Stay organised",       sub: "Keep daily care on track" },
    { icon: <Heart className="w-4 h-4" />,        title: "Plan with confidence",  sub: "Personalised care, every day" },
    { icon: <Shield className="w-4 h-4" />,       title: "You're not alone",      sub: "Support for you and your loved one" },
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
            <h1 className="text-[32px] md:text-[40px] font-extrabold leading-tight tracking-tight text-[#1F2247]">
              Welcome to ParkiCare
            </h1>
            <p className="mt-2 text-sm text-[#4F567E]">
              Your daily care companion for Parkinson's care at home.
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
                  <h3 className="text-[16px] font-extrabold leading-tight text-[#1F2247]">Need support?</h3>
                  <p className="text-[12px] text-[#6B7299] mt-1.5 leading-snug">
                    MIASA Malaysia offers free mental health crisis support. You are not alone.
                  </p>
                </div>
              </div>
              <div className="mt-auto pt-4 flex items-center gap-2">
                <a
                  href="tel:1800180066"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#4318FF] hover:bg-[#3412C7] text-white text-[12px] font-extrabold transition-colors shadow-sm"
                >
                  <Phone className="w-3 h-3" /> Call Now
                </a>
                <button
                  type="button"
                  onClick={() => navigate("/knowledge-hub#miasa-support")}
                  className="flex-1 inline-flex items-center justify-center py-2 rounded-lg bg-white text-[#4318FF] text-[12px] font-extrabold border border-[#E9E3FF] hover:bg-[#F4F2FF] transition-colors cursor-pointer"
                >
                  Read More
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
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDate();
  const month = MONTH_SHORT[d.getMonth()];
  const weekday = WEEKDAY_SHORT[d.getDay()];

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
          <span className={`text-[11px] font-bold ${isSelected ? "text-white" : "text-[#1F2247]"}`}>{medCount} medication{medCount !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-2">
          <Heart className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-white/80" : "text-[#F59E0B]"}`} />
          <span className={`text-[11px] font-bold ${isSelected ? "text-white" : "text-[#1F2247]"}`}>{careCount} care event{careCount !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {isToday && !isSelected && (
        <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-md bg-[#FBBF24] text-[#1F2247] text-[9px] font-extrabold uppercase tracking-wider shadow-sm">
          Today
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
        {WEEKDAY_SHORT.map((d) => (
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

// ─── Care Calendar Section ────────────────────────────────────────────────────

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

  // Week view: always 7 days with today in the centre
  const visibleDates = useMemo(
    () => [-3, -2, -1, 0, 1, 2, 3].map((o) => addDaysStr(todayStr, o)),
    [todayStr],
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

  const subtitle =
    view === "Month"
      ? `${MONTH_NAMES[anchorMonth.month]} ${anchorMonth.year}`
      : "Tap a day to see the care plan";

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
          <h2 className="text-[20px] font-extrabold tracking-tight text-[#1F2247]">Care Calendar</h2>
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
                {v}
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
          { color: "#4318FF", bg: "#EDE9FE", label: "Patient Medication",              count: bd.med,       Icon: Pill },
          { color: "#F59E0B", bg: "#FEF3C7", label: "Patient Home Care Event", count: bd.home,      Icon: Heart },
          { color: "#10B981", bg: "#DCFCE7", label: "Patient Outdoor Event",   count: bd.outdoor,   Icon: MapPin },
          { color: "#3B82F6", bg: "#EFF6FF", label: "Caregiver Event",         count: bd.caregiver, Icon: CalendarIcon },
        ] as const;

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
                {MONTH_NAMES[anchorMonth.month]} {anchorMonth.year}
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
            <div className="grid grid-cols-2 gap-4 items-start">
              {/* Month grid - unchanged size */}
              <MonthGrid
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                year={anchorMonth.year}
                month={anchorMonth.month}
                todayStr={todayStr}
                getDateEventBreakdown={getDateEventBreakdown}
              />

              {/* Right panel */}
              <div className="flex flex-col gap-3 h-full">

                {/* ── Legend ─────────────────────────────────────────────────── */}
                <div className="rounded-2xl border border-[#EEEAFB] bg-gradient-to-br from-[#F8F6FF] to-white p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#A3AED0] mb-3">
                    Color Legend
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
                      {isSelToday ? "Today" : selD.toLocaleDateString("en-US", { weekday: "long" })}
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
                          {selD.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
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
                        <p className="text-[11px] font-bold text-[#A3AED0]">No events this day</p>
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
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 h-full">
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
  const isToday = selectedDate === todayStr;
  const now = getMYTNow();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const d = new Date(selectedDate + "T00:00:00");
  const dateLabel = isToday
    ? "Today"
    : d.toLocaleDateString("en-US", { weekday: "long" });
  const dateSubLabel = `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;

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
              {schedule.length} scheduled ·{" "}
              <span className="text-[#10B981] font-bold">{completed} done</span>{" "}
              · <span className="text-[#F59E0B] font-bold">{schedule.length - completed} to go</span>
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
                  {pendingCount} pending
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
                  {overdueCount} overdue
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
          <p className="text-sm font-bold text-[#A3AED0]">No tasks scheduled for this day</p>
          <p className="text-xs text-[#A3AED0]/70 mt-1">Select another day or add events →</p>
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
                          {item.title}
                        </p>
                        <span
                          className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-widest whitespace-nowrap"
                          style={{ background: s.bg, color: s.color }}
                        >
                          {s.label}
                        </span>
                        {isNext && (
                          <span className="px-1.5 py-0.5 rounded-md bg-[#F59E0B] text-white text-[9px] font-extrabold uppercase tracking-widest animate-pulse whitespace-nowrap">
                            Up next
                          </span>
                        )}
                        {item.completed && (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-[#4318FF] bg-[#E9E3FF] px-2 py-0.5 rounded-md">Done</span>
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

const QUICK_ACTIONS = [
  { title: "Medication Plan",              desc: "Set reminders and track medications.",                                   icon: Pill,      color: "#4318FF", bg: "#EDE9FE", path: "/care-events#medication-section" },
  { title: "Caregiver and Patient Events", desc: "Log care activities and monitor daily progress.",                        icon: Heart,     color: "#F97316", bg: "#FFF7ED", path: "/care-events#care-event-section" },
  { title: "AI Suggested Events",          desc: "Plan meaningful outdoor/indoor activities suited best for the patient.", icon: MapPin,    color: "#10B981", bg: "#ECFDF5", path: "/care-events#outdoor-event-section" },
  { title: "Digital Records",              desc: "Access reports, documents and health history.",                          icon: FolderOpen,color: "#3B82F6", bg: "#EFF6FF", path: "/digital-records" },
  { title: "Nutrition Library",            desc: "Explore nutrition tips, meal planning guidance.",                        icon: Apple,     color: "#8B5CF6", bg: "#F5F3FF", path: "/nutrition-library" },
  { title: "Recipes",                      desc: "Access your Parkinson friendly generated recipes.",                      icon: ChefHat,  color: "#F59E0B", bg: "#FEF3C7", path: "/recipes" },
];

function QuickActionsGrid({ navigate }: { navigate: (path: string) => void }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="h-full flex flex-col bg-white rounded-[26px] p-6 border border-[#EEEAFB] shadow-[0_4px_24px_-16px_rgba(67,24,255,0.12)]"
    >
      <h2 className="text-[20px] font-extrabold tracking-tight text-[#1F2247] mb-5 shrink-0">
        What would you like to manage today?
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

// ─── Meal Planner Sidebar ─────────────────────────────────────────────────────

function MealPlannerSidebar({
  caregiverId,
  onSaved,
}: {
  caregiverId: number;
  onSaved: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [rows, setRows] = useState<MealRow[]>(() =>
    DEFAULT_MEALS.map((m) => ({ ...m, editing: false, saving: false }))
  );

  useEffect(() => {
    if (!caregiverId) return;
    getMealSchedules(caregiverId)
      .then((entries) => {
        setRows((prev) =>
          prev.map((row) => {
            const found = entries.find((e) => e.mealType === row.mealType);
            if (!found) return row;
            return { ...row, mealTime: found.mealTime, ...parseToEditFields(found.mealTime) };
          })
        );
      })
      .catch(() => {});
  }, [caregiverId]);

  function startEdit(mealType: string) {
    setRows((prev) => prev.map((r) => (r.mealType === mealType ? { ...r, editing: true } : r)));
  }
  function cancelEdit(mealType: string) {
    setRows((prev) =>
      prev.map((r) => r.mealType === mealType ? { ...r, editing: false, ...parseToEditFields(r.mealTime) } : r)
    );
  }
  async function saveEdit(mealType: string) {
    const row = rows.find((r) => r.mealType === mealType);
    if (!row) return;
    let h = parseInt(row.editHour, 10);
    if (row.editPeriod === "AM" && h === 12) h = 0;
    if (row.editPeriod === "PM" && h !== 12) h += 12;
    const newTime = `${String(h).padStart(2, "0")}:${row.editMinute}`;
    setRows((prev) => prev.map((r) => (r.mealType === mealType ? { ...r, saving: true } : r)));
    try {
      await updateMealTime(caregiverId, mealType, newTime);
      setRows((prev) =>
        prev.map((r) => r.mealType === mealType ? { ...r, mealTime: newTime, editing: false, saving: false } : r)
      );
      toast.success("Meal time saved");
      onSaved();
    } catch {
      toast.error("Failed to save meal time");
      setRows((prev) => prev.map((r) => (r.mealType === mealType ? { ...r, saving: false } : r)));
    }
  }
  function setField(mealType: string, field: "editHour" | "editMinute" | "editPeriod", value: string) {
    setRows((prev) => prev.map((r) => (r.mealType === mealType ? { ...r, [field]: value } : r)));
  }

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="h-full flex flex-col bg-white rounded-[26px] p-5 border border-[#EEEAFB] shadow-[0_4px_24px_-16px_rgba(67,24,255,0.12)]"
    >
      <h3 className="text-[20px] font-extrabold tracking-tight text-[#1F2247] mb-4 shrink-0">Meal Schedule</h3>
      <div className="flex-1 flex flex-col justify-between gap-2">
        {rows.map((row) => {
          const cfg = MEAL_ICON_CONFIG[row.mealType];
          return (
            <div key={row.mealType} className="rounded-2xl overflow-hidden flex-1 flex flex-col justify-center">
              {!row.editing ? (
                <div className="flex items-center gap-3 p-3 rounded-2xl border border-[#EEEAFB] hover:bg-[#F8F6FF] transition-colors h-full">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    <cfg.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-widest font-extrabold text-[#A3AED0]">{row.label}</p>
                    <p className="text-[15px] font-extrabold text-[#1F2247] mt-0.5">{formatMealDisplayTime(row.mealTime)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startEdit(row.mealType)}
                    className="w-8 h-8 rounded-xl hover:bg-[#F4F2FF] flex items-center justify-center text-[#A3AED0] hover:text-[#4318FF] transition-colors cursor-pointer"
                    title="Edit time"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="bg-[#F8F6FF] rounded-2xl px-4 py-3 border border-[#4318FF]/20 space-y-2">
                  <p className="text-[10px] font-bold text-[#4318FF] uppercase tracking-widest">{row.label}</p>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={row.editHour}
                      onChange={(e) => setField(row.mealType, "editHour", e.target.value)}
                      className="flex-1 px-2 py-1.5 bg-white border border-[#E0E5F2] rounded-lg text-xs font-bold text-[#1F2247] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/30"
                    >
                      {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <span className="text-[#4318FF] font-bold text-sm">:</span>
                    <select
                      value={row.editMinute}
                      onChange={(e) => setField(row.mealType, "editMinute", e.target.value)}
                      className="flex-1 px-2 py-1.5 bg-white border border-[#E0E5F2] rounded-lg text-xs font-bold text-[#1F2247] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/30"
                    >
                      {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <div className="flex rounded-lg overflow-hidden border border-[#4318FF]/30">
                      {(["AM", "PM"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setField(row.mealType, "editPeriod", p)}
                          className={`px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer
                            ${row.editPeriod === p
                              ? "bg-[#4318FF] text-white"
                              : "bg-white text-[#A3AED0] hover:bg-[#F4F2FF]"}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => cancelEdit(row.mealType)}
                      disabled={row.saving}
                      className="flex-1 py-1.5 bg-white text-[#A3AED0] text-xs font-bold rounded-lg border border-[#E0E5F2] transition-all disabled:opacity-50 cursor-pointer hover:bg-[#F4F7FE]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => saveEdit(row.mealType)}
                      disabled={row.saving}
                      className="flex-1 py-1.5 bg-[#4318FF] hover:bg-[#3412C7] text-white text-xs font-bold rounded-lg transition-all disabled:opacity-70 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      {row.saving && <Loader2 className="w-3 h-3 animate-spin" />}
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Main DashboardPage ───────────────────────────────────────────────────────

export function DashboardPage() {
  const { meds: patientMedications, events: patientEventsStore, deleteMed, deleteEvent } = useCareEvents();
  const navigate = useNavigate();
  const { user } = useAuth();
  const caregiverId = user?.caregiverId ?? 0;
  const shouldReduceMotion = useReducedMotion();

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

  // ── Data fetching ───────────────────────────────────────────────────────────

  const refreshCompletions = useCallback(async () => {
    if (!caregiverId) return;
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
    if (!caregiverId) return;
    caregiverScheduleService.getSchedules(caregiverId).then((schedules) => {
      setAgenda(
        schedules.map((s) => ({
          id: s.id,
          title: s.scheduleTitle,
          time: s.startDatetime.slice(11, 16),
          startDatetime: s.startDatetime,
          endDatetime: s.endDatetime,
          recurrence: s.recurrence ?? null,
        })),
      );
    }).catch(() => {});
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
  }, [caregiverId, refreshAgenda, todayStr]);

  useEffect(() => {
    refreshCompletions();
  }, [refreshCompletions]);

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
      toast.success(confirmMode === "undo" ? "Task marked as incomplete." : "Task marked as complete!");
      dashboardService.getPendingTasks(caregiverId).then((t) => setPendingCount(t.length)).catch(() => {});
      dashboardService.getOverdueTasks(caregiverId).then((t) => setOverdueCount(t.length)).catch(() => {});
    } catch (err) {
      setCompletionKeys(snapshot);
      toast.error(err instanceof Error ? err.message : "Could not save completion");
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
      toast.success("Medication administration confirmed!");
      dismissAlert();
    } catch {
      setCompletionKeys(snapshot);
      toast.error("Could not confirm. Please try again.");
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
      toast.success("Event deleted");
    } catch {
      toast.error("Could not delete event");
    } finally {
      setDeletingKeys((prev) => { const s = new Set(prev); s.delete(item.rowKey); return s; });
    }
  }, [caregiverId, patientMedications, patientEventsStore, deleteMed, deleteEvent]);

  const confirmTaskTitle = confirmRow?.title;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <HeroSection navigate={navigate} />

      {/* ── Layout grid ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-5">

        {/* Row 1 - Quick Actions (8) + Meal Schedule (4) */}
        <div className="col-span-12 lg:col-span-8 h-full">
          <QuickActionsGrid navigate={navigate} />
        </div>
        <div className="col-span-12 lg:col-span-4 h-full">
          <MealPlannerSidebar caregiverId={caregiverId} onSaved={refreshAgenda} />
        </div>

        {/* Row 2 - Care Calendar (full width) */}
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
            isLoading={isCompletionsLoading}
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
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
                        {confirmMode === "undo" ? "Undo Task?" : "Complete Task?"}
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
                    {confirmMode === "undo" ? "Mark this task as incomplete again?" : "Mark this task as complete?"}
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleCancelComplete}
                      disabled={isConfirming}
                      className="flex-1 py-3 bg-[#F4F7FE] hover:bg-[#E9E3FF] text-[#4318FF] font-bold rounded-xl transition-all disabled:opacity-70 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmComplete}
                      disabled={isConfirming}
                      className="flex-1 py-3 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer"
                    >
                      {isConfirming && <Loader2 className="w-4 h-4 animate-spin" />}
                      {isConfirming ? "Saving…" : confirmMode === "undo" ? "Yes, Undo" : "Yes, Complete"}
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
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
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
                      <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-0.5">Medication Alert</p>
                      <p className="text-xl font-bold text-white">{pendingAlert.title}</p>
                    </div>
                  </div>
                  <div className="px-6 sm:px-8 py-5 sm:py-6">
                    <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-wider mb-2">Time to administer:</p>
                    <div className="p-4 bg-[#F8F7FF] rounded-xl border border-[#E9E3FF]/50 mb-4">
                      <p className="text-[#1F2247] font-bold text-base leading-relaxed">{pendingAlert.body}</p>
                    </div>
                    <p className="text-sm text-[#A3AED0] font-medium">Please confirm or snooze to continue.</p>
                  </div>
                  <div className="px-6 sm:px-8 pb-6 sm:pb-8 flex gap-3 sm:gap-4">
                    <button
                      type="button"
                      onClick={handleAlertSnooze}
                      disabled={isAlertConfirming}
                      className="flex-1 py-4 px-6 bg-[#F4F7FE] hover:bg-[#E9E3FF] text-[#4318FF] font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                    >
                      Snooze 5 min
                    </button>
                    <button
                      type="button"
                      onClick={handleAlertConfirm}
                      disabled={isAlertConfirming}
                      className="flex-1 py-4 px-6 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isAlertConfirming && <Loader2 className="w-5 h-5 animate-spin" />}
                      {isAlertConfirming ? "Confirming…" : "Confirm"}
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
