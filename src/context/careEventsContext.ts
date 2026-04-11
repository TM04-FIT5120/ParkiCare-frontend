import { createContext } from "react";

export type Medication = {
  id: number;
  name: string;
  dose: string;
  frequency: string;
  time: string;
};

export type CareEvent = {
  id: number;
  title: string;
  type: string;
  time: string;
};

export type CareEventsContextValue = {
  meds: Medication[];
  addMed: (med: Omit<Medication, "id">) => void;
  deleteMed: (id: number) => void;
  events: CareEvent[];
  addEvent: (event: Omit<CareEvent, "id">) => void;
  deleteEvent: (id: number) => void;
};

export const DEFAULT_MEDS: Medication[] = [
  { id: 1, name: "Levodopa", dose: "100mg", frequency: "3 times/day", time: "08:00" },
  { id: 2, name: "Pramipexole", dose: "0.125mg", frequency: "1 time/day", time: "09:30" },
];

export const DEFAULT_EVENTS: CareEvent[] = [
  { id: 1, title: "Morning Bath", type: "Bathing", time: "09:00" },
  { id: 2, title: "Nursing Care Visit", type: "Nursing Care", time: "14:00" },
];

export const CareEventsContext = createContext<CareEventsContextValue | null>(null);
