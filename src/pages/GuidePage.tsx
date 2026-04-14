import { motion } from "motion/react";
import { UserPlus, LayoutDashboard, Bell, Pill, BookOpen, Heart, MapPin, FileText } from "lucide-react";

interface GuideStep {
  text: string;
  note?: string;
}

interface GuideFeature {
  id: number;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  route?: string;
  accentColor: string;
  iconColor: string;
  steps: GuideStep[];
}

const guideFeatures: GuideFeature[] = [
  {
    id: 1,
    title: "Getting Started",
    subtitle: "Register, set up your patient profile, and log in",
    icon: <UserPlus className="w-5 h-5 sm:w-6 sm:h-6" />,
    accentColor: "bg-indigo-50",
    iconColor: "text-indigo-500",
    steps: [
      { text: "On the Register screen, enter a nickname and password to create your caregiver account." },
      { text: "Complete Patient Setup: enter your patient's nickname and age range." },
      {
        text: "Your Profile page shows your unique User ID - tap the copy button to save it.",
        note: "Your User ID is always accessible from the Profile page (top-right avatar).",
      },
      { text: "On future visits, log in with your User ID and password on the Login screen." },
    ],
  },
  {
    id: 2,
    title: "Using the Home Dashboard",
    subtitle: "Your daily command centre for tasks and scheduling",
    icon: <LayoutDashboard className="w-5 h-5 sm:w-6 sm:h-6" />,
    route: "/home",
    accentColor: "bg-blue-50",
    iconColor: "text-blue-500",
    steps: [
      { text: "My Agenda shows today's medications, home care tasks, and outdoor events in one list." },
      { text: "Tap any agenda item to mark it complete. Tap again to undo." },
      { text: "The Patient Care panel shows three organised lists: Medication List, Daily Care List, and Outdoor Event List." },
      { text: "Use Schedule New Event (title, start/end time, date, recurrence) to add a one-off or recurring event directly from the Dashboard." },
      { text: "The Calendar widget lets you switch between Day, Week, and Month views to browse upcoming events." },
      {
        text: 'Tap "Add More" in any list to jump to the Care Events page for that category.',
        note: "Medications and care events created on the Care Events page automatically appear here.",
      },
    ],
  },
  {
    id: 3,
    title: "Enabling Notifications",
    subtitle: "Allow push alerts so you never miss a medication reminder",
    icon: <Bell className="w-5 h-5 sm:w-6 sm:h-6" />,
    accentColor: "bg-violet-50",
    iconColor: "text-violet-500",
    steps: [
      { text: "Push notifications are currently supported on Android and desktop browsers (Chrome, Edge, Firefox)." },
      { text: "When you log in for the first time, your browser will ask: \"Allow ParkiCare to send notifications?\" - tap Allow to enable push reminders." },
      { text: "If you missed the prompt or tapped Block, open your browser's site settings, find ParkiCare, and change Notifications to Allow." },
      { text: "Once notifications are enabled, medication reminders will appear as system alerts at the scheduled time even when the app is in the background." },
      { text: "Tap a notification to open ParkiCare directly on the Dashboard, where you can mark the task complete or dismiss it." },
      {
        text: "iOS (iPhone / iPad) is not yet supported for push notifications.",
        note: "iOS notification support is coming in a future update. For now, iOS users can still use all other features of ParkiCare - check the Dashboard manually for upcoming reminders.",
      },
    ],
  },
  {
    id: 4,
    title: "Setting Medication Reminders",
    subtitle: "Add and schedule medications using the multi-step form",
    icon: <Pill className="w-5 h-5 sm:w-6 sm:h-6" />,
    route: "/care-events",
    accentColor: "bg-purple-50",
    iconColor: "text-purple-500",
    steps: [
      { text: "Go to Care Events and select the Medication section." },
      { text: "The 7-step form guides you through: (1) optional medication photo → (2) search drug name → (3) enter dosage → (4) set start and optional end dates → (5) choose recurrence (Daily, Weekdays, Weekly, or None) → (6) set administration times → (7) review and confirm." },
      { text: "Choose the drug type: Oral (standard) or a custom intake method. Set frequency: 1–4 times per day, or as needed." },
      { text: "When a reminder appears on the Dashboard at the scheduled time, tap the task to mark it complete, or undo it if needed." },
      { text: "To remove a medication, find it in the Medication List and tap the delete button." },
    ],
  },
  {
    id: 5,
    title: "Reading Parkinson's Details",
    subtitle: "Learn Parkinson's essentials and access medical references",
    icon: <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />,
    route: "/knowledge-hub",
    accentColor: "bg-sky-50",
    iconColor: "text-sky-500",
    steps: [
      { text: "Open Knowledge Hub from the top navigation." },
      { text: 'Tap the play button to watch the video: "The Fundamentals of Parkinson\'s Care" (approx. 3 minutes).' },
      { text: "Read the key concept cards: What is Parkinson's, The Symptom Cycle (On/Off periods), and Daily Restrictions." },
      {
        text: "Scroll down to find PubMed references and links to external resources for deeper reading.",
        note: "The On/Off symptom cycle explains why medication timing is so important - the Knowledge Hub provides the context behind your reminders.",
      },
    ],
  },
  {
    id: 6,
    title: "Managing Home Care Events",
    subtitle: "Schedule and track all in-home care activities",
    icon: <Heart className="w-5 h-5 sm:w-6 sm:h-6" />,
    route: "/care-events",
    accentColor: "bg-rose-50",
    iconColor: "text-rose-500",
    steps: [
      { text: "Go to Care Events and select the Home Care section." },
      { text: "Fill in the event form: title, type (Bathing, Nursing Care, Toileting Assist, Meals, Exercise, or Physical Therapy), start and end times (12-hour format), start date, optional end date, and recurrence." },
      { text: "Submit the form. The event will appear in the Home Care Event List on the right panel." },
      { text: "Hover over any event in the list to reveal the delete button and remove it." },
      { text: "The History section records past events. Click the pin icon to mark frequently used events, then click a pinned event to auto-fill the form and reuse it quickly." },
    ],
  },
  {
    id: 7,
    title: "Adding Outdoor Events",
    subtitle: "Log appointments, walks, and outings for your patient",
    icon: <MapPin className="w-5 h-5 sm:w-6 sm:h-6" />,
    route: "/care-events",
    accentColor: "bg-emerald-50",
    iconColor: "text-emerald-500",
    steps: [
      { text: "Go to Care Events and select the Outdoor Events section." },
      { text: "Choose an event type: Doctor Appointment, Walk in Park, Social Visit, Shopping, Recreation, Family Outing, or enter a custom type." },
      { text: "Fill in the same scheduling fields as Home Care events: title, start and end times, start date, optional end date, and recurrence." },
      { text: "Submit to add the event. It will appear in the Outdoor Event List." },
      {
        text: "Use the History section to pin and reuse frequent outdoor activities.",
        note: "Outdoor events also appear in the Dashboard agenda and in Digital Records under Outdoor Activity Records.",
      },
    ],
  },
  {
    id: 8,
    title: "Viewing Digital Records",
    subtitle: "Export structured care data for doctor consultations",
    icon: <FileText className="w-5 h-5 sm:w-6 sm:h-6" />,
    route: "/digital-records",
    accentColor: "bg-amber-50",
    iconColor: "text-amber-500",
    steps: [
      { text: "Open Digital Records from the top navigation." },
      { text: "Three sections are available: Medication Records, Home Care Records, and Outdoor Activity Records." },
      { text: "For each section, select a date range: Since Last Medical Visit, Last 30 Days, Custom Range, or Full History." },
      { text: "Switch between view modes: Detailed (full event-by-event list), Summary (aggregated), or Narrative (readable prose)." },
      {
        text: "Use the Export button to download the report as a structured file to share with your neurologist or GP.",
        note: "Prepare this before each medical appointment to give your doctor an accurate picture of the patient's routine and medication adherence.",
      },
    ],
  },
];

