import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, X, Loader2, ChevronLeft, ChevronRight,
  ShoppingCart, ShoppingBag, Plus, Trash2, ChefHat,
} from "lucide-react";
import { toast } from "sonner";
import { nutritionService, FOOD_CATEGORIES, type FoodNutrition } from "@/services/nutrition";
import { useNutritionCart } from "@/context/NutritionCartContext";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { recipeService } from "@/services/recipe";
import { useTranslation } from "react-i18next";
import { translateEnum } from "@/lib/translateEnum";

// ─── Status color config (matches Claude Design) ─────────────────────────────

type SafetyStatus = "Safe" | "Recommended" | "Avoid" | "Caution";

const SC = {
  Safe: {
    c: "#0EA5E9", bg: "#F0F9FF", tx: "#0C4A6E", br: "#BAE6FD",
    li: "#F0F9FF", gb: "linear-gradient(150deg,#0C4A6E,#075985,#0369A1)",
  },
  Recommended: {
    c: "#059669", bg: "#ECFDF5", tx: "#065F46", br: "#A7F3D0",
    li: "#F0FDF4", gb: "linear-gradient(150deg,#064E3B,#065F46,#047857)",
  },
  Caution: {
    c: "#D97706", bg: "#FFFBEB", tx: "#78350F", br: "#FCD34D",
    li: "#FEFCE8", gb: "linear-gradient(150deg,#78350F,#92400E,#B45309)",
  },
  Avoid: {
    c: "#DC2626", bg: "#FFF1F2", tx: "#881337", br: "#FECDD3",
    li: "#FFF5F5", gb: "linear-gradient(150deg,#7F1D1D,#991B1B,#B91C1C)",
  },
} as const;

// ─── Inline SVG icons (matching design exactly) ───────────────────────────────

const IconShield = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="#7DD3FC" stroke="#0EA5E9" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);
const IconStar = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="#6EE7B7" stroke="#059669" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);
const IconZap = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="#FDE68A" stroke="#D97706" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);
const IconWarn = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="#FECACA" stroke="#DC2626" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);
const IconBook = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.75)"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 014 17V5a2 2 0 012-2h14v14H6.5" />
  </svg>
);

const STATUS_ICONS: Record<SafetyStatus, React.ReactNode> = {
  Safe: <IconShield />,
  Recommended: <IconStar />,
  Caution: <IconZap />,
  Avoid: <IconWarn />,
};

// ─── Status Tag ───────────────────────────────────────────────────────────────

function StatusTag({ status, small }: { status: SafetyStatus; small?: boolean }) {
  const s = SC[status] ?? SC.Caution;
  const label = translateEnum("safetyStatus", status);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: small ? "2px 7px" : "3px 10px",
      borderRadius: 99, fontSize: 10, fontWeight: 700,
      background: s.bg, color: s.tx, border: `1px solid ${s.br}`, whiteSpace: "nowrap",
    }}>
      {STATUS_ICONS[status]}{label}
    </span>
  );
}

function categoryMatches(foodCategory: string, filterCategory: string): boolean {
  if (filterCategory === "Fruits") return /^Fruits/i.test(foodCategory);
  if (filterCategory === "Vegetables") return /^Vegetables/i.test(foodCategory);
  return foodCategory === filterCategory;
}

// ─── Remark parser ────────────────────────────────────────────────────────────

const DEFAULT_REMARK_RATIONALE =
  "Nutritional data is based on the USDA FoodData Central dataset.";
const DEFAULT_CAREGIVER_TIP =
  "Always consult the patient's neurologist or dietitian before making dietary changes.";

/** Split food_nutrition.remark into sentence 1 (Parkinson's Connection) and sentence 2 (Caregiver Tip). */
function splitRemarkSentences(remark: string): string[] {
  const trimmed = remark.trim();
  if (!trimmed) return [];

  const byNewline = trimmed.split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (byNewline.length >= 2) return byNewline;

  // Catalog copy often uses ". Caregivers should..." as the boundary between sections.
  const caregiversBoundary = trimmed.search(/\.\s+Caregivers\b/i);
  if (caregiversBoundary !== -1) {
    const first = trimmed.slice(0, caregiversBoundary + 1).trim();
    const second = trimmed.slice(caregiversBoundary + 1).trim();
    if (first && second) return [first, second];
  }

  // English / Western punctuation, plus CJK sentence endings (zh/ms translations).
  const byPunctuation = trimmed
    .split(/(?<=[.!?])\s+|(?<=[。！？])\s*/)
    .map(s => s.trim())
    .filter(Boolean);
  if (byPunctuation.length >= 2) return byPunctuation;

  return [trimmed];
}

