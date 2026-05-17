import { motion } from "motion/react";
import { LayoutDashboard, Bell, Pill, Heart, MapPin, BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

interface GuideStep {
  text: string;
  note?: string;
  /** Optional screenshot shown below this step (e.g. mid-section callout) */
  image?: { src: string; alt: string };
}

interface GuideFeature {
  id: number;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  route?: string;
  accentColor: string;
  iconColor: string;
  steps: GuideStep[];
  /** Screenshots from /public/Guide/ (PDF walkthrough + notification) */
  images?: { src: string; alt: string }[];
}

export function GuidePage() {
  const { t } = useTranslation();

  const guideFeatures: GuideFeature[] = [
    {
      id: 1,
      title: t("guide.feat1Title"),
      subtitle: t("guide.feat1Subtitle"),
      icon: <LayoutDashboard className="w-5 h-5 sm:w-6 sm:h-6" />,
      route: "/home",
      accentColor: "bg-blue-50",
      iconColor: "text-blue-500",
      images: [{ src: "/Guide/Picture1.png", alt: t("guide.feat1Img1Alt") }],
      steps: [
        { text: t("guide.feat1Step1") },
        { text: t("guide.feat1Step2") },
        { text: t("guide.feat1Step3"), note: t("guide.feat1Step3Note"), image: { src: "/Guide/Picture2.png", alt: t("guide.feat1Img2Alt") } },
      ],
    },
    {
      id: 2,
      title: t("guide.feat2Title"),
      subtitle: t("guide.feat2Subtitle"),
      icon: <Pill className="w-5 h-5 sm:w-6 sm:h-6" />,
      route: "/care-events",
      accentColor: "bg-purple-50",
      iconColor: "text-purple-500",
      images: [{ src: "/Guide/Picture3.png", alt: t("guide.feat2Img1Alt") }],
      steps: [
        { text: t("guide.feat2Step1") },
        { text: t("guide.feat2Step2") },
        { text: t("guide.feat2Step3") },
        { text: t("guide.feat2Step4") },
        { text: t("guide.feat2Step5") },
      ],
    },
    {
      id: 3,
      title: t("guide.feat3Title"),
      subtitle: t("guide.feat3Subtitle"),
      icon: <Heart className="w-5 h-5 sm:w-6 sm:h-6" />,
      route: "/care-events",
      accentColor: "bg-rose-50",
      iconColor: "text-rose-500",
      images: [{ src: "/Guide/Picture4.png", alt: t("guide.feat3Img1Alt") }],
      steps: [
        { text: t("guide.feat3Step1") },
        { text: t("guide.feat3Step2") },
        { text: t("guide.feat3Step3") },
      ],
    },
    {
      id: 4,
      title: t("guide.feat4Title"),
      subtitle: t("guide.feat4Subtitle"),
      icon: <MapPin className="w-5 h-5 sm:w-6 sm:h-6" />,
      route: "/care-events",
      accentColor: "bg-emerald-50",
      iconColor: "text-emerald-500",
      images: [{ src: "/Guide/Picture5.png", alt: t("guide.feat4Img1Alt") }],
      steps: [
        { text: t("guide.feat4Step1") },
        { text: t("guide.feat4Step2") },
        { text: t("guide.feat4Step3") },
        { text: t("guide.feat4Step4") },
        { text: t("guide.feat4Step5") },
      ],
    },
    {
      id: 5,
      title: t("guide.feat5Title"),
      subtitle: t("guide.feat5Subtitle"),
      icon: <Bell className="w-5 h-5 sm:w-6 sm:h-6" />,
      accentColor: "bg-violet-50",
      iconColor: "text-violet-500",
      images: [{ src: "/Guide/Picture6.png", alt: t("guide.feat5Img1Alt") }],
      steps: [
        { text: t("guide.feat5Step1") },
        { text: t("guide.feat5Step2") },
        { text: t("guide.feat5Step3") },
        { text: t("guide.feat5Step4"), note: t("guide.feat5Step4Note") },
      ],
    },
    {
      id: 6,
      title: t("guide.feat6Title"),
      subtitle: t("guide.feat6Subtitle"),
      icon: <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />,
      route: "/knowledge-hub",
      accentColor: "bg-sky-50",
      iconColor: "text-sky-500",
      steps: [
        { text: t("guide.feat6Step1") },
        { text: t("guide.feat6Step2") },
        { text: t("guide.feat6Step3") },
      ],
    },
  ];

  return (
    <div className="pb-6 sm:pb-8">
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto py-4 sm:py-6">
          <div className="max-w-4xl mx-auto flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#2B3674]">{t("guide.title")}</h1>
              <p className="text-sm sm:text-base text-[#A3AED0]">{t("guide.subtitle")}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl xl:max-w-5xl mx-auto pt-6 sm:pt-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl xl:max-w-5xl mx-auto"
        >
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 mb-6 flex items-start gap-3">
            <Bell className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm sm:text-base text-amber-800 leading-relaxed">
              <span className="font-semibold">{t("guide.notificationAlertPrefix")}</span> {t("guide.notificationAlertBody")}
            </p>
          </div>

          {guideFeatures.map((feature, index) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.08 }}
              className="bg-white rounded-2xl sm:rounded-3xl shadow-sm mb-4 sm:mb-6 border border-white/50 backdrop-blur-xl overflow-hidden"
            >
              <div className="p-4 sm:p-6 md:p-8">
                <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm sm:text-base font-bold shadow-md shrink-0">
                    {feature.id}
                  </div>
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 ${feature.accentColor} ${feature.iconColor}`}>
                    {feature.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg sm:text-xl font-bold text-[#2B3674] leading-tight">{feature.title}</h2>
                    <p className="text-xs sm:text-sm text-[#A3AED0]">{feature.subtitle}</p>
                  </div>
                  {feature.route && (
                    <span className="hidden sm:block text-xs font-semibold text-[#707EAE] bg-gray-100 px-2 py-1 rounded-full shrink-0">
                      {feature.route}
                    </span>
                  )}
                </div>

                <div className="border-t border-gray-100 mb-4 sm:mb-5" />

                {feature.images && feature.images.length > 0 && (
                  <div className="mb-5 sm:mb-6 space-y-4">
                    {feature.images.map((img) => (
                      <figure key={img.src} className="rounded-xl overflow-hidden border border-[#E0E5F2] bg-[#F4F7FE]">
                        <img
                          src={img.src}
                          alt={img.alt}
                          className="w-full h-auto max-h-[min(70vh,520px)] object-contain object-top mx-auto block"
                          loading="lazy"
                        />
                        <figcaption className="px-3 py-2 text-xs text-[#707EAE] font-medium text-center border-t border-[#E0E5F2] bg-white">
                          {img.alt}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}

                <ol className="space-y-3 sm:space-y-4">
                  {feature.steps.map((step, stepIndex) => (
                    <li key={stepIndex} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center mt-0.5">
                        {stepIndex + 1}
                      </span>
                      <div className="min-w-0 flex-1 space-y-3">
                        <p className="text-sm sm:text-base text-[#2B3674] font-medium leading-relaxed">{step.text}</p>
                        {step.note && (
                          <p className="text-xs sm:text-sm text-[#707EAE] mt-1 not-italic font-medium leading-relaxed">
                            {step.note}
                          </p>
                        )}
                        {step.image && (
                          <figure className="rounded-xl overflow-hidden border border-[#E0E5F2] bg-[#F4F7FE]">
                            <img
                              src={step.image.src}
                              alt={step.image.alt}
                              className="w-full h-auto max-h-[min(70vh,520px)] object-contain object-top mx-auto block"
                              loading="lazy"
                            />
                            <figcaption className="px-3 py-2 text-xs text-[#707EAE] font-medium text-center border-t border-[#E0E5F2] bg-white">
                              {step.image.alt}
                            </figcaption>
                          </figure>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </motion.div>
          ))}

          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white shadow-xl">
            <h3 className="text-lg sm:text-xl font-bold mb-1 sm:mb-2">{t("guide.allSet")}</h3>
            <p className="text-sm sm:text-base text-indigo-100">
              {t("guide.allSetDesc")}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
