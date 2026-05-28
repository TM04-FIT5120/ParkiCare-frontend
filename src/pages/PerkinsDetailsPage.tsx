import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import {
  Activity, AlertCircle, FileText, Play, Brain, ShieldAlert,
  ExternalLink, Lightbulb, Clock, Heart, AlertTriangle,
  Clipboard, Phone, X, ChevronRight, Landmark, BadgeCheck,
} from "lucide-react";

interface Item {
  title: string;
  desc: string;
}

interface ChecklistGroup {
  heading: string;
  items: string[];
}

interface Section {
  id: number;
  icon: React.ElementType;
  iconColor: string;
  titleKey: string;
  previewKey: string;
  imageAltKey: string;
  image: string;
  render: () => React.ReactNode;
}

const HERO_POINT_ICONS: React.ElementType[] = [Brain, Activity, ShieldAlert];

const REFERENCE_URLS = [
  "https://pubmed.ncbi.nlm.nih.gov/26474317/",
  "https://pubmed.ncbi.nlm.nih.gov/40958821/",
  "https://link.springer.com/article/10.1007/s00702-019-02033-9",
  "https://pubmed.ncbi.nlm.nih.gov/22777251/",
  "https://www.tandfonline.com/doi/full/10.1080/14737175.2021.1883428",
  "https://pmc.ncbi.nlm.nih.gov/articles/PMC9249436/",
];

function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="block text-xs text-[#4318FF] hover:underline font-bold">
      {label}
    </a>
  );
}

