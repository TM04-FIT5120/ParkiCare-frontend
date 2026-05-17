import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useMotionTemplate, useMotionValue } from "motion/react";
import { User, Lock, ArrowRight, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Footer } from "@/components/layout/Footer";
import { authService } from "@/services/auth";
import { patientService } from "@/services/patient";
import { useAuth } from "@/context/AuthContext";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, setPatient } = useAuth();
  const { t } = useTranslation();
  const [userId, setUserId] = useState(() => localStorage.getItem("parkicare_remembered_id") ?? "");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem("parkicare_remembered_id"));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (rememberMe) {
      localStorage.setItem("parkicare_remembered_id", userId);
    } else {
      localStorage.removeItem("parkicare_remembered_id");
    }
  }, [rememberMe, userId]);

  // Mouse parallax effect for the split screen background
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ clientX, clientY }: React.MouseEvent) {
    const { innerWidth, innerHeight } = window;
    const x = (clientX / innerWidth - 0.5) * 20; // 20px movement
    const y = (clientY / innerHeight - 0.5) * 20;
    mouseX.set(x);
    mouseY.set(y);
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!userId || !password) {
      setError(t("login.errorFillAll"));
      return;
    }

    setIsLoading(true);
    try {
      const data = await authService.login(userId, password);
      login({ caregiverId: data.caregiverId, uniqueId: data.uniqueId, caregiverNickname: data.nickname, language: data.language });

      const patients = await patientService.getPatientsByCaregiver(data.caregiverId);
      if (patients.length > 0) {
        const p = patients[0];
        setPatient({ patientId: p.id, patientNickname: p.patientNickname, patientAge: p.ageRange });
        toast.success(t("login.welcomeToast"));
        navigate("/home");
      } else {
        toast.success(t("login.welcomeNewToast"));
        navigate("/patient-setup");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      const isCredentialError =
        message.includes("400") ||
        message.includes("401") ||
        message.toLowerCase().includes("invalid") ||
        message.toLowerCase().includes("incorrect") ||
        message.toLowerCase().includes("not found") ||
        message.toLowerCase().includes("unauthorized") ||
        message.toLowerCase().includes("wrong");
      setError(
        isCredentialError
          ? t("login.errorCredentials")
          : t("login.errorGeneral")
      );
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
    <div className="min-h-screen-dvh w-full flex flex-col bg-[#f8fafc] text-slate-800 font-sans relative pt-safe pb-safe">
      <div 
        className="flex-1 w-full flex relative"
        onMouseMove={handleMouseMove}
      >
        {/* Animated Background Decor behind the transparent form */}
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.6, 0.4] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] right-[-5%] w-[min(40rem,80vw)] h-[min(40rem,80vw)] rounded-full bg-blue-200/50 blur-[100px] pointer-events-none z-0"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-[-10%] right-[20%] w-[min(30rem,70vw)] h-[min(30rem,70vw)] rounded-full bg-indigo-200/50 blur-[100px] pointer-events-none z-0"
        />

        {/* Left side Image with Parallax */}
        <div className="hidden lg:flex w-[55%] relative overflow-hidden bg-slate-900 shadow-2xl z-10 rounded-r-[3rem] items-end justify-start p-16">
          <motion.img
            src="https://images.unsplash.com/photo-1693821193140-7db5779d47ed?auto=format&fit=crop&q=80&w=1080"
            alt="Elderly care"
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
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-6">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs font-medium tracking-wide">{t("login.platform")}</span>
            </div>
            <h1 className="text-5xl font-bold tracking-tight mb-6 leading-[1.1] text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
              {t("login.tagline")}
            </h1>
            <p className="text-lg text-slate-300 font-light max-w-md">
              {t("login.description")}
            </p>
          </motion.div>
        </div>

        {/* Right side Form (Transparent & Animated) */}
        <div className="w-full lg:w-[45%] flex items-center justify-center px-5 py-6 sm:px-10 sm:py-8 md:px-12 md:py-10 relative z-20">
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
              className="space-y-6 bg-white/30 backdrop-blur-2xl p-8 sm:p-10 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-white/60 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
              
              <motion.div variants={itemVariants} className="relative z-10">
                <h3 className="text-3xl font-bold mb-2 text-slate-900">{t("login.title")}</h3>
                <p className="text-slate-600 text-sm font-medium">{t("login.subtitle")}</p>
              </motion.div>

              <motion.div variants={itemVariants} className="space-y-4 pt-4 relative z-10">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <User className={`w-5 h-5 transition-colors ${error ? "text-red-400" : "text-slate-400"}`} />
                  </div>
                  <input
                    type="text"
                    value={userId}
                    onChange={(e) => { setUserId(e.target.value); setError(null); }}
                    className={`w-full pl-11 pr-4 py-3.5 bg-white/50 backdrop-blur-md border rounded-2xl text-slate-900 outline-none transition-all placeholder:text-slate-500 text-sm font-medium shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] ${error ? "border-red-400 focus:ring-4 focus:ring-red-500/10 focus:border-red-500" : "border-white/60 focus:ring-4 focus:ring-blue-600/10 focus:border-blue-500"}`}
                    placeholder={t("login.userIdPlaceholder")}
                    required
                  />
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <Lock className={`w-5 h-5 transition-colors ${error ? "text-red-400" : "text-slate-400"}`} />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    className={`w-full pl-11 pr-4 py-3.5 bg-white/50 backdrop-blur-md border rounded-2xl text-slate-900 outline-none transition-all placeholder:text-slate-500 text-sm font-medium shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] ${error ? "border-red-400 focus:ring-4 focus:ring-red-500/10 focus:border-red-500" : "border-white/60 focus:ring-4 focus:ring-blue-600/10 focus:border-blue-500"}`}
                    placeholder={t("login.passwordPlaceholder")}
                    required
                  />
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="text-sm font-medium">{error}</span>
                  </motion.div>
                )}
              </motion.div>

              <motion.div variants={itemVariants} className="flex items-center justify-between mt-2 relative z-10">
                <label className="flex items-center gap-2 cursor-pointer group/check">
                  <div className="relative flex items-center justify-center w-5 h-5 rounded-[6px] border border-slate-300 bg-white/50 backdrop-blur-sm group-hover/check:border-blue-500 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="sr-only" 
                    />
                    {rememberMe && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute inset-0 bg-blue-600 rounded-[5px] flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                      </motion.div>
                    )}
                  </div>
                  <span className="text-sm font-medium text-slate-700 select-none">{t("login.rememberMe")}</span>
                </label>

              </motion.div>

              <motion.div variants={itemVariants} className="pt-2 relative z-10">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isLoading}
                  className="w-full relative overflow-hidden group/btn py-3.5 rounded-2xl bg-slate-900 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-800 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" />
                  <span className="relative z-10">
                    {isLoading ? t("login.signingIn") : t("login.signIn")}
                  </span>
                  {!isLoading && (
                    <ArrowRight className="w-5 h-5 relative z-10 group-hover/btn:translate-x-1 transition-transform" />
                  )}
                </motion.button>
              </motion.div>

              <motion.p variants={itemVariants} className="text-center text-sm font-medium text-slate-600 mt-8 relative z-10 border-t border-slate-200/50 pt-6">
                {t("login.noAccount")}{" "}
                <Link to="/register" className="text-blue-600 font-bold hover:text-blue-700 hover:underline underline-offset-4">
                  {t("login.signUp")}
                </Link>
              </motion.p>
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
