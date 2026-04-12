import { createContext } from "react";

export type Medication = {
  id: number;
  remindId?: number;        // backend ID from /reminder/plan
  drugId?: number;          // backend drug reference ID
  name: string;
  dose: string;
  frequency: string;
  time: string;
  startDate?: string;       // "YYYY-MM-DD" — when this plan starts (recurring from this date)
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
  refresh: () => void;
};

export const DEFAULT_MEDS: Medication[] = [];

export const DEFAULT_EVENTS: CareEvent[] = [];

export const CareEventsContext = createContext<CareEventsContextValue | null>(null);
