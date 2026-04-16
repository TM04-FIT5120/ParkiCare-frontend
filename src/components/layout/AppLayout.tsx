import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "motion/react";
import { User, Globe, ChevronDown, Check, Menu, X } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

import { Footer } from "@/components/layout/Footer";

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
};

const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "zh", label: "中文" },
  { id: "ms", label: "Bahasa Melayu" },
];

export const AppLayout = () => {
  const location = useLocation();
  const { user, patient } = useAuth();
  const [currentLang, setCurrentLang] = useState(LANGUAGES[0]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const caregiverId = user?.caregiverId ?? "-";
  const caregiverNickname = user?.caregiverNickname ?? "Caregiver";
  const patientNickname = patient?.patientNickname ?? "Patient";

  const navLinks = [
    { name: "Home", path: "/home" },
    { name: "Guide", path: "/guide" },
    { name: "Knowledge Hub", path: "/knowledge-hub" },
    { name: "Care Events", path: "/care-events" },
    // { name: "Digital Records", path: "/digital-records" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EBF4FF] via-[#F4F7FE] to-[#E0EAFC] text-[#2B3674] font-sans selection:bg-indigo-200 flex flex-col relative overflow-hidden">
      <ScrollToTop />
      {/* Background blobs - CSS-animated so the browser can schedule them on
          the compositor thread, not the JS main thread. Static on mobile to
          keep touch scroll completely jank-free. */}
      <div
        className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
        style={{ transform: "translateZ(0)" }}
      >
        <div className="bg-blob bg-blob-1 absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-200/40 blur-[100px]" />
        <div className="bg-blob bg-blob-2 absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-cyan-200/30 blur-[120px]" />
        <div className="bg-blob bg-blob-3 absolute top-[30%] left-[60%] w-[30vw] h-[30vw] rounded-full bg-sky-200/40 blur-[80px]" />
      </div>

      {/* Top Navigation - Clean White, Soft Shadow */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring" as const, stiffness: 200, damping: 20 }}
        className="sticky top-0 z-50 px-4 sm:px-6 py-3 bg-white/95 sm:bg-white/90 sm:backdrop-blur-xl shadow-[0_4px_20px_rgba(112,144,176,0.08)] flex items-center justify-between"
      >
        <div className="flex items-center gap-3 md:gap-6 lg:gap-8">
          <Link to="/home" className="flex items-center gap-2 group shrink-0">
            <motion.img 
              whileHover={{ rotate: 10, scale: 1.05 }}
              src="/logo-nav.png"
              alt="ParkiCare Logo"
              className="w-12 h-12 object-contain drop-shadow-sm" 
            />
            <span className="text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[#2B3674] to-indigo-600 tracking-tight">
              ParkiCare
            </span>
          </Link>
          
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = location.pathname.startsWith(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className="relative px-2.5 py-2 md:px-3 lg:px-4 rounded-full text-[12px] lg:text-[13px] font-bold transition-all duration-300"
                >
                  {isActive && (
                    <motion.div 
                      layoutId="nav-indicator"
                      className="absolute inset-0 bg-[#F4F7FE] rounded-full"
                      transition={{ type: "spring" as const, bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className={`relative z-10 ${isActive ? 'text-[#4318FF]' : 'text-[#A3AED0] hover:text-[#2B3674]'}`}>
                    {link.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-3 lg:gap-4">
          {/* Language Switcher instead of Bell */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#F4F7FE] hover:bg-[#E9E3FF] rounded-full text-xs font-bold text-[#4318FF] transition-colors focus:outline-none">
              <Globe className="w-3.5 h-3.5 text-[#4318FF]" />
              {currentLang.label}
              <ChevronDown className="w-3 h-3 text-[#4318FF]/70" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="min-w-[140px] bg-white rounded-xl shadow-[0_18px_40px_rgba(112,144,176,0.12)] border-none p-2 z-50 animate-in fade-in zoom-in-95 duration-200" align="end" sideOffset={8}>
                {LANGUAGES.map(lang => (
                  <DropdownMenu.Item 
                    key={lang.id}
                    onClick={() => setCurrentLang(lang)}
                    className="flex items-center justify-between px-3 py-2 text-sm font-bold text-[#A3AED0] rounded-lg cursor-pointer outline-none hover:bg-[#F4F7FE] hover:text-[#4318FF] transition-colors"
                  >
                    {lang.label}
                    {currentLang.id === lang.id && <Check className="w-4 h-4 text-[#4318FF]" />}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          
          <div className="w-px h-6 bg-[#E0E5F2] hidden sm:block" />

          {/* Profile Section */}
          <Link to="/profile" className="hidden sm:flex items-center gap-2.5 group hover:bg-[#F4F7FE] p-1 pr-3 rounded-full transition-colors cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-[#E9E3FF] flex items-center justify-center border-2 border-white shadow-sm group-hover:border-[#E9E3FF] transition-colors">
              <User className="w-4 h-4 text-[#4318FF]" />
            </div>
            <div className="hidden sm:block text-xs">
              <p className="font-bold text-[#2B3674] leading-tight">{caregiverNickname} <span className="font-normal text-[#A3AED0]">&</span> {patientNickname}</p>
              <p className="text-[10px] text-[#A3AED0] font-bold">ID: {caregiverId}</p>
            </div>
          </Link>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-[#4318FF] hover:bg-[#F4F7FE] rounded-lg transition-colors"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden sticky top-[60px] z-40 bg-white/95 backdrop-blur-xl shadow-[0_18px_40px_rgba(112,144,176,0.08)] overflow-hidden"
          >
            <div className="p-4 space-y-2">
              {/* Profile in Mobile Menu */}
              <Link 
                to="/profile" 
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 p-3 bg-[#F4F7FE] rounded-xl hover:bg-[#E9E3FF] transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-[#E9E3FF] flex items-center justify-center border-2 border-white shadow-sm">
                  <User className="w-5 h-5 text-[#4318FF]" />
                </div>
                <div className="text-xs flex-1">
                  <p className="font-bold text-[#2B3674] leading-tight">{caregiverNickname} <span className="font-normal text-[#A3AED0]">&</span> {patientNickname}</p>
                  <p className="text-[10px] text-[#A3AED0] font-bold">ID: {caregiverId}</p>
                </div>
              </Link>

              {/* Navigation Links */}
              {navLinks.map((link) => {
                const isActive = location.pathname.startsWith(link.path);
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                      isActive
                        ? 'bg-[#F4F7FE] text-[#4318FF]'
                        : 'text-[#A3AED0] hover:bg-[#F4F7FE] hover:text-[#2B3674]'
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}

              {/* Language Switcher in Mobile */}
              <div className="pt-2 border-t border-[#E0E5F2]">
                <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-2 px-4">Language</p>
                <div className="space-y-1">
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.id}
                      onClick={() => {
                        setCurrentLang(lang);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                        currentLang.id === lang.id
                          ? 'bg-[#E9E3FF] text-[#4318FF]'
                          : 'text-[#A3AED0] hover:bg-[#F4F7FE] hover:text-[#2B3674]'
                      }`}
                    >
                      {lang.label}
                      {currentLang.id === lang.id && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col w-full relative">
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 w-full max-w-[1400px] mx-auto p-4 sm:p-6 md:p-7 xl:p-8"
          >
            <Outlet />
          </motion.main>
        </AnimatePresence>
      </div>

      <Footer />
    </div>
  );
};