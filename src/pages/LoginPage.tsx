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
  const [nickname, setNickname] = useState(() => localStorage.getItem("parkicare_remembered_nickname") ?? "");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem("parkicare_remembered_nickname"));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (rememberMe) {
      localStorage.setItem("parkicare_remembered_nickname", nickname);
    } else {
      localStorage.removeItem("parkicare_remembered_nickname");
    }
  }, [rememberMe, nickname]);

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
    if (!nickname || !password) {
      setError(t("login.errorFillAll"));
      return;
    }

    setIsLoading(true);
    try {
      const data = await authService.login(nickname, password);
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
    } catch {
      setError(t("login.errorCredentials"));
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
    <div className="min-h-screen-dvh w-full flex flex-col bg-[#f1f4fa] text-slate-800 font-sans relative pt-safe pb-safe">
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

        {/* Left side Image Panel (Redesigned) */}
        <div className="hidden lg:flex w-[55%] p-7 relative z-10">
          <div className="relative overflow-hidden rounded-[2rem] bg-[#0f172a] shadow-[0_30px_80px_-20px_rgba(15,23,42,0.45)] w-full">
            <motion.img
              src="/auth-login-photo.png"
              alt="Caregiver supporting an elderly woman"
              className="absolute inset-0 w-full h-full object-cover object-top"
              style={{
                x: useMotionTemplate`calc(-5% + ${mouseX}px)`,
                y: useMotionTemplate`calc(-5% + ${mouseY}px)`,
                scale: 1.05,
              }}
            />
            {/* Gradient overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b1a3a] via-[#0b1a3a]/85 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0b1a3a]/35 to-transparent" />

            <motion.div
              className="relative z-10 h-full w-full flex flex-col justify-end p-14 text-white"
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, delay: 0.5 }}
            >
              <div>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[11px] font-semibold tracking-widest uppercase text-white/90">
                  <span className="w-2 h-2 rounded-full bg-[#9DB8FF] animate-pulse" />
                  {t("login.platform")}
                </span>
              </div>
              <h1 className="text-[clamp(2.4rem,3.4vw,3.25rem)] font-bold leading-[1.05] tracking-tight mt-6 text-white max-w-[20ch]">
                {t("login.taglinePrefix")} <span className="text-[#9DB8FF]">{t("login.taglineAccent")}</span>
              </h1>
              <p className="text-[15.5px] leading-relaxed text-slate-200/85 font-light max-w-[46ch] mt-5">
                {t("login.description")}
              </p>

              {/* Feature columns */}
              <div className="border-t border-white/10 grid grid-cols-4 mt-9 pt-6 gap-0">
                {[
                  {
                    label: t("login.feat1"),
                    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
                  },
                  {
                    label: t("login.feat2"),
                    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>,
                  },
                  {
                    label: t("login.feat3"),
                    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11h18a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8z"/><path d="M7 11V8a2 2 0 0 1 2-2"/><path d="M15 6a3 3 0 0 1 3 3v2"/><path d="M2 21h20"/></svg>,
                  },
                  {
                    label: t("login.feat4"),
                    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/><path d="m12 5 1.5 1.5"/></svg>,
                  },
                ].map((feat, i) => (
                  <div key={i} className={`flex flex-col gap-3 ${i > 0 ? "pl-5 border-l border-white/12" : ""}`}>
                    <div className="w-10 h-10 rounded-xl bg-white/8 border border-white/12 text-[#C9D7FF] backdrop-blur-md flex items-center justify-center">
                      {feat.icon}
                    </div>
                    <span className="text-[13px] leading-snug text-white/90 font-medium whitespace-pre-line">{feat.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
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
                    value={nickname}
                    onChange={(e) => { setNickname(e.target.value); setError(null); }}
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
