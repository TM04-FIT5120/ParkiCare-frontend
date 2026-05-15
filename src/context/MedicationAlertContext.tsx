import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";

export interface MedicationAlert {
  remindId: string;
  caregiverId: string;
  title: string;
  body: string;
}

interface MedicationAlertContextValue {
  pendingAlert: MedicationAlert | null;
  dispatchAlert: (alert: MedicationAlert) => void;
  dismissAlert: () => void;
  pendingObservationAlert: MedicationAlert | null;
  dispatchObservationAlert: (alert: MedicationAlert) => void;
  dismissObservationAlert: () => void;
}

const MedicationAlertContext = createContext<MedicationAlertContextValue | null>(null);

export function MedicationAlertProvider({ children }: { children: ReactNode }) {
  const [pendingAlert, setPendingAlert] = useState<MedicationAlert | null>(null);
  const [pendingObservationAlert, setPendingObservationAlert] = useState<MedicationAlert | null>(null);

  // Track the snooze timeout so it can be cleared if a new alert for the same
  // remindId arrives from FCM before the client-side timer fires.
  const snoozeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dispatchAlert = useCallback((alert: MedicationAlert) => {
    console.log('[MedicationAlertContext] dispatchAlert called:', JSON.stringify(alert));
    setPendingAlert((prev) => {
      // Deduplicate: if this remindId is already showing, don't stack another modal.
      if (prev?.remindId === alert.remindId) {
        console.log('[MedicationAlertContext] dispatchAlert - duplicate remindId, keeping existing alert:', alert.remindId);
        return prev;
      }
      console.log('[MedicationAlertContext] dispatchAlert - setting pendingAlert to:', JSON.stringify(alert));
      return alert;
    });
    // If a snooze timer was pending for this remindId, clear it - the FCM re-fired.
    if (snoozeTimerRef.current !== null) {
      clearTimeout(snoozeTimerRef.current);
      snoozeTimerRef.current = null;
    }
  }, []);

  const dismissAlert = useCallback(() => {
    console.log('[MedicationAlertContext] dismissAlert called - clearing pendingAlert.');
    setPendingAlert(null);
  }, []);

  const dispatchObservationAlert = useCallback((alert: MedicationAlert) => {
    console.log('[MedicationAlertContext] dispatchObservationAlert called:', JSON.stringify(alert));
    setPendingObservationAlert((prev) => {
      if (prev?.remindId === alert.remindId) return prev;
      return alert;
    });
  }, []);

  const dismissObservationAlert = useCallback(() => {
    console.log('[MedicationAlertContext] dismissObservationAlert called.');
    setPendingObservationAlert(null);
  }, []);

  return (
    <MedicationAlertContext.Provider value={{
      pendingAlert, dispatchAlert, dismissAlert,
      pendingObservationAlert, dispatchObservationAlert, dismissObservationAlert,
    }}>
      {children}
    </MedicationAlertContext.Provider>
  );
}

export function useMedicationAlert(): MedicationAlertContextValue {
  const ctx = useContext(MedicationAlertContext);
  if (!ctx) throw new Error("useMedicationAlert must be used within MedicationAlertProvider");
  return ctx;
}

export function useObservationAlert() {
  const { pendingObservationAlert, dispatchObservationAlert, dismissObservationAlert } = useMedicationAlert();
  return { pendingObservationAlert, dispatchObservationAlert, dismissObservationAlert };
}

/** Exposed so DashboardPage can schedule a re-show after snooze. */
export function useMedicationAlertSnoozeScheduler() {
  const { dispatchAlert } = useMedicationAlert();
  const scheduleReshow = useCallback(
    (alert: MedicationAlert, delayMs: number) => {
      return setTimeout(() => dispatchAlert(alert), delayMs);
    },
    [dispatchAlert],
  );
  return scheduleReshow;
}
