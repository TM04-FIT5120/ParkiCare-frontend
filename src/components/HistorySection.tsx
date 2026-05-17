import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Pin, RotateCcw, ChevronDown, ChevronUp, CalendarHeart, MapPin, History } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CareEvent } from "@/context/careEventsContext";
import { getMYTDateString, addDaysMYT } from "@/lib/eventRecurrence";
import { getIntlLocale } from "@/lib/dateLocale";

interface HistorySectionProps {
  events: CareEvent[];
  onTogglePin: (backendId: number, eventType: "home" | "outdoor") => Promise<void>;
  onReuse: (event: CareEvent) => void;
}

type TimeGroup = "Today" | "Yesterday" | "Last 7 Days" | "Last 30 Days" | "Older";

const GROUP_LABEL_KEY: Record<TimeGroup, string> = {
  Today: "historySection.groupToday",
  Yesterday: "historySection.groupYesterday",
  "Last 7 Days": "historySection.groupLast7",
  "Last 30 Days": "historySection.groupLast30",
  Older: "historySection.groupOlder",
};

function getTimeGroup(startDatetime: string | undefined): TimeGroup {
  if (!startDatetime) return "Older";
  const eventDate = startDatetime.slice(0, 10);
  const today = getMYTDateString();
  const yesterday = addDaysMYT(-1);
  const sevenDaysAgo = addDaysMYT(-7);
  const thirtyDaysAgo = addDaysMYT(-30);

  if (eventDate === today) return "Today";
  if (eventDate === yesterday) return "Yesterday";
  if (eventDate >= sevenDaysAgo) return "Last 7 Days";
  if (eventDate >= thirtyDaysAgo) return "Last 30 Days";
  return "Older";
}

