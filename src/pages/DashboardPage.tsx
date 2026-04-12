import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import {
  Calendar as CalendarIcon,
  Clock,
  Pill,
  Plus,
  CheckCircle2,
  Circle,
  Activity,
  Heart,
  Stethoscope,
  Video,
  X
} from "lucide-react";
import { toast } from "sonner";
import { useCareEvents } from "@/hooks/useCareEvents";
import { caregiverScheduleService } from "@/services/caregiverSchedule";
import { dashboardService, type TaskResponse } from "@/services/dashboard";
import { useAuth } from "@/context/AuthContext";
import { CalendarWidget } from "@/components/CalendarWidget";

export function DashboardPage() {
  const { meds: patientMedications, events: patientEventsStore } = useCareEvents();
  const navigate = useNavigate();
  const { user } = useAuth();
  const caregiverId = user?.caregiverId ?? 0;

  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventStartTime, setNewEventStartTime] = useState("");
  const [newEventEndTime, setNewEventEndTime] = useState("");
  const [confirmTaskId, setConfirmTaskId] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [upcomingTasks, setUpcomingTasks] = useState<TaskResponse[]>([]);

  const [agenda, setAgenda] = useState<{
    id: number;
    title: string;
    time: string;
    startDatetime: string;
    endDatetime: string;
    completed: boolean;
  }[]>([]);

  // Fetch caregiver schedules + dashboard summary from API on mount
  useEffect(() => {
    if (!caregiverId) return;

    caregiverScheduleService.getSchedules(caregiverId).then((schedules) => {
      setAgenda(
        schedules.map((s) => ({
          id: s.id,
          title: s.scheduleTitle,
          time: s.startDatetime.slice(11, 16),
          startDatetime: s.startDatetime,
          endDatetime: s.endDatetime,
          completed: false,
        })),
      );
    }).catch(() => {});

    dashboardService.getPendingTasks(caregiverId).then((tasks) => setPendingCount(tasks.length)).catch(() => {});
    dashboardService.getOverdueTasks(caregiverId).then((tasks) => setOverdueCount(tasks.length)).catch(() => {});
    dashboardService.getUpcomingTasks(caregiverId).then(setUpcomingTasks).catch(() => {});
  }, [caregiverId]);

  const patientPlans = upcomingTasks.slice(0, 2).map((t) => ({
    id: t.id,
    title: t.title,
    time: t.time,
    icon: t.type === "medication" ? Pill : t.type === "outdoor" ? Stethoscope : Video,
  }));

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle || !newEventStartTime || !newEventEndTime) return;

    const today = new Date().toISOString().slice(0, 10);
    const startDatetime = `${today}T${newEventStartTime}:00`;
    const endDatetime = `${today}T${newEventEndTime}:00`;

    try {
      const created = await caregiverScheduleService.createSchedule(
        caregiverId,
        newEventTitle,
        startDatetime,
        endDatetime,
        "",
      );
      setAgenda((prev) =>
        [...prev, { id: created.id, title: created.scheduleTitle, time: newEventStartTime, startDatetime, endDatetime, completed: false }]
          .sort((a, b) => a.time.localeCompare(b.time)),
      );
      toast.success("Event added successfully");
    } catch {
      // Fallback: add locally if API is unavailable
      setAgenda((prev) =>
        [...prev, { id: Date.now(), title: newEventTitle, time: newEventStartTime, startDatetime, endDatetime, completed: false }]
          .sort((a, b) => a.time.localeCompare(b.time)),
      );
      toast.success("Event added locally");
    }

    setNewEventTitle("");
    setNewEventStartTime("");
    setNewEventEndTime("");
  };

  const handleTaskClick = (id: number, completed: boolean) => {
    if (!completed) {
      setConfirmTaskId(id);
    } else {
      toggleAgendaItem(id);
    }
  };

  const handleConfirmComplete = () => {
    if (confirmTaskId) {
      toggleAgendaItem(confirmTaskId);
      toast.success("Task marked as complete!");
      setConfirmTaskId(null);
    }
  };

  const handleCancelComplete = () => {
    setConfirmTaskId(null);
  };

  const toggleAgendaItem = (id: number) => {
    setAgenda(agenda.map(item => item.id === id ? { ...item, completed: !item.completed } : item));
  };

  // Caregiver Schedule: use API-backed agenda (already sorted)
  const caregiverSchedule = agenda;

  return (
    <>
      {/* Full Width Calendar at Top */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="mb-8"
      >
        <CalendarWidget meds={patientMedications} events={patientEventsStore} agenda={agenda} />
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        
        {/* Left: My Agenda */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-6"
        >
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <div className="w-8 h-8 rounded-lg bg-[#E9E3FF] flex items-center justify-center">
              <CalendarIcon className="w-4 h-4 text-[#4318FF]" />
            </div>
            <h2 className="text-xl font-bold text-[#2B3674]">My Agenda</h2>
            {pendingCount > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full">
                {pendingCount} pending
              </span>
            )}
            {overdueCount > 0 && (
              <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-bold rounded-full">
                {overdueCount} overdue
              </span>
            )}
          </div>

          <div className="bg-white rounded-[20px] p-6 shadow-[0_18px_40px_rgba(112,144,176,0.12)]">
            
            {/* Caregiver Schedule - MOVED TO TOP */}
            <div className="mb-8">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#A3AED0] mb-4 ml-1">Caregiver Schedule</h3>
              <div className="space-y-3">
                {caregiverSchedule.length === 0 ? (
                  <p className="text-sm text-[#A3AED0] text-center py-8 bg-[#F4F7FE] rounded-[20px] font-bold">No tasks scheduled.</p>
                ) : (
                  caregiverSchedule.map((item) => (
                    <div 
                      key={item.id} 
                      onClick={() => handleTaskClick(item.id, item.completed)}
                      className={`flex items-center gap-4 p-4 rounded-[20px] transition-all cursor-pointer group ${
                        item.completed 
                          ? 'bg-[#F4F7FE]' 
                          : 'bg-white border border-[#E0E5F2] hover:border-[#4318FF]/30 hover:shadow-md hover:-translate-y-0.5'
                      }`}
                    >
                      <button type="button" className="shrink-0 flex items-center justify-center focus:outline-none">
                        {item.completed ? (
                          <CheckCircle2 className="w-7 h-7 text-[#4318FF]" />
                        ) : (
                          <Circle className="w-7 h-7 text-[#A3AED0] group-hover:text-[#4318FF] transition-colors" />
                        )}
                      </button>
                      <div className="flex-1">
                        <h4 className={`font-bold text-[15px] ${item.completed ? 'text-[#A3AED0] line-through' : 'text-[#2B3674]'}`}>
                          {item.title}
                        </h4>
                        <p className="text-xs font-bold text-[#A3AED0] mt-1 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {item.time}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Schedule New Event Form - MOVED TO BOTTOM */}
            <div className="p-5 bg-[#F4F7FE] rounded-[20px] border-none">
              <h3 className="font-bold text-[#2B3674] mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#4318FF]" /> Schedule New Event
              </h3>
              <form onSubmit={handleAddEvent} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-wider mb-2 block ml-1">Event Name</label>
                  <input 
                    type="text" 
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                    placeholder="e.g., Grocery Shopping"
                    className="w-full px-4 py-3 bg-white border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50 transition-all shadow-sm placeholder:text-[#A3AED0]"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-wider mb-2 block ml-1">Start Time</label>
                  <input 
                    type="time" 
                    value={newEventStartTime}
                    onChange={(e) => setNewEventStartTime(e.target.value)}
                    className="w-full px-4 py-3 bg-white border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50 transition-all shadow-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#A3AED0] uppercase tracking-wider mb-2 block ml-1">End Time</label>
                  <input 
                    type="time" 
                    value={newEventEndTime}
                    onChange={(e) => setNewEventEndTime(e.target.value)}
                    className="w-full px-4 py-3 bg-white border-none rounded-xl text-sm font-bold text-[#2B3674] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/50 transition-all shadow-sm"
                    required
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-3 mt-2 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  Add
                </button>
              </form>
            </div>

          </div>
        </motion.div>

        {/* Right: Patient Care Information */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="space-y-6"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#E9E3FF] flex items-center justify-center">
              <Activity className="w-4 h-4 text-[#4318FF]" />
            </div>
            <h2 className="text-xl font-bold text-[#2B3674]">Patient Care</h2>
          </div>

          {/* Medication List */}
          <div className="bg-white rounded-[20px] p-6 shadow-[0_18px_40px_rgba(112,144,176,0.12)]">
            <h3 className="text-lg font-bold text-[#2B3674] mb-4 flex items-center gap-2">
              <Pill className="w-5 h-5 text-[#4318FF]" />
              Medication List
            </h3>
            <div className="space-y-3">
              {patientMedications.length > 0 ? (
                patientMedications.map(med => (
                  <div key={med.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#F4F7FE] hover:shadow-sm transition-all">
                    <Circle className="w-5 h-5 text-[#A3AED0]" />
                    <div className="flex-1">
                      <h4 className="font-bold text-[#2B3674] text-sm">{med.name}</h4>
                      <p className="text-xs text-[#A3AED0] font-bold mt-0.5">{med.dose} â€¢ {med.frequency}</p>
                    </div>
                    <span className="text-xs font-bold text-[#4318FF] bg-[#E9E3FF] px-3 py-1 rounded-lg">
                      {med.time}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#A3AED0] font-bold text-center py-4">No medications scheduled</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate('/care-events')}
              className="w-full mt-4 py-2.5 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white text-sm font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98]"
            >
              Add More
            </button>
          </div>

          {/* Daily Care List */}
          <div className="bg-white rounded-[20px] p-6 shadow-[0_18px_40px_rgba(112,144,176,0.12)]">
            <h3 className="text-lg font-bold text-[#2B3674] mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-orange-500" />
              Daily Care List
            </h3>
            <div className="space-y-3">
              {patientEventsStore.length > 0 ? (
                patientEventsStore.map((ev, index) => (
                  <div key={`care-${ev.id || index}`} className="flex items-center gap-3 p-3 rounded-xl bg-[#F4F7FE] hover:shadow-sm transition-all">
                    <Circle className="w-5 h-5 text-[#A3AED0]" />
                    <div className="flex-1">
                      <h4 className="font-bold text-[#2B3674] text-sm">{ev.type}</h4>
                      <p className="text-xs text-[#A3AED0] font-bold mt-0.5">{ev.title}</p>
                    </div>
                    <span className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-lg">
                      {ev.time}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#A3AED0] font-bold text-center py-4">No care events scheduled</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate('/care-events')}
              className="w-full mt-4 py-2.5 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white text-sm font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98]"
            >
              Add More
            </button>
          </div>

          {/* Upcoming Plans */}
          <div className="bg-white rounded-[20px] p-6 shadow-[0_18px_40px_rgba(112,144,176,0.12)]">
            <h3 className="text-lg font-bold text-[#2B3674] mb-4 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-[#4318FF]" />
              Upcoming Plans
            </h3>
            <div className="flex flex-col sm:flex-row gap-4">
              {patientPlans.map((plan, index) => (
                <div key={`patient-plan-${plan.id || index}`} className="flex-1 flex items-center gap-4 p-4 rounded-[20px] bg-[#E9E3FF] border-none hover:shadow-sm transition-all cursor-default">
                  <div className="w-11 h-11 rounded-xl bg-white shadow-sm text-[#4318FF] flex items-center justify-center shrink-0">
                    <plan.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#4318FF]">{plan.title}</h4>
                    <p className="text-sm font-bold text-[#4318FF]/80 mt-0.5">{plan.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => navigate('/care-events')}
              className="w-full mt-4 py-2.5 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white text-sm font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98]"
            >
              Add More
            </button>
          </div>

        </motion.div>

      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmTaskId !== null && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancelComplete}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50 p-4"
            >
              <div className="bg-white rounded-[20px] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.2)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-[#2B3674]">Complete Task?</h3>
                  <button
                    type="button"
                    onClick={handleCancelComplete}
                    className="p-2 hover:bg-[#F4F7FE] rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-[#A3AED0]" />
                  </button>
                </div>
                
                <p className="text-sm text-[#A3AED0] font-bold mb-6">
                  Are you sure you want to mark this task as complete?
                </p>
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCancelComplete}
                    className="flex-1 py-3 bg-[#F4F7FE] hover:bg-[#E9E3FF] text-[#4318FF] font-bold rounded-xl transition-all active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmComplete}
                    className="flex-1 py-3 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98]"
                  >
                    Yes, Complete
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}