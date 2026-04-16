import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import {
  Calendar as CalendarIcon,
  Clock,
  Pill,
  Plus,
  CheckCircle2,
  Circle,
  Activity,
  Heart,
  X,
  MapPin,
  Trash2,
  Loader2,
  Bell,
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
import { useAuth } from "@/context/AuthContext";
import { useMedicationAlert, useMedicationAlertSnoozeScheduler } from "@/context/MedicationAlertContext";
import { CalendarWidget } from "@/components/CalendarWidget";
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

const HOURS = ["01","02","03","04","05","06","07","08","09","10","11","12"];
const MINUTES = ["00","05","10","15","20","25","30","35","40","45","50","55"];

function to24h(hour: string, minute: string, period: string): string {
  let h = parseInt(hour, 10);
  if (period === "AM" && h === 12) h = 0;
  if (period === "PM" && h !== 12) h += 12;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

function getDayName(dateStr: string): string {
  if (!dateStr) return "Sunday";
  return new Date(dateStr).toLocaleDateString("en-US", { weekday: "long" });
}

function formatDisplayTime(hour: string, minute: string, period: string): string {
  return `${hour}:${minute} ${period}`;
}

function resolveOutdoorSourceId(e: CareEvent): number {
  if (e.backendId != null) return e.backendId;
  if (e.id > 100_000) return e.id - 100_000;
  return e.id;
}

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

export function DashboardPage() {
  const { meds: patientMedications, events: patientEventsStore, deleteMed, deleteEvent } = useCareEvents();
  const navigate = useNavigate();
  const { user } = useAuth();
  const caregiverId = user?.caregiverId ?? 0;

  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventStartDate, setNewEventStartDate] = useState(() => getMYTDateString());
  const [newEventIsNeverEnding, setNewEventIsNeverEnding] = useState(true);
  const [newEventEndDate, setNewEventEndDate] = useState("");
  const [newEventRecurrence, setNewEventRecurrence] = useState<"daily" | "weekdays" | "weekly" | "none">("none");
  const [newEventTimeHour, setNewEventTimeHour] = useState("08");
  const [newEventTimeMinute, setNewEventTimeMinute] = useState("00");
  const [newEventTimePeriod, setNewEventTimePeriod] = useState("AM");
  const [newEventEndTimeHour, setNewEventEndTimeHour] = useState("09");
  const [newEventEndTimeMinute, setNewEventEndTimeMinute] = useState("00");
  const [newEventEndTimePeriod, setNewEventEndTimePeriod] = useState("AM");
  const [confirmRow, setConfirmRow] = useState<DashboardScheduleRow | null>(null);
  const [confirmMode, setConfirmMode] = useState<"complete" | "undo" | null>(null);
  const [completionKeys, setCompletionKeys] = useState<Set<string>>(() => new Set());
  const [isCompletionsLoading, setIsCompletionsLoading] = useState(true);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [deletingKeys, setDeletingKeys] = useState<Set<string>>(new Set());
  const [pendingCount, setPendingCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [isAlertConfirming, setIsAlertConfirming] = useState(false);

  const { pendingAlert, dismissAlert } = useMedicationAlert();
  const scheduleAlertReshow = useMedicationAlertSnoozeScheduler();

  const [agenda, setAgenda] = useState<
    {
      id: number;
      title: string;
      time: string;
      startDatetime: string;
      endDatetime: string;
      recurrence: string | null;
    }[]
  >([]);

  const refreshCompletions = useCallback(async () => {
    if (!caregiverId) return;
    try {
      const from = addDaysMYT(-14);
      const to = addDaysMYT(60);
      const list = await listCaregiverEventOccurrences(caregiverId, from, to);
      const next = new Set<string>();
      for (const o of list) {
        if (o.completed !== 1) continue;
        next.add(
          completionLookupKey(
            o.sourceType as EventOccurrenceSourceType,
            o.sourceId,
            o.occurrenceStart,
          ),
        );
      }
      setCompletionKeys(next);
    } catch {
      // keep existing keys on failure
    } finally {
      setIsCompletionsLoading(false);
    }
  }, [caregiverId]);

  // Fetch caregiver schedules + dashboard summary from API on mount
  useEffect(() => {
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

    dashboardService.getPendingTasks(caregiverId).then((tasks) => setPendingCount(tasks.length)).catch(() => {});
    dashboardService.getOverdueTasks(caregiverId).then((tasks) => setOverdueCount(tasks.length)).catch(() => {});
  }, [caregiverId]);

  useEffect(() => {
    refreshCompletions();
  }, [refreshCompletions]);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle) return;

    const startTime24 = to24h(newEventTimeHour, newEventTimeMinute, newEventTimePeriod);
    const endTime24 = to24h(newEventEndTimeHour, newEventEndTimeMinute, newEventEndTimePeriod);
    const startDatetime = `${newEventStartDate}T${startTime24}:00`;
    const endDateBase = (!newEventIsNeverEnding && newEventEndDate) ? newEventEndDate : newEventStartDate;
    const endDatetime = `${endDateBase}T${endTime24}:00`;
    const recurrence = newEventRecurrence !== "none" ? newEventRecurrence : null;

    setIsAddingEvent(true);
    try {
      const created = await caregiverScheduleService.createSchedule(
        caregiverId,
        newEventTitle,
        startDatetime,
        endDatetime,
        "",
        recurrence,
      );
      setAgenda((prev) =>
        [...prev, {
          id: created.id,
          title: created.scheduleTitle,
          time: startTime24,
          startDatetime,
          endDatetime,
          recurrence: created.recurrence ?? null,
        }].sort((a, b) => a.time.localeCompare(b.time)),
      );
      toast.success("Event added successfully");
    } catch {
      setAgenda((prev) =>
        [...prev, {
          id: Date.now(),
          title: newEventTitle,
          time: startTime24,
          startDatetime,
          endDatetime,
          recurrence: recurrence ?? null,
        }].sort((a, b) => a.time.localeCompare(b.time)),
      );
      toast.success("Event added locally");
    }

    setNewEventTitle("");
    setNewEventStartDate(getMYTDateString());
    setNewEventIsNeverEnding(true);
    setNewEventEndDate("");
    setNewEventRecurrence("none");
    setNewEventTimeHour("08");
    setNewEventTimeMinute("00");
    setNewEventTimePeriod("AM");
    setNewEventEndTimeHour("09");
    setNewEventEndTimeMinute("00");
    setNewEventEndTimePeriod("AM");
    setIsAddingEvent(false);
  };

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
      setCompletionKeys((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
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
      dashboardService.getPendingTasks(caregiverId).then((tasks) => setPendingCount(tasks.length)).catch(() => {});
      dashboardService.getOverdueTasks(caregiverId).then((tasks) => setOverdueCount(tasks.length)).catch(() => {});
    } catch (err) {
      setCompletionKeys(snapshot);
      toast.error(err instanceof Error ? err.message : "Could not save completion");
    } finally {
      setIsConfirming(false);
    }
    setConfirmRow(null);
    setConfirmMode(null);
  };

  const handleCancelComplete = () => {
    setConfirmRow(null);
    setConfirmMode(null);
  };

  // ── Medication alert modal handlers ──────────────────────────────────────────

  const handleAlertConfirm = async () => {
    if (!pendingAlert || !caregiverId) return;
  
    const remindId = Number(pendingAlert.remindId);
    const alertCaregiverId = Number(pendingAlert.caregiverId);
  
    // Match the same occurrence-key logic used by Caregiver Schedule click-confirm flow.
    const med = patientMedications.find((m) => (m.remindId ?? m.id) === remindId);
    const occurrenceStart = med?.time ? occurrenceIsoForDay(viewDay, med.time) : null;
    const completionKey = occurrenceStart
      ? completionLookupKey("MEDICATION_PLAN", remindId, occurrenceStart)
      : null;
  
    // Optimistic UI update so calendar + caregiver schedule reflect completion immediately.
    const snapshot = new Set(completionKeys);
    if (completionKey) {
      setCompletionKeys((prev) => {
        const next = new Set(prev);
        next.add(completionKey);
        return next;
      });
    }
  
    setIsAlertConfirming(true);
    try {
      // Keep existing reminder-status update for pending/overdue counters.
      await careEventsService.confirmMedication(remindId, alertCaregiverId);
  
      // Persist occurrence completion exactly like Yes-Complete in Caregiver Schedule.
      if (occurrenceStart) {
        await upsertCaregiverEventOccurrence({
          caregiverId,
          sourceType: "MEDICATION_PLAN",
          sourceId: remindId,
          occurrenceStart,
          completed: true,
        });
      }
  
      dashboardService.getPendingTasks(caregiverId).then((t) => setPendingCount(t.length)).catch(() => {});
      dashboardService.getOverdueTasks(caregiverId).then((t) => setOverdueCount(t.length)).catch(() => {});
      toast.success("Medication administration confirmed!");
      dismissAlert();
    } catch {
      // Roll back optimistic key if anything failed.
      setCompletionKeys(snapshot);
      toast.error("Could not confirm. Please try again.");
    } finally {
      setIsAlertConfirming(false);
    }
  };

  const handleAlertSnooze = async () => {
    if (!pendingAlert) return;
    const snapshot = { ...pendingAlert };
    dismissAlert(); // hide modal immediately so the user can continue
    try {
      await careEventsService.snoozeMedication(
        Number(snapshot.remindId),
        Number(snapshot.caregiverId),
      );
    } catch {
      // non-critical — backend will retry via FCM; silent fail is acceptable
    }
    // Client-side safety net: re-show modal in 5 min if FCM re-fire is delayed.
    // The backend's snooze endpoint will also re-fire FCM after 5 min, which
    // calls dispatchAlert again — the context deduplicates by remindId.
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
        const ev = patientEventsStore.find((e) => (e.backendId != null ? e.backendId : e.id > 100_000 ? e.id - 100_000 : e.id) === item.sourceId);
        if (ev) deleteEvent(ev.id);
      }
      toast.success("Event deleted");
    } catch {
      toast.error("Could not delete event");
    } finally {
      setDeletingKeys((prev) => { const s = new Set(prev); s.delete(item.rowKey); return s; });
    }
  }, [caregiverId, patientMedications, patientEventsStore, deleteMed, deleteEvent]);

  const viewDay = getMYTDateString();

  const caregiverSchedule = useMemo((): DashboardScheduleRow[] => {
    const rows: DashboardScheduleRow[] = [];

    for (const item of agenda) {
      const startDate = item.startDatetime.slice(0, 10);
      const endDatePart = item.endDatetime?.slice(0, 10);
      const seriesEndDate =
        endDatePart && endDatePart > startDate ? endDatePart : undefined;
      const rec = item.recurrence ?? "none";
      if (!isEventOnDay(viewDay, startDate, seriesEndDate, rec)) continue;
      const startTime = item.startDatetime.slice(11, 16);
      const occurrenceStart = occurrenceIsoForDay(viewDay, startTime);
      const rowKey = completionLookupKey("CAREGIVER_SCHEDULE", item.id, occurrenceStart);
      rows.push({
        rowKey,
        sourceType: "CAREGIVER_SCHEDULE",
        sourceId: item.id,
        occurrenceStart,
        title: item.title,
        time: item.time,
        completed: completionKeys.has(rowKey),
        source: "caregiver",
      });
    }

    for (const med of patientMedications) {
      if (!med.time) continue;
      const startDate = med.startDate ?? viewDay;
      const medRecurrence = resolveMedicationRecurrence(
        med.recurrence,
        startDate,
        med.endDate ?? null,
      );
      if (!isEventOnDay(viewDay, startDate, med.endDate, medRecurrence)) continue;
      const sid = med.remindId ?? med.id;
      const occurrenceStart = occurrenceIsoForDay(viewDay, med.time);
      const rowKey = completionLookupKey("MEDICATION_PLAN", sid, occurrenceStart);
      rows.push({
        rowKey,
        sourceType: "MEDICATION_PLAN",
        sourceId: sid,
        occurrenceStart,
        title: `${med.name}${med.dose ? ` · ${med.dose}` : ""}`,
        time: med.time,
        completed: completionKeys.has(rowKey),
        source: "medication",
      });
    }

    for (const ev of patientEventsStore) {
      if (!ev.startDatetime) continue;
      const startDate = ev.startDatetime.slice(0, 10);
      const endDatePart = ev.endDatetime?.slice(0, 10);
      const seriesEndDate =
        endDatePart && endDatePart > startDate ? endDatePart : undefined;
      if (!isEventOnDay(viewDay, startDate, seriesEndDate, ev.recurrence)) continue;
      const startTime = ev.startDatetime.slice(11, 16);
      const occurrenceStart = occurrenceIsoForDay(viewDay, startTime);
      const isOutdoor = ev.eventType === "outdoor";
      const sourceType: EventOccurrenceSourceType = isOutdoor
        ? "PATIENT_OUTDOOR"
        : "PATIENT_HOME_CARE";
      const sourceId = isOutdoor ? resolveOutdoorSourceId(ev) : (ev.backendId ?? ev.id);
      const rowKey = completionLookupKey(sourceType, sourceId, occurrenceStart);
      rows.push({
        rowKey,
        sourceType,
        sourceId,
        occurrenceStart,
        title: ev.title,
        time: ev.time ?? startTime,
        completed: completionKeys.has(rowKey),
        source: isOutdoor ? "outdoor" : "home",
      });
    }

    return rows.sort((a, b) => a.time.localeCompare(b.time));
  }, [agenda, patientMedications, patientEventsStore, completionKeys, viewDay]);

  const confirmTaskTitle = confirmRow?.title;

  return (
    <>
      {/* Full Width Calendar at Top */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="mb-8"
      >
        <CalendarWidget
          meds={patientMedications}
          events={patientEventsStore}
          agenda={agenda}
          completionKeys={completionKeys}
        />
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        
        {/* Left: My Agenda */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-6"
        >
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <div className="w-8 h-8 rounded-lg bg-[#E9E3FF] flex items-center justify-center">
              <CalendarIcon className="w-4 h-4 text-[#4318FF]" />
            </div>
            <h2 className="text-xl font-bold text-[#2B3674]">My Agenda</h2>
            {pendingCount > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full">
                {pendingCount} pending
              </span>
            )}
            {overdueCount > 0 && (
              <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-bold rounded-full">
                {overdueCount} overdue
              </span>
            )}
          </div>

          <div className="bg-white rounded-[20px] p-6 shadow-[0_18px_40px_rgba(112,144,176,0.12)]">
            
            {/* Caregiver Schedule - MOVED TO TOP */}
            <div className="mb-8">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#A3AED0] mb-4 ml-1">Caregiver Schedule</h3>
              <div className="space-y-3">
                {isCompletionsLoading ? (
                  [0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-[20px] bg-white border border-[#E0E5F2] animate-pulse">
                      <div className="shrink-0 w-9 h-9 rounded-xl bg-[#E0E5F2]" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 bg-[#E0E5F2] rounded-md w-3/5" />
                        <div className="h-3 bg-[#E0E5F2] rounded-md w-1/4" />
                      </div>
                    </div>
                  ))
                ) : caregiverSchedule.length === 0 ? (
                  <p className="text-sm text-[#A3AED0] text-center py-8 bg-[#F4F7FE] rounded-[20px] font-bold">No tasks scheduled.</p>
                ) : (
                  caregiverSchedule.map((item) => {
                    const isCaregiver = item.source === "caregiver";
                    const sourceIcon = item.source === "medication"
                      ? <Circle className="w-4 h-4 text-[#4318FF]" />
                      : item.source === "outdoor"
                      ? <Circle className="w-4 h-4 text-blue-500" />
                      : <Circle className="w-4 h-4 text-orange-500" />;
                    const sourceBadge = item.source === "medication"
                      ? { label: "Medication", cls: "text-[#4318FF] bg-[#E9E3FF]" }
                      : item.source === "outdoor"
                      ? { label: "Outdoor", cls: "text-blue-600 bg-blue-50" }
                      : item.source === "home"
                      ? { label: "Care", cls: "text-orange-600 bg-orange-50" }
                      : null;

                    const rowClasses = `flex items-center gap-4 p-4 pr-12 rounded-[20px] transition-all w-full text-left cursor-pointer ${
                      item.completed
                        ? "bg-[#F4F7FE]"
                        : "bg-white border border-[#E0E5F2] hover:border-[#4318FF]/30 hover:shadow-md hover:-translate-y-0.5"
                    }`;

                    return (
                      <div key={item.rowKey} className="relative group">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => handleTaskClick(item)}
                          onKeyDown={(e) => e.key === "Enter" && handleTaskClick(item)}
                          className={rowClasses}
                        >
                          <div className="shrink-0 w-9 h-9 rounded-xl bg-[#F4F7FE] flex items-center justify-center">
                            {item.completed
                              ? <CheckCircle2 className="w-5 h-5 text-[#4318FF]" />
                              : isCaregiver
                              ? <Circle className="w-4 h-4 text-[#A3AED0] group-hover:text-[#4318FF] transition-colors" />
                              : sourceIcon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className={`font-bold text-[15px] truncate ${item.completed ? "text-[#A3AED0] line-through" : "text-[#2B3674]"}`}>
                              {item.title}
                            </h4>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                              <p className="text-xs font-bold text-[#A3AED0] flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 shrink-0" />
                                {item.time}
                              </p>
                              {item.completed && (
                                <span className="text-[10px] font-bold uppercase tracking-wide text-[#4318FF] bg-[#E9E3FF] px-2 py-0.5 rounded-md">
                                  Completed
                                </span>
                              )}
                            </div>
                          </div>
                          {sourceBadge && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 ${sourceBadge.cls}`}>
                              {sourceBadge.label}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteItem(item); }}
                          disabled={deletingKeys.has(item.rowKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                          aria-label="Delete event"
                        >
                          {deletingKeys.has(item.rowKey)
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Schedule New Event Form */}
            <div className="p-5 bg-[#F4F7FE] rounded-[20px] border-none">
              <h3 className="font-bold text-[#2B3674] mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#4318FF]" /> Schedule New Event
              </h3>
              <form onSubmit={handleAddEvent} className="space-y-4">
                {/* Event Name */}
                <div>
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-wider mb-2 block ml-1">Event Name</label>
                  <input
                    type="text"
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                    placeholder="e.g., Grocery Shopping"
                    className="w-full px-4 py-3 bg-white border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50 transition-all shadow-sm placeholder:text-[#A3AED0]"
                    required
                  />
                </div>

                {/* Start Date */}
                <div>
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">
                    <CalendarIcon className="w-3.5 h-3.5 inline mr-1" />Start Date
                  </label>
                  <input
                    type="date"
                    value={newEventStartDate}
                    onChange={(e) => setNewEventStartDate(e.target.value)}
                    className="w-full px-4 py-3 bg-white border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50 transition-all shadow-sm"
                  />
                </div>

                {/* End date toggle */}
                <div
                  className="flex items-center justify-between p-4 bg-white rounded-xl cursor-pointer select-none shadow-sm"
                  onClick={() => {
                    const turningOn = newEventIsNeverEnding;
                    setNewEventIsNeverEnding(v => !v);
                    setNewEventRecurrence(turningOn ? "daily" : "none");
                  }}
                >
                  <div>
                    <p className="text-sm font-bold text-[#2B3674]">End date</p>
                    <p className="text-xs text-[#A3AED0] mt-0.5">Set an end date for this event</p>
                  </div>
                  <div className={`w-11 h-6 rounded-full transition-all relative ${!newEventIsNeverEnding ? "bg-[#4318FF]" : "bg-[#E0E5F2]"}`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${!newEventIsNeverEnding ? "left-6" : "left-1"}`} />
                  </div>
                </div>

                {/* End Date */}
                {!newEventIsNeverEnding && (
                  <div>
                    <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 block ml-1">End Date</label>
                    <input
                      type="date"
                      value={newEventEndDate}
                      min={newEventStartDate}
                      onChange={(e) => setNewEventEndDate(e.target.value)}
                      className="w-full px-4 py-3 bg-white border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50 transition-all shadow-sm"
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
                      { value: "weekly", label: `Weekly on ${getDayName(newEventStartDate)}` },
                      { value: "none", label: "No repeat" },
                    ] as { value: "daily" | "weekdays" | "weekly" | "none"; label: string }[]).map(opt => {
                      const disabled = newEventIsNeverEnding ? opt.value !== "none" : opt.value === "none";
                      return (
                        <label
                          key={opt.value}
                          className={`flex items-center gap-3 p-3.5 rounded-xl transition-all ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} ${newEventRecurrence === opt.value ? "bg-[#E9E3FF] border border-[#4318FF]/30" : disabled ? "bg-white shadow-sm" : "bg-white hover:bg-[#E9E3FF]/50 shadow-sm"}`}
                        >
                          <input
                            type="radio"
                            name="newEventRecurrence"
                            value={opt.value}
                            checked={newEventRecurrence === opt.value}
                            onChange={() => setNewEventRecurrence(opt.value)}
                            disabled={disabled}
                            className="accent-[#4318FF] w-4 h-4"
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
                    Event Time - {formatDisplayTime(newEventTimeHour, newEventTimeMinute, newEventTimePeriod)}
                  </label>
                  <div className="p-4 bg-white rounded-xl shadow-sm">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Hour</p>
                        <select
                          value={newEventTimeHour}
                          onChange={(e) => setNewEventTimeHour(e.target.value)}
                          className="w-full px-2 py-2.5 bg-[#F4F7FE] border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50"
                        >
                          {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Minute</p>
                        <select
                          value={newEventTimeMinute}
                          onChange={(e) => setNewEventTimeMinute(e.target.value)}
                          className="w-full px-2 py-2.5 bg-[#F4F7FE] border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50"
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
                              onClick={() => setNewEventTimePeriod(p)}
                              className={`flex-1 py-2.5 text-xs font-bold transition-all ${newEventTimePeriod === p ? "bg-[#4318FF] text-white" : "bg-white text-[#A3AED0] hover:bg-[#F4F7FE]"}`}
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
                    End Time - {formatDisplayTime(newEventEndTimeHour, newEventEndTimeMinute, newEventEndTimePeriod)}
                  </label>
                  <div className="p-4 bg-white rounded-xl shadow-sm">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Hour</p>
                        <select
                          value={newEventEndTimeHour}
                          onChange={(e) => setNewEventEndTimeHour(e.target.value)}
                          className="w-full px-2 py-2.5 bg-[#F4F7FE] border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50"
                        >
                          {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-[#A3AED0] mb-1.5 uppercase tracking-widest">Minute</p>
                        <select
                          value={newEventEndTimeMinute}
                          onChange={(e) => setNewEventEndTimeMinute(e.target.value)}
                          className="w-full px-2 py-2.5 bg-[#F4F7FE] border border-[#E0E5F2] rounded-lg text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50"
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
                              onClick={() => setNewEventEndTimePeriod(p)}
                              className={`flex-1 py-2.5 text-xs font-bold transition-all ${newEventEndTimePeriod === p ? "bg-[#4318FF] text-white" : "bg-white text-[#A3AED0] hover:bg-[#F4F7FE]"}`}
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
                  disabled={isAddingEvent}
                  className="w-full py-3 mt-2 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isAddingEvent && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isAddingEvent ? "Adding..." : "Add Event"}
                </button>
              </form>
            </div>

          </div>
        </motion.div>

        {/* Right: Patient Care Information */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="space-y-6"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#E9E3FF] flex items-center justify-center">
              <Activity className="w-4 h-4 text-[#4318FF]" />
            </div>
            <h2 className="text-xl font-bold text-[#2B3674]">Patient Care</h2>
          </div>

          {/* Medication List */}
          <div className="bg-white rounded-[20px] p-6 shadow-[0_18px_40px_rgba(112,144,176,0.12)]">
            <h3 className="text-lg font-bold text-[#2B3674] mb-4 flex items-center gap-2">
              <Pill className="w-5 h-5 text-[#4318FF]" />
              Medication List
            </h3>
            <div className="space-y-3">
              {patientMedications.length > 0 ? (
                patientMedications.map(med => (
                  <div key={med.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#F4F7FE] hover:shadow-sm transition-all">
                    <Pill className="w-5 h-5 text-[#A3AED0]" />
                    <div className="flex-1">
                      <h4 className="font-bold text-[#2B3674] text-sm">{med.name}</h4>
                      <p className="text-xs text-[#A3AED0] font-bold mt-0.5">{med.dose} • {med.frequency}</p>
                    </div>
                    <span className="text-xs font-bold text-[#4318FF] bg-[#E9E3FF] px-3 py-1 rounded-lg">
                      {med.time}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#A3AED0] font-bold text-center py-4">No medications scheduled</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate('/care-events')}
              className="w-full mt-4 py-2.5 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white text-sm font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98]"
            >
              Add More
            </button>
          </div>

          {/* Daily Care List */}
          <div className="bg-white rounded-[20px] p-6 shadow-[0_18px_40px_rgba(112,144,176,0.12)]">
            <h3 className="text-lg font-bold text-[#2B3674] mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-orange-500" />
              Daily Care List
            </h3>
            <div className="space-y-3">
              {patientEventsStore.filter(ev => ev.eventType === "home").length > 0 ? (
                patientEventsStore.filter(ev => ev.eventType === "home").map((ev, index) => (
                  <div key={`care-${ev.id || index}`} className="flex items-center gap-3 p-3 rounded-xl bg-[#F4F7FE] hover:shadow-sm transition-all">
                    <Heart className="w-5 h-5 text-[#A3AED0]" />
                    <div className="flex-1">
                      <h4 className="font-bold text-[#2B3674] text-sm">{ev.title}</h4>
                    </div>
                    <span className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-lg">
                      {ev.time}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#A3AED0] font-bold text-center py-4">No care events scheduled</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate('/care-events')}
              className="w-full mt-4 py-2.5 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white text-sm font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98]"
            >
              Add More
            </button>
          </div>

          {/* Upcoming Plans */}
          <div className="bg-white rounded-[20px] p-6 shadow-[0_18px_40px_rgba(112,144,176,0.12)]">
            <h3 className="text-lg font-bold text-[#2B3674] mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#4318FF]" />
              Outdoor Event List
            </h3>
            <div className="space-y-3">
              {patientEventsStore.filter(ev => ev.eventType === "outdoor").length > 0 ? (
                patientEventsStore.filter(ev => ev.eventType === "outdoor").map((ev, index) => (
                  <div key={`outdoor-${ev.id || index}`} className="flex items-center gap-3 p-3 rounded-xl bg-[#F4F7FE] hover:shadow-sm transition-all">
                    <MapPin className="w-5 h-5 text-[#A3AED0]" />
                    <div className="flex-1">
                      <h4 className="font-bold text-[#2B3674] text-sm">{ev.title}</h4>
                    </div>
                    <span className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-lg">
                      {ev.time}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#A3AED0] font-bold text-center py-4">No outdoor events scheduled</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate('/care-events')}
              className="w-full mt-4 py-2.5 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white text-sm font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98]"
            >
              Add More
            </button>
          </div>

        </motion.div>

      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmRow !== null && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancelComplete}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            
            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md pointer-events-auto"
            >
              <div className="bg-white rounded-[20px] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.2)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-[#2B3674]">
                    {confirmMode === "undo" ? "Undo Task?" : "Complete Task?"}
                  </h3>
                  <button
                    type="button"
                    onClick={handleCancelComplete}
                    className="p-2 hover:bg-[#F4F7FE] rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-[#A3AED0]" />
                  </button>
                </div>

                <p className="text-sm text-[#A3AED0] font-bold mb-2">
                  {confirmTaskTitle && (
                    <span className="block text-[#2B3674] mb-3">{confirmTaskTitle}</span>
                  )}
                  {confirmMode === "undo"
                    ? "Mark this task as incomplete again?"
                    : "Mark this task as complete?"}
                </p>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCancelComplete}
                    disabled={isConfirming}
                    className="flex-1 py-3 bg-[#F4F7FE] hover:bg-[#E9E3FF] text-[#4318FF] font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmComplete}
                    disabled={isConfirming}
                    className="flex-1 py-3 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isConfirming && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isConfirming ? "Processing..." : confirmMode === "undo" ? "Yes, Undo" : "Yes, Complete"}
                  </button>
                </div>
              </div>
            </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* ── Medication Alert Modal (blocking) ──────────────────────────────────
           Shown whenever a medication reminder FCM message arrives.
           Blocks all UI until the caregiver confirms or snoozes.
      ──────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {pendingAlert && (
          <>
            {/* Full-screen backdrop — covers everything, blocks all interaction */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999]"
            />

            {/* Modal card */}
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 24 }}
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
                className="w-full max-w-md pointer-events-auto"
              >
                <div className="bg-white rounded-[24px] shadow-[0_32px_80px_rgba(0,0,0,0.25)] overflow-hidden">
                  {/* Header band */}
                  <div className="bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] px-8 py-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                      <Bell className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-white/70 uppercase tracking-widest">{pendingAlert.title}</p>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="px-8 py-6">
                    <p className="text-sm text-[#A3AED0] font-bold mb-2">Time to administer:</p>
                    <p className="text-[#2B3674] font-bold text-base leading-relaxed">{pendingAlert.body}</p>

                    <p className="mt-5 text-sm text-[#A3AED0] font-bold">
                      Please confirm or snooze to continue using the app.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="px-8 pb-8 flex gap-4">
                    <button
                      type="button"
                      onClick={handleAlertSnooze}
                      disabled={isAlertConfirming}
                      className="flex-1 py-4 px-6 bg-[#F4F7FE] hover:bg-[#E9E3FF] text-[#4318FF] font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-base"
                    >
                      Snooze 5 min
                    </button>
                    <button
                      type="button"
                      onClick={handleAlertConfirm}
                      disabled={isAlertConfirming}
                      className="flex-1 py-4 px-6 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
                    >
                      {isAlertConfirming && <Loader2 className="w-5 h-5 animate-spin" />}
                      {isAlertConfirming ? "Confirming…" : "Confirm Administration"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}