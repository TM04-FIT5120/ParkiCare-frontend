import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Medication, CareEvent } from "@/context/careEventsContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type CalendarView = "twoDays" | "week" | "month";

interface AgendaItem {
  id: number;
  title: string;
  time: string;
  startDatetime: string;
  endDatetime: string;
  completed: boolean;
}

interface TimelineEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  bg: string;
  border: string;
  text: string;
}

interface CalendarWidgetProps {
  meds: Medication[];
  events: CareEvent[];
  agenda: AgendaItem[];
}

// ─── Malaysia Time Helpers ────────────────────────────────────────────────────

function getMYTNow(): Date {
  const utc = new Date().getTime() + new Date().getTimezoneOffset() * 60000;
  return new Date(utc + 8 * 3_600_000);
}
function getMYTToday(): Date {
  const n = getMYTNow();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const clamped = Math.min(h * 60 + m + mins, 23 * 60 + 59);
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}
function formatHour12(i: number): string {
  if (i === 0) return "";
  if (i === 12) return "12 pm";
  return i < 12 ? `${i} am` : `${i - 12} pm`;
}
function formatNowLabel(d: Date): string {
  const h = d.getHours() % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_ABBR    = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const PX          = 56; // px per hour
const GUTTER      = 52; // gutter width px

// ─── Event Builder ────────────────────────────────────────────────────────────

function buildDay(
  dayStr: string,
  meds: Medication[],
  events: CareEvent[],
  agenda: AgendaItem[],
): TimelineEvent[] {
  const out: TimelineEvent[] = [];

  meds.forEach((m) => {
    if (!m.time) return;
    out.push({ id: `med-${m.id}`, title: m.name,
      startTime: m.time, endTime: addMinutes(m.time, 30),
      bg: "bg-purple-50", border: "border-purple-400", text: "text-purple-800" });
  });

  events
    .filter((e) => e.eventType === "home" && e.startDatetime?.slice(0, 10) === dayStr)
    .forEach((e) => out.push({ id: `home-${e.id}`, title: e.title,
      startTime: e.time, endTime: e.endDatetime ? e.endDatetime.slice(11, 16) : addMinutes(e.time, 60),
      bg: "bg-orange-50", border: "border-orange-400", text: "text-orange-800" }));

  events
    .filter((e) => e.eventType === "outdoor" && e.startDatetime?.slice(0, 10) === dayStr)
    .forEach((e) => out.push({ id: `outdoor-${e.id}`, title: e.title,
      startTime: e.time, endTime: e.endDatetime ? e.endDatetime.slice(11, 16) : addMinutes(e.time, 60),
      bg: "bg-green-50", border: "border-green-400", text: "text-green-800" }));

  agenda
    .filter((a) => a.startDatetime?.slice(0, 10) === dayStr)
    .forEach((a) => out.push({ id: `ag-${a.id}`, title: a.title,
      startTime: a.time, endTime: a.endDatetime ? a.endDatetime.slice(11, 16) : addMinutes(a.time, 60),
      bg: "bg-blue-50", border: "border-blue-400", text: "text-blue-800" }));

  return out;
}

function toTop(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * PX + (m * PX) / 60;
}

// ─── Timeline View (Two Days + Week) ─────────────────────────────────────────

function TimelineView({
  visibleDays, isTwoDays, todayStr, mytNow, meds, events, agenda,
}: {
  visibleDays: Date[];
  isTwoDays: boolean;
  todayStr: string;
  mytNow: Date;
  meds: Medication[];
  events: CareEvent[];
  agenda: AgendaItem[];
}) {
  const nowTop      = mytNow.getHours() * PX + (mytNow.getMinutes() * PX) / 60;
  const todayVisible = visibleDays.some((d) => toDateStr(d) === todayStr);
  const totalH      = 24 * PX;

  return (
    <div className="flex flex-col">

      {/* ── Day header ── */}
      <div className="flex bg-gray-50 border-b border-gray-300 shrink-0">
        {/* gutter placeholder */}
        <div className="shrink-0 border-r border-gray-300" style={{ width: GUTTER }} />

        {visibleDays.map((d, idx) => {
          const ds      = toDateStr(d);
          const isToday = ds === todayStr;
          const borderL = idx > 0 ? "border-l border-gray-300" : "";

          return (
            <div
              key={ds}
              className={`flex-1 flex flex-col items-center justify-center py-3 ${borderL} ${
                isToday ? "bg-red-50/60" : ""
              }`}
            >
              {isTwoDays ? (
                <span className={`text-[13px] font-semibold tracking-tight ${isToday ? "text-red-500" : "text-slate-600"}`}>
                  {DAY_ABBR[d.getDay()]} — {d.getDate()} {MONTH_NAMES[d.getMonth()].slice(0, 3)}
                </span>
              ) : (
                <>
                  <span className={`text-[10px] font-semibold uppercase tracking-widest ${isToday ? "text-red-400" : "text-gray-400"}`}>
                    {DAY_ABBR[d.getDay()]}
                  </span>
                  <span className={`mt-0.5 text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${
                    isToday ? "bg-red-500 text-white" : "text-slate-700"
                  }`}>
                    {d.getDate()}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Scrollable body ── */}
      <div className="overflow-y-auto" style={{ height: 400 }}>
        <div className="flex" style={{ height: totalH }}>

          {/* Time gutter */}
          <div className="shrink-0 relative border-r border-gray-300 bg-white" style={{ width: GUTTER }}>
            {Array.from({ length: 24 }, (_, i) => (
              <div key={i} className="flex items-start justify-end pr-2.5" style={{ height: PX }}>
                <span className="text-[10px] font-medium text-gray-400 -mt-[6px] select-none leading-none whitespace-nowrap">
                  {formatHour12(i)}
                </span>
              </div>
            ))}

            {/* Current time label */}
            {todayVisible && (
              <div
                className="absolute inset-x-0 flex justify-end pr-1 z-30 pointer-events-none"
                style={{ top: nowTop - 9 }}
              >
                <span className="bg-red-500 text-white text-[9px] font-bold rounded px-1.5 py-[3px] leading-none shadow-sm">
                  {formatNowLabel(mytNow)}
                </span>
              </div>
            )}
          </div>

          {/* Day columns */}
          {visibleDays.map((d, idx) => {
            const ds      = toDateStr(d);
            const isToday = ds === todayStr;
            const dayEvs  = buildDay(ds, meds, events, agenda);
            const borderL = idx > 0 ? "border-l border-gray-300" : "";

            return (
              <div
                key={ds}
                className={`flex-1 relative ${borderL} ${isToday ? "bg-red-50/20" : "bg-white"}`}
              >
                {/* Horizontal hour lines */}
                {Array.from({ length: 24 }, (_, i) => (
                  <div
                    key={i}
                    className="border-b border-gray-200"
                    style={{ height: PX }}
                  />
                ))}

                {/* Current time line */}
                {isToday && (
                  <div
                    className="absolute inset-x-0 z-20 pointer-events-none flex items-center"
                    style={{ top: nowTop }}
                  >
                    <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 -ml-1 shadow-sm" />
                    <div className="flex-1 h-[1.5px] bg-red-500" />
                  </div>
                )}

                {/* Events */}
                {dayEvs.map((ev) => {
                  const top   = toTop(ev.startTime);
                  const [eh, em] = ev.endTime.split(":").map(Number);
                  const [sh, sm] = ev.startTime.split(":").map(Number);
                  const rawH  = ((eh * 60 + em) - (sh * 60 + sm)) * PX / 60;
                  const h     = Math.max(20, Math.min(rawH, totalH - top));
                  return (
                    <div
                      key={ev.id}
                      className={`absolute left-1 right-1 ${ev.bg} ${ev.border} border-l-[3px] rounded-md px-2 overflow-hidden z-10 shadow-sm`}
                      style={{ top, height: h }}
                    >
                      <p className={`text-[10px] font-bold leading-tight truncate pt-1 ${ev.text}`}>
                        {ev.title}
                      </p>
                      {h > 28 && (
                        <p className="text-[9px] text-gray-400 truncate mt-0.5">
                          {ev.startTime} – {ev.endTime}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({
  anchorDate, todayStr, meds, events, agenda,
}: {
  anchorDate: Date;
  todayStr: string;
  meds: Medication[];
  events: CareEvent[];
  agenda: AgendaItem[];
}) {
  const year     = anchorDate.getFullYear();
  const month    = anchorDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const cells    = Array.from({ length: 42 }, (_, i) =>
    new Date(year, month, 1 - firstDay + i));

  return (
    <div className="overflow-y-auto" style={{ maxHeight: 480 }}>
      {/* Weekday header */}
      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-300 sticky top-0 z-10">
        {DAY_ABBR.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-2.5 uppercase tracking-wider border-r border-gray-200 last:border-r-0">
            {d}
          </div>
        ))}
      </div>

      {/* Date cells */}
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const ds            = toDateStr(d);
          const isCurrentMonth = d.getMonth() === month;
          const isToday       = ds === todayStr;
          const dayEvs        = buildDay(ds, meds, events, agenda);
          const extra         = dayEvs.length - 3;
          const col           = i % 7;

          return (
            <div
              key={i}
              className={`min-h-[80px] border-b border-r border-gray-200 p-1.5 ${
                col === 6 ? "border-r-0" : ""
              } ${isToday ? "bg-red-50" : !isCurrentMonth ? "bg-gray-50/70" : "bg-white"}`}
            >
              <span
                className={`text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-full mb-1 ${
                  isToday
                    ? "bg-red-500 text-white"
                    : isCurrentMonth
                    ? "text-slate-700"
                    : "text-gray-300"
                }`}
              >
                {d.getDate()}
              </span>
              <div className="space-y-0.5">
                {dayEvs.slice(0, 3).map((ev) => (
                  <div
                    key={ev.id}
                    className={`truncate text-[9px] font-semibold px-1 py-px rounded ${ev.bg} ${ev.border} border-l-2 ${ev.text}`}
                  >
                    {ev.title}
                  </div>
                ))}
                {extra > 0 && (
                  <p className="text-[9px] text-gray-400 font-semibold pl-0.5">+{extra} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Widget ──────────────────────────────────────────────────────────────

const VIEW_OPTIONS: { value: CalendarView; label: string }[] = [
  { value: "twoDays", label: "Two Days" },
  { value: "week",    label: "Week"     },
  { value: "month",   label: "Month"    },
];

export function CalendarWidget({ meds, events, agenda }: CalendarWidgetProps) {
  const [view,       setView]       = useState<CalendarView>("week");
  const [anchorDate, setAnchorDate] = useState<Date>(() => getMYTToday());
  const [mytNow,     setMytNow]     = useState<Date>(() => getMYTNow());

  useEffect(() => {
    const id = setInterval(() => setMytNow(getMYTNow()), 60_000);
    return () => clearInterval(id);
  }, []);

  const todayStr = toDateStr(getMYTToday());

  const nav = useCallback((dir: 1 | -1) => {
    setAnchorDate((prev) => {
      const d = new Date(prev);
      if (view === "twoDays") d.setDate(d.getDate() + dir * 2);
      else if (view === "week") d.setDate(d.getDate() + dir * 7);
      else d.setMonth(d.getMonth() + dir);
      return d;
    });
  }, [view]);

  const goToday = useCallback(() => setAnchorDate(getMYTToday()), []);

  const switchView = (v: CalendarView) => { setView(v); setAnchorDate(getMYTToday()); };

  // Visible days for timeline
  const visibleDays: Date[] = (() => {
    if (view === "twoDays") {
      const d2 = new Date(anchorDate);
      d2.setDate(anchorDate.getDate() + 1);
      return [new Date(anchorDate), d2];
    }
    if (view === "week") {
      const sun = new Date(anchorDate);
      sun.setDate(anchorDate.getDate() - anchorDate.getDay());
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(sun); d.setDate(sun.getDate() + i); return d;
      });
    }
    return [];
  })();

  const headerLabel = (() => {
    if (view === "twoDays" && visibleDays.length === 2) {
      const [a, b] = visibleDays;
      return `${a.getDate()} ${MONTH_NAMES[a.getMonth()].slice(0, 3)} – ${b.getDate()} ${MONTH_NAMES[b.getMonth()].slice(0, 3)} ${b.getFullYear()}`;
    }
    return `${MONTH_NAMES[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`;
  })();

  return (
    <div className="bg-white rounded-[20px] shadow-[0_18px_40px_rgba(112,144,176,0.12)] overflow-hidden border border-gray-200">

      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-300 bg-white gap-3 flex-wrap shrink-0">

        {/* View selector */}
        <div className="relative">
          <select
            value={view}
            onChange={(e) => switchView(e.target.value as CalendarView)}
            className="appearance-none text-xs font-bold text-[#2B3674] bg-white border border-gray-300 rounded-lg pl-3 pr-7 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#4318FF]/30 cursor-pointer shadow-sm"
          >
            {VIEW_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 rotate-90 pointer-events-none" />
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => nav(-1)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <span className="text-[13px] font-bold text-slate-700 min-w-[170px] text-center select-none">
            {headerLabel}
          </span>
          <button
            type="button"
            onClick={() => nav(1)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
          >
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        {/* Today */}
        <button
          type="button"
          onClick={goToday}
          className="text-xs font-bold text-[#4318FF] bg-[#EEF2FF] border border-[#c7d2fe] px-3 py-1.5 rounded-lg hover:bg-[#e0e7ff] transition-colors shadow-sm"
        >
          Today
        </button>
      </div>

      {/* View content */}
      {(view === "twoDays" || view === "week") && (
        <TimelineView
          visibleDays={visibleDays}
          isTwoDays={view === "twoDays"}
          todayStr={todayStr}
          mytNow={mytNow}
          meds={meds}
          events={events}
          agenda={agenda}
        />
      )}
      {view === "month" && (
        <MonthView
          anchorDate={anchorDate}
          todayStr={todayStr}
          meds={meds}
          events={events}
          agenda={agenda}
        />
      )}
    </div>
  );
}
