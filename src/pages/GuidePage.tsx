import { motion } from "motion/react";
import { LayoutDashboard, Bell, Pill, Heart, MapPin, BookOpen } from "lucide-react";

interface GuideStep {
  text: string;
  note?: string;
  /** Optional screenshot shown below this step (e.g. mid-section callout) */
  image?: { src: string; alt: string };
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
  /** Screenshots from /public/Guide/ (PDF walkthrough + notification) */
  images?: { src: string; alt: string }[];
}

const guideFeatures: GuideFeature[] = [
  {
    id: 1,
    title: "Using the Home Dashboard",
    subtitle: "Add items and see today’s priorities",
    icon: <LayoutDashboard className="w-5 h-5 sm:w-6 sm:h-6" />,
    route: "/home",
    accentColor: "bg-blue-50",
    iconColor: "text-blue-500",
    images: [{ src: "/Guide/Picture1.png", alt: "Home dashboard - add medications, care tasks, and plans" }],
    steps: [
      {
        text: "Go to the Home page. Use the dashboard sections to add more medications, daily care tasks, or upcoming plans when needed.",
      },
      {
        text: "Use this page to quickly see important medication times, care tasks, and scheduled events for today.",
      },
      {
        text: "Check today’s priorities",
        note: "Use this page to quickly identify important medication times, care tasks, and scheduled events",
        image: {
          src: "/Guide/Picture2.png",
          alt: "Calendar view - use Week or Month and the Today control to see medications, care tasks, and scheduled events",
        },
      },
    ],
  },
  {
    id: 2,
    title: "Setting Medication Reminders",
    subtitle: "Scan, review, save, and respond to reminders",
    icon: <Pill className="w-5 h-5 sm:w-6 sm:h-6" />,
    route: "/care-events",
    accentColor: "bg-purple-50",
    iconColor: "text-purple-500",
    images: [{ src: "/Guide/Picture3.png", alt: "Care Events - add home care tasks and review activities" }],
    steps: [
      { text: "Open Care Events and use Add Medication on the left. The form is a short wizard (photo → name → dosage → dates & repeat → how often & meal timing → dose times → review)." },
      {
        text: "Optional photo of the label - ParkiCare shows a short OCR-style processing screen, then displays a suggestion panel only; it does not auto-fill the form fields.",
      },
      { text: "Enter the drug (search the list or type the name), then dosage (oral strength/quantity or another route), start/end dates, repeat, frequency, when to take (with meals), and administration times." },
      {
        text: "On the Review step, check everything and tap Confirm & Save to add it to your Medication List and schedule.",
      },
      { text: "When a reminder appears, use Confirm Administration or Snooze 5 min as needed." },
    ],
  },
  {
    id: 3,
    title: "Managing Care Events",
    subtitle: "Daily care tasks and upcoming activities",
    icon: <Heart className="w-5 h-5 sm:w-6 sm:h-6" />,
    route: "/care-events",
    accentColor: "bg-rose-50",
    iconColor: "text-rose-500",
    images: [{ src: "/Guide/Picture4.png", alt: "Care Events - Add Outdoor Event" }],
    steps: [
      { text: "Go to Care Events and open the Add Care Event section to manage daily caregiving activities." },
      {
        text: "Add tasks or events such as bathing, nursing care, appointments, or household-related responsibilities.",
      },
      { text: "Use this area to keep track of important plans and daily care responsibilities." },
    ],
  },
  {
    id: 4,
    title: "Add Outdoor Event",
    subtitle: "Plan outings and see them on your schedule",
    icon: <MapPin className="w-5 h-5 sm:w-6 sm:h-6" />,
    route: "/care-events",
    accentColor: "bg-emerald-50",
    iconColor: "text-emerald-500",
    images: [{ src: "/Guide/Picture5.png", alt: "Outdoor event saved on the care schedule" }],
    steps: [
      { text: "From the navigation menu, open the Care Events page." },
      { text: "Select Add Outdoor Event to create a new outdoor event." },
      { text: "Enter the event title, category or type, and event time." },
      { text: "Tap Save Outdoor Event to add it to your care schedule." },
      { text: "The event appears in your care planning section for easier daily management." },
    ],
  },
  {
    id: 5,
    title: "Notifications",
    subtitle: "Allow alerts for medication reminders",
    icon: <Bell className="w-5 h-5 sm:w-6 sm:h-6" />,
    accentColor: "bg-violet-50",
    iconColor: "text-violet-500",
    images: [{ src: "/Guide/Picture6.png", alt: "Browser notification permission for ParkiCare" }],
    steps: [
      {
        text: "After you log in, your browser may ask to allow notifications for ParkiCare. Choose Allow so medication reminders can reach you on time.",
      },
      {
        text: "If you dismissed the prompt or chose Block, open the site settings for ParkiCare in your browser and set Notifications to Allow.",
      },
      {
        text: "When a medication reminder fires, you may get a system notification and an in-app prompt to Confirm Administration or Snooze.",
      },
      {
        text: "Push works well on Android and on desktop browsers such as Chrome, Edge, and Firefox.",
        note: "On iPhone or iPad, add ParkiCare to the Home Screen and use a recent iOS version; enable notifications in system settings if prompted.",
      },
    ],
  },
  {
    id: 6,
    title: "Knowledge Hub",
    subtitle: "Learn more about Parkinson’s care (optional)",
    icon: <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />,
    route: "/knowledge-hub",
    accentColor: "bg-sky-50",
    iconColor: "text-sky-500",
    steps: [
      { text: "Open Knowledge Hub from the top navigation." },
      { text: "Watch the introductory video and read the topic cards for fundamentals of Parkinson’s care." },
      { text: "Use the references section for links to deeper reading." },
    ],
  },
];

