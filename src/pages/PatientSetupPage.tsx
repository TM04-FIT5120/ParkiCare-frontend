import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, useMotionTemplate, useMotionValue } from "motion/react";
import { User, ArrowRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import * as Select from "@radix-ui/react-select";
import { Footer } from "@/components/layout/Footer";
import { patientService } from "@/services/patient";
import { useAuth } from "@/context/AuthContext";

const AGE_RANGES = ["50-59", "60-69", "70-79", "80-89", "90-100", "Over 100"];

export function PatientSetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setPatient } = useAuth();
  const generatedId = user?.caregiverId ?? location.state?.caregiverId ?? Math.floor(100000 + Math.random() * 900000);

  const [patientNickname, setPatientNickname] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ clientX, clientY }: React.MouseEvent) {
    const { innerWidth, innerHeight } = window;
    const x = (clientX / innerWidth - 0.5) * 20;
    const y = (clientY / innerHeight - 0.5) * 20;
    mouseX.set(x);
    mouseY.set(y);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientNickname || !ageRange) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    try {
      const data = await patientService.createPatient(
        Number(generatedId),
        patientNickname,
        ageRange,
      );
      setPatient({ patientId: data.id, patientNickname: data.patientNickname, patientAge: data.ageRange });
      toast.success("Setup complete!");
      navigate("/profile", { state: { caregiverId: generatedId, patientNickname, ageRange } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Patient setup failed");
    } finally {
      setIsLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#f8fafc] text-slate-800 font-sans overflow-hidden relative">
      <div 
        className="flex-1 w-full flex relative"
        onMouseMove={handleMouseMove}
      >
      {/* Background Decor */}
      <div className="absolute top-[-10%] right-[-5%] w-[40rem] h-[40rem] rounded-full bg-blue-100/40 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[30rem] h-[30rem] rounded-full bg-red-100/30 blur-[100px] pointer-events-none" />

      {/* Left side Form */}
      <div className="w-full lg:w-[45%] flex items-center justify-center px-8 py-4 sm:px-12 sm:py-6 relative z-20">
        <div className="w-full max-w-[420px]">
          <motion.div
            className="flex justify-center mb-3"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <img src="/logo.png" alt="ParkiCare" className="w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 object-contain drop-shadow-md" />
          </motion.div>

          <motion.form 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            onSubmit={handleSubmit}
            className="space-y-6 bg-white/70 backdrop-blur-2xl p-8 rounded-[2rem] shadow-[0_8px_40px_rgb(0,0,0,0.06)] border border-white/50"
          >
            <motion.div variants={itemVariants} className="mb-2">
              <h3 className="text-3xl font-bold mb-2 text-slate-900">Patient Details</h3>
              <p className="text-slate-500 text-sm">
                Set up your patient's profile. No real names or exact birth dates required.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="space-y-5 pt-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 ml-1">Patient Nickname</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <User className="w-5 h-5 text-blue-400 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    value={patientNickname}
                    onChange={(e) => setPatientNickname(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all placeholder:text-slate-400 text-sm font-medium shadow-sm"
                    placeholder="e.g., Dear Parent"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 ml-1">Approximate Age Range</label>
                
                <Select.Root value={ageRange} onValueChange={setAgeRange} required>
                  <Select.Trigger className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all text-sm font-medium shadow-sm data-[placeholder]:text-slate-400">
                    <Select.Value placeholder="Select Age Range" />
                    <Select.Icon>
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    </Select.Icon>
                  </Select.Trigger>

                  <Select.Portal>
                    <Select.Content 
                      className="overflow-hidden bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-slate-100 z-50"
                      position="popper"
                      sideOffset={8}
                    >
                      <Select.Viewport className="p-2">
                        {AGE_RANGES.map((range) => (
                          <Select.Item
                            key={range}
                            value={range}
                            className="relative flex items-center px-8 py-3 text-sm font-medium text-slate-700 rounded-xl cursor-pointer select-none outline-none data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-700 transition-colors"
                          >
                            <Select.ItemText>{range} years</Select.ItemText>
                            <Select.ItemIndicator className="absolute left-2 inline-flex items-center">
                              <span className="w-2 h-2 bg-blue-600 rounded-full" />
                            </Select.ItemIndicator>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="pt-6">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isLoading}
                className="w-full relative overflow-hidden group py-3.5 rounded-2xl bg-slate-900 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-[0_1px_15px_rgba(15,23,42,0.2)] hover:shadow-[0_8px_25px_rgba(15,23,42,0.3)]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-800 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <span className="relative z-10">
                  {isLoading ? "Saving..." : "Complete Setup"}
                </span>
                {!isLoading && (
                  <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                )}
              </motion.button>
            </motion.div>
          </motion.form>
        </div>
      </div>

      {/* Right side Image with Parallax */}
      <div className="hidden lg:flex w-[55%] relative overflow-hidden bg-slate-900 shadow-2xl z-10 rounded-l-[3rem] items-end justify-start p-16">
        <motion.img
          src="https://images.unsplash.com/photo-1693821193140-7db5779d47ed?auto=format&fit=crop&q=80&w=1080"
          alt="Care and Compassion"
          className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay"
          style={{
            x: useMotionTemplate`calc(-5% + ${mouseX}px)`,
            y: useMotionTemplate`calc(-5% + ${mouseY}px)`,
            scale: 1.1,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/40 to-transparent" />
        
        <motion.div 
          className="relative z-20 text-white max-w-xl"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-6 shadow-xl">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-medium tracking-wide">ParkiCare Platform</span>
          </div>
          <h1 className="text-5xl font-bold tracking-tight mb-6 leading-[1.1] text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
            Privacy-First Care.
          </h1>
          <p className="text-lg text-slate-300 font-light max-w-md">
            We value your privacy. Set up your loved one's profile using nicknames and age ranges to ensure complete anonymity while receiving the best care support.
          </p>
        </motion.div>
      </div>
      </div>

      <div className="w-full relative z-30 shrink-0">
        <Footer />
      </div>
    </div>
  );
}
