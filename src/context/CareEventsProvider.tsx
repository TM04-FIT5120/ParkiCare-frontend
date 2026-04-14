import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CareEventsContext,
  DEFAULT_EVENTS,
  DEFAULT_MEDS,
  type CareEvent,
  type Medication,
} from "@/context/careEventsContext";
import { careEventsService } from "@/services/careEvents";
import { drugsService } from "@/services/drugs";
import { useAuth } from "@/context/AuthContext";

export const CareEventsProvider = ({ children }: { children: ReactNode }) => {
  const { patient, user } = useAuth();
  const patientId = patient?.patientId ?? null;
  const caregiverId = user?.caregiverId ?? 0;

  const [loading, setLoading] = useState(false);
  const [meds, setMeds] = useState<Medication[]>(DEFAULT_MEDS);
  const [events, setEvents] = useState<CareEvent[]>(DEFAULT_EVENTS);

  const fetchFromApi = useCallback(async (pid: number) => {
    setLoading(true);
    try {
      const [apiMeds, apiHomeCare, apiOutdoor] = await Promise.all([
        careEventsService.getMedications(pid),
        careEventsService.getHomeCare(pid),
        careEventsService.getOutdoor(pid),
      ]);

      const drugNames = await Promise.all(
        apiMeds.map((m) =>
          drugsService.getDrugById(m.drugId).then((d) => d.drugName).catch(() => `Drug #${m.drugId}`)
        )
      );

      const mappedMeds: Medication[] = apiMeds.map((m, i) => ({
        id: m.remindId,
        remindId: m.remindId,
        drugId: m.drugId,
        name: drugNames[i],
        dose: m.dosage,
        frequency: m.frequency,
        time: m.remindTime,
        startDate: m.startDate,
        endDate: m.endDate ?? undefined,
        recurrence: m.recurrence ?? undefined,
      }));

      const mappedHome: CareEvent[] = apiHomeCare.map((h) => ({
        id: h.id,
        backendId: h.id,
        eventType: "home" as const,
        title: h.homeCareTitle,
        type: "Home Care",
        time: h.startDatetime.slice(11, 16),
        startDatetime: h.startDatetime,
        endDatetime: h.endDatetime,
        recurrence: h.recurrence,
        isPinned: h.isPinned ?? 0,
        note: h.careNote,
      }));

      const mappedOutdoor: CareEvent[] = apiOutdoor.map((o) => ({
        id: o.id + 100000,
        backendId: o.id,
        eventType: "outdoor" as const,
        title: o.outdoorTitle,
        type: "Outdoor",
        time: o.startDatetime.slice(11, 16),
        startDatetime: o.startDatetime,
        endDatetime: o.endDatetime,
        recurrence: o.recurrence,
        isPinned: o.isPinned ?? 0,
        note: o.prepareNote,
      }));

      setMeds(mappedMeds);
      setEvents([...mappedHome, ...mappedOutdoor]);
    } catch {
      // Backend unreachable, keep current state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (patientId) {
      fetchFromApi(patientId);
    } else {
      setMeds(DEFAULT_MEDS);
      setEvents(DEFAULT_EVENTS);
    }
  }, [patientId, fetchFromApi]);

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

  const refresh = useCallback(() => {
    if (patientId) fetchFromApi(patientId);
  }, [patientId, fetchFromApi]);

  const togglePin = useCallback(async (backendId: number, eventType: "home" | "outdoor") => {
    if (!caregiverId) return;
    // Optimistic update: flip isPinned immediately so the UI responds instantly
    setEvents((prev) =>
      prev.map((e) =>
        e.backendId === backendId && e.eventType === eventType
          ? { ...e, isPinned: e.isPinned === 1 ? 0 : 1 }
          : e
      )
    );
    try {
      if (eventType === "home") {
        await careEventsService.toggleHomeCarePin(backendId, caregiverId);
      } else {
        await careEventsService.toggleOutdoorPin(backendId, caregiverId);
      }
    } catch {
      // Revert on failure
      setEvents((prev) =>
        prev.map((e) =>
          e.backendId === backendId && e.eventType === eventType
            ? { ...e, isPinned: e.isPinned === 1 ? 0 : 1 }
            : e
        )
      );
    }
  }, [caregiverId]);

  const value = useMemo(
    () => ({
      patientId,
      loading,
      meds,
      addMed,
      deleteMed,
      events,
      addEvent,
      deleteEvent,
      togglePin,
      refresh,
    }),
    [patientId, loading, meds, events, addMed, deleteMed, addEvent, deleteEvent, togglePin, refresh],
  );

  return (
    <CareEventsContext.Provider value={value}>{children}</CareEventsContext.Provider>
  );
};
