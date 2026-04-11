import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CareEventsContext,
  DEFAULT_EVENTS,
  DEFAULT_MEDS,
  type CareEvent,
  type Medication,
} from "@/context/careEventsContext";

export const CareEventsProvider = ({ children }: { children: ReactNode }) => {
  const [meds, setMeds] = useState<Medication[]>(() => {
    const saved = localStorage.getItem("parkicare_meds");
    return saved ? (JSON.parse(saved) as Medication[]) : DEFAULT_MEDS;
  });

  const [events, setEvents] = useState<CareEvent[]>(() => {
    const saved = localStorage.getItem("parkicare_events");
    return saved ? (JSON.parse(saved) as CareEvent[]) : DEFAULT_EVENTS;
  });

  useEffect(() => {
    const stringified = JSON.stringify(meds);
    if (localStorage.getItem("parkicare_meds") !== stringified) {
      localStorage.setItem("parkicare_meds", stringified);
      window.dispatchEvent(new Event("parkicare_update"));
    }
  }, [meds]);

  useEffect(() => {
    const stringified = JSON.stringify(events);
    if (localStorage.getItem("parkicare_events") !== stringified) {
      localStorage.setItem("parkicare_events", stringified);
      window.dispatchEvent(new Event("parkicare_update"));
    }
  }, [events]);

  useEffect(() => {
    const handleUpdate = () => {
      const savedMeds = localStorage.getItem("parkicare_meds");
      if (savedMeds) {
        setMeds((prev) => (JSON.stringify(prev) === savedMeds ? prev : JSON.parse(savedMeds)));
      }
      const savedEvents = localStorage.getItem("parkicare_events");
      if (savedEvents) {
        setEvents((prev) =>
          JSON.stringify(prev) === savedEvents ? prev : JSON.parse(savedEvents),
        );
      }
    };
    window.addEventListener("parkicare_update", handleUpdate);
    return () => window.removeEventListener("parkicare_update", handleUpdate);
  }, []);

  const addMed = useCallback((med: Omit<Medication, "id">) => {
    setMeds((prev) => [...prev, { ...med, id: Date.now() }]);
  }, []);

  const deleteMed = useCallback((id: number) => {
    setMeds((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const addEvent = useCallback((event: Omit<CareEvent, "id">) => {
    setEvents((prev) => [...prev, { ...event, id: Date.now() }]);
  }, []);

  const deleteEvent = useCallback((id: number) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      meds,
      addMed,
      deleteMed,
      events,
      addEvent,
      deleteEvent,
    }),
    [meds, events, addMed, deleteMed, addEvent, deleteEvent],
  );

  return (
    <CareEventsContext.Provider value={value}>{children}</CareEventsContext.Provider>
  );
};
