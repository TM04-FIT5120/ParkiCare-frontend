/**
 * Whether a recurring (or one-off) event should appear on dayStr ("YYYY-MM-DD").
 * Matches CalendarWidget semantics for home/outdoor/meds/caregiver series.
 */
export function isEventOnDay(
  dayStr: string,
  startDate: string,
  endDate: string | undefined | null,
  recurrence: string | undefined | null,
): boolean {
  if (dayStr < startDate) return false;

  const rec = (recurrence ?? "none").toLowerCase();

  if (rec === "none" || rec === "") {
    return dayStr === startDate;
  }

  if (endDate && endDate > startDate && dayStr > endDate) return false;

  const dow = new Date(dayStr + "T00:00:00").getDay();
  const startDow = new Date(startDate + "T00:00:00").getDay();

  if (rec === "daily") return true;
  if (rec === "weekdays") return dow >= 1 && dow <= 5;
  if (rec === "weekly") return dow === startDow;

  return dayStr === startDate;
}

/** Malaysia (UTC+8) calendar date string for "today". */
export function getMYTDateString(): string {
  const utc = Date.now() + new Date().getTimezoneOffset() * 60_000;
  const myt = new Date(utc + 8 * 3_600_000);
  const y = myt.getFullYear();
  const m = String(myt.getMonth() + 1).padStart(2, "0");
  const d = String(myt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Calendar date string in MYT, shifted by whole days from "now" in MYT. */
export function addDaysMYT(delta: number): string {
  const utc = Date.now() + new Date().getTimezoneOffset() * 60_000;
  const myt = new Date(utc + 8 * 3_600_000);
  myt.setDate(myt.getDate() + delta);
  const y = myt.getFullYear();
  const m = String(myt.getMonth() + 1).padStart(2, "0");
  const d = String(myt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function occurrenceIsoForDay(dayStr: string, timeHHmm: string): string {
  const t = timeHHmm.length === 5 ? `${timeHHmm}:00` : timeHHmm;
  return `${dayStr}T${t}`;
}

/** Normalize API / UI occurrence strings so Set lookup is stable (always HH:mm:ss). */
export function normalizeOccurrenceStart(s: string): string {
  const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return s;
  const sec = (m[4] ?? "00").slice(0, 2).padStart(2, "0");
  return `${m[1]}T${m[2]}:${m[3]}:${sec}`;
}

export type EventOccurrenceSourceType =
  | "CAREGIVER_SCHEDULE"
  | "PATIENT_HOME_CARE"
  | "PATIENT_OUTDOOR"
  | "MEDICATION_PLAN";

export function completionLookupKey(
  sourceType: EventOccurrenceSourceType,
  sourceId: number,
  occurrenceStart: string,
): string {
  return `${sourceType}|${sourceId}|${normalizeOccurrenceStart(occurrenceStart)}`;
}
