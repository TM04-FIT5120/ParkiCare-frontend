import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CareEventsContext,
  DEFAULT_EVENTS,
  DEFAULT_MEDS,
  type CareEvent,
  type Medication,
} from "@/context/careEventsContext";
import { useLanguage } from "@/context/LanguageContext";
import { careEventsService, type MedicationPlan } from "@/services/careEvents";
import { drugsService } from "@/services/drugs";
import { patientService } from "@/services/patient";
import { useAuth } from "@/context/AuthContext";

function normalizeMedTime(raw?: string | null): string {
  if (!raw) return "";
  const part = raw.includes("T") ? raw.slice(11) : raw;
  const [hh, mm] = part.split(":");
  if (!hh || !mm) return "";
  return `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}`;
}

function mapMedicationPlan(m: MedicationPlan, drugName: string): Medication {
  return {
    id: m.remindId,
    planId: m.planId,
    remindId: m.remindId,
    drugId: m.drugId,
    name: drugName,
    dose: m.dosage,
    frequency: m.frequency,
    time: normalizeMedTime(m.time ?? m.adminTime ?? m.remindTime),
    startDate: m.date ?? m.startDate,
    endDate: m.endDate ?? undefined,
    recurrence: m.recurrence ?? undefined,
  };
}

export const CareEventsProvider = ({ children }: { children: ReactNode }) => {
  const { patient, user, setPatient } = useAuth();
  const { currentLang } = useLanguage();
  const patientId = patient?.patientId ?? null;
  const caregiverId = user?.caregiverId ?? 0;

  // Re-sync patient id if localStorage is stale (e.g. DB reset) — avoids FK errors on medication save.
  useEffect(() => {
    if (!caregiverId) return;
    patientService.getPatientsByCaregiver(caregiverId).then((patients) => {
      if (patients.length === 0) {
        if (patientId != null) setPatient(null);
        return;
      }
      const match = patientId != null ? patients.find((p) => p.id === patientId) : null;
      if (!match) {
        const p = patients[0];
        setPatient({
          patientId: p.id,
          patientNickname: p.patientNickname,
          patientAge: p.ageRange,
        });
      }
    }).catch(() => { /* keep cached patient on network error */ });
  }, [caregiverId, patientId, setPatient]);

  const [loading, setLoading] = useState(false);
  const [meds, setMeds] = useState<Medication[]>(DEFAULT_MEDS);
  const [events, setEvents] = useState<CareEvent[]>(DEFAULT_EVENTS);

  const fetchFromApi = useCallback(async (pid: number) => {
    setLoading(true);
    try {
      const [medsResult, homeResult, outdoorResult] = await Promise.allSettled([
        careEventsService.getMedications(pid),
        careEventsService.getHomeCare(pid),
        careEventsService.getOutdoor(pid),
      ]);

      const apiMeds = medsResult.status === "fulfilled" ? medsResult.value : [];
      const apiHomeCare = homeResult.status === "fulfilled" ? homeResult.value : [];
      const apiOutdoor = outdoorResult.status === "fulfilled" ? outdoorResult.value : [];

      if (medsResult.status === "rejected") {
        console.warn("Failed to load medications:", medsResult.reason);
      }
      if (homeResult.status === "rejected") {
        console.warn("Failed to load home care schedules:", homeResult.reason);
      }
      if (outdoorResult.status === "rejected") {
        console.warn("Failed to load outdoor schedules:", outdoorResult.reason);
      }

      const drugNames = await Promise.all(
        apiMeds.map((m) =>
          drugsService.getDrugById(m.drugId).then((d) => d.drugName).catch(() => `Drug #${m.drugId}`),
        ),
      );

      const mappedMeds = apiMeds.map((m, i) => mapMedicationPlan(m, drugNames[i]));

      const mappedHome: CareEvent[] = apiHomeCare
        .filter((h) => h.startDatetime)
        .map((h) => ({
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

      const mappedOutdoor: CareEvent[] = apiOutdoor
        .filter((o) => o.startDatetime)
        .map((o) => ({
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
    } catch (err) {
      console.warn("Care events load failed:", err);
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
  }, [patientId, currentLang, fetchFromApi]);

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

  const togglePin = useCallback(
    async (backendId: number, eventType: "home" | "outdoor") => {
      if (!caregiverId) return;
      setEvents((prev) =>
        prev.map((e) =>
          e.backendId === backendId && e.eventType === eventType
            ? { ...e, isPinned: e.isPinned === 1 ? 0 : 1 }
            : e,
        ),
      );
      try {
        if (eventType === "home") {
          await careEventsService.toggleHomeCarePin(backendId, caregiverId);
        } else {
          await careEventsService.toggleOutdoorPin(backendId, caregiverId);
        }
      } catch {
        setEvents((prev) =>
          prev.map((e) =>
            e.backendId === backendId && e.eventType === eventType
              ? { ...e, isPinned: e.isPinned === 1 ? 0 : 1 }
              : e,
          ),
        );
      }
    },
    [caregiverId],
  );

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

  return <CareEventsContext.Provider value={value}>{children}</CareEventsContext.Provider>;
};