export function GuidePage() {
  return (
    <div className="pb-6 sm:pb-8">
      <div className="bg-white border-b border-gray-100 shadow-sm">
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
          className="max-w-4xl xl:max-w-5xl mx-auto"
        >
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 mb-6 flex items-start gap-3">
            <Bell className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm sm:text-base text-amber-800 leading-relaxed">
              <span className="font-semibold">To receive medication alerts on iPhone, iPad, or Android:</span> add ParkiCare to your Home Screen.{" "}
              Tap <span className="font-semibold">Share</span> &rarr; <span className="font-semibold">Add to Home Screen</span>, then open the app from there and allow notifications when prompted.
            </p>
          </div>

          {guideFeatures.map((feature, index) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.08 }}
              className="bg-white rounded-2xl sm:rounded-3xl shadow-sm mb-4 sm:mb-6 border border-white/50 backdrop-blur-xl overflow-hidden"
            >
              <div className="p-4 sm:p-6 md:p-8">
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

                <div className="border-t border-gray-100 mb-4 sm:mb-5" />

                {feature.images && feature.images.length > 0 && (
                  <div className="mb-5 sm:mb-6 space-y-4">
                    {feature.images.map((img) => (
                      <figure key={img.src} className="rounded-xl overflow-hidden border border-[#E0E5F2] bg-[#F4F7FE]">
                        <img
                          src={img.src}
                          alt={img.alt}
                          className="w-full h-auto max-h-[min(70vh,520px)] object-contain object-top mx-auto block"
                          loading="lazy"
                        />
                        <figcaption className="px-3 py-2 text-xs text-[#707EAE] font-medium text-center border-t border-[#E0E5F2] bg-white">
                          {img.alt}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}

                <ol className="space-y-3 sm:space-y-4">
                  {feature.steps.map((step, stepIndex) => (
                    <li key={stepIndex} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center mt-0.5">
                        {stepIndex + 1}
                      </span>
                      <div className="min-w-0 flex-1 space-y-3">
                        <p className="text-sm sm:text-base text-[#2B3674] font-medium leading-relaxed">{step.text}</p>
                        {step.note && (
                          <p className="text-xs sm:text-sm text-[#707EAE] mt-1 not-italic font-medium leading-relaxed">
                            {step.note}
                          </p>
                        )}
                        {step.image && (
                          <figure className="rounded-xl overflow-hidden border border-[#E0E5F2] bg-[#F4F7FE]">
                            <img
                              src={step.image.src}
                              alt={step.image.alt}
                              className="w-full h-auto max-h-[min(70vh,520px)] object-contain object-top mx-auto block"
                              loading="lazy"
                            />
                            <figcaption className="px-3 py-2 text-xs text-[#707EAE] font-medium text-center border-t border-[#E0E5F2] bg-white">
                              {step.image.alt}
                            </figcaption>
                          </figure>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </motion.div>
          ))}

          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white shadow-xl">
            <h3 className="text-lg sm:text-xl font-bold mb-1 sm:mb-2">You&apos;re all set!</h3>
            <p className="text-sm sm:text-base text-indigo-100">
              Use the navigation links at the top to open Home, Care Events, or the Knowledge Hub anytime.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
