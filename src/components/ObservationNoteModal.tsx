import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, ClipboardList, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { careEventsService } from "@/services/careEvents";
import type { MedicationAlert } from "@/context/MedicationAlertContext";

interface ObservationNoteModalProps {
  alert: MedicationAlert;
  caregiverId: number;
  onDismiss: () => void;
}

type ObsAnswer = 0 | 1 | 2;

interface Questionnaire {
  q1: ObsAnswer | null;
  q2: ObsAnswer | null;
  q3: ObsAnswer | null;
  q4: ObsAnswer | null;
  note: string;
}

const NOTE_MAX = 400;

export function ObservationNoteModal({ alert, caregiverId, onDismiss }: ObservationNoteModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<Questionnaire>({ q1: null, q2: null, q3: null, q4: null, note: "" });
  const [isSaving, setIsSaving] = useState(false);

  const setAnswer = (key: keyof Pick<Questionnaire, "q1" | "q2" | "q3" | "q4">, val: ObsAnswer) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const allAnswered = form.q1 !== null && form.q2 !== null && form.q3 !== null && form.q4 !== null;

  const handleSave = async () => {
    if (!allAnswered) {
      toast.error(t("observation.saveRequired"));
      return;
    }
    setIsSaving(true);
    try {
      const payload = JSON.stringify({
        q1: form.q1,
        q2: form.q2,
        q3: form.q3,
        q4: form.q4,
        note: form.note.trim(),
      });
      await careEventsService.savePlanNote(Number(alert.remindId), caregiverId, payload);
      toast.success(t("observation.savedToast"));
      onDismiss();
    } catch {
      toast.error(t("observation.saveErrorToast"));
    } finally {
      setIsSaving(false);
    }
  };

  const questions: Array<{
    key: keyof Pick<Questionnaire, "q1" | "q2" | "q3" | "q4">;
    label: string;
    sub?: string;
    options: string[];
  }> = [
    {
      key: "q1",
      label: t("observation.q1"),
      sub: t("observation.q1Sub"),
      options: [t("observation.q1o0"), t("observation.q1o1"), t("observation.q1o2")],
    },
    {
      key: "q2",
      label: t("observation.q2"),
      options: [t("observation.q2o0"), t("observation.q2o1"), t("observation.q2o2")],
    },
    {
      key: "q3",
      label: t("observation.q3"),
      options: [t("observation.q3o0"), t("observation.q3o1"), t("observation.q3o2")],
    },
    {
      key: "q4",
      label: t("observation.q4"),
      options: [t("observation.q4o0"), t("observation.q4o1"), t("observation.q4o2")],
    },
  ];

  return createPortal(
    <AnimatePresence>
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onDismiss}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9000]"
        />

        <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4 p-safe pointer-events-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="w-full max-w-lg pointer-events-auto"
          >
            <div className="bg-white rounded-[24px] shadow-[0_24px_64px_rgba(0,0,0,0.18)] overflow-hidden max-h-[90vh] flex flex-col">

              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#E9E3FF] flex items-center justify-center shrink-0">
                    <ClipboardList className="w-5 h-5 text-[#4318FF]" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#2B3674]">{t("observation.title")}</h3>
                    <p className="text-xs text-[#A3AED0] font-medium mt-0.5 truncate max-w-[240px]">
                      {alert.body}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onDismiss}
                  className="p-2 hover:bg-[#F4F7FE] rounded-xl transition-colors shrink-0"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4 text-[#A3AED0]" />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 px-6 pb-6 space-y-5">
                <p className="text-sm text-[#707EAE] font-medium leading-relaxed">
                  {t("observation.subtitle")}
                </p>

                {questions.map((q, idx) => (
                  <div key={q.key} className="space-y-2">
                    <p className="text-sm font-bold text-[#2B3674] leading-snug">
                      {idx + 1}. {q.label}
                    </p>
                    {q.sub && (
                      <p className="text-xs text-[#A3AED0] leading-relaxed -mt-1">{q.sub}</p>
                    )}
                    <div className="space-y-1.5 pl-1">
                      {q.options.map((opt, optIdx) => {
                        const val = optIdx as ObsAnswer;
                        const checked = form[q.key] === val;
                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => setAnswer(q.key, val)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-medium text-left transition-all ${
                              checked
                                ? "bg-[#E9E3FF] border-[#4318FF] text-[#4318FF]"
                                : "bg-[#F4F7FE] border-transparent text-[#2B3674] hover:border-[#C9BFFF]"
                            }`}
                          >
                            <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                              checked ? "border-[#4318FF]" : "border-[#A3AED0]"
                            }`}>
                              {checked && <span className="w-2 h-2 rounded-full bg-[#4318FF]" />}
                            </span>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Additional notes */}
                <div className="space-y-2">
                  <p className="text-sm font-bold text-[#2B3674]">5. {t("observation.addNotes")}</p>
                  <div className="relative">
                    <textarea
                      value={form.note}
                      onChange={e => setForm(prev => ({ ...prev, note: e.target.value.slice(0, NOTE_MAX) }))}
                      placeholder={t("observation.placeholder")}
                      rows={3}
                      className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-medium text-[#2B3674] placeholder:text-[#A3AED0] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/40 resize-none transition-all"
                    />
                    <span className={`absolute bottom-3 right-3 text-[11px] font-bold ${form.note.length >= NOTE_MAX ? "text-red-400" : "text-[#A3AED0]"}`}>
                      {form.note.length} / {NOTE_MAX}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={onDismiss}
                    disabled={isSaving}
                    className="flex-1 py-3 bg-[#F4F7FE] hover:bg-[#E9E3FF] text-[#4318FF] text-sm font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-60"
                  >
                    {t("observation.skip")}
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving || !allAnswered}
                    className="flex-1 py-3 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white text-sm font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_20px_rgba(67,24,255,0.4)] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isSaving ? t("observation.saving") : t("observation.save")}
                  </button>
                </div>
              </div>

            </div>
          </motion.div>
        </div>
      </>
    </AnimatePresence>,
    document.body
  );
}
