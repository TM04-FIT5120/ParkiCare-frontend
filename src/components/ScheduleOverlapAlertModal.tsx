import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { TriangleAlert } from "lucide-react";
import {
  caregiverAlertsService,
  type CaregiverAlert,
  type ScheduleOverlapPayload,
} from "@/services/caregiverAlerts";

type Props = {
  caregiverId: number;
  alerts: CaregiverAlert[];
  onDismissed: () => void;
};

function parsePayload(json: string): ScheduleOverlapPayload | null {
  try {
    return JSON.parse(json) as ScheduleOverlapPayload;
  } catch {
    return null;
  }
}

export function ScheduleOverlapAlertModal({ caregiverId, alerts, onDismissed }: Props) {
  const { t } = useTranslation();
  const [dismissing, setDismissing] = useState(false);

  if (alerts.length === 0) return null;

  const handleDismissAll = async () => {
    setDismissing(true);
    try {
      await caregiverAlertsService.dismissAll(caregiverId);
      onDismissed();
    } finally {
      setDismissing(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 p-safe bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="overlap-alert-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden border border-rose-100 flex flex-col"
      >
        <motion.div className="flex items-start gap-3 p-5 border-b border-rose-100 bg-rose-50/80">
          <TriangleAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h2 id="overlap-alert-title" className="text-lg font-bold text-[#2B3674]">
              {t("alerts.overlapTitle")}
            </h2>
            <p className="text-sm text-[#707EAE] mt-1">{t("alerts.overlapDescription")}</p>
          </div>
        </motion.div>

        <ul className="p-4 space-y-3 overflow-y-auto max-h-[50vh] flex-1">
          {alerts.map((alert) => {
            const payload = parsePayload(alert.payloadJson);
            if (!payload) return null;
            const kindKey =
              payload.conflictKind === "caregiver"
                ? "alerts.overlapKindCaregiver"
                : "alerts.overlapKindManual";
            return (
              <li
                key={alert.id}
                className="rounded-xl border border-[#EEEAFB] p-3 text-sm text-[#2B3674] bg-[#F8FAFF]"
              >
                <p className="font-semibold text-rose-700">{t(kindKey)}</p>
                <p className="mt-1">
                  <span className="font-medium">{payload.rescheduledEvent.title}</span>
                  {" "}
                  ({payload.rescheduledEvent.start} – {payload.rescheduledEvent.end})
                </p>
                <p className="mt-1 text-[#707EAE]">
                  {t("alerts.overlapsWith")}{" "}
                  <span className="font-medium text-[#2B3674]">{payload.conflictingEvent.title}</span>
                  {" "}
                  ({payload.conflictingEvent.start} – {payload.conflictingEvent.end})
                </p>
              </li>
            );
          })}
        </ul>

        <div className="p-4 border-t border-[#EEEAFB] flex justify-end shrink-0">
          <button
            type="button"
            onClick={handleDismissAll}
            disabled={dismissing}
            className="px-5 py-2.5 rounded-xl bg-[#4318FF] text-white font-semibold text-sm hover:bg-[#3311DB] disabled:opacity-60"
          >
            {t("alerts.dismissAll")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
