import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useMotionTemplate, useMotionValue } from "motion/react";
import { User, Lock, ArrowRight, ShieldCheck, Info } from "lucide-react";
import { toast } from "sonner";
import { Footer } from "@/components/layout/Footer";
import { authService } from "@/services/auth";
import { useAuth } from "@/context/AuthContext";

export function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    nickname: "",
    password: "",
    confirmPassword: ""
  });
  const [isLoading, setIsLoading] = useState(false);

  // Mouse parallax effect for the split screen background
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ clientX, clientY }: React.MouseEvent) {
    const { innerWidth, innerHeight } = window;
    const x = (clientX / innerWidth - 0.5) * 20; 
    const y = (clientY / innerHeight - 0.5) * 20;
    mouseX.set(x);
    mouseY.set(y);
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nickname || !formData.password || !formData.confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    if (formData.password.length > 20) {
      toast.error("Password must be less than 20 characters long");
      return;
    }
    if (!/^[a-zA-Z0-9]{6,20}$/.test(formData.nickname)) {
      toast.error("Nickname must be 6–20 alphanumeric characters");
      return;
    }

    setIsLoading(true);
    try {
      const data = await authService.register(formData.nickname, formData.password);
      login({ caregiverId: data.caregiverId, uniqueId: data.uniqueId, caregiverNickname: data.nickname });
      toast.success("Account created successfully!");
      navigate("/patient-setup", { state: { caregiverId: data.caregiverId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
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
        className="flex-1 w-full flex relative flex-row-reverse"
        onMouseMove={handleMouseMove}
      >
        {/* Animated Background Decor behind the transparent form */}
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] left-[-5%] w-[40rem] h-[40rem] rounded-full bg-indigo-200/50 blur-[100px] pointer-events-none z-0" 
        />
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-[-10%] left-[20%] w-[30rem] h-[30rem] rounded-full bg-blue-200/50 blur-[100px] pointer-events-none z-0" 
        />

        {/* Right side Image with Parallax (Mirrored from Login) */}
        <div className="hidden lg:flex w-[55%] relative overflow-hidden bg-slate-900 shadow-[-20px_0_40px_rgba(0,0,0,0.1)] z-10 rounded-l-[3rem] items-end justify-start p-16">
          <motion.img
            src="https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&q=80&w=1080"
            alt="Caregiver and patient"
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
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-6">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-xs font-medium tracking-wide">Join Our Community</span>
            </div>
            <h1 className="text-5xl font-bold tracking-tight mb-6 leading-[1.1] text-transparent bg-clip-text bg-gradient-to-r from-white to-indigo-200">
              Your partner in navigating daily care.
            </h1>
            <p className="text-lg text-slate-300 font-light max-w-md">
              Create an account to track medications, log daily vitals, and share real-time updates with your healthcare team.
            </p>
          </motion.div>
        </div>

        {/* Left side Form (Transparent & Animated) */}
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
              whileHover={{ y: -4 }}
              transition={{ type: "spring" as const, stiffness: 400, damping: 30 }}
              className="space-y-5 bg-white/30 backdrop-blur-2xl p-8 sm:p-10 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-white/60 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
              
              <motion.div variants={itemVariants} className="mb-2 relative z-10">
                <h3 className="text-3xl font-bold mb-2 text-slate-900">Create an account</h3>
                <p className="text-slate-600 text-sm font-medium">Join ParkiCare to manage and coordinate care.</p>
              </motion.div>

              <motion.div variants={itemVariants} className="space-y-4 pt-4 relative z-10">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <User className="w-5 h-5 text-slate-400 focus-within:text-indigo-600 transition-colors" />
                  </div>
                  <input
                    type="text"
                    name="nickname"
                    value={formData.nickname}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3.5 bg-white/50 backdrop-blur-md border border-white/60 rounded-2xl text-slate-900 outline-none focus:ring-4 focus:ring-indigo-600/10 focus:border-indigo-500 transition-all placeholder:text-slate-500 text-sm font-medium shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                    placeholder="User Nickname (Caregiver)"
                    required
                  />
                </div>
                
                <div className="flex items-start gap-2 px-1 pb-1">
                  <Info className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    For privacy reasons, please use a nickname instead of your real name.
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <Lock className="w-5 h-5 text-slate-400 focus-within:text-indigo-600 transition-colors" />
                  </div>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3.5 bg-white/50 backdrop-blur-md border border-white/60 rounded-2xl text-slate-900 outline-none focus:ring-4 focus:ring-indigo-600/10 focus:border-indigo-500 transition-all placeholder:text-slate-500 text-sm font-medium shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                    placeholder="Password"
                    required
                  />
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <ShieldCheck className="w-5 h-5 text-slate-400 focus-within:text-indigo-600 transition-colors" />
                  </div>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3.5 bg-white/50 backdrop-blur-md border border-white/60 rounded-2xl text-slate-900 outline-none focus:ring-4 focus:ring-indigo-600/10 focus:border-indigo-500 transition-all placeholder:text-slate-500 text-sm font-medium shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                    placeholder="Confirm Password"
                    required
                  />
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="pt-4 relative z-10">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isLoading}
                  className="w-full relative overflow-hidden group/btn py-3.5 rounded-2xl bg-slate-900 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-indigo-800 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" />
                  <span className="relative z-10">
                    {isLoading ? "Creating account..." : "Sign Up"}
                  </span>
                  {!isLoading && (
                    <ArrowRight className="w-5 h-5 relative z-10 group-hover/btn:translate-x-1 transition-transform" />
                  )}
                </motion.button>
              </motion.div>

              <motion.div variants={itemVariants} className="text-center mt-6 pt-6 border-t border-slate-200/50 relative z-10">
                <p className="text-sm font-medium text-slate-600">
                  Already have an account?{" "}
                  <Link to="/login" className="text-indigo-600 font-bold hover:text-indigo-700 hover:underline underline-offset-4">
                    Sign in
                  </Link>
                </p>
              </motion.div>
            </motion.form>
          </div>
        </div>
      </div>

      <div className="w-full relative z-30 shrink-0">
        <Footer hideDisclaimer />
      </div>
    </div>
  );
};