function formatEventDate(startDatetime: string | undefined): string {
  if (!startDatetime) return "";
  const date = new Date(startDatetime);
  return date.toLocaleDateString(getIntlLocale(), {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatEventTime(startDatetime: string | undefined): string {
  if (!startDatetime) return "";
  const date = new Date(startDatetime);
  return date.toLocaleTimeString(getIntlLocale(), { hour: "2-digit", minute: "2-digit", hour12: true });
}

interface HistoryItemProps {
  event: CareEvent;
  onTogglePin: (backendId: number, eventType: "home" | "outdoor") => Promise<void>;
  onReuse: (event: CareEvent) => void;
}

function HistoryItem({ event, onTogglePin, onReuse }: HistoryItemProps) {
  const { t } = useTranslation();
  const isPinned = event.isPinned === 1;
  const isOutdoor = event.eventType === "outdoor";

  const handlePin = () => {
    if (!event.backendId || !event.eventType) return;
    onTogglePin(event.backendId, event.eventType);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="group flex items-start gap-3 p-4 bg-white border border-[#E0E5F2] rounded-2xl hover:border-[#4318FF]/20 hover:shadow-[0_6px_20px_rgba(112,144,176,0.1)] transition-all cursor-pointer"
      onClick={() => onReuse(event)}
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          isOutdoor ? "bg-emerald-50" : "bg-orange-50"
        }`}
      >
        {isOutdoor ? (
          <MapPin className="w-4 h-4 text-emerald-500" />
        ) : (
          <CalendarHeart className="w-4 h-4 text-orange-500" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#2B3674] truncate">{event.title}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  isOutdoor
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-orange-50 text-orange-600"
                }`}
              >
                {isOutdoor ? t("historySection.outdoor") : t("historySection.homeCare")}
              </span>
              {event.type && event.type !== "Home Care" && event.type !== "Outdoor" && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#F4F7FE] text-[#A3AED0]">
                  {event.type}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={handlePin}
              title={isPinned ? t("historySection.unpin") : t("historySection.pin")}
              className={`p-1.5 rounded-lg transition-all ${
                isPinned
                  ? "text-[#4318FF] bg-[#E9E3FF]"
                  : "text-[#A3AED0] hover:text-[#4318FF] hover:bg-[#F4F7FE]"
              }`}
            >
              <Pin className={`w-3.5 h-3.5 ${isPinned ? "fill-[#4318FF]" : ""}`} />
            </button>

            <button
              type="button"
              onClick={() => onReuse(event)}
              title={t("historySection.useAgain")}
              className="p-1.5 text-[#A3AED0] hover:text-[#4318FF] hover:bg-[#F4F7FE] rounded-lg transition-all opacity-0 group-hover:opacity-100"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <p className="text-[10px] text-[#A3AED0] mt-1.5">
          {formatEventDate(event.startDatetime)} · {formatEventTime(event.startDatetime)}
        </p>

        {event.note && (
          <p className="text-[11px] text-[#A3AED0] mt-1 line-clamp-1 italic">"{event.note}"</p>
        )}
      </div>
    </motion.div>
  );
}

const GROUP_ORDER: TimeGroup[] = ["Today", "Yesterday", "Last 7 Days", "Last 30 Days"];

export function HistorySection({ events, onTogglePin, onReuse }: HistorySectionProps) {
  const { t } = useTranslation();
  const [olderExpanded, setOlderExpanded] = useState(false);

  const pinnedItems = events.filter((e) => e.isPinned === 1);
  const recentItems = events.filter((e) => e.isPinned !== 1);

  const grouped: Record<TimeGroup, CareEvent[]> = {
    Today: [],
    Yesterday: [],
    "Last 7 Days": [],
    "Last 30 Days": [],
    Older: [],
  };

  for (const event of recentItems) {
    grouped[getTimeGroup(event.startDatetime)].push(event);
  }

  for (const group of Object.values(grouped)) {
    group.sort((a, b) => {
      const aDate = a.startDatetime ?? "";
      const bDate = b.startDatetime ?? "";
      return bDate.localeCompare(aDate);
    });
  }

  const hasAnyHistory = events.length > 0;
  const hasOlder = grouped["Older"].length > 0;

  return (
    <div className="bg-white rounded-[20px] p-4 sm:p-6 shadow-[0_18px_40px_rgba(112,144,176,0.12)]">
      <h2 className="text-xl font-bold text-[#2B3674] mb-6 flex items-center gap-2">
        <History className="w-5 h-5 text-[#4318FF]" />
        {t("historySection.title")}
        <span className="ml-auto text-xs font-bold px-3 py-1 bg-[#E9E3FF] text-[#4318FF] rounded-full">
          {t("historySection.recordCount", { count: events.length })}
        </span>
      </h2>

      {!hasAnyHistory ? (
        <div className="p-8 text-center bg-[#F4F7FE] rounded-2xl">
          <History className="w-8 h-8 text-[#A3AED0] mx-auto mb-3" />
          <p className="text-sm font-bold text-[#A3AED0]">{t("historySection.emptyTitle")}</p>
          <p className="text-xs text-[#A3AED0] mt-1">{t("historySection.emptySubtitle")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Pin className="w-3 h-3" /> {t("historySection.pinned")}
            </p>
            {pinnedItems.length === 0 ? (
              <p className="text-xs text-[#A3AED0] italic px-1">
                {t("historySection.noPinned")}
              </p>
            ) : (
              <div className="space-y-2">
                <AnimatePresence>
                  {pinnedItems.map((event) => (
                    <HistoryItem
                      key={`pinned-${event.eventType}-${event.backendId}`}
                      event={event}
                      onTogglePin={onTogglePin}
                      onReuse={onReuse}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {recentItems.length > 0 && (
            <div className="border-t border-[#F4F7FE]" />
          )}

          {GROUP_ORDER.map((group) => {
            const items = grouped[group];
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <p className="text-xs font-bold text-[#A3AED0] uppercase tracking-widest mb-3">{t(GROUP_LABEL_KEY[group])}</p>
                <div className="space-y-2">
                  <AnimatePresence>
                    {items.map((event) => (
                      <HistoryItem
                        key={`${group}-${event.eventType}-${event.backendId}`}
                        event={event}
                        onTogglePin={onTogglePin}
                        onReuse={onReuse}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}

          {hasOlder && (
            <div>
              <button
                type="button"
                onClick={() => setOlderExpanded((v) => !v)}
                className="flex items-center gap-2 text-xs font-bold text-[#A3AED0] uppercase tracking-widest hover:text-[#4318FF] transition-colors w-full text-left"
              >
                {olderExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
                {t("historySection.groupOlder")}
                <span className="ml-auto font-bold text-[#A3AED0] normal-case tracking-normal">
                  {t("historySection.recordCount", { count: grouped["Older"].length })}
                </span>
              </button>

              <AnimatePresence>
                {olderExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 mt-3">
                      {grouped["Older"].map((event) => (
                        <HistoryItem
                          key={`older-${event.eventType}-${event.backendId}`}
                          event={event}
                          onTogglePin={onTogglePin}
                          onReuse={onReuse}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {hasAnyHistory && (
        <p className="text-[10px] text-[#A3AED0] mt-6 text-center">
          {t("historySection.footerHint")}
        </p>
      )}
    </div>
  );
}
