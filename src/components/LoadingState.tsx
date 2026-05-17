import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

/** Centered spinner for full card/section loading (Recipes-style). */
export function SectionSpinner({
  className = "",
  size = 32,
  minHeightClass = "min-h-[120px]",
}: {
  className?: string;
  size?: number;
  minHeightClass?: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-10 ${minHeightClass} ${className}`}
      role="status"
      aria-label={t("common.loading")}
    >
      <Loader2 size={size} className="text-[#4318FF] animate-spin" aria-hidden />
      <p className="text-[12px] font-bold text-[#A3AED0]">{t("common.loading")}</p>
    </div>
  );
}

/** Pulse rows for scrollable lists (Dashboard task list style). */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 rounded-2xl bg-[#F8F7FF] animate-pulse"
        >
          <div className="w-9 h-9 rounded-xl bg-[#E9E3FF] shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 bg-[#E9E3FF] rounded-md w-3/5" />
            <div className="h-3 bg-[#E9E3FF] rounded-md w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Pulse bars for table bodies. */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-[#F4F7FE] rounded-xl animate-pulse" />
      ))}
    </div>
  );
}
