import { createContext } from "react";

export type Medication = {
  id: number;
  planId?: number;          // shared across all reminders from the same medication plan
  remindId?: number;        // backend ID from /reminder/plan
  drugId?: number;          // backend drug reference ID
  name: string;
  dose: string;
  frequency: string;
  time: string;
  startDate?: string;       // "YYYY-MM-DD": when this plan starts
  endDate?: string;         // "YYYY-MM-DD": when this plan ends (undefined = ongoing)
  recurrence?: string;      // "none" | "daily" | "weekdays" | "weekly"
};

export type CareEvent = {
  id: number;
  backendId?: number;               // backend ID from /homeCare or /outdoor
  eventType?: "home" | "outdoor";   // which backend table it belongs to
  title: string;
  type: string;
  time: string;
  startDatetime?: string;           // full ISO string e.g. "2026-04-12T09:00:00"
  endDatetime?: string;             // full ISO string e.g. "2026-04-12T10:00:00"
  recurrence?: string;              // "none" | "daily" | "weekdays" | "weekly"
  isPinned?: number;                // 1 = pinned, 0 = not pinned
  note?: string;                    // careNote or prepareNote for history display
};

export type CareEventsContextValue = {
  patientId: number | null;
  loading: boolean;
  meds: Medication[];
  addMed: (med: Omit<Medication, "id">) => void;
  deleteMed: (id: number) => void;
  events: CareEvent[];
  addEvent: (event: Omit<CareEvent, "id">) => void;
  deleteEvent: (id: number) => void;
  togglePin: (backendId: number, eventType: "home" | "outdoor") => Promise<void>;
  refresh: () => void;
};

export const DEFAULT_MEDS: Medication[] = [];

export const DEFAULT_EVENTS: CareEvent[] = [];

export const CareEventsContext = createContext<CareEventsContextValue | null>(null);