function parseRemark(remark: string | null): { rationale: string; tip: string } {
  if (!remark?.trim()) {
    return {
      rationale: DEFAULT_REMARK_RATIONALE,
      tip: DEFAULT_CAREGIVER_TIP,
    };
  }

  const sentences = splitRemarkSentences(remark);
  return {
    rationale: sentences[0] ?? remark.trim(),
    tip: sentences.length > 1 ? sentences[1] : DEFAULT_CAREGIVER_TIP,
  };
}

function firstSource(source: string | null): string {
  if (!source) return "USDA FoodData Central";
  // If multiple sources are separated by commas, semicolons, or newlines, take only the first
  return source.split(/[,;\n]/)[0].trim();
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

const SAFETY_STATUSES = ["Safe", "Recommended", "Caution", "Avoid"] as const;

function FilterBar({
  keyword, setKeyword,
  activeStatuses, toggleStatus,
}: {
  keyword: string; setKeyword: (v: string) => void;
  activeStatuses: SafetyStatus[]; toggleStatus: (s: SafetyStatus) => void;
}) {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>

      {/* search */}
      <div style={{ position: "relative", flex: "1 1 180px", minWidth: 150 }}>
        <Search size={15} color="#A3AED0" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
        <input
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          placeholder={t("nutritionLibrary.searchPlaceholder")}
          style={{
            width: "100%", paddingLeft: 36, paddingRight: keyword ? 32 : 12,
            paddingTop: 9, paddingBottom: 9,
            border: "1.5px solid #E0E5F2", borderRadius: 10,
            fontSize: 13, color: "#2B3674", background: "#fff",
            fontFamily: "inherit", transition: "border-color .15s",
            boxShadow: "0 1px 4px rgba(112,144,176,.06)",
          }}
          onFocus={e => (e.target.style.borderColor = "#4318FF")}
          onBlur={e => (e.target.style.borderColor = "#E0E5F2")}
        />
        {keyword && (
          <button type="button" onClick={() => setKeyword("")}
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 2 }}>
            <X size={13} color="#A3AED0" />
          </button>
        )}
      </div>

      {/* status pills - multi-select, empty = all */}
      <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
        {SAFETY_STATUSES.map(s => {
          const on = activeStatuses.includes(s);
          const sc = SC[s];
          return (
            <button key={s} type="button" onClick={() => toggleStatus(s)} style={{
              padding: "7px 14px", borderRadius: 99, fontSize: 11, fontWeight: 700,
              cursor: "pointer", transition: "all .15s",
              border: `1.5px solid ${on ? sc.c : sc.br}`,
              background: on ? sc.c : "#fff",
              color: on ? "#fff" : sc.tx,
            }}>{translateEnum("safetyStatus", s)}</button>
          );
        })}
      </div>

    </div>
  );
}

// ─── Category Tabs ────────────────────────────────────────────────────────────

