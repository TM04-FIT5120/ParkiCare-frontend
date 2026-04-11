import { useState } from "react";
import { motion } from "motion/react";
import { Activity, AlertCircle, FileText, Play, Brain, ShieldAlert, ExternalLink, Lightbulb, Clock, Heart, AlertTriangle, Clipboard, Phone } from "lucide-react";

export function PerkinsDetailsPage() {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      
      {/* Understanding Parkinson's Disease Section */}
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
            <div className="flex items-start gap-3">
              <Brain className="w-5 h-5 text-[#4318FF] shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-[#2B3674]">What is Parkinson's?</h4>
                <p className="text-sm text-[#A3AED0] font-bold">A progressive neurological disorder affecting movement due to decreased dopamine.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Activity className="w-5 h-5 text-[#4318FF] shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-[#2B3674]">The Symptom Cycle</h4>
                <p className="text-sm text-[#A3AED0] font-bold">Fluctuations between "On" (medication working) and "Off" (symptoms return) periods.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-[#4318FF] shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-[#2B3674]">Daily Restrictions</h4>
                <p className="text-sm text-[#A3AED0] font-bold">High risk of falls, swallowing difficulties, and sudden freezing of gait.</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="md:w-1/2 bg-[#2B3674] relative min-h-[250px] sm:min-h-[350px] md:min-h-[400px] flex flex-col">
          <div className="flex-1 relative">
            {isVideoPlaying ? (
              <div className="absolute inset-0 flex items-center justify-center bg-[#2B3674] text-white p-8 text-center">
                <div>
                  <Brain className="w-16 h-16 text-[#4318FF] mx-auto mb-4 animate-pulse" />
                  <h3 className="text-xl font-bold mb-2">Video Playing...</h3>
                  <p className="text-[#A3AED0] text-sm max-w-sm mx-auto font-bold">Covering Core Symptoms: Tremors, rigidity, and bradykinesia, and medication timing.</p>
                  <button
                    type="button"
                    onClick={() => setIsVideoPlaying(false)}
                    className="mt-6 px-6 py-2 bg-white text-[#2B3674] hover:bg-[#F4F7FE] rounded-full text-sm font-bold transition-colors"
                  >
                    Close Video
                  </button>
                </div>
              </div>
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
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-[#4318FF] hover:bg-[#3412C7] hover:scale-105 transition-all rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(67,24,255,0.5)] group"
                >
                  <Play className="w-8 h-8 text-white ml-1 group-hover:scale-110 transition-transform" />
                </button>
                <div className="absolute bottom-8 left-8 right-8 text-center">
                  <p className="text-white font-bold text-lg">Watch: The Fundamentals of Parkinson's Care</p>
                  <p className="text-[#A3AED0] font-bold text-sm mt-1">3 mins â€¢ Educational Series</p>
                </div>
              </>
            )}
          </div>

          {/* References attached to video card */}
          <div className="bg-white p-6 border-t border-gray-100">
            <h3 className="text-sm font-bold text-[#2B3674] mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#4318FF]" />
              References to support the video
            </h3>
            <div className="space-y-2">
              <a
                href="https://pubmed.ncbi.nlm.nih.gov/26474317/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-[#4318FF] hover:text-[#3412C7] transition-colors group"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span className="font-bold group-hover:underline">Early-stage Parkinson's symptoms</span>
              </a>

              <a
                href="https://pubmed.ncbi.nlm.nih.gov/40958821/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-[#4318FF] hover:text-[#3412C7] transition-colors group"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span className="font-bold group-hover:underline">Early to mid-stage progression</span>
              </a>

              <a
                href="https://link.springer.com/article/10.1007/s00702-019-02033-9"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-[#4318FF] hover:text-[#3412C7] transition-colors group"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span className="font-bold group-hover:underline">Non-motor symptoms and stage dependency (mid-stage)</span>
              </a>

              <a
                href="https://pubmed.ncbi.nlm.nih.gov/22777251/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-[#4318FF] hover:text-[#3412C7] transition-colors group"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span className="font-bold group-hover:underline">Late-stage symptoms and impact</span>
              </a>

              <a
                href="https://www.tandfonline.com/doi/full/10.1080/14737175.2021.1883428"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-[#4318FF] hover:text-[#3412C7] transition-colors group"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span className="font-bold group-hover:underline">Care needs and management (relevant to caregiver support)</span>
              </a>

              <a
                href="https://pmc.ncbi.nlm.nih.gov/articles/PMC9249436/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-[#4318FF] hover:text-[#3412C7] transition-colors group"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span className="font-bold group-hover:underline">Functional characteristics across different stages</span>
              </a>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Section 1: What is Parkinson's Disease? */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-[20px] overflow-hidden shadow-[0_18px_40px_rgba(112,144,176,0.12)] flex flex-col md:flex-row"
      >
        <div className="md:w-1/3">
          <img
            src="https://images.unsplash.com/photo-1559757175-5700dde675bc?auto=format&fit=crop&q=80&w=800"
            alt="Parkinson's awareness"
            className="w-full h-full object-cover min-h-[200px] sm:min-h-[280px] md:min-h-[300px]"
          />
        </div>
        <div className="md:w-2/3 p-4 sm:p-6 md:p-8 lg:p-10">
          <h2 className="text-2xl font-bold text-[#2B3674] mb-4 flex items-center gap-2">
            <Brain className="w-6 h-6 text-[#4318FF]" />
            Section 1: What is Parkinson's Disease?
          </h2>
          <p className="text-[#707EAE] leading-relaxed mb-4">
            Parkinson's disease is a progressive neurological disorder that affects how the brain controls body movements. While most people immediately think of hand tremors or stiffness, Parkinson's is actually much more complex.
          </p>
          <p className="text-[#707EAE] leading-relaxed mb-4">
            Research shows that Parkinson's affects more than just movement. In fact, many "invisible" symptoms can appear years before any walking difficulties begin. As a caregiver, you might notice your loved one experiencing:
          </p>
          <ul className="space-y-2 mb-4">
            <li className="flex items-start gap-2 text-[#707EAE]">
              <span className="text-[#4318FF] mt-1">â—</span>
              <span><strong>Sleep Issues:</strong> Acting out dreams, thrashing, or shouting during sleep</span>
            </li>
            <li className="flex items-start gap-2 text-[#707EAE]">
              <span className="text-[#4318FF] mt-1">â—</span>
              <span><strong>Digestive Problems:</strong> Severe and persistent constipation</span>
            </li>
            <li className="flex items-start gap-2 text-[#707EAE]">
              <span className="text-[#4318FF] mt-1">â—</span>
              <span><strong>Sensory Changes:</strong> A noticeable loss of smell</span>
            </li>
            <li className="flex items-start gap-2 text-[#707EAE]">
              <span className="text-[#4318FF] mt-1">â—</span>
              <span><strong>Mood Fluctuations:</strong> Unexplained depression, anxiety, or lack of motivation</span>
            </li>
          </ul>
          <p className="text-[#707EAE] leading-relaxed mb-4">
            Knowing these issues are actual symptoms of Parkinson'sâ€”and not just "normal aging" or the patient being difficultâ€”can help you provide more patient, empathetic care and communicate better with the neurologist.
          </p>
          <a
            href="https://doi.org/10.1002/mds.26431"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#4318FF] hover:underline font-bold"
          >
            Source: Movement Disorders, 30(12), 1600â€“1611
          </a>
        </div>
      </motion.section>

      {/* Section 2: Recognizing Common Symptoms */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-[20px] overflow-hidden shadow-[0_18px_40px_rgba(112,144,176,0.12)] flex flex-col md:flex-row-reverse"
      >
        <div className="md:w-1/3">
          <img
            src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=800"
            alt="Doctor examining patient"
            className="w-full h-full object-cover min-h-[200px] sm:min-h-[280px] md:min-h-[300px]"
          />
        </div>
        <div className="md:w-2/3 p-4 sm:p-6 md:p-8 lg:p-10">
        <h2 className="text-2xl font-bold text-[#2B3674] mb-4 flex items-center gap-2">
          <Activity className="w-6 h-6 text-[#4318FF]" />
          Section 2: Recognizing Common Symptoms
        </h2>
        <p className="text-[#707EAE] leading-relaxed mb-6">
          Parkinson's symptoms vary from person to person, but they generally fall into two categories. Knowing what to look for helps you provide better care and keeps the doctor well-informed.
        </p>

        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold text-[#2B3674] mb-3">Motor Symptoms</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-[#707EAE]">
                <span className="text-[#4318FF] mt-1">â—</span>
                <span><strong>Slowness of Movement:</strong> This is actually the most common symptom, affecting over 77% of patients. You might notice your parent taking longer to get dressed, walking with shorter steps, or struggling to stand up from a chair.</span>
              </li>
              <li className="flex items-start gap-2 text-[#707EAE]">
                <span className="text-[#4318FF] mt-1">â—</span>
                <span><strong>Tremors:</strong> Shaking, usually starting in one hand while at rest.</span>
              </li>
              <li className="flex items-start gap-2 text-[#707EAE]">
                <span className="text-[#4318FF] mt-1">â—</span>
                <span><strong>Stiffness:</strong> Muscles feel tight and inflexible, making it hard to swing their arms while walking.</span>
              </li>
              <li className="flex items-start gap-2 text-[#707EAE]">
                <span className="text-[#4318FF] mt-1">â—</span>
                <span><strong>Balance & Gait Issues:</strong> Difficulty turning around, or feeling like their feet are "glued to the floor".</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-bold text-[#2B3674] mb-3">Non-Motor Symptoms</h3>
            <p className="text-[#707EAE] mb-3">These symptoms are often overlooked but can affect daily life even more than motor symptoms.</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-[#707EAE]">
                <span className="text-[#4318FF] mt-1">â—</span>
                <span><strong>Mood Changes:</strong> Depression, apathy, and anxiety often appear together.</span>
              </li>
              <li className="flex items-start gap-2 text-[#707EAE]">
                <span className="text-[#4318FF] mt-1">â—</span>
                <span><strong>Sleep Problems:</strong> Excessive daytime sleepiness, or acting out dreams at night.</span>
              </li>
              <li className="flex items-start gap-2 text-[#707EAE]">
                <span className="text-[#4318FF] mt-1">â—</span>
                <span><strong>Autonomic Issues:</strong> Severe constipation, frequent/urgent urination, and feeling dizzy when standing up.</span>
              </li>
              <li className="flex items-start gap-2 text-[#707EAE]">
                <span className="text-[#4318FF] mt-1">â—</span>
                <span><strong>Pain & Fatigue:</strong> Unexplained muscle aches and feeling constantly tired.</span>
              </li>
            </ul>
          </div>

          <div className="bg-[#FFF9E6] border-l-4 border-[#FFB800] p-4 rounded-lg">
            <p className="flex items-start gap-2 text-[#2B3674] font-bold">
              <Lightbulb className="w-5 h-5 text-[#FFB800] shrink-0 mt-0.5" />
              <span><strong>Caregiver Tip:</strong> If you notice any of these symptoms, especially the "invisible" ones, log them in your ParkiCare Daily Record. It is crucial information for the neurologist!</span>
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-1">
          <a href="https://doi.org/10.3389/fnagi.2022.935841" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#4318FF] hover:underline font-bold">
            Source: Frontiers in Aging Neuroscience, 14(14), 935841
          </a>
          <a href="https://doi.org/10.1080/14737175.2021.1883428" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#4318FF] hover:underline font-bold">
            Source: Expert Review of Neurotherapeutics, 21(3), 1â€“18
          </a>
        </div>
        </div>
      </motion.section>

      {/* Section 3: How Care Needs Change Over Time */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-[20px] overflow-hidden shadow-[0_18px_40px_rgba(112,144,176,0.12)] flex flex-col md:flex-row"
      >
        <div className="md:w-1/3">
          <img
            src="https://images.unsplash.com/photo-1581594693702-fbdc51b2763b?auto=format&fit=crop&q=80&w=800"
            alt="Timeline concept with clock"
            className="w-full h-full object-cover min-h-[200px] sm:min-h-[280px] md:min-h-[300px]"
          />
        </div>
        <div className="md:w-2/3 p-4 sm:p-6 md:p-8 lg:p-10">
        <h2 className="text-2xl font-bold text-[#2B3674] mb-4 flex items-center gap-2">
          <Clock className="w-6 h-6 text-[#4318FF]" />
          Section 3: How Care Needs Change Over Time
        </h2>
        <p className="text-[#707EAE] leading-relaxed mb-6">
          Parkinson's progresses differently for everyone. It is more helpful to understand how your loved one's needs and your role as a caregiver will change over time.
        </p>

        <div className="space-y-6">
          <div className="bg-[#F4F7FE] p-6 rounded-xl">
            <h3 className="text-xl font-bold text-[#2B3674] mb-3">Early Stage</h3>
            <div className="space-y-3">
              <div>
                <p className="font-bold text-[#4318FF] mb-1">What it looks like:</p>
                <p className="text-[#707EAE]">Symptoms like tremors usually affect only one side of the body. You might notice they get tired more easily while walking.</p>
              </div>
              <div>
                <p className="font-bold text-[#4318FF] mb-1">Your role:</p>
                <p className="text-[#707EAE]">They can still live independently. Your main job is to help them establish a medication routine and encourage daily exercise.</p>
              </div>
              <a href="https://doi.org/10.1002/mds.26431" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#4318FF] hover:underline font-bold mt-2">
                Source: Movement Disorders, 30(12), 1600â€“1611
              </a>
            </div>
          </div>

          <div className="bg-[#FFF4ED] p-6 rounded-xl">
            <h3 className="text-xl font-bold text-[#2B3674] mb-3">Mid Stage</h3>
            <div className="space-y-3">
              <div>
                <p className="font-bold text-[#FF6B35] mb-1">What it looks like:</p>
                <p className="text-[#707EAE]">Symptoms affect both sides. They may experience "Freezing of Gait" (feet feeling stuck) and have trouble standing up from a chair or turning over in bed.</p>
              </div>
              <div>
                <p className="font-bold text-[#FF6B35] mb-1">Your Role:</p>
                <p className="text-[#707EAE]">Fall prevention is your top priority. They will need your physical assistance with daily tasks like dressing, bathing, and moving around the house safely.</p>
              </div>
              <a href="https://doi.org/10.1007/s00702-019-02033-9" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#4318FF] hover:underline font-bold mt-2">
                Source: Journal of Neural Transmission, 126(7), 841â€“851
              </a>
            </div>
          </div>

          <div className="bg-[#FEF0F0] p-6 rounded-xl">
            <h3 className="text-xl font-bold text-[#2B3674] mb-3">Late Stage</h3>
            <div className="space-y-3">
              <div>
                <p className="font-bold text-[#DC2626] mb-1">What it looks like:</p>
                <p className="text-[#707EAE]">Severe stiffness and mobility loss. They may require a wheelchair or become bedbound.</p>
              </div>
              <div>
                <p className="font-bold text-[#DC2626] mb-1">Your Role:</p>
                <p className="text-[#707EAE]">They need full-time assistance for all daily activities. At this stage, providing emotional, family, and spiritual comfort becomes just as important as physical care.</p>
              </div>
              <a href="https://doi.org/10.1038/nrneurol.2012.126" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#4318FF] hover:underline font-bold mt-2">
                Source: Nature Reviews Neurology, 8(8), 435â€“442
              </a>
            </div>
          </div>
        </div>
        </div>
      </motion.section>

      {/* Section 4: Your Daily Observation Checklist */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white rounded-[20px] overflow-hidden shadow-[0_18px_40px_rgba(112,144,176,0.12)] flex flex-col md:flex-row-reverse"
      >
        <div className="md:w-1/3">
          <img
            src="https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&q=80&w=800"
            alt="Checklist and clipboard"
            className="w-full h-full object-cover min-h-[200px] sm:min-h-[280px] md:min-h-[300px]"
          />
        </div>
        <div className="md:w-2/3 p-4 sm:p-6 md:p-8 lg:p-10">
        <h2 className="text-2xl font-bold text-[#2B3674] mb-4 flex items-center gap-2">
          <Clipboard className="w-6 h-6 text-[#4318FF]" />
          Section 4: Your Daily Observation Checklist
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-[#2B3674] mb-3">1. Medication Timing & "On/Off" Periods</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-[#707EAE]">
                <span className="text-[#4318FF] mt-1">-</span>
                <span>Parkinson's medication is highly time-critical.</span>
              </li>
              <li className="flex items-start gap-2 text-[#707EAE]">
                <span className="text-[#4318FF] mt-1">-</span>
                <span>A 30-minute delay matters.</span>
              </li>
              <li className="flex items-start gap-2 text-[#707EAE]">
                <span className="text-[#4318FF] mt-1">-</span>
                <span>And notice when the medication wears off before the next dose is due.</span>
              </li>
              <li className="flex items-start gap-2 text-[#707EAE]">
                <span className="text-[#4318FF] mt-1">-</span>
                <span>Do their symptoms suddenly worsen?</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-bold text-[#2B3674] mb-3">2. Mobility & Fall Risks</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-[#707EAE]">
                <span className="text-[#4318FF] mt-1">-</span>
                <span>Do their feet suddenly feel glued to the floor while walking?</span>
              </li>
              <li className="flex items-start gap-2 text-[#707EAE]">
                <span className="text-[#4318FF] mt-1">-</span>
                <span>Are they struggling to stand up from a chair, or having difficulty turning over in bed?</span>
              </li>
              <li className="flex items-start gap-2 text-[#707EAE]">
                <span className="text-[#4318FF] mt-1">-</span>
                <span>These are major fall risk warnings.</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-bold text-[#2B3674] mb-3">3. The "Invisible" Fluctuations</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-[#707EAE]">
                <span className="text-[#4318FF] mt-1">-</span>
                <span>Do they experience intense anxiety, sadness, or panic right before their next pill is due?</span>
              </li>
              <li className="flex items-start gap-2 text-[#707EAE]">
                <span className="text-[#4318FF] mt-1">-</span>
                <span>Note any sudden dizziness upon standing, severe pain, or excessive sleepiness during the day.</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-bold text-[#2B3674] mb-3">4. Daily Care & Comfort</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-[#707EAE]">
                <span className="text-[#4318FF] mt-1">-</span>
                <span>Do they have any choking, coughing, or swallowing difficulties during meals?</span>
              </li>
              <li className="flex items-start gap-2 text-[#707EAE]">
                <span className="text-[#4318FF] mt-1">-</span>
                <span>How many times do they wake up at night, and are they acting out their dreams?</span>
              </li>
            </ul>
          </div>

          <div className="bg-[#FFF9E6] border-l-4 border-[#FFB800] p-4 rounded-lg">
            <p className="flex items-start gap-2 text-[#2B3674] font-bold">
              <Lightbulb className="w-5 h-5 text-[#FFB800] shrink-0 mt-0.5" />
              <span><strong>Action Item:</strong> Don't try to remember all of this! Use the ParkiCare Daily Record to quickly tap and save these observations as they happen.</span>
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-1">
          <a href="https://doi.org/10.1080/14737175.2021.1883428" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#4318FF] hover:underline font-bold">
            Source: Expert Review of Neurotherapeutics, 21(3), 1â€“18
          </a>
          <a href="https://doi.org/10.2147/dnnd.s535306" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#4318FF] hover:underline font-bold">
            Source: Degenerative Neurological and Neuromuscular Disease, Volume 15, 101â€“116
          </a>
        </div>
        </div>
      </motion.section>

      {/* Section 5: Why Your Tracking is the Doctor's Best Tool */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-white rounded-[20px] overflow-hidden shadow-[0_18px_40px_rgba(112,144,176,0.12)] flex flex-col md:flex-row"
      >
        <div className="md:w-1/3">
          <img
            src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=800"
            alt="Doctor and patient collaboration"
            className="w-full h-full object-cover min-h-[200px] sm:min-h-[280px] md:min-h-[300px]"
          />
        </div>
        <div className="md:w-2/3 p-4 sm:p-6 md:p-8 lg:p-10">
        <h2 className="text-2xl font-bold text-[#2B3674] mb-4 flex items-center gap-2">
          <Heart className="w-6 h-6 text-[#4318FF]" />
          Section 5: Why Your Tracking is the Doctor's Best Tool
        </h2>
        <div className="space-y-4 text-[#707EAE] leading-relaxed">
          <p>
            It's easy to feel like tracking daily symptoms is just "extra paperwork," but in Parkinson's care, your records are the actual medicine prescription.
          </p>
          <p>
            Your neurologist only sees your parent for about <strong className="text-[#2B3674]">15 minutes</strong> every few months. They cannot see the sudden "Off" periods, the midnight hallucinations, or the non-motor anxiety crashes that happen at home.
          </p>
          <p>
            Parkinson's treatment is highly individualized. Doctors rely <strong className="text-[#2B3674]">entirely</strong> on your logs of "when symptoms worsen" to adjust the exact timing and dosage of Levodopa.
          </p>
          <p className="text-[#4318FF] font-bold text-lg">
            By using the ParkiCare Daily Record, you are not just a caregiver; you are the doctor's most vital clinical partner.
          </p>
        </div>

        <div className="mt-4 space-y-1">
          <a href="https://doi.org/10.1080/14737175.2021.1883428" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#4318FF] hover:underline font-bold">
            Source: Expert Review of Neurotherapeutics, 21(3), 1â€“18
          </a>
          <a href="https://doi.org/10.2147/dnnd.s535306" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#4318FF] hover:underline font-bold">
            Source: Degenerative Neurological and Neuromuscular Disease, Volume 15, 101â€“116
          </a>
        </div>
        </div>
      </motion.section>

      {/* Section 6: The Golden Rules of Medication */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="bg-white rounded-[20px] overflow-hidden shadow-[0_18px_40px_rgba(112,144,176,0.12)] flex flex-col md:flex-row-reverse"
      >
        <div className="md:w-1/3">
          <img
            src="https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&q=80&w=800"
            alt="Medication and pills"
            className="w-full h-full object-cover min-h-[200px] sm:min-h-[280px] md:min-h-[300px]"
          />
        </div>
        <div className="md:w-2/3 p-4 sm:p-6 md:p-8 lg:p-10">
        <h2 className="text-2xl font-bold text-[#2B3674] mb-4 flex items-center gap-2">
          <AlertCircle className="w-6 h-6 text-[#4318FF]" />
          Section 6: The Golden Rules of Medication
        </h2>
        <p className="text-[#707EAE] leading-relaxed mb-6">
          Parkinson's medications are unlike typical blood pressure or vitamin pills. They are <strong className="text-[#2B3674]">Time-Critical</strong>.
        </p>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-[#4318FF] mt-2 shrink-0"></div>
            <div>
              <p className="font-bold text-[#2B3674] mb-1">Timing is Everything:</p>
              <p className="text-[#707EAE]">Taking medication even 30 minutes late can cause a severe "Off" period, freezing of gait, or a sudden crash in mood/energy.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-[#4318FF] mt-2 shrink-0"></div>
            <div>
              <p className="font-bold text-[#2B3674] mb-1">Never Adjust Independently:</p>
              <p className="text-[#707EAE]">Even if your parent is having a "bad day," never increase the dose or change the schedule without consulting the doctor.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-[#4318FF] mt-2 shrink-0"></div>
            <div>
              <p className="font-bold text-[#2B3674] mb-1">Set Persistent Reminders:</p>
              <p className="text-[#707EAE]">Because household chores can be distracting, always rely on alarms.</p>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] p-4 rounded-xl">
          <p className="text-white font-bold flex items-center gap-2">
            ðŸ‘‰ <span>Tap here to set up your ParkiCare Persistent Medication Reminders now.</span>
          </p>
        </div>

        <div className="mt-4">
          <a href="https://doi.org/10.1080/14737175.2021.1883428" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#4318FF] hover:underline font-bold">
            Source: Expert Review of Neurotherapeutics, 21(3), 1â€“18
          </a>
        </div>
        </div>
      </motion.section>

      {/* Section 7: Daily Care & Home Guidelines */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="bg-white rounded-[20px] overflow-hidden shadow-[0_18px_40px_rgba(112,144,176,0.12)] flex flex-col md:flex-row"
      >
        <div className="md:w-1/3">
          <img
            src="https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&q=80&w=800"
            alt="Home care and daily activities"
            className="w-full h-full object-cover min-h-[200px] sm:min-h-[280px] md:min-h-[300px]"
          />
        </div>
        <div className="md:w-2/3 p-4 sm:p-6 md:p-8 lg:p-10">
        <h2 className="text-2xl font-bold text-[#2B3674] mb-4 flex items-center gap-2">
          <Activity className="w-6 h-6 text-[#4318FF]" />
          Section 7: Daily Care & Home Guidelines
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold text-[#2B3674] mb-3">Nutrition & Digestion</h3>
            <div className="space-y-3">
              <div>
                <p className="font-bold text-[#4318FF] mb-1">Combat Constipation:</p>
                <p className="text-[#707EAE]">Ensure they drink 1.5 to 2 liters of water daily, and include plenty of fruits, vegetables, and olive oil in their diet.</p>
              </div>
              <div>
                <p className="font-bold text-[#4318FF] mb-1">Drooling/Swallowing:</p>
                <p className="text-[#707EAE]">Drooling happens because of infrequent swallowing, not extra saliva. Encourage them to chew gum or use a "swallow timer" to practice swallowing more often.</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold text-[#2B3674] mb-3">Mobility & Safety</h3>
            <div className="space-y-3">
              <div>
                <p className="font-bold text-[#4318FF] mb-1">Preventing Dizzy Spells:</p>
                <p className="text-[#707EAE]">Blood pressure drops are common when standing up. Teach them to rise very slowly from a bed or chair. Elevating the head of the bed by 30-45 degrees during sleep can also help.</p>
              </div>
              <div>
                <p className="font-bold text-[#4318FF] mb-1">Exercise:</p>
                <p className="text-[#707EAE]">Regular physical activity, such as low-intensity walking or yoga, not only maintains mobility but also actively reduces Parkinson's-related pain.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <a href="https://doi.org/10.1080/14737175.2021.1883428" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#4318FF] hover:underline font-bold">
            Source: Expert Review of Neurotherapeutics, 21(3), 1â€“18
          </a>
        </div>
        </div>
      </motion.section>

      {/* Section 8: Red Flags - When to Call the Doctor */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="bg-white rounded-[20px] overflow-hidden shadow-[0_18px_40px_rgba(112,144,176,0.12)] flex flex-col md:flex-row-reverse"
      >
        <div className="md:w-1/3">
          <img
            src="https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&q=80&w=800"
            alt="Emergency call and healthcare"
            className="w-full h-full object-cover min-h-[200px] sm:min-h-[280px] md:min-h-[300px]"
          />
        </div>
        <div className="md:w-2/3 p-4 sm:p-6 md:p-8 lg:p-10">
        <h2 className="text-2xl font-bold text-[#2B3674] mb-4 flex items-center gap-2">
          <Phone className="w-6 h-6 text-red-600" />
          Section 8: Red Flags - When to Call the Doctor
        </h2>
        <p className="text-[#707EAE] leading-relaxed mb-6">
          You are doing a great job, but you are not expected to handle everything alone. Contact your neurologist or seek immediate professional help if you observe any of the following:
        </p>

        <div className="space-y-6">
          <div className="bg-red-50 border-l-4 border-red-500 p-5 rounded-lg">
            <h3 className="text-lg font-bold text-red-700 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Physical Emergencies
            </h3>
            <div className="space-y-3">
              <div>
                <p className="font-bold text-[#2B3674] mb-1">Frequent Falls or Fainting:</p>
                <p className="text-[#707EAE]">If they feel light-headed or actually faint when standing up, their blood pressure medication may need urgent adjustment.</p>
              </div>
              <div>
                <p className="font-bold text-[#2B3674] mb-1">Choking:</p>
                <p className="text-[#707EAE]">Any signs of silent aspiration (choking on saliva or food) require a speech-language therapist's intervention.</p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 border-l-4 border-purple-500 p-5 rounded-lg">
            <h3 className="text-lg font-bold text-purple-700 mb-3 flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Mental & Emotional Crises
            </h3>
            <div className="space-y-3">
              <div>
                <p className="font-bold text-[#2B3674] mb-1">Sudden Hallucinations:</p>
                <p className="text-[#707EAE]">Seeing things that aren't there (psychosis) is a severe complication that reduces quality of life and requires medication adjustments.</p>
              </div>
              <div>
                <p className="font-bold text-[#2B3674] mb-1">Severe Caregiver Burnout or Patient Depression:</p>
                <p className="text-[#707EAE]">In the advanced stages, it is normal for both the patient and caregiver to feel overwhelmed. If your loved one expresses a loss of "meaning in life" or you feel completely exhausted, please reach out to Parkinson's support groups, psychological counselors, or palliative care teams.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <a href="https://doi.org/10.1080/14737175.2021.1883428" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#4318FF] hover:underline font-bold">
            Source: Expert Review of Neurotherapeutics, 21(3), 1â€“18
          </a>
        </div>
        </div>
      </motion.section>
    </div>
  );
}