function useSections(navigate: ReturnType<typeof useNavigate>): Section[] {
  const { t } = useTranslation();

  return [
    {
      id: 1,
      icon: Brain,
      iconColor: "text-[#4318FF]",
      titleKey: "knowledgeHub.sections.s1.title",
      previewKey: "knowledgeHub.sections.s1.preview",
      imageAltKey: "knowledgeHub.sections.s1.imageAlt",
      image: "https://images.unsplash.com/photo-1559757175-5700dde675bc?auto=format&fit=crop&q=80&w=800",
      render: () => {
        const items = t("knowledgeHub.sections.s1.items", { returnObjects: true }) as Item[];
        return (
          <div className="space-y-4">
            <p className="text-[#707EAE] leading-relaxed">{t("knowledgeHub.sections.s1.p1")}</p>
            <p className="text-[#707EAE] leading-relaxed">{t("knowledgeHub.sections.s1.p2")}</p>
            <ul className="space-y-2">
              {items.map((it) => (
                <li key={it.title} className="flex items-start gap-2 text-[#707EAE]">
                  <span className="text-[#4318FF] mt-1">●</span>
                  <span><strong>{it.title}:</strong> {it.desc}</span>
                </li>
              ))}
            </ul>
            <p className="text-[#707EAE] leading-relaxed">{t("knowledgeHub.sections.s1.outro")}</p>
            <SourceLink href="https://doi.org/10.1002/mds.26431" label={t("knowledgeHub.sections.s1.source")} />
          </div>
        );
      },
    },
    {
      id: 2,
      icon: Activity,
      iconColor: "text-[#4318FF]",
      titleKey: "knowledgeHub.sections.s2.title",
      previewKey: "knowledgeHub.sections.s2.preview",
      imageAltKey: "knowledgeHub.sections.s2.imageAlt",
      image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=800",
      render: () => {
        const motorItems = t("knowledgeHub.sections.s2.motorItems", { returnObjects: true }) as Item[];
        const nonMotorItems = t("knowledgeHub.sections.s2.nonMotorItems", { returnObjects: true }) as Item[];
        const sources = t("knowledgeHub.sections.s2.sources", { returnObjects: true }) as string[];
        const sourceUrls = ["https://doi.org/10.3389/fnagi.2022.935841", "https://doi.org/10.1080/14737175.2021.1883428"];
        return (
          <div className="space-y-6">
            <p className="text-[#707EAE] leading-relaxed">{t("knowledgeHub.sections.s2.intro")}</p>
            <div>
              <h3 className="text-xl font-bold text-[#2B3674] mb-3">{t("knowledgeHub.sections.s2.motorHeading")}</h3>
              <ul className="space-y-2">
                {motorItems.map((it) => (
                  <li key={it.title} className="flex items-start gap-2 text-[#707EAE]">
                    <span className="text-[#4318FF] mt-1">●</span>
                    <span><strong>{it.title}:</strong> {it.desc}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#2B3674] mb-3">{t("knowledgeHub.sections.s2.nonMotorHeading")}</h3>
              <p className="text-[#707EAE] mb-3">{t("knowledgeHub.sections.s2.nonMotorIntro")}</p>
              <ul className="space-y-2">
                {nonMotorItems.map((it) => (
                  <li key={it.title} className="flex items-start gap-2 text-[#707EAE]">
                    <span className="text-[#4318FF] mt-1">●</span>
                    <span><strong>{it.title}:</strong> {it.desc}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[#FFF9E6] border-l-4 border-[#FFB800] p-4 rounded-lg">
              <p className="flex items-start gap-2 text-[#2B3674] font-bold">
                <Lightbulb className="w-5 h-5 text-[#FFB800] shrink-0 mt-0.5" />
                <span><strong>{t("knowledgeHub.sections.s2.tipLabel")}</strong> {t("knowledgeHub.sections.s2.tip")}</span>
              </p>
            </div>
            <div className="space-y-1">
              {sources.map((label, i) => (
                <SourceLink key={label} href={sourceUrls[i]} label={label} />
              ))}
            </div>
          </div>
        );
      },
    },
    {
      id: 3,
      icon: Clock,
      iconColor: "text-[#4318FF]",
      titleKey: "knowledgeHub.sections.s3.title",
      previewKey: "knowledgeHub.sections.s3.preview",
      imageAltKey: "knowledgeHub.sections.s3.imageAlt",
      image: "https://images.unsplash.com/photo-1581594693702-fbdc51b2763b?auto=format&fit=crop&q=80&w=800",
      render: () => {
        const labelLook = t("knowledgeHub.sections.s3.labelLook");
        const labelRole = t("knowledgeHub.sections.s3.labelRole");
        return (
          <div className="space-y-6">
            <p className="text-[#707EAE] leading-relaxed">{t("knowledgeHub.sections.s3.intro")}</p>
            <div className="bg-[#F4F7FE] p-6 rounded-xl">
              <h3 className="text-xl font-bold text-[#2B3674] mb-3">{t("knowledgeHub.sections.s3.earlyHeading")}</h3>
              <div className="space-y-3">
                <div><p className="font-bold text-[#4318FF] mb-1">{labelLook}</p><p className="text-[#707EAE]">{t("knowledgeHub.sections.s3.earlyLook")}</p></div>
                <div><p className="font-bold text-[#4318FF] mb-1">{labelRole}</p><p className="text-[#707EAE]">{t("knowledgeHub.sections.s3.earlyRole")}</p></div>
                <SourceLink href="https://doi.org/10.1002/mds.26431" label={t("knowledgeHub.sections.s3.earlySource")} />
              </div>
            </div>
            <div className="bg-[#FFF4ED] p-6 rounded-xl">
              <h3 className="text-xl font-bold text-[#2B3674] mb-3">{t("knowledgeHub.sections.s3.midHeading")}</h3>
              <div className="space-y-3">
                <div><p className="font-bold text-[#FF6B35] mb-1">{labelLook}</p><p className="text-[#707EAE]">{t("knowledgeHub.sections.s3.midLook")}</p></div>
                <div><p className="font-bold text-[#FF6B35] mb-1">{labelRole}</p><p className="text-[#707EAE]">{t("knowledgeHub.sections.s3.midRole")}</p></div>
                <SourceLink href="https://doi.org/10.1007/s00702-019-02033-9" label={t("knowledgeHub.sections.s3.midSource")} />
              </div>
            </div>
            <div className="bg-[#FEF0F0] p-6 rounded-xl">
              <h3 className="text-xl font-bold text-[#2B3674] mb-3">{t("knowledgeHub.sections.s3.lateHeading")}</h3>
              <div className="space-y-3">
                <div><p className="font-bold text-[#DC2626] mb-1">{labelLook}</p><p className="text-[#707EAE]">{t("knowledgeHub.sections.s3.lateLook")}</p></div>
                <div><p className="font-bold text-[#DC2626] mb-1">{labelRole}</p><p className="text-[#707EAE]">{t("knowledgeHub.sections.s3.lateRole")}</p></div>
                <SourceLink href="https://doi.org/10.1038/nrneurol.2012.126" label={t("knowledgeHub.sections.s3.lateSource")} />
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: 4,
      icon: Clipboard,
      iconColor: "text-[#4318FF]",
      titleKey: "knowledgeHub.sections.s4.title",
      previewKey: "knowledgeHub.sections.s4.preview",
      imageAltKey: "knowledgeHub.sections.s4.imageAlt",
      image: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&q=80&w=800",
      render: () => {
        const groups = t("knowledgeHub.sections.s4.groups", { returnObjects: true }) as ChecklistGroup[];
        const sources = t("knowledgeHub.sections.s4.sources", { returnObjects: true }) as string[];
        const sourceUrls = ["https://doi.org/10.1080/14737175.2021.1883428", "https://doi.org/10.2147/dnnd.s535306"];
        return (
          <div className="space-y-6">
            {groups.map((g) => (
              <div key={g.heading}>
                <h3 className="text-lg font-bold text-[#2B3674] mb-3">{g.heading}</h3>
                <ul className="space-y-2">
                  {g.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-[#707EAE]">
                      <span className="text-[#4318FF] mt-1">-</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="bg-[#FFF9E6] border-l-4 border-[#FFB800] p-4 rounded-lg">
              <p className="flex items-start gap-2 text-[#2B3674] font-bold">
                <Lightbulb className="w-5 h-5 text-[#FFB800] shrink-0 mt-0.5" />
                <span><strong>{t("knowledgeHub.sections.s4.tipLabel")}</strong> {t("knowledgeHub.sections.s4.tip")}</span>
              </p>
            </div>
            <div className="space-y-1">
              {sources.map((label, i) => (
                <SourceLink key={label} href={sourceUrls[i]} label={label} />
              ))}
            </div>
          </div>
        );
      },
    },
    {
      id: 5,
      icon: Heart,
      iconColor: "text-[#4318FF]",
      titleKey: "knowledgeHub.sections.s5.title",
      previewKey: "knowledgeHub.sections.s5.preview",
      imageAltKey: "knowledgeHub.sections.s5.imageAlt",
      image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=800",
      render: () => {
        const sources = t("knowledgeHub.sections.s5.sources", { returnObjects: true }) as string[];
        const sourceUrls = ["https://doi.org/10.1080/14737175.2021.1883428", "https://doi.org/10.2147/dnnd.s535306"];
        return (
          <div className="space-y-4 text-[#707EAE] leading-relaxed">
            <p>{t("knowledgeHub.sections.s5.p1")}</p>
            <p>{t("knowledgeHub.sections.s5.p2")}</p>
            <p>{t("knowledgeHub.sections.s5.p3")}</p>
            <p className="text-[#4318FF] font-bold text-lg">{t("knowledgeHub.sections.s5.highlight")}</p>
            <div className="space-y-1 pt-2">
              {sources.map((label, i) => (
                <SourceLink key={label} href={sourceUrls[i]} label={label} />
              ))}
            </div>
          </div>
        );
      },
    },
    {
      id: 6,
      icon: AlertCircle,
      iconColor: "text-[#4318FF]",
      titleKey: "knowledgeHub.sections.s6.title",
      previewKey: "knowledgeHub.sections.s6.preview",
      imageAltKey: "knowledgeHub.sections.s6.imageAlt",
      image: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&q=80&w=800",
      render: () => {
        const rules = t("knowledgeHub.sections.s6.rules", { returnObjects: true }) as Item[];
        return (
          <div className="space-y-6">
            <p className="text-[#707EAE] leading-relaxed">{t("knowledgeHub.sections.s6.intro")}</p>
            <div className="space-y-4">
              {rules.map((r) => (
                <div key={r.title} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#4318FF] mt-2 shrink-0" />
                  <div>
                    <p className="font-bold text-[#2B3674] mb-1">{r.title}:</p>
                    <p className="text-[#707EAE]">{r.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => navigate('/care-events')}
              className="w-full bg-gradient-to-r from-[#4318FF] to-[#8B5CF6] hover:from-[#3412C7] hover:to-[#7C3AED] p-4 rounded-xl text-left transition-all shadow-[0_4px_15px_rgba(67,24,255,0.3)] hover:shadow-[0_6px_25px_rgba(67,24,255,0.4)] active:scale-[0.98]"
            >
              <p className="text-white font-bold">{t("knowledgeHub.sections.s6.ctaButton")}</p>
            </button>
            <SourceLink href="https://doi.org/10.1080/14737175.2021.1883428" label={t("knowledgeHub.sections.s6.source")} />
          </div>
        );
      },
    },
    {
      id: 7,
      icon: Activity,
      iconColor: "text-[#4318FF]",
      titleKey: "knowledgeHub.sections.s7.title",
      previewKey: "knowledgeHub.sections.s7.preview",
      imageAltKey: "knowledgeHub.sections.s7.imageAlt",
      image: "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&q=80&w=800",
      render: () => (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold text-[#2B3674] mb-3">{t("knowledgeHub.sections.s7.nutritionHeading")}</h3>
            <div className="space-y-3">
              <div><p className="font-bold text-[#4318FF] mb-1">{t("knowledgeHub.sections.s7.constipationLabel")}</p><p className="text-[#707EAE]">{t("knowledgeHub.sections.s7.constipation")}</p></div>
              <div><p className="font-bold text-[#4318FF] mb-1">{t("knowledgeHub.sections.s7.droolingLabel")}</p><p className="text-[#707EAE]">{t("knowledgeHub.sections.s7.drooling")}</p></div>
            </div>
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#2B3674] mb-3">{t("knowledgeHub.sections.s7.mobilityHeading")}</h3>
            <div className="space-y-3">
              <div><p className="font-bold text-[#4318FF] mb-1">{t("knowledgeHub.sections.s7.dizzyLabel")}</p><p className="text-[#707EAE]">{t("knowledgeHub.sections.s7.dizzy")}</p></div>
              <div><p className="font-bold text-[#4318FF] mb-1">{t("knowledgeHub.sections.s7.exerciseLabel")}</p><p className="text-[#707EAE]">{t("knowledgeHub.sections.s7.exercise")}</p></div>
            </div>
          </div>
          <SourceLink href="https://doi.org/10.1080/14737175.2021.1883428" label={t("knowledgeHub.sections.s7.source")} />
        </div>
      ),
    },
    {
      id: 8,
      icon: Phone,
      iconColor: "text-red-600",
      titleKey: "knowledgeHub.sections.s8.title",
      previewKey: "knowledgeHub.sections.s8.preview",
      imageAltKey: "knowledgeHub.sections.s8.imageAlt",
      image: "https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&q=80&w=800",
      render: () => (
        <div className="space-y-6">
          <p className="text-[#707EAE] leading-relaxed">{t("knowledgeHub.sections.s8.intro")}</p>
          <div className="bg-red-50 border-l-4 border-red-500 p-5 rounded-lg">
            <h3 className="text-lg font-bold text-red-700 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> {t("knowledgeHub.sections.s8.physicalHeading")}
            </h3>
            <div className="space-y-3">
              <div><p className="font-bold text-[#2B3674] mb-1">{t("knowledgeHub.sections.s8.fallsLabel")}</p><p className="text-[#707EAE]">{t("knowledgeHub.sections.s8.falls")}</p></div>
              <div><p className="font-bold text-[#2B3674] mb-1">{t("knowledgeHub.sections.s8.chokingLabel")}</p><p className="text-[#707EAE]">{t("knowledgeHub.sections.s8.choking")}</p></div>
            </div>
          </div>
          <div className="bg-purple-50 border-l-4 border-purple-500 p-5 rounded-lg">
            <h3 className="text-lg font-bold text-purple-700 mb-3 flex items-center gap-2">
              <Brain className="w-5 h-5" /> {t("knowledgeHub.sections.s8.mentalHeading")}
            </h3>
            <div className="space-y-3">
              <div><p className="font-bold text-[#2B3674] mb-1">{t("knowledgeHub.sections.s8.hallucinationsLabel")}</p><p className="text-[#707EAE]">{t("knowledgeHub.sections.s8.hallucinations")}</p></div>
              <div><p className="font-bold text-[#2B3674] mb-1">{t("knowledgeHub.sections.s8.burnoutLabel")}</p><p className="text-[#707EAE]">{t("knowledgeHub.sections.s8.burnout")}</p></div>
            </div>
          </div>
          <SourceLink href="https://doi.org/10.1080/14737175.2021.1883428" label={t("knowledgeHub.sections.s8.source")} />
        </div>
      ),
    },
    {
      id: 9,
      icon: Landmark,
      iconColor: "text-emerald-600",
      titleKey: "knowledgeHub.sections.s9.title",
      previewKey: "knowledgeHub.sections.s9.preview",
      imageAltKey: "knowledgeHub.sections.s9.imageAlt",
      image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=800",
      render: () => {
        const eligItems = t("knowledgeHub.sections.s9.eligItems", { returnObjects: true }) as string[];
        return (
          <div className="space-y-6">
            <p className="text-[#707EAE] leading-relaxed">{t("knowledgeHub.sections.s9.intro")}</p>

            {/* Amount highlight */}
            <div className="flex items-center gap-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
              <div className="w-14 h-14 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <Landmark className="w-7 h-7 text-emerald-600" />
              </div>
              <div>
                <p className="text-3xl font-extrabold text-emerald-700 leading-none">{t("knowledgeHub.sections.s9.amountLabel")}</p>
                <p className="text-sm text-emerald-600 font-bold mt-1">{t("knowledgeHub.sections.s9.amountDesc")}</p>
              </div>
            </div>

            {/* Eligibility */}
            <div>
              <h3 className="text-lg font-bold text-[#2B3674] mb-3 flex items-center gap-2">
                <BadgeCheck className="w-5 h-5 text-emerald-500" />
                {t("knowledgeHub.sections.s9.eligHeading")}
              </h3>
              <ul className="space-y-2">
                {eligItems.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[#707EAE]">
                    <span className="text-emerald-500 mt-1 shrink-0">●</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* How to apply */}
            <div className="bg-[#F4F7FE] p-5 rounded-xl">
              <h3 className="text-lg font-bold text-[#2B3674] mb-2">{t("knowledgeHub.sections.s9.howHeading")}</h3>
              <p className="text-[#707EAE] text-sm leading-relaxed mb-3">{t("knowledgeHub.sections.s9.howText")}</p>
              <a
                href="https://ebantuanjkm.jkm.gov.my/spbk/login.jsp"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                {t("knowledgeHub.sections.s9.portalLabel")}
              </a>
            </div>

            {/* Contact */}
            <div>
              <h3 className="text-lg font-bold text-[#2B3674] mb-3">{t("knowledgeHub.sections.s9.contactHeading")}</h3>
              <div className="space-y-1 text-sm text-[#707EAE]">
                <p>{t("knowledgeHub.sections.s9.contactAddr")}</p>
                <p><span className="font-bold text-[#2B3674]">📞</span> {t("knowledgeHub.sections.s9.contactPhone")}</p>
                <p><span className="font-bold text-[#2B3674]">✉</span> {t("knowledgeHub.sections.s9.contactEmail")}</p>
              </div>
            </div>

            <div className="bg-[#FFF9E6] border-l-4 border-[#FFB800] p-4 rounded-lg">
              <p className="flex items-start gap-2 text-[#2B3674]">
                <Lightbulb className="w-5 h-5 text-[#FFB800] shrink-0 mt-0.5" />
                <span><strong>{t("knowledgeHub.sections.s9.tipLabel")}</strong> {t("knowledgeHub.sections.s9.tip")}</span>
              </p>
            </div>

            <SourceLink href="https://www.malaysia.gov.my/en/topics/assistance-for-bedridden-oku-chronically-ill-patients-bpt" label={t("knowledgeHub.sections.s9.source")} />
          </div>
        );
      },
    },
  ];
}

export function PerkinsDetailsPage() {
  const { t } = useTranslation();
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [highlightBpt, setHighlightBpt] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const sections = useSections(navigate);

  useEffect(() => {
    if (location.hash === '#miasa-support') {
      const timer = setTimeout(() => {
        const el = document.getElementById('miasa-support');
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top, behavior: 'smooth' });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
    if (location.hash === '#bpt-allowance') {
      const scrollTimer = setTimeout(() => {
        document.getElementById('bpt-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 350);
      const highlightTimer = setTimeout(() => {
        setHighlightBpt(true);
        setTimeout(() => setHighlightBpt(false), 900);
      }, 750);
      return () => {
        clearTimeout(scrollTimer);
        clearTimeout(highlightTimer);
      };
    }
  }, [location.hash]);

  const heroPoints = t("knowledgeHub.hero.points", { returnObjects: true }) as Item[];
  const referenceLabels = t("knowledgeHub.references.items", { returnObjects: true }) as string[];
  const miasaServices = t("knowledgeHub.miasa.services", { returnObjects: true }) as Item[];

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[20px] overflow-hidden shadow-[0_18px_40px_rgba(112,144,176,0.12)] border-none flex flex-col md:flex-row relative"
      >
        <div className="md:w-1/2 p-6 sm:p-8 md:p-10 lg:p-14 flex flex-col justify-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#2B3674] tracking-tight leading-[1.1] mb-4 sm:mb-6">
            {t("knowledgeHub.hero.titlePart1")}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4318FF] to-indigo-500">{t("knowledgeHub.hero.titleHighlight")}</span>
            {t("knowledgeHub.hero.titlePart2")}
          </h1>
          <p className="text-lg text-[#A3AED0] font-bold leading-relaxed mb-8">
            {t("knowledgeHub.hero.subtitle")}
          </p>
          <div className="space-y-4">
            {heroPoints.map((point, i) => {
              const Icon = HERO_POINT_ICONS[i] ?? Brain;
              return (
                <div key={point.title} className="flex items-start gap-3">
                  <Icon className="w-5 h-5 text-[#4318FF] shrink-0 mt-1" />
                  <div>
                    <h4 className="font-bold text-[#2B3674]">{point.title}</h4>
                    <p className="text-sm text-[#A3AED0] font-bold">{point.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="md:w-1/2 bg-[#2B3674] flex flex-col md:min-h-[400px]">
          <div className="relative aspect-video md:aspect-auto md:flex-1">
            {isVideoPlaying ? (
              <video
                className="absolute inset-0 w-full h-full object-contain bg-black"
                src="/home_video.mp4"
                controls
                autoPlay
                onEnded={() => setIsVideoPlaying(false)}
              />
            ) : (
              <>
                <img
                  src="https://images.unsplash.com/photo-1685657814797-83706c4e5279?auto=format&fit=crop&q=80&w=1080"
                  alt={t("knowledgeHub.video.title")}
                  className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#2B3674] via-[#2B3674]/40 to-transparent" />
                <button
                  type="button"
                  onClick={() => setIsVideoPlaying(true)}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 sm:w-20 sm:h-20 bg-[#4318FF] hover:bg-[#3412C7] hover:scale-105 transition-all rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(67,24,255,0.5)] group"
                >
                  <Play className="w-6 h-6 sm:w-8 sm:h-8 text-white ml-1 group-hover:scale-110 transition-transform" />
                </button>
                <div className="absolute bottom-4 left-4 right-4 sm:bottom-8 sm:left-8 sm:right-8 text-center">
                  <p className="text-white font-bold text-sm sm:text-lg">{t("knowledgeHub.video.title")}</p>
                  <p className="text-[#A3AED0] font-bold text-xs sm:text-sm mt-1">{t("knowledgeHub.video.meta")}</p>
                </div>
              </>
            )}
          </div>

          <div className="bg-white p-4 sm:p-6 border-t border-gray-100">
            <h3 className="text-sm font-bold text-[#2B3674] mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#4318FF]" />
              {t("knowledgeHub.references.heading")}
            </h3>
            <div className="space-y-2">
              {referenceLabels.map((label, i) => (
                <a key={REFERENCE_URLS[i]} href={REFERENCE_URLS[i]} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-[#4318FF] hover:text-[#3412C7] transition-colors group">
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-bold group-hover:underline">{label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h2 className="text-lg sm:text-xl font-extrabold text-[#2B3674] mb-4 sm:mb-5">{t("knowledgeHub.exploreGuide")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {sections.map((section, i) => (
            <motion.button
              key={section.id}
              id={section.id === 9 ? "bpt-card" : undefined}
              type="button"
              onClick={() => setActiveSection(section)}
              initial={{ opacity: 0, y: 16 }}
              animate={
                section.id === 9 && highlightBpt
                  ? { opacity: 1, y: 0, scale: [1, 1.05, 1] }
                  : { opacity: 1, y: 0, scale: 1 }
              }
              transition={
                section.id === 9 && highlightBpt
                  ? { duration: 0.6, ease: "easeInOut" }
                  : { delay: 0.1 + i * 0.05 }
              }
              className={`group bg-white rounded-[20px] overflow-hidden text-left hover:-translate-y-1 transition-all duration-200 flex flex-col ${
                section.id === 9 && highlightBpt
                  ? "shadow-[0_0_0_3px_#4318FF,0_18px_40px_rgba(67,24,255,0.25)]"
                  : "shadow-[0_18px_40px_rgba(112,144,176,0.12)] hover:shadow-[0_24px_50px_rgba(112,144,176,0.2)]"
              }`}
            >
              <div className="relative h-44 overflow-hidden">
                <img
                  src={section.image}
                  alt={t(section.imageAltKey)}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <span className="absolute top-3 left-3 bg-white/90 text-[#4318FF] text-xs font-extrabold px-2.5 py-1 rounded-full">
                  {String(section.id).padStart(2, "0")}
                </span>
              </div>

              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <section.icon className={`w-5 h-5 shrink-0 ${section.iconColor}`} />
                  <h3 className="text-base font-extrabold text-[#2B3674] leading-tight">{t(section.titleKey)}</h3>
                </div>
                <p className="text-sm text-[#707EAE] font-medium leading-relaxed line-clamp-3 flex-1">
                  {t(section.previewKey)}
                </p>
                <div className="mt-4 flex items-center gap-1 text-[#4318FF] text-sm font-bold">
                  <span>{t("knowledgeHub.readSection")}</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      <motion.section
        id="miasa-support"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-gradient-to-br from-[#4318FF] to-[#8B5CF6] rounded-[20px] overflow-hidden shadow-[0_18px_40px_rgba(67,24,255,0.25)]"
      >
        <div className="p-6 sm:p-8 md:p-10 flex flex-col md:flex-row gap-6 md:gap-10">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Phone className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-white/60 uppercase tracking-widest">{t("knowledgeHub.miasa.category")}</p>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">{t("knowledgeHub.miasa.name")}</h2>
              </div>
            </div>

            <p className="text-white/80 text-sm leading-relaxed mb-4">
              {t("knowledgeHub.miasa.description")}
            </p>

            <div className="space-y-2 mb-5">
              {miasaServices.map((s) => (
                <div key={s.title} className="flex items-start gap-2">
                  <span className="text-white/60 mt-1 text-xs">●</span>
                  <p className="text-sm text-white/80"><span className="font-bold text-white">{s.title}:</span> {s.desc}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-white/70">
              <span className="bg-white/10 px-3 py-1 rounded-full font-bold">📧 info.miasa@gmail.com</span>
              <span className="bg-white/10 px-3 py-1 rounded-full font-bold">🌐 miasa.org.my</span>
            </div>
          </div>

          <div className="md:w-72 shrink-0 space-y-3">
            <h3 className="text-sm font-bold text-white/60 uppercase tracking-widest mb-3">{t("knowledgeHub.miasa.contactNow")}</h3>

            <a
              href="tel:1800180066"
              className="flex items-center gap-4 p-4 bg-white rounded-[16px] group hover:bg-[#F4F7FE] transition-all active:scale-[0.98] shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
            >
              <div className="w-11 h-11 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-wide">{t("knowledgeHub.miasa.crisisHotline")}</p>
                <p className="text-base font-extrabold text-[#2B3674]">1800 180 066</p>
                <p className="text-xs text-[#A3AED0] font-medium">{t("knowledgeHub.miasa.freeTapToCall")}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center group-hover:bg-red-600 transition-colors">
                <Phone className="w-4 h-4 text-white" />
              </div>
            </a>

            <a
              href="tel:0397656088"
              className="flex items-center gap-4 p-4 bg-white rounded-[16px] group hover:bg-[#F4F7FE] transition-all active:scale-[0.98] shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
            >
              <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-wide">{t("knowledgeHub.miasa.crisisWhatsapp")}</p>
                <p className="text-base font-extrabold text-[#2B3674]">03-9765 6088</p>
                <p className="text-xs text-[#A3AED0] font-medium">{t("knowledgeHub.miasa.tapToCall")}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center group-hover:bg-green-600 transition-colors">
                <Phone className="w-4 h-4 text-white" />
              </div>
            </a>

            <a
              href="tel:+60379321409"
              className="flex items-center gap-4 p-4 bg-white rounded-[16px] group hover:bg-[#F4F7FE] transition-all active:scale-[0.98] shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
            >
              <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-wide">{t("knowledgeHub.miasa.generalEnquiry")}</p>
                <p className="text-base font-extrabold text-[#2B3674]">+603-7932 1409</p>
                <p className="text-xs text-[#A3AED0] font-medium">{t("knowledgeHub.miasa.tapToCall")}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                <Phone className="w-4 h-4 text-white" />
              </div>
            </a>

            <a
              href="https://miasa.org.my/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-white/20 hover:bg-white/30 text-white font-bold text-sm rounded-[16px] transition-all active:scale-[0.98]"
            >
              <ExternalLink className="w-4 h-4" />
              {t("knowledgeHub.miasa.visitWebsite")}
            </a>
          </div>
        </div>
      </motion.section>

      {createPortal(
        <AnimatePresence>
          {activeSection && (
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] min-h-[100dvh] w-full bg-black/40 backdrop-blur-md"
                onClick={() => setActiveSection(null)}
              />

              <motion.div
                key="modal"
                initial={{ opacity: 0, y: 0, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed inset-4 z-[210] bg-white rounded-[24px] shadow-2xl flex flex-col overflow-hidden"
              >
                <div className="relative h-48 shrink-0">
                  <img
                    src={activeSection.image}
                    alt={t(activeSection.imageAltKey)}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#2B3674]/80 to-transparent" />
                  <div className="absolute bottom-4 left-5 right-14 flex items-center gap-2">
                    <activeSection.icon className={`w-6 h-6 shrink-0 text-white`} />
                    <h2 className="text-white text-xl font-extrabold leading-tight">{t(activeSection.titleKey)}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSection(null)}
                    className="absolute top-3 right-3 w-9 h-9 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full flex items-center justify-center transition-colors"
                    aria-label={t("knowledgeHub.modalClose")}
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                  {activeSection.render()}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
