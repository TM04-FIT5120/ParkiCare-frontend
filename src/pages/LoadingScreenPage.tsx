import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";

export function LoadingScreenPage() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Start progress
    const duration = 2500; // 2.5s loading
    const start = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      const delta = now - start;
      const percent = Math.min(100, Math.floor((delta / duration) * 100));
      
      setProgress(percent);

      if (percent >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          navigate("/login");
        }, 600); // Small pause at 100%
      }
    }, 16);

    return () => clearInterval(interval);
  }, [navigate]);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] overflow-hidden font-sans text-slate-600">
      {/* Subtle background radial effect */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-[#f4f7fa] to-[#eaeff4] opacity-80 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center w-full max-w-md px-6"
      >
        {/* Logo Animation */}
        <motion.div 
          className="mb-16"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, type: "spring" as const, bounce: 0.4 }}
        >
          <img 
            src="/logo.png"
            alt="ParkiCare Logo"
            className="w-[480px] h-[480px] object-contain drop-shadow-2xl"
          />
        </motion.div>

        {/* Progress Section matching second reference image */}
        <div className="w-full relative space-y-2">
          <div className="flex justify-between items-end mb-2">
            <span className="text-sm font-semibold tracking-[0.2em] text-[#8e9d90] uppercase">
              Ready
            </span>
            <span className="text-3xl font-bold text-[#4c8466]">
              {progress}%
            </span>
          </div>

          {/* Progress Bar Container */}
          <div className="w-full h-2.5 bg-[#d3dfd7] rounded-full overflow-hidden shadow-inner">
            <motion.div
              className="h-full bg-gradient-to-r from-[#6e9b81] to-[#4c8466] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: "linear" }}
            />
          </div>

          <div className="mt-8 text-center w-full flex justify-center pt-8">
            <span className="text-sm font-medium tracking-[0.15em] text-[#a0afb5] uppercase">
              FIT5120 TEAM TM04 | FutureStack
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