function CatTabs({ activeCategories, toggleCategory, counts }: {
  activeCategories: string[];
  toggleCategory: (c: string) => void;
  counts: Record<string, number>;
}) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(dir: "left" | "right") {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
    }
  }

  const arrowBtn: React.CSSProperties = {
    flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
    width: 32, height: 32, borderRadius: "50%", border: "1.5px solid #E0E5F2",
    background: "#fff", cursor: "pointer", color: "#A3AED0",
    boxShadow: "0 1px 4px rgba(112,144,176,.1)", transition: "all .15s",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent" }}>
      <button type="button" style={arrowBtn} onClick={() => scroll("left")}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "#2B3674"; e.currentTarget.style.color = "#2B3674"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "#E0E5F2"; e.currentTarget.style.color = "#A3AED0"; }}>
        <ChevronLeft size={15} />
      </button>

      <div ref={scrollRef} className="nl-no-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2, flex: 1, background: "transparent" }}>
        {/* All tab */}
        {(() => {
          const on = activeCategories.length === 0;
          return (
            <button type="button" onClick={() => toggleCategory("All")} style={{
              flexShrink: 0, display: "flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 99, fontSize: 12, fontWeight: 700,
              cursor: "pointer", transition: "all .15s",
              background: on ? "#2B3674" : "#fff", color: on ? "#fff" : "#A3AED0",
              border: `1.5px solid ${on ? "#2B3674" : "#E0E5F2"}`,
              boxShadow: on ? "0 4px 14px rgba(43,54,116,.25)" : "none",
            }}>{t("nutritionLibrary.allTab")}</button>
          );
        })()}
        {/* Category tabs - multi-select */}
        {FOOD_CATEGORIES.map(c => {
          const on = activeCategories.includes(c);
          return (
            <button key={c} type="button" onClick={() => toggleCategory(c)} style={{
              flexShrink: 0, display: "flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 99, fontSize: 12, fontWeight: 700,
              cursor: "pointer", transition: "all .15s",
              background: on ? "#2B3674" : "#fff", color: on ? "#fff" : "#A3AED0",
              border: `1.5px solid ${on ? "#2B3674" : "#E0E5F2"}`,
              boxShadow: on ? "0 4px 14px rgba(43,54,116,.25)" : "none",
            }}>
              {translateEnum("foodCategory", c)}
              {(counts[c] ?? 0) > 0 && (
                <span style={{
                  fontSize: 10, padding: "1px 6px", borderRadius: 99,
                  background: on ? "rgba(255,255,255,.2)" : "#F4F7FE",
                  color: on ? "#fff" : "#A3AED0",
                }}>{counts[c]}</span>
              )}
            </button>
          );
        })}
      </div>

      <button type="button" style={arrowBtn} onClick={() => scroll("right")}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "#2B3674"; e.currentTarget.style.color = "#2B3674"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "#E0E5F2"; e.currentTarget.style.color = "#A3AED0"; }}>
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

// ─── Food Card ────────────────────────────────────────────────────────────────

