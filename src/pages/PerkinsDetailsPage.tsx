import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Activity, AlertCircle, FileText, Play, Brain, ShieldAlert,
  ExternalLink, Lightbulb, Clock, Heart, AlertTriangle,
  Clipboard, Phone, X, ChevronRight,
} from "lucide-react";

// ── Section definitions ──────────────────────────────────────────────────────

interface Section {
  id: number;
  icon: React.ElementType;
  iconColor: string;
  title: string;
  preview: string;
  image: string;
  imageAlt: string;
  content: React.ReactNode;
}

function useSections(navigate: ReturnType<typeof useNavigate>): Section[] {
  return [
    {
      id: 1,
      icon: Brain,
      iconColor: "text-[#4318FF]",
      title: "What is Parkinson's Disease?",
      preview:
        "A progressive neurological disorder that affects movement, mood, and sleep. Often years before tremors appear. Learn the early invisible symptoms most caregivers miss.",
      image: "https://images.unsplash.com/photo-1559757175-5700dde675bc?auto=format&fit=crop&q=80&w=800",
      imageAlt: "Parkinson's awareness",
      content: (
        <div className="space-y-4">
          <p className="text-[#707EAE] leading-relaxed">
            Parkinson's disease is a progressive neurological disorder that affects how the brain controls body
            movements. While most people immediately think of hand tremors or stiffness, Parkinson's is actually
            much more complex.
          </p>
          <p className="text-[#707EAE] leading-relaxed">
            Research shows that Parkinson's affects more than just movement. In fact, many "invisible" symptoms
            can appear years before any walking difficulties begin. As a caregiver, you might notice your loved
            one experiencing:
          </p>
          <ul className="space-y-2">
            {[
              ["Sleep Issues", "Acting out dreams, thrashing, or shouting during sleep"],
              ["Digestive Problems", "Severe and persistent constipation"],
              ["Sensory Changes", "A noticeable loss of smell"],
              ["Mood Fluctuations", "Unexplained depression, anxiety, or lack of motivation"],
            ].map(([title, desc]) => (
              <li key={title} className="flex items-start gap-2 text-[#707EAE]">
                <span className="text-[#4318FF] mt-1">●</span>
                <span><strong>{title}:</strong> {desc}</span>
              </li>
            ))}
          </ul>
          <p className="text-[#707EAE] leading-relaxed">
            Knowing these issues are actual symptoms of Parkinson's and not just "normal aging" can help you
            provide more patient, empathetic care and communicate better with the neurologist.
          </p>
          <a href="https://doi.org/10.1002/mds.26431" target="_blank" rel="noopener noreferrer"
            className="text-xs text-[#4318FF] hover:underline font-bold block">
            Source: Movement Disorders, 30(12), 1600–1611
          </a>
        </div>
      ),
    },
    {
      id: 2,
      icon: Activity,
      iconColor: "text-[#4318FF]",
      title: "Recognizing Common Symptoms",
      preview:
        "Symptoms fall into motor and non-motor categories. Slowness of movement affects over 77% of patients. Non-motor symptoms often impact daily life even more than tremors.",
      image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=800",
      imageAlt: "Doctor examining patient",
      content: (
        <div className="space-y-6">
          <p className="text-[#707EAE] leading-relaxed">
            Parkinson's symptoms vary from person to person, but they generally fall into two categories. Knowing
            what to look for helps you provide better care and keeps the doctor well-informed.
          </p>
          <div>
            <h3 className="text-xl font-bold text-[#2B3674] mb-3">Motor Symptoms</h3>
            <ul className="space-y-2">
              {[
                ["Slowness of Movement", "The most common symptom, affecting over 77% of patients. You might notice your parent taking longer to get dressed, walking with shorter steps, or struggling to stand up from a chair."],
                ["Tremors", "Shaking, usually starting in one hand while at rest."],
                ["Stiffness", "Muscles feel tight and inflexible, making it hard to swing their arms while walking."],
                ["Balance & Gait Issues", "Difficulty turning around, or feeling like their feet are \"glued to the floor\"."],
              ].map(([title, desc]) => (
                <li key={title} className="flex items-start gap-2 text-[#707EAE]">
                  <span className="text-[#4318FF] mt-1">●</span>
                  <span><strong>{title}:</strong> {desc}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#2B3674] mb-3">Non-Motor Symptoms</h3>
            <p className="text-[#707EAE] mb-3">These symptoms are often overlooked but can affect daily life even more than motor symptoms.</p>
            <ul className="space-y-2">
              {[
                ["Mood Changes", "Depression, apathy, and anxiety often appear together."],
                ["Sleep Problems", "Excessive daytime sleepiness, or acting out dreams at night."],
                ["Autonomic Issues", "Severe constipation, frequent/urgent urination, and feeling dizzy when standing up."],
                ["Pain & Fatigue", "Unexplained muscle aches and feeling constantly tired."],
              ].map(([title, desc]) => (
                <li key={title} className="flex items-start gap-2 text-[#707EAE]">
                  <span className="text-[#4318FF] mt-1">●</span>
                  <span><strong>{title}:</strong> {desc}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-[#FFF9E6] border-l-4 border-[#FFB800] p-4 rounded-lg">
            <p className="flex items-start gap-2 text-[#2B3674] font-bold">
              <Lightbulb className="w-5 h-5 text-[#FFB800] shrink-0 mt-0.5" />
              <span><strong>Caregiver Tip:</strong> Log any of these symptoms in your ParkiCare Daily Record. It's crucial information for the neurologist!</span>
            </p>
          </div>
          <div className="space-y-1">
            <a href="https://doi.org/10.3389/fnagi.2022.935841" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#4318FF] hover:underline font-bold">Source: Frontiers in Aging Neuroscience, 14(14), 935841</a>
            <a href="https://doi.org/10.1080/14737175.2021.1883428" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#4318FF] hover:underline font-bold">Source: Expert Review of Neurotherapeutics, 21(3), 1–18</a>
          </div>
        </div>
      ),
    },
    {
      id: 3,
      icon: Clock,
      iconColor: "text-[#4318FF]",
      title: "How Care Needs Change Over Time",
      preview:
        "Parkinson's progresses in stages. Your caregiver role shifts from encouraging independence in early stage to full-time physical assistance in late stage. Learn what to expect at each stage.",
      image: "https://images.unsplash.com/photo-1581594693702-fbdc51b2763b?auto=format&fit=crop&q=80&w=800",
      imageAlt: "Timeline concept with clock",
      content: (
        <div className="space-y-6">
          <p className="text-[#707EAE] leading-relaxed">
            Parkinson's progresses differently for everyone. It is more helpful to understand how your loved one's
            needs and your role as a caregiver will change over time.
          </p>
          <div className="bg-[#F4F7FE] p-6 rounded-xl">
            <h3 className="text-xl font-bold text-[#2B3674] mb-3">Early Stage</h3>
            <div className="space-y-3">
              <div><p className="font-bold text-[#4318FF] mb-1">What it looks like:</p><p className="text-[#707EAE]">Symptoms like tremors usually affect only one side of the body. You might notice they get tired more easily while walking.</p></div>
              <div><p className="font-bold text-[#4318FF] mb-1">Your role:</p><p className="text-[#707EAE]">They can still live independently. Your main job is to help them establish a medication routine and encourage daily exercise.</p></div>
              <a href="https://doi.org/10.1002/mds.26431" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#4318FF] hover:underline font-bold mt-2">Source: Movement Disorders, 30(12), 1600–1611</a>
            </div>
          </div>
          <div className="bg-[#FFF4ED] p-6 rounded-xl">
            <h3 className="text-xl font-bold text-[#2B3674] mb-3">Mid Stage</h3>
            <div className="space-y-3">
              <div><p className="font-bold text-[#FF6B35] mb-1">What it looks like:</p><p className="text-[#707EAE]">Symptoms affect both sides. They may experience "Freezing of Gait" and have trouble standing up from a chair or turning over in bed.</p></div>
              <div><p className="font-bold text-[#FF6B35] mb-1">Your Role:</p><p className="text-[#707EAE]">Fall prevention is your top priority. They will need your physical assistance with daily tasks like dressing, bathing, and moving around the house safely.</p></div>
              <a href="https://doi.org/10.1007/s00702-019-02033-9" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#4318FF] hover:underline font-bold mt-2">Source: Journal of Neural Transmission, 126(7), 841–851</a>
            </div>
          </div>
          <div className="bg-[#FEF0F0] p-6 rounded-xl">
            <h3 className="text-xl font-bold text-[#2B3674] mb-3">Late Stage</h3>
            <div className="space-y-3">
              <div><p className="font-bold text-[#DC2626] mb-1">What it looks like:</p><p className="text-[#707EAE]">Severe stiffness and mobility loss. They may require a wheelchair or become bedbound.</p></div>
              <div><p className="font-bold text-[#DC2626] mb-1">Your Role:</p><p className="text-[#707EAE]">They need full-time assistance for all daily activities. Providing emotional, family, and spiritual comfort becomes just as important as physical care.</p></div>
              <a href="https://doi.org/10.1038/nrneurol.2012.126" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#4318FF] hover:underline font-bold mt-2">Source: Nature Reviews Neurology, 8(8), 435–442</a>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 4,
      icon: Clipboard,
      iconColor: "text-[#4318FF]",
      title: "Your Daily Observation Checklist",
      preview:
        "A practical guide to what to watch for every day, from medication \"On/Off\" timing and fall risks to invisible emotional fluctuations and mealtime safety.",
      image: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&q=80&w=800",
      imageAlt: "Checklist and clipboard",
      content: (
        <div className="space-y-6">
          {[
            {
              heading: "1. Medication Timing & \"On/Off\" Periods",
              items: [
                "Parkinson's medication is highly time-critical.",
                "A 30-minute delay matters.",
                "Notice when the medication wears off before the next dose is due.",
                "Do their symptoms suddenly worsen?",
              ],
            },
            {
              heading: "2. Mobility & Fall Risks",
              items: [
                "Do their feet suddenly feel glued to the floor while walking?",
                "Are they struggling to stand up from a chair, or having difficulty turning over in bed?",
                "These are major fall risk warnings.",
              ],
            },
            {
              heading: "3. The \"Invisible\" Fluctuations",
              items: [
                "Do they experience intense anxiety, sadness, or panic right before their next pill is due?",
                "Note any sudden dizziness upon standing, severe pain, or excessive sleepiness during the day.",
              ],
            },
            {
              heading: "4. Daily Care & Comfort",
              items: [
                "Do they have any choking, coughing, or swallowing difficulties during meals?",
                "How many times do they wake up at night, and are they acting out their dreams?",
              ],
            },
          ].map(({ heading, items }) => (
            <div key={heading}>
              <h3 className="text-lg font-bold text-[#2B3674] mb-3">{heading}</h3>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[#707EAE]">
                    <span className="text-[#4318FF] mt-1">-</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="bg-[#FFF9E6] border-l-4 border-[#FFB800] p-4 rounded-lg">
            <p className="flex items-start gap-2 text-[#2B3674] font-bold">
              <Lightbulb className="w-5 h-5 text-[#FFB800] shrink-0 mt-0.5" />
              <span><strong>Action Item:</strong> Don't try to remember all of this! Use the ParkiCare Daily Record to quickly tap and save these observations as they happen.</span>
            </p>
          </div>
          <div className="space-y-1">
            <a href="https://doi.org/10.1080/14737175.2021.1883428" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#4318FF] hover:underline font-bold">Source: Expert Review of Neurotherapeutics, 21(3), 1–18</a>
            <a href="https://doi.org/10.2147/dnnd.s535306" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#4318FF] hover:underline font-bold">Source: Degenerative Neurological and Neuromuscular Disease, Volume 15, 101–116</a>
          </div>
        </div>
      ),
    },
    {
      id: 5,
      icon: Heart,
      iconColor: "text-[#4318FF]",
      title: "Why Your Tracking is the Doctor's Best Tool",
      preview:
        "Your neurologist sees your parent for only 15 minutes every few months. Your daily logs of symptoms, timing, and \"Off\" periods are what actually drive medication adjustments.",
      image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=800",
      imageAlt: "Doctor and patient collaboration",
      content: (
        <div className="space-y-4 text-[#707EAE] leading-relaxed">
          <p>It's easy to feel like tracking daily symptoms is just "extra paperwork," but in Parkinson's care, your records are the actual medicine prescription.</p>
          <p>Your neurologist only sees your parent for about <strong className="text-[#2B3674]">15 minutes</strong> every few months. They cannot see the sudden "Off" periods, the midnight hallucinations, or the non-motor anxiety crashes that happen at home.</p>
          <p>Parkinson's treatment is highly individualized. Doctors rely <strong className="text-[#2B3674]">entirely</strong> on your logs of "when symptoms worsen" to adjust the exact timing and dosage of Levodopa.</p>
          <p className="text-[#4318FF] font-bold text-lg">By using the ParkiCare Daily Record, you are not just a caregiver; you are the doctor's most vital clinical partner.</p>
          <div className="space-y-1 pt-2">
            <a href="https://doi.org/10.1080/14737175.2021.1883428" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#4318FF] hover:underline font-bold">Source: Expert Review of Neurotherapeutics, 21(3), 1–18</a>
            <a href="https://doi.org/10.2147/dnnd.s535306" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#4318FF] hover:underline font-bold">Source: Degenerative Neurological and Neuromuscular Disease, Volume 15, 101–116</a>
          </div>
        </div>
      ),
    },
    {
      id: 6,
      icon: AlertCircle,
      iconColor: "text-[#4318FF]",
      title: "The Golden Rules of Medication",
      preview:
        "Parkinson's medications are time-critical, a 30-minute delay can cause severe \"Off\" periods or freezing. Learn the rules every caregiver must follow and never break.",
      image: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&q=80&w=800",
      imageAlt: "Medication and pills",
      content: (
        <div className="space-y-6">
          <p className="text-[#707EAE] leading-relaxed">
            Parkinson's medications are unlike typical blood pressure or vitamin pills. They are <strong className="text-[#2B3674]">Time-Critical</strong>.
          </p>
          <div className="space-y-4">
            {[
              ["Timing is Everything", "Taking medication even 30 minutes late can cause a severe \"Off\" period, freezing of gait, or a sudden crash in mood/energy."],
              ["Never Adjust Independently", "Even if your parent is having a \"bad day,\" never increase the dose or change the schedule without consulting the doctor."],
              ["Set Persistent Reminders", "Because household chores can be distracting, always rely on alarms."],
            ].map(([title, desc]) => (
              <div key={title} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-[#4318FF] mt-2 shrink-0" />
                <div>
                  <p className="font-bold text-[#2B3674] mb-1">{title}:</p>
                  <p className="text-[#707EAE]">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => navigate('/care-events')}
            className="w-full bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] p-4 rounded-xl text-left transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98]"
          >
            <p className="text-white font-bold">Tap here to set up your ParkiCare Persistent Medication Reminders now.</p>
          </button>
          <a href="https://doi.org/10.1080/14737175.2021.1883428" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#4318FF] hover:underline font-bold">Source: Expert Review of Neurotherapeutics, 21(3), 1–18</a>
        </div>
      ),
    },
    {
      id: 7,
      icon: Activity,
      iconColor: "text-[#4318FF]",
      title: "Daily Care & Home Guidelines",
      preview:
        "Practical guidance on nutrition, constipation, swallowing, fall prevention, and exercise, the day-to-day practices that protect your loved one's health and safety at home.",
      image: "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&q=80&w=800",
      imageAlt: "Home care and daily activities",
      content: (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold text-[#2B3674] mb-3">Nutrition & Digestion</h3>
            <div className="space-y-3">
              <div><p className="font-bold text-[#4318FF] mb-1">Combat Constipation:</p><p className="text-[#707EAE]">Ensure they drink 1.5 to 2 liters of water daily, and include plenty of fruits, vegetables, and olive oil in their diet.</p></div>
              <div><p className="font-bold text-[#4318FF] mb-1">Drooling/Swallowing:</p><p className="text-[#707EAE]">Drooling happens because of infrequent swallowing, not extra saliva. Encourage them to chew gum or use a "swallow timer" to practice swallowing more often.</p></div>
            </div>
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#2B3674] mb-3">Mobility & Safety</h3>
            <div className="space-y-3">
              <div><p className="font-bold text-[#4318FF] mb-1">Preventing Dizzy Spells:</p><p className="text-[#707EAE]">Blood pressure drops are common when standing up. Teach them to rise very slowly from a bed or chair. Elevating the head of the bed by 30–45 degrees during sleep can also help.</p></div>
              <div><p className="font-bold text-[#4318FF] mb-1">Exercise:</p><p className="text-[#707EAE]">Regular physical activity, such as low-intensity walking or yoga, not only maintains mobility but also actively reduces Parkinson's-related pain.</p></div>
            </div>
          </div>
          <a href="https://doi.org/10.1080/14737175.2021.1883428" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#4318FF] hover:underline font-bold">Source: Expert Review of Neurotherapeutics, 21(3), 1–18</a>
        </div>
      ),
    },
    {
      id: 8,
      icon: Phone,
      iconColor: "text-red-600",
      title: "Red Flags - When to Call the Doctor",
      preview:
        "You are not expected to handle everything alone. Know the physical emergencies and mental health crises that require immediate professional intervention.",
      image: "https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&q=80&w=800",
      imageAlt: "Emergency call and healthcare",
      content: (
        <div className="space-y-6">
          <p className="text-[#707EAE] leading-relaxed">
            You are doing a great job, but you are not expected to handle everything alone. Contact your neurologist or seek immediate professional help if you observe any of the following:
          </p>
          <div className="bg-red-50 border-l-4 border-red-500 p-5 rounded-lg">
            <h3 className="text-lg font-bold text-red-700 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Physical Emergencies
            </h3>
            <div className="space-y-3">
              <div><p className="font-bold text-[#2B3674] mb-1">Frequent Falls or Fainting:</p><p className="text-[#707EAE]">If they feel light-headed or actually faint when standing up, their blood pressure medication may need urgent adjustment.</p></div>
              <div><p className="font-bold text-[#2B3674] mb-1">Choking:</p><p className="text-[#707EAE]">Any signs of silent aspiration (choking on saliva or food) require a speech-language therapist's intervention.</p></div>
            </div>
          </div>
          <div className="bg-purple-50 border-l-4 border-purple-500 p-5 rounded-lg">
            <h3 className="text-lg font-bold text-purple-700 mb-3 flex items-center gap-2">
              <Brain className="w-5 h-5" /> Mental & Emotional Crises
            </h3>
            <div className="space-y-3">
              <div><p className="font-bold text-[#2B3674] mb-1">Sudden Hallucinations:</p><p className="text-[#707EAE]">Seeing things that aren't there (psychosis) is a severe complication that requires medication adjustments.</p></div>
              <div><p className="font-bold text-[#2B3674] mb-1">Severe Caregiver Burnout or Patient Depression:</p><p className="text-[#707EAE]">If your loved one expresses a loss of "meaning in life" or you feel completely exhausted, please reach out to Parkinson's support groups, psychological counselors, or palliative care teams.</p></div>
            </div>
          </div>
          <a href="https://doi.org/10.1080/14737175.2021.1883428" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#4318FF] hover:underline font-bold">Source: Expert Review of Neurotherapeutics, 21(3), 1–18</a>
        </div>
      ),
    },
  ];
}

// ── Component ────────────────────────────────────────────────────────────────

export function PerkinsDetailsPage() {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const sections = useSections(navigate);

  useEffect(() => {
    if (location.hash === '#miasa-support') {
      const timer = setTimeout(() => {
        document.getElementById('miasa-support')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [location.hash]);

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">

      {/* ── Hero: Understanding Parkinson's Disease ─────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[20px] overflow-hidden shadow-[0_18px_40px_rgba(112,144,176,0.12)] border-none flex flex-col md:flex-row relative"
      >
        <div className="md:w-1/2 p-6 sm:p-8 md:p-10 lg:p-14 flex flex-col justify-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#2B3674] tracking-tight leading-[1.1] mb-4 sm:mb-6">
            Understanding <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4318FF] to-indigo-500">Parkinson's</span> Disease
          </h1>
          <p className="text-lg text-[#A3AED0] font-bold leading-relaxed mb-8">
            A simplified guide for family caregivers to understand symptoms, the "On/Off" cycle, and real-life safety challenges.
          </p>
          <div className="space-y-4">
            {[
              [Brain, "What is Parkinson's?", "A progressive neurological disorder affecting movement due to decreased dopamine."],
              [Activity, "The Symptom Cycle", "Fluctuations between \"On\" (medication working) and \"Off\" (symptoms return) periods."],
              [ShieldAlert, "Daily Restrictions", "High risk of falls, swallowing difficulties, and sudden freezing of gait."],
            ].map(([Icon, title, desc]) => (
              <div key={String(title)} className="flex items-start gap-3">
                <Icon className="w-5 h-5 text-[#4318FF] shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-[#2B3674]">{String(title)}</h4>
                  <p className="text-sm text-[#A3AED0] font-bold">{String(desc)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="md:w-1/2 bg-[#2B3674] flex flex-col md:min-h-[400px]">
          {/* Video/poster area - aspect-video on mobile so it always has height;
              md:flex-1 + md:relative so it fills the panel in side-by-side layout */}
          <div className="relative aspect-video md:aspect-auto md:flex-1">
            {isVideoPlaying ? (
              <video
                className="absolute inset-0 w-full h-full object-contain bg-black"
                src="/home_video.mp4"
                controls
                autoPlay
                onEnded={() => setIsVideoPlaying(false)}
              />
            ) : (
              <>
                <img
                  src="https://images.unsplash.com/photo-1685657814797-83706c4e5279?auto=format&fit=crop&q=80&w=1080"
                  alt="Caregiver holding patient's hands"
                  className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#2B3674] via-[#2B3674]/40 to-transparent" />
                <button
                  type="button"
                  onClick={() => setIsVideoPlaying(true)}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 sm:w-20 sm:h-20 bg-[#4318FF] hover:bg-[#3412C7] hover:scale-105 transition-all rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(67,24,255,0.5)] group"
                >
                  <Play className="w-6 h-6 sm:w-8 sm:h-8 text-white ml-1 group-hover:scale-110 transition-transform" />
                </button>
                <div className="absolute bottom-4 left-4 right-4 sm:bottom-8 sm:left-8 sm:right-8 text-center">
                  <p className="text-white font-bold text-sm sm:text-lg">Watch: The Fundamentals of Parkinson's Care</p>
                  <p className="text-[#A3AED0] font-bold text-xs sm:text-sm mt-1">3 mins • Educational Series</p>
                </div>
              </>
            )}
          </div>

          <div className="bg-white p-4 sm:p-6 border-t border-gray-100">
            <h3 className="text-sm font-bold text-[#2B3674] mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#4318FF]" />
              References to support the video
            </h3>
            <div className="space-y-2">
              {[
                ["https://pubmed.ncbi.nlm.nih.gov/26474317/", "Early-stage Parkinson's symptoms"],
                ["https://pubmed.ncbi.nlm.nih.gov/40958821/", "Early to mid-stage progression"],
                ["https://link.springer.com/article/10.1007/s00702-019-02033-9", "Non-motor symptoms and stage dependency (mid-stage)"],
                ["https://pubmed.ncbi.nlm.nih.gov/22777251/", "Late-stage symptoms and impact"],
                ["https://www.tandfonline.com/doi/full/10.1080/14737175.2021.1883428", "Care needs and management"],
                ["https://pmc.ncbi.nlm.nih.gov/articles/PMC9249436/", "Functional characteristics across different stages"],
              ].map(([href, label]) => (
                <a key={href} href={href} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-[#4318FF] hover:text-[#3412C7] transition-colors group">
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-bold group-hover:underline">{label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── Section Cards Grid ───────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h2 className="text-lg sm:text-xl font-extrabold text-[#2B3674] mb-4 sm:mb-5">Explore the Guide</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {sections.map((section, i) => (
            <motion.button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="group bg-white rounded-[20px] overflow-hidden shadow-[0_18px_40px_rgba(112,144,176,0.12)] text-left hover:shadow-[0_24px_50px_rgba(112,144,176,0.2)] hover:-translate-y-1 transition-all duration-200 flex flex-col"
            >
              {/* Card image */}
              <div className="relative h-44 overflow-hidden">
                <img
                  src={section.image}
                  alt={section.imageAlt}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                {/* Section number badge */}
                <span className="absolute top-3 left-3 bg-white/90 text-[#4318FF] text-xs font-extrabold px-2.5 py-1 rounded-full">
                  {String(section.id).padStart(2, "0")}
                </span>
              </div>

              {/* Card body */}
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <section.icon className={`w-5 h-5 shrink-0 ${section.iconColor}`} />
                  <h3 className="text-base font-extrabold text-[#2B3674] leading-tight">{section.title}</h3>
                </div>
                <p className="text-sm text-[#707EAE] font-medium leading-relaxed line-clamp-3 flex-1">
                  {section.preview}
                </p>
                <div className="mt-4 flex items-center gap-1 text-[#4318FF] text-sm font-bold">
                  <span>Read section</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* ── MIASA Malaysia Mental Health Support Card ───────────────────────── */}
      <motion.section
        id="miasa-support"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-gradient-to-br from-[#4318FF] to-[#8B5CF6] rounded-[20px] overflow-hidden shadow-[0_18px_40px_rgba(67,24,255,0.25)]"
      >
        <div className="p-6 sm:p-8 md:p-10 flex flex-col md:flex-row gap-6 md:gap-10">
          {/* Left: Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Phone className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-white/60 uppercase tracking-widest">Mental Health Support</p>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">MIASA Malaysia</h2>
              </div>
            </div>

            <p className="text-white/80 text-sm leading-relaxed mb-4">
              MIASA (Mental Illness Awareness &amp; Support Association) is a Malaysian NGO dedicated to breaking mental health stigma and providing crisis support, counselling, and peer support services — free and subsidised for those in need.
            </p>

            <div className="space-y-2 mb-5">
              {[
                ["Crisis Intervention", "Immediate support for those in acute distress"],
                ["Counselling & Therapy", "Mental health assessments and psychological support"],
                ["Peer Support", "One-on-one peer support and group sessions"],
                ["B40 Support Program", "Free and subsidised services for lower-income individuals"],
              ].map(([title, desc]) => (
                <div key={title} className="flex items-start gap-2">
                  <span className="text-white/60 mt-1 text-xs">●</span>
                  <p className="text-sm text-white/80"><span className="font-bold text-white">{title}:</span> {desc}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-white/70">
              <span className="bg-white/10 px-3 py-1 rounded-full font-bold">📧 info.miasa@gmail.com</span>
              <span className="bg-white/10 px-3 py-1 rounded-full font-bold">🌐 miasa.org.my</span>
            </div>
          </div>

          {/* Right: Contact Actions */}
          <div className="md:w-72 shrink-0 space-y-3">
            <h3 className="text-sm font-bold text-white/60 uppercase tracking-widest mb-3">Contact Now</h3>

            {/* Crisis Hotline */}
            <a
              href="tel:1800180066"
              className="flex items-center gap-4 p-4 bg-white rounded-[16px] group hover:bg-[#F4F7FE] transition-all active:scale-[0.98] shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
            >
              <div className="w-11 h-11 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-wide">Crisis Hotline</p>
                <p className="text-base font-extrabold text-[#2B3674]">1800 180 066</p>
                <p className="text-xs text-[#A3AED0] font-medium">Free call · Tap to call now</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center group-hover:bg-red-600 transition-colors">
                <Phone className="w-4 h-4 text-white" />
              </div>
            </a>

            {/* WhatsApp Crisis */}
            <a
              href="tel:0397656088"
              className="flex items-center gap-4 p-4 bg-white rounded-[16px] group hover:bg-[#F4F7FE] transition-all active:scale-[0.98] shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
            >
              <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-wide">Crisis WhatsApp Line</p>
                <p className="text-base font-extrabold text-[#2B3674]">03-9765 6088</p>
                <p className="text-xs text-[#A3AED0] font-medium">Tap to call now</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center group-hover:bg-green-600 transition-colors">
                <Phone className="w-4 h-4 text-white" />
              </div>
            </a>

            {/* General Enquiry */}
            <a
              href="tel:+60379321409"
              className="flex items-center gap-4 p-4 bg-white rounded-[16px] group hover:bg-[#F4F7FE] transition-all active:scale-[0.98] shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
            >
              <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-wide">General Enquiry</p>
                <p className="text-base font-extrabold text-[#2B3674]">+603-7932 1409</p>
                <p className="text-xs text-[#A3AED0] font-medium">Tap to call now</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                <Phone className="w-4 h-4 text-white" />
              </div>
            </a>

            <a
              href="https://miasa.org.my/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-white/20 hover:bg-white/30 text-white font-bold text-sm rounded-[16px] transition-all active:scale-[0.98]"
            >
              <ExternalLink className="w-4 h-4" />
              Visit miasa.org.my
            </a>
          </div>
        </div>
      </motion.section>

      {/* ── Section Modal ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {activeSection && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] min-h-[100dvh] w-full bg-black/40 backdrop-blur-md"
              onClick={() => setActiveSection(null)}
            />

            {/* Modal panel */}
            <motion.div
              key="modal"
              initial={{ opacity: 0, y: 0, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed inset-4 z-[210] bg-white rounded-[24px] shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Modal header image */}
              <div className="relative h-48 shrink-0">
                <img
                  src={activeSection.image}
                  alt={activeSection.imageAlt}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#2B3674]/80 to-transparent" />
                <div className="absolute bottom-4 left-5 right-14 flex items-center gap-2">
                  <activeSection.icon className={`w-6 h-6 shrink-0 text-white`} />
                  <h2 className="text-white text-xl font-extrabold leading-tight">{activeSection.title}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection(null)}
                  className="absolute top-3 right-3 w-9 h-9 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full flex items-center justify-center transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Modal scrollable content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {activeSection.content}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
