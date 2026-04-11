import { motion } from "motion/react";
import { BookOpen, Shield, ChevronRight, Clock } from "lucide-react";

export function GuidePage() {
  const guideSections = [
    {
      title: "Understanding 'On/Off' Periods",
      description: "Learn how to recognize when medication is working optimally ('On') vs when symptoms return before the next dose ('Off').",
      icon: <Clock className="w-6 h-6 text-indigo-500" />,
      color: "bg-indigo-50"
    },
    {
      title: "Fall Prevention at Home",
      description: "Practical steps to minimize fall risks, including removing tripping hazards and installing grab bars.",
      icon: <Shield className="w-6 h-6 text-purple-500" />,
      color: "bg-purple-50"
    },
    {
      title: "Managing Sleep Issues",
      description: "Tips for improving sleep hygiene and managing nighttime symptoms common in Parkinson's.",
      icon: <BookOpen className="w-6 h-6 text-blue-500" />,
      color: "bg-blue-50"
    }
  ];

  return (
    <div className="pb-6 sm:pb-8">
      <div className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="max-w-4xl mx-auto flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#2B3674]">Caregiver Guide</h1>
              <p className="text-sm sm:text-base text-[#A3AED0]">Essential resources and knowledge for Parkinson's care</p>
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
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm mb-6 sm:mb-8 border border-white/50 backdrop-blur-xl overflow-hidden">
            <div className="grid gap-4 sm:gap-6 p-4 sm:p-6 md:px-8 md:py-8">
            {guideSections.map((section, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="group cursor-pointer bg-gray-50/50 hover:bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-gray-100 hover:border-indigo-100 transition-all shadow-sm hover:shadow-md flex items-start gap-3 sm:gap-6"
              >
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${section.color}`}>
                  {section.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-xl font-bold text-[#2B3674] mb-1 sm:mb-2 group-hover:text-indigo-600 transition-colors">
                    {section.title}
                  </h3>
                  <p className="text-sm sm:text-base text-[#707EAE] leading-relaxed">
                    {section.description}
                  </p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400 group-hover:text-indigo-500 group-hover:bg-indigo-50 transition-all self-center shrink-0">
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </motion.div>
            ))}
          </div>
          </div>

          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6 shadow-xl">
            <div className="flex-1">
              <h3 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">Need Emergency Help?</h3>
              <p className="text-sm sm:text-base text-indigo-100">Quick access to emergency contacts and protocols.</p>
            </div>
            <button type="button" className="w-full sm:w-auto px-6 py-3 bg-white text-indigo-600 rounded-xl font-bold shadow-sm hover:shadow-md transition-all active:scale-95">
              View Contacts
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
