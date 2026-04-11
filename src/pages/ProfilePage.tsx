import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { User, Copy, CheckCircle2, ArrowRight, HeartPulse, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Footer } from "@/components/layout/Footer";

export function ProfilePage() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get data from state, then fallback to localStorage, then default
  const { 
    caregiverId = localStorage.getItem("parkicare_caregiver_id") || "948271", 
    patientNickname = localStorage.getItem("parkicare_patient_nickname") || "Dear Parent", 
    ageRange = localStorage.getItem("parkicare_patient_age") || "70-79" 
  } = location.state || {};

  const [copied, setCopied] = useState(false);

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(caregiverId);
      setCopied(true);
      toast.success("User ID copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments where clipboard API is blocked
      try {
        const textArea = document.createElement("textarea");
        textArea.value = caregiverId;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
        
        setCopied(true);
        toast.success("User ID copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error("Failed to copy ID.");
      }
    }
  };

  const handleContinue = () => {
    navigate("/home");
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#EBF4FF] via-[#F4F7FE] to-[#E0EAFC] text-[#2B3674] font-sans flex flex-col selection:bg-indigo-200 relative overflow-hidden">
      
      {/* Animated Light Blue Gradient Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] left-[-5%] w-[45rem] h-[45rem] rounded-full bg-blue-200/40 blur-[100px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            x: [0, -40, 0],
            y: [0, 40, 0],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-[-10%] right-[-5%] w-[40rem] h-[40rem] rounded-full bg-cyan-200/30 blur-[120px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            x: [0, 30, 0],
            y: [0, -30, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 4 }}
          className="absolute top-[20%] left-[30%] w-[30rem] h-[30rem] rounded-full bg-sky-200/40 blur-[80px]"
        />
      </div>

      {/* Sleek Top Navigation */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring" as const, stiffness: 200, damping: 20 }}
        className="relative z-50 px-4 sm:px-8 py-3 sm:py-4 bg-white/90 backdrop-blur-xl shadow-[0_18px_40px_rgba(112,144,176,0.08)] flex items-center justify-between"
      >
        <Link to="/" className="flex items-center gap-3 group">
          <motion.img 
            whileHover={{ rotate: 10, scale: 1.1 }}
            src="/logo-nav.png"
            alt="ParkiCare"
            className="w-12 h-12 object-contain drop-shadow-sm" 
          />
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#2B3674] to-indigo-600">
            ParkiCare
          </span>
        </Link>
        
        <button 
          onClick={() => navigate("/login")}
          className="flex items-center gap-2 text-sm font-bold text-[#A3AED0] hover:text-[#2B3674] transition-colors bg-[#F4F7FE] px-4 py-2 rounded-full border-none hover:bg-[#E9E3FF]"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </motion.nav>

      {/* Main Profile Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 relative z-20">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, type: "spring" as const, bounce: 0.4 }}
          className="w-full max-w-2xl bg-white rounded-[20px] shadow-[0_18px_40px_rgba(112,144,176,0.12)] border-none overflow-hidden relative"
        >
          <div className="px-4 sm:px-8 md:px-10 pb-6 sm:pb-10 relative bg-white">
            <div className="pt-6 sm:pt-10 mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#2B3674] tracking-tight">Your Profile is Ready</h1>
              <p className="text-[#A3AED0] mt-2 font-bold">Please save your User ID to log in next time.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Unique ID Card */}
              <div className="p-6 rounded-[20px] bg-[#F4F7FE] border-none flex flex-col relative group">
                <div className="absolute right-4 top-4">
                  <div className="w-8 h-8 rounded-full bg-[#F5F3FF] flex items-center justify-center text-[#8B5CF6]">
                    <User className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-sm font-bold text-[#A3AED0] uppercase tracking-wider mb-2">Login User ID</h3>
                <div className="flex items-center gap-3">
                  <span className="text-3xl sm:text-4xl font-extrabold text-[#8B5CF6] tracking-tight drop-shadow-sm">{caregiverId}</span>
                </div>
                <button 
                  onClick={handleCopyId}
                  className="mt-6 w-full py-3 bg-white text-[#8B5CF6] font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#F5F3FF] transition-all shadow-sm rounded-xl border-none"
                >
                  {copied ? (
                    <><CheckCircle2 className="w-4 h-4 text-[#8B5CF6]" /> Copied!</>
                  ) : (
                    <><Copy className="w-4 h-4" /> Copy ID to Clipboard</>
                  )}
                </button>
              </div>

              {/* Patient Details Card */}
              <div className="p-6 rounded-[20px] bg-[#F4F7FE] border-none flex flex-col relative">
                <div className="absolute right-4 top-4">
                  <div className="w-8 h-8 rounded-full bg-[#F5F3FF] flex items-center justify-center text-[#8B5CF6]">
                    <HeartPulse className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-sm font-bold text-[#A3AED0] uppercase tracking-wider mb-2">Patient Config</h3>
                
                <div className="space-y-4 mt-2 flex-1">
                  <div>
                    <p className="text-xs font-bold text-[#A3AED0] mb-1">Nickname</p>
                    <p className="font-extrabold text-[#2B3674] text-lg drop-shadow-sm">{patientNickname}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#A3AED0] mb-1">Age Range</p>
                    <p className="font-extrabold text-[#2B3674] text-lg drop-shadow-sm">{ageRange} years</p>
                  </div>
                </div>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleContinue}
              className="mt-8 w-full py-4 rounded-2xl bg-[#8B5CF6] text-white font-bold flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(139,92,246,0.2)] hover:shadow-[0_15px_40px_rgba(139,92,246,0.3)] transition-all group relative overflow-hidden border-none"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <span className="relative z-10 flex items-center gap-2">
                Go to Dashboard
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </motion.button>
          </div>
        </motion.div>
      </main>

      <div className="relative z-20 w-full shrink-0">
        <Footer hideDisclaimer />
      </div>
    </div>
  );
}