function FoodCard({ food, onAdd }: { food: FoodNutrition; onAdd: (f: FoodNutrition) => void }) {
  const { t } = useTranslation();
  const [flipped, setFlipped] = useState(false);
  const [hovered, setHovered] = useState(false);
  const status = food.safetyStatus as SafetyStatus;
  const s = SC[status] ?? SC.Caution;
  const { rationale, tip } = parseRemark(food.remark);
  const source = firstSource(food.source);

  const macros: [string, number, string, string][] = [
    ["P", Number(food.protein100g), "#EEF2FF", "#4F46E5"],
    ["F", Number(food.fat100g), "#FFF7ED", "#EA580C"],
    ["C", Number(food.carbs100g), "#F0FDF4", "#16A34A"],
    ...(Number(food.fiber100g) > 0
      ? [["Fi", Number(food.fiber100g), "#F5F3FF", "#7C3AED"] as [string, number, string, string]]
      : []),
  ];

  return (
    <div
      style={{ perspective: 1000, height: "min(500px, 70vh)", cursor: "pointer" }}
      onClick={() => setFlipped(f => !f)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={`nl-ci${flipped ? " nl-flipped" : ""}`}>

        {/* ── FRONT ── */}
        <div className="nl-cf" style={{
          borderRadius: 18, overflow: "hidden", background: "#fff",
          border: "1px solid #E0E5F2", display: "flex", flexDirection: "column",
          boxShadow: hovered && !flipped
            ? "0 20px 52px rgba(112,144,176,.22)"
            : "0 4px 20px rgba(112,144,176,.1)",
          transform: hovered && !flipped ? "translateY(-3px)" : "none",
          transition: "box-shadow .2s,transform .2s",
        }}>
          {/* image area */}
          <div style={{
            height: 220, background: s.li,
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative", flexShrink: 0, overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", inset: 0,
              backgroundImage: `radial-gradient(ellipse at 30% 40%,${s.c}18 0%,transparent 60%),radial-gradient(ellipse at 75% 65%,${s.c}10 0%,transparent 55%)`,
            }} />
            <div style={{
              position: "absolute", inset: 0,
              backgroundImage: "radial-gradient(circle,rgba(0,0,0,.04) 1px,transparent 1px)",
              backgroundSize: "20px 20px", opacity: .6,
            }} />
            {food.imageUrl && (
              <img
                src={food.imageUrl}
                alt={food.foodName}
                style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }}
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}

            <div style={{ position: "absolute", top: 10, right: 10 }}>
              <StatusTag status={status} />
            </div>
            <div style={{ position: "absolute", bottom: 10, left: 10, background: "rgba(43,54,116,.82)", backdropFilter: "blur(8px)", borderRadius: 8, padding: "3px 10px" }}>
              <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>{food.calories} kcal</span>
            </div>
            <div style={{ position: "absolute", bottom: 10, right: 10, background: "rgb(146, 152, 180)", backdropFilter: "blur(6px)", borderRadius: 6, padding: "2px 8px" }}>
              <span style={{ color: "#ffffff", fontSize: 9, fontWeight: 700, letterSpacing: ".04em" }}>{t("nutritionLibrary.tapToFlip")}</span>
            </div>
          </div>

          {/* body */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "14px 16px", gap: 9, minHeight: 0 }}>
            <div>
              <p style={{
                fontWeight: 800, color: "#2B3674", fontSize: 14, lineHeight: 1.3,
                display: "-webkit-box", WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>{food.foodName}</p>
              <p style={{ fontSize: 11, color: "#A3AED0", marginTop: 3 }}>
                {food.measure} · {food.grams}g per serving
              </p>
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {macros.map(([l, v, bg, c]) => (
                <span key={l} style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 6, background: bg, color: c }}>
                  {l} {v.toFixed(1)}g
                </span>
              ))}
            </div>
          </div>

          {/* add button */}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onAdd(food); }}
            style={{
              width: "100%", padding: "12px 0",
              background: "linear-gradient(90deg,#4318FF 0%,#6B35FF 100%)",
              color: "#fff", fontWeight: 700, fontSize: 12, border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              flexShrink: 0, transition: "opacity .15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = ".88")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            <Plus size={13} color="#fff" /> {t("nutritionLibrary.addToIngredientCart")}
          </button>
        </div>

        {/* ── BACK ── */}
        <div className="nl-cf nl-cb" style={{
          borderRadius: 18, overflow: "hidden",
          display: "flex", flexDirection: "column", padding: 18, gap: 10,
          background: s.gb, boxShadow: "0 12px 40px rgba(0,0,0,.28)",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <p style={{ fontWeight: 800, color: "#fff", fontSize: 14, lineHeight: 1.3, flex: 1 }}>
              {food.foodName}
            </p>
            <StatusTag status={status} small />
          </div>

          {/* Parkinson's Connection */}
          <div style={{ background: "rgba(255,255,255,.12)", borderRadius: 11, padding: "11px 13px", border: "1px solid rgba(255,255,255,.15)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
              <IconBook />
              <span style={{ color: "rgba(255,255,255,.65)", fontSize: 9, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
                {t("nutritionLibrary.parkinsonsConnection")}
              </span>
            </div>
            <p style={{
              color: "#fff", fontSize: 10.5, lineHeight: 1.55,
              display: "-webkit-box", WebkitLineClamp: 5,
              WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>{rationale}</p>
          </div>

          {/* Caregiver Tip */}
          <div style={{ background: "rgba(255,255,255,.08)", borderRadius: 11, padding: "10px 13px", border: "1px solid rgba(255,255,255,.1)", flexShrink: 0 }}>
            <span style={{ color: "rgba(255,255,255,.65)", fontSize: 9, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
              💡 {t("nutritionLibrary.caregiverTip")}
            </span>
            <p style={{
              color: "rgba(255,255,255,.9)", fontSize: 10.5, lineHeight: 1.55,
              display: "-webkit-box", WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>{tip}</p>
          </div>

          {/* Key Nutrients */}
          <div style={{ background: "rgba(0,0,0,.18)", borderRadius: 11, padding: "10px 13px", flex: 1, minHeight: 0, overflow: "hidden" }}>
            <span style={{ color: "rgba(255,255,255,.65)", fontSize: 9, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>
              {t("nutritionLibrary.keyNutrients")}
            </span>
            {([
              [t("nutritionLibrary.protein"), food.protein100g],
              [t("nutritionLibrary.saturatedFats"), food.saturatedFats100g],
              [t("nutritionLibrary.dietaryFiber"), food.fiber100g],
              [t("nutritionLibrary.carbohydrates"), food.carbs100g],
            ] as [string, number][]).map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 5, marginBottom: 5, borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                <span style={{ color: "rgba(255,255,255,.6)", fontSize: 10.5 }}>{l}</span>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: 11 }}>{Number(v).toFixed(1)}g</span>
              </div>
            ))}
          </div>

          <p style={{
            flexShrink: 0, maxHeight: 46, overflow: "hidden",
            color: "rgba(255,255,255,.3)", fontSize: 9, textAlign: "center",
            lineHeight: 1.5, wordBreak: "break-all",
          }}>
            Source:{" "}
            {source.startsWith("http") ? (
              <a
                href={source}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "rgba(255,255,255,.5)", textDecoration: "underline" }}
                onClick={e => e.stopPropagation()}
              >
                {source}
              </a>
            ) : (
              source
            )}
          </p>
        </div>

      </div>
    </div>
  );
}

// ─── Cart Panel ───────────────────────────────────────────────────────────────

function CartPanel({ onClose, onGenerate, generating, foodsById }: {
  onClose: () => void;
  onGenerate: () => void;
  generating: boolean;
  foodsById: Map<number, FoodNutrition>;
}) {
  const { t } = useTranslation();
  const { items, removeItem, clearCart, totalCount } = useNutritionCart();

  return (
    <>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(20,20,60,.35)", backdropFilter: "blur(5px)", zIndex: 45 }}
      />
      <motion.div
        key="panel"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 35 }}
        style={{
          position: "fixed", top: 0, right: 0,
          height: "100dvh",
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          width: "min(380px,100vw)", background: "#fff", zIndex: 50,
          display: "flex", flexDirection: "column",
          boxShadow: "-10px 0 60px rgba(67,24,255,.14)",
        }}
      >
        {/* header */}
        <div style={{ padding: "18px 20px", background: "linear-gradient(135deg,#4318FF,#6B35FF)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ShoppingBag size={20} color="#fff" />
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>{t("nutritionLibrary.ingredientCart")}</span>
            {totalCount > 0 && (
              <span style={{ background: "rgba(255,255,255,.2)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99 }}>
                {t("nutritionLibrary.cartItemCount", { count: totalCount })}
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 8, padding: 7, cursor: "pointer", display: "flex" }}>
            <X size={16} color="#fff" />
          </button>
        </div>

        {/* items */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {items.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "#A3AED0", textAlign: "center", padding: 32 }}>
              <ShoppingCart size={52} color="#E0E5F2" />
              <p style={{ fontWeight: 700, fontSize: 14, color: "#2B3674" }}>{t("nutritionLibrary.cartEmpty")}</p>
              <p style={{ fontSize: 12, lineHeight: 1.6 }}>
                {t("nutritionLibrary.cartEmptyBrowseTip")}
              </p>
              <div style={{ width: "100%", marginTop: 8 }}>
                <button type="button" disabled
                  style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "none", background: "#E0E5F2", color: "#A3AED0", fontWeight: 700, fontSize: 13, cursor: "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                  <ChefHat size={15} /> {t("nutritionLibrary.generateRecipe")}
                </button>
                <p style={{ fontSize: 11, color: "#A3AED0", marginTop: 8, lineHeight: 1.5 }}>
                  {t("nutritionLibrary.cartBasketEmptyHint")}
                </p>
              </div>
            </div>
          ) : (
            items.map(item => {
              const sc = SC[item.safetyStatus as SafetyStatus] ?? SC.Caution;
              return (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", background: "#F8FAFF", borderRadius: 12, border: "1px solid #E0E5F2" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 12, color: "#2B3674", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{foodsById.get(item.id)?.foodName ?? item.foodName}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: sc.c, flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: "#A3AED0" }}>{translateEnum("foodCategory", item.category)}</span>
                    </div>
                  </div>
<button type="button" onClick={() => removeItem(item.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex" }}>
                    <Trash2 size={15} color="#EF4444" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* footer */}
        {items.length > 0 && (
          <div style={{ padding: "14px 16px", borderTop: "1px solid #E0E5F2", flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 11, padding: "10px 14px", background: "#F8FAFF", borderRadius: 10 }}>
              <span style={{ fontSize: 13, color: "#A3AED0", fontWeight: 600 }}>{t("nutritionLibrary.totalItems")}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#2B3674" }}>{totalCount}</span>
            </div>
            <button type="button"
              onClick={onGenerate}
              disabled={generating}
              style={{ width: "100%", padding: "12px 0", border: "none", borderRadius: 10, background: generating ? "#A3AED0" : "linear-gradient(90deg,#4318FF 0%,#6B35FF 100%)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: generating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 10 }}>
              {generating ? <Loader2 size={15} className="animate-spin" /> : <ChefHat size={15} />}
              {generating ? t("nutritionLibrary.generatingRecipe") : t("nutritionLibrary.generateRecipe")}
            </button>
            <button type="button"
              onClick={() => { clearCart(); toast.success(t("nutritionLibrary.cartClearedToast")); }}
              style={{ width: "100%", padding: "11px 0", border: "2px solid #FEE2E2", borderRadius: 10, background: "none", color: "#EF4444", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              {t("nutritionLibrary.clearCart")}
            </button>
          </div>
        )}
      </motion.div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function NutritionLibraryPage() {
  const { t } = useTranslation();
  const [allFoods, setAllFoods] = useState<FoodNutrition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [keyword, setKeyword] = useState("");
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [activeStatuses, setActiveStatuses] = useState<SafetyStatus[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  const { totalCount, addItem, items, syncDisplayNamesFromFoods } = useNutritionCart();
  const { user } = useAuth();
  const { currentLang } = useLanguage();
  const navigate = useNavigate();

  async function handleGenerateRecipe() {
    if (items.length === 0 || !user) return;
    setGenerating(true);
    try {
      await recipeService.generateRecipe(
        items.map(i => i.canonicalFoodName ?? i.foodName),
        user.caregiverId,
      );
      navigate("/recipes");
    } catch {
      toast.error(t("nutritionLibrary.recipeFailedToast"));
    } finally {
      setGenerating(false);
    }
  }

  function toggleCategory(c: string) {
    if (c === "All") { setActiveCategories([]); return; }
    setActiveCategories(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  }

  function toggleStatus(s: SafetyStatus) {
    setActiveStatuses(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  }

  // load full dataset once
  function loadFoods() {
    setLoading(true);
    setError(null);
    nutritionService
      .getAll()
      .then(data => {
        setAllFoods(data);
        syncDisplayNamesFromFoods(data);
        setLoading(false);
      })
      .catch(() => { setError(t("nutritionLibrary.failedLoadFood")); setLoading(false); });
  }
  useEffect(() => { loadFoods(); }, [currentLang]); // eslint-disable-line react-hooks/exhaustive-deps

  // client-side filtering - empty arrays mean "all"
  const filtered = useMemo(() =>
    allFoods.filter(f => {
      const mk = !keyword
        || f.foodName.toLowerCase().includes(keyword.toLowerCase())
        || f.category.toLowerCase().includes(keyword.toLowerCase());
      const mc = activeCategories.length === 0 || activeCategories.some(c => categoryMatches(f.category, c));
      const ms = activeStatuses.length === 0 || activeStatuses.includes(f.safetyStatus as SafetyStatus);
      return mk && mc && ms;
    }),
    [allFoods, keyword, activeCategories, activeStatuses],
  );

  // category counts from full data
  const categoryCounts = useMemo(() =>
    FOOD_CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
      acc[cat] = allFoods.filter(f => categoryMatches(f.category, cat)).length;
      return acc;
    }, {}),
    [allFoods],
  );

  const hasFilters = !!(keyword || activeCategories.length > 0 || activeStatuses.length > 0);

  const foodsById = useMemo(
    () => new Map(allFoods.map((f) => [f.id, f])),
    [allFoods],
  );

  function handleAdd(food: FoodNutrition) {
    addItem(food);
    toast.success(t("nutritionLibrary.cartAddedFoodToast", { foodName: food.foodName }));
  }

  return (
    <div className="pb-[calc(5rem+env(safe-area-inset-bottom,0px))] min-w-0">
      {/* Standard page header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#2B3674]">{t("nutritionLibrary.title")}</h1>
        <p className="text-sm sm:text-base text-[#A3AED0] font-bold mt-1">
          {t("nutritionLibrary.subtitle")}
        </p>
      </div>

      {/* Filter Bar */}
      <FilterBar
        keyword={keyword} setKeyword={setKeyword}
        activeStatuses={activeStatuses} toggleStatus={toggleStatus}
      />

      {/* Category Tabs */}
      <div style={{ marginBottom: 16 }}>
        <CatTabs activeCategories={activeCategories} toggleCategory={toggleCategory} counts={categoryCounts} />
      </div>

      {/* Results count */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18, marginBottom: 2 }}>
        <p style={{ fontSize: 12, color: "#A3AED0", fontWeight: 600 }}>
          {loading ? t("common.loading") : t("nutritionLibrary.foodsFound", { count: filtered.length })}
        </p>
        {hasFilters && (
          <button type="button"
            onClick={() => { setKeyword(""); setActiveCategories([]); setActiveStatuses([]); }}
            style={{ fontSize: 11, fontWeight: 700, color: "#4318FF", background: "none", border: "none", cursor: "pointer", padding: "3px 8px", borderRadius: 8 }}>
            {t("nutritionLibrary.clearAllFilters")}
          </button>
        )}
      </div>

      {/* Food Grid */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "96px 0" }}>
          <Loader2 size={32} color="#4318FF" className="animate-spin" />
        </div>
      ) : error ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 12 }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: "#EF4444" }}>{error}</p>
          <button type="button" onClick={loadFoods}
            style={{ padding: "8px 18px", background: "#4318FF", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
            {t("common.retry")}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 12, color: "#A3AED0" }}>
          <span style={{ fontSize: 44 }}>🍽️</span>
          <p style={{ fontWeight: 700, fontSize: 14, color: "#2B3674", marginTop: 4 }}>{t("nutritionLibrary.noFoodsMatch")}</p>
          <p style={{ fontSize: 12 }}>{t("nutritionLibrary.adjustFilters")}</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(228px,1fr))", gap: 20, marginTop: 10 }}>
          {filtered.map((food, i) => (
            <motion.div
              key={food.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: .2, delay: Math.min(i * .04, .3) }}
            >
              <FoodCard food={food} onAdd={handleAdd} />
            </motion.div>
          ))}
        </div>
      )}

      {/* Floating cart button - fixed bottom-right */}
      <button
        type="button"
        onClick={() => setCartOpen(true)}
        style={{
          position: "fixed",
          bottom: "calc(1.75rem + env(safe-area-inset-bottom, 0px))",
          right: "calc(1.75rem + env(safe-area-inset-right, 0px))",
          zIndex: 60,
          display: "flex", alignItems: "center", gap: 8,
          padding: "12px 20px",
          background: "linear-gradient(135deg,#4318FF 0%,#6B35FF 100%)",
          border: "none", borderRadius: 14, color: "#fff",
          fontWeight: 700, fontSize: 13, cursor: "pointer",
          boxShadow: "0 8px 32px rgba(67,24,255,.38)",
          transition: "transform .15s, box-shadow .15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(67,24,255,.48)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(67,24,255,.38)"; }}
      >
        <ShoppingBag size={16} color="#fff" />
        {t("nutritionLibrary.ingredientCart")}
        {totalCount > 0 && (
          <span style={{
            minWidth: 20, height: 20, borderRadius: 99, padding: "0 6px",
            background: "#EF4444", color: "#fff", fontSize: 10, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>{totalCount > 99 ? "99+" : totalCount}</span>
        )}
      </button>

      {/* Cart Drawer */}
      <AnimatePresence>
        {cartOpen && (
          <CartPanel
            onClose={() => setCartOpen(false)}
            onGenerate={handleGenerateRecipe}
            generating={generating}
            foodsById={foodsById}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
