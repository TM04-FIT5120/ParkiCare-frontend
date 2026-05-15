import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ClipboardList, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { careEventsService } from "@/services/careEvents";
import type { MedicationAlert } from "@/context/MedicationAlertContext";

interface ObservationNoteModalProps {
  alert: MedicationAlert;
  caregiverId: number;
  onDismiss: () => void;
}

const MAX_CHARS = 200;

export function ObservationNoteModal({ alert, caregiverId, onDismiss }: ObservationNoteModalProps) {
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!note.trim()) {
      onDismiss();
      return;
    }
    setIsSaving(true);
    try {
      await careEventsService.savePlanNote(Number(alert.remindId), caregiverId, note.trim());
      toast.success("Observation saved");
      onDismiss();
    } catch {
      toast.error("Could not save observation. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <>
        {/* Backdrop - dismissable */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onDismiss}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9000]"
        />

        {/* Modal card */}
        <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="w-full max-w-md pointer-events-auto"
          >
            <div className="bg-white rounded-[24px] shadow-[0_24px_64px_rgba(0,0,0,0.18)] overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#E9E3FF] flex items-center justify-center shrink-0">
                    <ClipboardList className="w-5 h-5 text-[#4318FF]" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#2B3674]">Observation Note</h3>
                    <p className="text-xs text-[#A3AED0] font-medium mt-0.5 truncate max-w-[220px]">
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

              {/* Body */}
              <div className="px-6 pb-6 space-y-4">
                <p className="text-sm text-[#707EAE] font-medium leading-relaxed">
                  How is the patient doing 20 minutes after medication? This note is optional.
                </p>

                <div className="relative">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, MAX_CHARS))}
                    placeholder="e.g. Patient felt slightly drowsy but otherwise comfortable..."
                    rows={4}
                    className="w-full px-4 py-3 bg-[#F4F7FE] border-none rounded-xl text-sm font-medium text-[#2B3674] placeholder:text-[#A3AED0] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/40 resize-none transition-all"
                  />
                  <span className={`absolute bottom-3 right-3 text-[11px] font-bold ${note.length >= MAX_CHARS ? "text-red-400" : "text-[#A3AED0]"}`}>
                    {note.length} / {MAX_CHARS}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={onDismiss}
                    disabled={isSaving}
                    className="flex-1 py-3 bg-[#F4F7FE] hover:bg-[#E9E3FF] text-[#4318FF] text-sm font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-60"
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 py-3 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white text-sm font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_20px_rgba(67,24,255,0.4)] active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isSaving ? "Saving..." : "Save Note"}
                  </button>
                </div>
              </div>

            </div>
          </motion.div>
        </div>
      </>
    </AnimatePresence>
  );
}
