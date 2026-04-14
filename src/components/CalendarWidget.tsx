import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { Medication, CareEvent } from "@/context/careEventsContext";
import {
  completionLookupKey,
  isEventOnDay,
  occurrenceIsoForDay,
} from "@/lib/eventRecurrence";

// ─── Types ────────────────────────────────────────────────────────────────────

type CalendarView = "twoDays" | "week" | "month";

export interface AgendaItem {
  id: number;
  title: string;
  time: string;
  startDatetime: string;
  endDatetime: string;
  recurrence?: string | null;
}

interface TimelineEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  bg: string;
  border: string;
  text: string;
  completed?: boolean;
}

interface CalendarWidgetProps {
  meds: Medication[];
  events: CareEvent[];
  agenda: AgendaItem[];
  /** Keys from `completionLookupKey` for occurrences marked complete */
  completionKeys?: Set<string>;
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
/** Wider gutter so time labels never sit flush against the card edge */
const GUTTER      = 76;
/** Explicit grid line color (inline styles: always visible, avoids Tailwind/flex quirks) */
const GRID_LINE   = "#e8eaee";

const TIMELINE_VIEWPORT_PX = 400;
/** Reserve space for sticky day header inside the scroll area (py-3 + labels) */
const TIMELINE_HEADER_RESERVE_PX = 88;
const NOW_LINE_COLOR = "#ef4444";

// ─── Event Builder ────────────────────────────────────────────────────────────

function resolveOutdoorSourceId(e: CareEvent): number {
  if (e.backendId != null) return e.backendId;
  if (e.id > 100_000) return e.id - 100_000;
  return e.id;
}

function buildDay(
  dayStr: string,
  meds: Medication[],
  events: CareEvent[],
  agenda: AgendaItem[],
  completionKeys?: Set<string>,
): TimelineEvent[] {
  const out: TimelineEvent[] = [];

  meds.forEach((m) => {
    if (!m.time) return;
    const startDate = m.startDate ?? dayStr;
    const rec = m.recurrence ?? "daily";
    if (!isEventOnDay(dayStr, startDate, m.endDate, rec)) return;
    const sid = m.remindId ?? m.id;
    const occurrenceStart = occurrenceIsoForDay(dayStr, m.time);
    const key = completionLookupKey("MEDICATION_PLAN", sid, occurrenceStart);
    const completed = completionKeys?.has(key) ?? false;
    out.push({
      id: `med-${m.id}-${dayStr}`,
      title: m.name,
      startTime: m.time,
      endTime: addMinutes(m.time, 30),
      bg: completed ? "bg-slate-100" : "bg-purple-50",
      border: completed ? "border-slate-300" : "border-purple-400",
      text: completed ? "text-slate-500 line-through" : "text-purple-800",
      completed,
    });
  });

  (["home", "outdoor"] as const).forEach((evType) => {
    const style = evType === "home"
      ? { bg: "bg-orange-50", border: "border-orange-400", text: "text-orange-800" }
      : { bg: "bg-green-50", border: "border-green-400", text: "text-green-800" };

    events
      .filter((e) => e.eventType === evType && !!e.startDatetime)
      .forEach((e) => {
        const startDate = e.startDatetime!.slice(0, 10);
        const endDatePart = e.endDatetime?.slice(0, 10);
        const seriesEndDate = endDatePart && endDatePart > startDate ? endDatePart : undefined;

        if (!isEventOnDay(dayStr, startDate, seriesEndDate, e.recurrence)) return;

        const startTime = e.startDatetime!.slice(11, 16);
        const endTime = e.endDatetime ? e.endDatetime.slice(11, 16) : addMinutes(startTime, 60);
        const sourceId = evType === "home" ? (e.backendId ?? e.id) : resolveOutdoorSourceId(e);
        const occurrenceStart = occurrenceIsoForDay(dayStr, startTime);
        const st = evType === "home" ? "PATIENT_HOME_CARE" as const : "PATIENT_OUTDOOR" as const;
        const key = completionLookupKey(st, sourceId, occurrenceStart);
        const completed = completionKeys?.has(key) ?? false;
        out.push({
          id: `${evType}-${e.id}-${dayStr}`,
          title: e.title,
          startTime,
          endTime,
          bg: completed ? "bg-slate-100" : style.bg,
          border: completed ? "border-slate-300" : style.border,
          text: completed ? "text-slate-500 line-through" : style.text,
          completed,
        });
      });
  });

  agenda.forEach((a) => {
    if (!a.startDatetime) return;
    const startDate = a.startDatetime.slice(0, 10);
    const endDatePart = a.endDatetime?.slice(0, 10);
    const seriesEndDate = endDatePart && endDatePart > startDate ? endDatePart : undefined;
    const rec = a.recurrence ?? "none";
    if (!isEventOnDay(dayStr, startDate, seriesEndDate, rec)) return;
    const startTime = a.startDatetime.slice(11, 16);
    const endTime = a.endDatetime ? a.endDatetime.slice(11, 16) : addMinutes(a.time || startTime, 60);
    const occurrenceStart = occurrenceIsoForDay(dayStr, startTime);
    const key = completionLookupKey("CAREGIVER_SCHEDULE", a.id, occurrenceStart);
    const completed = completionKeys?.has(key) ?? false;
    out.push({
      id: `ag-${a.id}-${dayStr}`,
      title: a.title,
      startTime,
      endTime,
      bg: completed ? "bg-slate-100" : "bg-blue-50",
      border: completed ? "border-slate-300" : "border-blue-400",
      text: completed ? "text-slate-500 line-through" : "text-blue-800",
      completed,
    });
  });

  return out;
}

// ─── Overlap Layout ───────────────────────────────────────────────────────────

interface LayoutEvent extends TimelineEvent {
  col: number;
  numCols: number;
  overlapping: boolean;
}

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function eventsOverlap(a: TimelineEvent, b: TimelineEvent): boolean {
  return timeToMin(a.startTime) < timeToMin(b.endTime) &&
         timeToMin(b.startTime) < timeToMin(a.endTime);
}

/**
 * Assigns side-by-side columns to overlapping events.
 * Events that overlap any other event get `overlapping = true`.
 */
function layoutEvents(events: TimelineEvent[]): LayoutEvent[] {
  if (events.length === 0) return [];

  // Sort by start time, longer events first on tie
  const sorted = [...events].sort((a, b) => {
    const d = timeToMin(a.startTime) - timeToMin(b.startTime);
    return d !== 0 ? d : timeToMin(b.endTime) - timeToMin(a.endTime);
  });

  // Greedy column assignment: each slot tracks end-minute of last event placed
  const colEnds: number[] = [];
  const assigned: number[] = new Array(sorted.length).fill(0);

  sorted.forEach((ev, i) => {
    const startMin = timeToMin(ev.startTime);
    let col = colEnds.findIndex((end) => end <= startMin);
    if (col === -1) col = colEnds.length;
    colEnds[col] = timeToMin(ev.endTime);
    assigned[i] = col;
  });

  // For each event: numCols = max col of any event that overlaps it + 1
  return sorted.map((ev, i) => {
    let maxCol = assigned[i];
    let overlapping = false;
    sorted.forEach((other, j) => {
      if (i !== j && eventsOverlap(ev, other)) {
        maxCol = Math.max(maxCol, assigned[j]);
        overlapping = true;
      }
    });
    return { ...ev, col: assigned[i], numCols: maxCol + 1, overlapping };
  });
}

const OVERLAP_STYLE = { bg: "bg-red-50", border: "border-red-500", text: "text-red-700" };

function toTop(time: string) {
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * PX + (m * PX) / 60;
}

// ─── Timeline View (Two Days + Week) ─────────────────────────────────────────

function TimelineView({
  visibleDays, isTwoDays, todayStr, mytNow, meds, events, agenda, completionKeys,
}: {
  visibleDays: Date[];
  isTwoDays: boolean;
  todayStr: string;
  mytNow: Date;
  meds: Medication[];
  events: CareEvent[];
  agenda: AgendaItem[];
  completionKeys?: Set<string>;
}) {
  const nowTop      = mytNow.getHours() * PX + (mytNow.getMinutes() * PX) / 60;
  const todayVisible = visibleDays.some((d) => toDateStr(d) === todayStr);
  const totalH      = 24 * PX;
  const nDays       = visibleDays.length;
  const gridCols    = `${GUTTER}px repeat(${nDays}, minmax(0, 1fr))`;
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const visibleKey    = visibleDays.map((d) => toDateStr(d)).join("|");

  /** Scroll so the current-time row is in view (default focus on “now”). */
  useLayoutEffect(() => {
    const root = scrollRootRef.current;
    if (!root || !todayVisible) return;
    const headerEl = root.firstElementChild as HTMLElement | undefined;
    const headerH =
      headerEl?.offsetHeight ?? TIMELINE_HEADER_RESERVE_PX;
    const lineFromContentTop = headerH + nowTop;
    const ch = root.clientHeight;
    const maxScroll = Math.max(0, root.scrollHeight - ch);
    const target =
      lineFromContentTop - ch * 0.35;
    root.scrollTop = Math.max(0, Math.min(target, maxScroll));
    // Omit ticking deps (mytNow / nowTop) so scroll does not jump every minute;
    // re-run when the visible day range changes or today enters view.
  }, [todayVisible, visibleKey]);

  return (
    <div
      ref={scrollRootRef}
      className="min-w-0 overflow-x-hidden overflow-y-auto"
      style={{
        maxHeight: TIMELINE_VIEWPORT_PX + TIMELINE_HEADER_RESERVE_PX,
        scrollbarGutter: "stable",
      }}
    >
      {/*
        Single scroll container + sticky header so column widths match the body
        (avoids scrollbar shrinking only the grid and misaligning the date row).
      */}
      <div
        className="sticky top-0 z-40 grid min-w-0 bg-gray-50 shadow-[0_1px_0_0_rgba(15,23,42,0.08)]"
        style={{
          gridTemplateColumns: gridCols,
          borderBottom: `1px solid ${GRID_LINE}`,
          zIndex: 40,
        }}
      >
        <div
          aria-hidden
          style={{
            boxSizing: "border-box",
            borderRight: `1px solid ${GRID_LINE}`,
            backgroundColor: "#f8fafc",
          }}
        />
        {visibleDays.map((d) => {
          const ds = toDateStr(d);
          const isToday = ds === todayStr;
          return (
            <div
              key={`h-${ds}`}
              className="flex min-w-0 flex-col items-center justify-center py-3"
              style={{
                borderRight: `1px solid ${GRID_LINE}`,
                backgroundColor: isToday ? "#fff1f2" : "#f8fafc",
              }}
            >
              {isTwoDays ? (
                <span
                  className={`text-[13px] font-semibold tracking-tight ${
                    isToday ? "text-red-500" : "text-slate-600"
                  }`}
                >
                  {DAY_ABBR[d.getDay()]} - {d.getDate()} {MONTH_NAMES[d.getMonth()].slice(0, 3)}
                </span>
              ) : (
                <>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-widest ${
                      isToday ? "text-red-400" : "text-gray-400"
                    }`}
                  >
                    {DAY_ABBR[d.getDay()]}
                  </span>
                  <span
                    className={`mt-0.5 text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${
                      isToday ? "bg-red-500 text-white" : "text-slate-700"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div
        className="grid min-w-0 bg-white"
        style={{
          gridTemplateColumns: gridCols,
          height: totalH,
        }}
      >
        {/* Time gutter */}
        <div
          className="relative min-w-0 bg-white"
          style={{
            boxSizing: "border-box",
            borderRight: `1px solid ${GRID_LINE}`,
            paddingLeft: 12,
            paddingRight: 6,
          }}
        >
          {Array.from({ length: 24 }, (_, i) => (
            <div
              key={i}
              className="flex items-start justify-start"
              style={{ height: PX, boxSizing: "border-box" }}
            >
              <span
                className="select-none leading-none whitespace-nowrap"
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: "#94a3b8",
                  marginTop: -6,
                }}
              >
                {formatHour12(i)}
              </span>
            </div>
          ))}

          {todayVisible && (
            <div
              className="pointer-events-none absolute inset-x-0 z-20 flex justify-end pr-1"
              style={{ top: nowTop - 9 }}
            >
              <span
                className="rounded px-1.5 py-[3px] text-[9px] font-bold leading-none text-white shadow-sm"
                style={{ backgroundColor: NOW_LINE_COLOR }}
              >
                {formatNowLabel(mytNow)}
              </span>
            </div>
          )}
        </div>

        {/* All day columns: nested grid + one full-width "now" line */}
        <div
          className="relative min-h-0 min-w-0"
          style={{
            gridColumn: "2 / -1",
            display: "grid",
            gridTemplateColumns: `repeat(${nDays}, minmax(0, 1fr))`,
            height: totalH,
          }}
        >
          {visibleDays.map((d) => {
            const ds = toDateStr(d);
            const isToday = ds === todayStr;
            const dayEvs = buildDay(ds, meds, events, agenda, completionKeys);

            return (
              <div
                key={ds}
                className={`relative min-w-0 ${isToday ? "bg-red-50/20" : "bg-white"}`}
                style={{ borderRight: `1px solid ${GRID_LINE}` }}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <div
                    key={i}
                    className="border-b border-gray-200"
                    style={{ height: PX }}
                  />
                ))}

                {isToday && (
                  /* Line is the positioned element; dot is an absolute child of it */
                  <div
                    className="pointer-events-none absolute z-30"
                    style={{
                      top: nowTop,
                      left: 0,
                      right: 0,
                      height: 2,
                      backgroundColor: NOW_LINE_COLOR,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: -4,
                        top: -3.5,
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        backgroundColor: NOW_LINE_COLOR,
                      }}
                    />
                  </div>
                )}

                {layoutEvents(dayEvs).map((ev) => {
                  const top = toTop(ev.startTime);
                  const rawH = (timeToMin(ev.endTime) - timeToMin(ev.startTime)) * PX / 60;
                  const h = Math.max(20, Math.min(rawH, totalH - top));
                  const style = ev.overlapping ? OVERLAP_STYLE : ev;
                  const colW = 100 / ev.numCols;
                  const left = `calc(${ev.col * colW}% + 2px)`;
                  const width = `calc(${colW}% - 4px)`;
                  return (
                    <div
                      key={ev.id}
                      className={`absolute z-[25] overflow-hidden rounded-md border-l-[3px] px-2 shadow-sm ${style.bg} ${style.border}`}
                      style={{ top, height: h, left, width }}
                    >
                      <p className={`truncate pt-1 text-[10px] font-bold leading-tight ${style.text}`}>
                        {ev.title}
                      </p>
                      {h > 28 && (
                        <p className="mt-0.5 truncate text-[9px] text-gray-400">
                          {ev.startTime} – {ev.endTime}
                        </p>
                      )}
                      {ev.completed && (
                        <div
                          className="pointer-events-none absolute inset-x-0"
                          style={{
                            top: "50%",
                            height: 1.5,
                            backgroundColor: "#94a3b8",
                            opacity: 0.7,
                          }}
                        />
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
  anchorDate, todayStr, meds, events, agenda, completionKeys,
}: {
  anchorDate: Date;
  todayStr: string;
  meds: Medication[];
  events: CareEvent[];
  agenda: AgendaItem[];
  completionKeys?: Set<string>;
}) {
  const year     = anchorDate.getFullYear();
  const month    = anchorDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const cells    = Array.from({ length: 42 }, (_, i) =>
    new Date(year, month, 1 - firstDay + i));
  return (
    <div className="flex flex-col" style={{ height: TIMELINE_VIEWPORT_PX + TIMELINE_HEADER_RESERVE_PX }}>
      {/* Weekday header */}
      <div
        className="grid grid-cols-7 bg-gray-50 shrink-0"
        style={{ borderBottom: `1px solid ${GRID_LINE}` }}
      >
        {DAY_ABBR.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-semibold text-gray-400 py-2.5 uppercase tracking-wider min-w-0"
            style={{ borderRight: `1px solid ${GRID_LINE}` }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Date cells */}
      <div className="grid grid-cols-7 grid-rows-6 flex-1">
        {cells.map((d, i) => {
          const ds            = toDateStr(d);
          const isCurrentMonth = d.getMonth() === month;
          const isToday       = ds === todayStr;
          const dayLayout     = layoutEvents(buildDay(ds, meds, events, agenda, completionKeys));
          const extra         = dayLayout.length - 3;

          return (
            <div
              key={i}
              className={`h-full min-h-0 p-1.5 min-w-0 ${
                isToday ? "bg-red-50" : !isCurrentMonth ? "bg-gray-50/70" : "bg-white"
              }`}
              style={{
                borderRight: `1px solid ${GRID_LINE}`,
                borderBottom: `1px solid ${GRID_LINE}`,
              }}
            >
              <span
                className={`text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-full mb-1 ml-0.5 ${
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
                {dayLayout.slice(0, 3).map((ev) => {
                  const style = ev.overlapping ? OVERLAP_STYLE : ev;
                  return (
                    <div
                      key={ev.id}
                      className={`relative truncate text-[9px] font-semibold px-1 py-px rounded ${style.bg} ${style.border} border-l-2 ${style.text}`}
                    >
                      {ev.title}
                      {ev.completed && (
                        <div
                          className="pointer-events-none absolute inset-x-0"
                          style={{
                            top: "50%",
                            height: 1,
                            backgroundColor: "#94a3b8",
                            opacity: 0.7,
                          }}
                        />
                      )}
                    </div>
                  );
                })}
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

export function CalendarWidget({ meds, events, agenda, completionKeys }: CalendarWidgetProps) {
  const [view,       setView]       = useState<CalendarView>("twoDays");
  const [anchorDate, setAnchorDate] = useState<Date>(() => getMYTToday());
  const [mytNow,     setMytNow]     = useState<Date>(() => getMYTNow());
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setMytNow(getMYTNow()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!viewMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = viewMenuRef.current;
      if (el && !el.contains(e.target as Node)) setViewMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [viewMenuOpen]);

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

  const switchView = (v: CalendarView) => {
    setView(v);
    setAnchorDate(getMYTToday());
    setViewMenuOpen(false);
  };

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

        {/* View selector, custom menu so full trigger is clickable and list matches trigger width */}
        <div ref={viewMenuRef} className="relative min-w-[11rem] shrink-0">
          <button
            type="button"
            id="calendar-view-trigger"
            aria-haspopup="listbox"
            aria-expanded={viewMenuOpen}
            aria-controls="calendar-view-listbox"
            onClick={() => setViewMenuOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-left shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#4318FF]/30"
          >
            <span className="text-xs font-bold text-[#2B3674]">
              {VIEW_OPTIONS.find((o) => o.value === view)?.label ?? "Two Days"}
            </span>
            <ChevronDown
              className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${viewMenuOpen ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
          {viewMenuOpen && (
            <div
              id="calendar-view-listbox"
              role="listbox"
              aria-labelledby="calendar-view-trigger"
              className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-gray-300 bg-white py-1 shadow-lg"
            >
              {VIEW_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={view === o.value}
                  onClick={() => switchView(o.value)}
                  className={`w-full px-3 py-2 text-left text-xs font-bold transition-colors ${
                    view === o.value
                      ? "bg-[#4318FF] text-white"
                      : "text-[#2B3674] hover:bg-[#F4F7FE]"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => nav(-1)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <span className="text-[13px] font-bold text-slate-700 min-w-[170px] text-center select-none">
            {headerLabel}
          </span>
          <button
            type="button"
            onClick={() => nav(1)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
          >
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Today */}
        <button
          type="button"
          onClick={goToday}
          className="text-xs font-bold text-[#4318FF] bg-[#EEF2FF] border border-[#c7d2fe] px-5 py-1.5 rounded-lg hover:bg-[#e0e7ff] transition-colors shadow-sm"
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
          completionKeys={completionKeys}
        />
      )}
      {view === "month" && (
        <MonthView
          anchorDate={anchorDate}
          todayStr={todayStr}
          meds={meds}
          events={events}
          agenda={agenda}
          completionKeys={completionKeys}
        />
      )}
    </div>
  );
}