export function GuidePage() {
  return (
    <div className="pb-6 sm:pb-8">
      <div className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="max-w-4xl mx-auto flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#2B3674]">How to Use ParkiCare</h1>
              <p className="text-sm sm:text-base text-[#A3AED0]">Step-by-step guide for caregivers</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          {guideFeatures.map((feature, index) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.08 }}
              className="bg-white rounded-2xl sm:rounded-3xl shadow-sm mb-4 sm:mb-6 border border-white/50 backdrop-blur-xl overflow-hidden"
            >
              <div className="p-4 sm:p-6 md:p-8">
                {/* Card header */}
                <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm sm:text-base font-bold shadow-md shrink-0">
                    {feature.id}
                  </div>
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 ${feature.accentColor} ${feature.iconColor}`}>
                    {feature.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg sm:text-xl font-bold text-[#2B3674] leading-tight">{feature.title}</h2>
                    <p className="text-xs sm:text-sm text-[#A3AED0]">{feature.subtitle}</p>
                  </div>
                  {feature.route && (
                    <span className="hidden sm:block text-xs font-semibold text-[#707EAE] bg-gray-100 px-2 py-1 rounded-full shrink-0">
                      {feature.route}
                    </span>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100 mb-4 sm:mb-5" />

                {/* Steps */}
                <ol className="space-y-3 sm:space-y-4">
                  {feature.steps.map((step, stepIndex) => (
                    <li key={stepIndex} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center mt-0.5">
                        {stepIndex + 1}
                      </span>
                      <div>
                        <p className="text-sm sm:text-base text-[#2B3674] font-medium leading-relaxed">{step.text}</p>
                        {step.note && (
                          <p className="text-xs sm:text-sm text-[#707EAE] mt-1 italic">{step.note}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </motion.div>
          ))}

          {/* Closing card */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white shadow-xl">
            <h3 className="text-lg sm:text-xl font-bold mb-1 sm:mb-2">You're all set!</h3>
            <p className="text-sm sm:text-base text-indigo-100">
              Explore the navigation links at the top to get started. Visit the Knowledge Hub anytime to learn more about Parkinson's care.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
