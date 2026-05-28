import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

export function Footer({ hideDisclaimer = false }: { hideDisclaimer?: boolean }) {
  const { t } = useTranslation();
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { 
      opacity: 1, 
      y: 0, 
      transition: { type: "spring" as const, stiffness: 250, damping: 25 } 
    }
  };

  return (
    <footer className="bg-transparent border-t border-[#E0E5F2] py-6 sm:py-8 md:py-10 pb-safe mt-auto w-full relative z-50 overflow-hidden">
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-20px" }}
        className="max-w-[1400px] mx-auto px-4 sm:px-6 flex flex-col items-center justify-center text-center space-y-4"
      >
        {!hideDisclaimer && (
          <>
            <motion.div 
              variants={itemVariants}
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring" as const, stiffness: 400, damping: 10 }}
              className="inline-block px-5 py-1.5 rounded-full bg-white/50 hover:bg-white/90 transition-colors backdrop-blur-sm shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-[#E0E5F2] text-[#A3AED0] text-[11px] font-bold tracking-[0.15em] uppercase cursor-default"
            >
              {t("footer.disclaimerLabel")}
            </motion.div>
            
            <motion.p 
              variants={itemVariants} 
              className="text-xs font-bold text-[#A3AED0] max-w-4xl leading-relaxed"
            >
              {t("footer.disclaimerBody1")} <strong className="text-[#2B3674] font-bold">{t("footer.disclaimerBody2")}</strong>{t("footer.disclaimerBody3")}
            </motion.p>
            
            <motion.p 
              variants={itemVariants} 
              className="text-xs font-bold text-[#A3AED0] mt-1"
            >
              {t("footer.educationalNote")}
            </motion.p>
            
            <motion.div 
              variants={itemVariants} 
              className="w-full max-w-2xl h-px bg-gradient-to-r from-transparent via-[#E0E5F2] to-transparent my-6"
            />
          </>
        )}
        
        <motion.p
          variants={itemVariants}
          className="text-xs font-bold text-[#A3AED0] flex items-center gap-2"
        >
          <span>&copy; {new Date().getFullYear()} ParkiCare</span>
          <span className="w-1 h-1 rounded-full bg-[#A3AED0]/50"></span>
          <span>{t("footer.team")}</span>
        </motion.p>
      </motion.div>
    </footer>
  );
}
