import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Pill, 
  Plus, 
  CheckCircle2, 
  Circle,
  ChevronLeft,
  ChevronRight,
  Activity,
  Heart,
  Stethoscope,
  Video,
  X
} from "lucide-react";
import { toast } from "sonner";
import { useCareEvents } from "@/hooks/useCareEvents";

export function DashboardPage() {
  const { meds: patientMedications, events: patientEventsStore } = useCareEvents();
  const navigate = useNavigate();

  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventStartTime, setNewEventStartTime] = useState("");
  const [newEventEndTime, setNewEventEndTime] = useState("");
  const [selectedDate, setSelectedDate] = useState(1); // Currently selected date
  const [confirmTaskId, setConfirmTaskId] = useState<number | null>(null);

  const [agenda, setAgenda] = useState([
    { id: 1, title: "Prepare Breakfast", time: "08:00", completed: true },
    { id: 2, title: "Administer Morning Meds", time: "08:30", completed: true },
    { id: 3, title: "Grocery Shopping", time: "11:00", completed: false },
  ]);

  const patientPlans = [
    { id: 1, title: "Doctor Appointment", time: "10:30", icon: Stethoscope },
    { id: 2, title: "Family Video Call", time: "19:00", icon: Video },
  ];

  // Generate week days for calendar
  const generateWeekDays = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dates = [29, 30, 31, 1, 2, 3, 4];
    return dates.map((date, idx) => ({
      day: days[idx],
      date,
      isToday: date === 1,
      isPastMonth: date > 20
    }));
  };

  const weekDays = generateWeekDays();

  // Time slots for calendar view
  const timeSlots = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return `${hour}:00`;
  });

  // Calendar events - combining all events for the timeline view
  const calendarEvents = [
    { id: 1, title: "Morning Medication", start: "08:00", end: "08:30", color: "bg-purple-200 border-purple-400" },
    { id: 2, title: "Doctor Appointment", start: "10:00", end: "11:00", color: "bg-blue-200 border-blue-400" },
    { id: 3, title: "Physical Therapy", start: "14:00", end: "15:30", color: "bg-green-200 border-green-400" },
    { id: 4, title: "Evening Medication", start: "18:00", end: "18:30", color: "bg-purple-200 border-purple-400" },
  ];

  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  const currentTime = getCurrentTime();

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle || !newEventStartTime || !newEventEndTime) return;

    const updatedAgenda = [...agenda, { 
      id: Date.now(), 
      title: newEventTitle, 
      time: newEventStartTime, 
      completed: false 
    }].sort((a, b) => a.time.localeCompare(b.time));
      
    setAgenda(updatedAgenda);
    setNewEventTitle("");
    setNewEventStartTime("");
    setNewEventEndTime("");
    toast.success("Event added successfully");
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

  // Combine calendar events with agenda for Caregiver Schedule
  const caregiverSchedule = [
    ...agenda,
    ...calendarEvents.map(event => ({
      id: 1000 + event.id,
      title: event.title,
      time: event.start,
      completed: false
    }))
  ].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <>
      {/* Full Width Calendar at Top */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="mb-8"
      >
        <div className="bg-white rounded-[20px] shadow-[0_18px_40px_rgba(112,144,176,0.12)] overflow-hidden">
          
          {/* Calendar Header with Days */}
          <div className="border-b border-gray-100">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <button type="button" className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5 text-[#2B3674]" />
              </button>
              <h3 className="text-sm font-bold text-[#2B3674]">April 2026</h3>
              <button type="button" className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
                <ChevronRight className="w-5 h-5 text-[#2B3674]" />
              </button>
            </div>
            
            <div className="grid grid-cols-7 border-b border-gray-100">
              {weekDays.map((day, idx) => (
                <button
                  key={`day-${idx}`}
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  className={`flex flex-col items-center py-3 transition-colors relative ${
                    day.isToday 
                      ? 'bg-red-500 text-white' 
                      : selectedDate === day.date
                      ? 'bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`text-xs font-bold mb-1 ${day.isToday ? 'text-white' : 'text-[#A3AED0]'}`}>
                    {day.day}
                  </span>
                  <span className={`text-xl font-bold ${day.isToday ? 'text-white' : day.isPastMonth ? 'text-gray-300' : 'text-[#2B3674]'}`}>
                    {day.date}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Calendar Timeline */}
          <div className="relative h-[220px] sm:h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-transparent hover:scrollbar-thumb-[#4318FF]/30 scrollbar-track-transparent">
            <div className="relative">
              {/* Time slots */}
              {timeSlots.map((time) => (
                <div key={`slot-${time}`} className="flex border-b border-gray-50 relative" style={{ height: '40px' }}>
                  <div className="w-16 shrink-0 text-xs font-bold text-[#A3AED0] text-right pr-3 pt-1">
                    {time}
                  </div>
                  <div className="flex-1 relative">
                    {/* Current time indicator */}
                    {time === currentTime.split(':')[0] + ':00' && (
                      <div className="absolute left-0 right-0 top-0 h-0.5 bg-red-500 z-10">
                        <div className="absolute -left-1 -top-1.5 w-3 h-3 rounded-full bg-red-500"></div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Calendar events positioned absolutely */}
              {calendarEvents.map((event) => {
                const startHour = parseInt(event.start.split(':')[0]);
                const startMin = parseInt(event.start.split(':')[1]);
                const endHour = parseInt(event.end.split(':')[0]);
                const endMin = parseInt(event.end.split(':')[1]);
                
                const top = (startHour * 40 + startMin * 40 / 60);
                const height = ((endHour * 60 + endMin) - (startHour * 60 + startMin)) * 40 / 60;
                
                return (
                  <div
                    key={event.id}
                    className={`absolute left-16 right-2 ${event.color} border-l-4 rounded-lg p-2 text-xs font-bold shadow-sm z-5`}
                    style={{
                      top: `${top}px`,
                      height: `${height}px`,
                    }}
                  >
                    <div className="text-[#2B3674]">{event.title}</div>
                    <div className="text-[#A3AED0] text-[10px] mt-0.5">
                      {event.start} - {event.end}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        
        {/* Left: My Agenda */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-6"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#E9E3FF] flex items-center justify-center">
              <CalendarIcon className="w-4 h-4 text-[#4318FF]" />
            </div>
            <h2 className="text-xl font-bold text-[#2B3674]">My Agenda</h2>
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