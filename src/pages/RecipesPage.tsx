import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChefHat, Loader2, AlertTriangle, ChevronDown, ChevronUp, UtensilsCrossed, Utensils, Cookie, Coffee } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { recipeService, type GeneratedRecipe } from "@/services/recipe";

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString("en-AU", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

type CategoryMeta = { label: string; colorClass: string; bgClass: string; icon: React.ComponentType<{ size?: number; className?: string }> };

const CATEGORY_META: Record<string, CategoryMeta> = {
  MAIN:    { label: "Main Dish", colorClass: "text-[#4318FF]", bgClass: "bg-[#EEF2FF]",    icon: Utensils },
  SIDE:    { label: "Side",      colorClass: "text-emerald-700", bgClass: "bg-emerald-50", icon: Utensils },
  DESSERT: { label: "Dessert",   colorClass: "text-pink-700",    bgClass: "bg-pink-50",    icon: Cookie   },
  SNACK:   { label: "Snack",     colorClass: "text-amber-700",   bgClass: "bg-amber-50",   icon: Coffee   },
};

function getCategoryMeta(category: string | null | undefined): CategoryMeta | null {
  return category ? (CATEGORY_META[category] ?? null) : null;
}

function HighProteinWarning({ warning, source }: { warning: string; source: string | null }) {
  return (
    <div className="bg-[#FFFBEB] border-[1.5px] border-[#FCD34D] rounded-xl px-4 py-3.5 flex flex-col gap-2">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={18} className="text-[#D97706] shrink-0 mt-0.5" />
        <p className="text-[13px] font-bold text-[#78350F] leading-snug">{warning}</p>
      </div>
      {source && (
        <p className="text-[11px] text-[#92400E] pl-7 leading-snug">
          Source:{" "}
          {source.startsWith("http") ? (
            <a href={source} target="_blank" rel="noopener noreferrer" className="text-[#B45309] underline">
              {source}
            </a>
          ) : source}
        </p>
      )}
    </div>
  );
}

function RecipeCard({ recipe, isLatest }: { recipe: GeneratedRecipe; isLatest: boolean }) {
  const ingredients = parseJsonArray(recipe.ingredients);
  const steps = parseJsonArray(recipe.steps);
  const meta = getCategoryMeta(recipe.category);

  return (
    <div className={`rounded-2xl overflow-hidden bg-white ${
      isLatest
        ? "border-2 border-[#4318FF] shadow-[0_8px_32px_rgba(67,24,255,.14)]"
        : "border border-[#E0E5F2] shadow-[0_2px_12px_rgba(112,144,176,.08)]"
    }`}>
      {/* Header */}
      <div className={`px-5 py-4 flex items-center justify-between gap-3 ${
        isLatest ? "bg-gradient-to-br from-[#4318FF] to-[#6B35FF]" : "bg-[#F8FAFF]"
      }`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <ChefHat size={18} className={isLatest ? "text-white shrink-0" : "text-[#4318FF] shrink-0"} />
          <h2 className={`font-extrabold break-words ${isLatest ? "text-base text-white" : "text-sm text-[#2B3674]"}`}>
            {recipe.recipeTitle || "Untitled Recipe"}
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {meta && (
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
              isLatest ? "bg-white/20 text-white" : `${meta.bgClass} ${meta.colorClass}`
            }`}>
              {meta.label}
            </span>
          )}
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
            isLatest ? "bg-white/20 text-white" : "bg-[#EEF2FF] text-[#4318FF]"
          }`}>
            {isLatest ? "Latest" : formatDate(recipe.createdAt)}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col gap-4">
        {recipe.highProteinWarning && (
          <HighProteinWarning warning={recipe.highProteinWarning} source={recipe.referenceSource ?? null} />
        )}

        {ingredients.length > 0 && (
          <div>
            <h3 className="text-[11px] font-extrabold text-[#A3AED0] uppercase tracking-widest mb-2.5">
              Ingredients
            </h3>
            <ul className="flex flex-col gap-1.5">
              {ingredients.map((ing, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-[#2B3674]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4318FF] shrink-0 mt-[5px]" />
                  {ing}
                </li>
              ))}
            </ul>
          </div>
        )}

        {steps.length > 0 && (
          <div>
            <h3 className="text-[11px] font-extrabold text-[#A3AED0] uppercase tracking-widest mb-2.5">
              Preparation Steps
            </h3>
            <ol className="flex flex-col gap-2.5">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-[#4318FF] to-[#6B35FF] text-white text-[11px] font-extrabold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <p className="text-[13px] text-[#2B3674] leading-relaxed mt-0.5">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {(recipe.suitableDesc || recipe.healthTip) && (
          <div className="flex flex-col gap-2.5">
            {recipe.suitableDesc && (
              <div className="bg-[#F0FDF4] rounded-xl px-3.5 py-3 border border-[#A7F3D0]">
                <span className="text-[10px] font-extrabold text-[#059669] uppercase tracking-widest block mb-1">
                  Why it's suitable
                </span>
                <p className="text-xs text-[#065F46] leading-relaxed">{recipe.suitableDesc}</p>
              </div>
            )}
            {recipe.healthTip && (
              <div className="bg-[#EEF2FF] rounded-xl px-3.5 py-3 border border-[#C7D2FE]">
                <span className="text-[10px] font-extrabold text-[#4318FF] uppercase tracking-widest block mb-1">
                  Health Tip
                </span>
                <p className="text-xs text-[#312E81] leading-relaxed">{recipe.healthTip}</p>
              </div>
            )}
          </div>
        )}

        {ingredients.length > 0 && (
          <p className="text-[11px] text-[#A3AED0] border-t border-[#F4F7FE] pt-3">
            Made from: {ingredients.join(", ")}
          </p>
        )}
        {isLatest && (
          <p className="text-[10px] text-[#A3AED0]">Generated: {formatDate(recipe.createdAt)}</p>
        )}
      </div>
    </div>
  );
}

function PastRecipeAccordion({ recipe }: { recipe: GeneratedRecipe }) {
  const [open, setOpen] = useState(false);
  const meta = getCategoryMeta(recipe.category);

  return (
    <div className="border border-[#E0E5F2] rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3.5 flex items-center justify-between gap-3 cursor-pointer bg-transparent border-none"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <ChefHat size={15} className="text-[#4318FF] shrink-0" />
          <span className="font-bold text-[13px] text-[#2B3674] break-words">
            {recipe.recipeTitle || "Untitled Recipe"}
          </span>
          {meta && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${meta.bgClass} ${meta.colorClass}`}>
              {meta.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-[#A3AED0]">{formatDate(recipe.createdAt)}</span>
          {open
            ? <ChevronUp size={15} className="text-[#A3AED0]" />
            : <ChevronDown size={15} className="text-[#A3AED0]" />}
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[#F4F7FE]">
              <RecipeCard recipe={recipe} isLatest={false} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function RecipesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<GeneratedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllPast, setShowAllPast] = useState(false);

  const PAST_PREVIEW_COUNT = 5;

  useEffect(() => {
    if (!user) return;
    recipeService.getRecipeHistory(user.caregiverId)
      .then(data => { setRecipes(data); setLoading(false); })
      .catch(() => { setError("Failed to load recipes. Please try again."); setLoading(false); });
  }, [user]);

  // Group the most recent generation batch by createdAt minute (recipes generated
  // in the same call share the same timestamp within seconds).
  const latestMinute = recipes[0]?.createdAt?.slice(0, 16) ?? null;
  const latestGroup = latestMinute ? recipes.filter(r => r.createdAt.slice(0, 16) === latestMinute) : [];
  const pastRecipes = latestMinute ? recipes.filter(r => r.createdAt.slice(0, 16) !== latestMinute) : [];

  const mainRecipes = latestGroup.filter(r => !r.category || r.category === "MAIN");
  const sideRecipes = latestGroup.filter(r => r.category === "SIDE" || r.category === "DESSERT" || r.category === "SNACK");
  const hasBothColumns = mainRecipes.length > 0 && sideRecipes.length > 0;

  return (
    <div className="pb-20">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#2B3674]">Recipe Generator</h1>
        <p className="text-sm sm:text-base text-[#A3AED0] font-bold mt-1">
          AI-generated, Parkinson-friendly recipes from your selected ingredients.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="text-[#4318FF] animate-spin" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-20">
          <p className="font-bold text-sm text-red-500">{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError(null);
              recipeService.getRecipeHistory(user!.caregiverId)
                .then(d => { setRecipes(d); setLoading(false); })
                .catch(() => { setError("Failed to load recipes."); setLoading(false); });
            }}
            className="px-4 py-2 bg-[#4318FF] text-white rounded-xl font-bold text-xs"
          >
            Retry
          </button>
        </div>
      ) : recipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <UtensilsCrossed size={56} className="text-[#E0E5F2]" />
          <p className="font-bold text-[15px] text-[#2B3674]">No recipes generated yet</p>
          <p className="text-[13px] text-[#A3AED0] max-w-xs leading-relaxed">
            Go to the Nutrition Library to build your basket and generate your first recipe.
          </p>
          <button
            type="button"
            onClick={() => navigate("/nutrition-library")}
            className="px-5 py-2.5 bg-gradient-to-r from-[#4318FF] to-[#6B35FF] text-white rounded-xl font-bold text-[13px]"
          >
            Go to Nutrition Library
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* ── Latest Generated Recipe(s) ─────────────────────────────────── */}
          <section>
            <p className="text-[11px] font-extrabold text-[#A3AED0] tracking-[.08em] uppercase mb-3">
              Latest Generated Recipe
            </p>

            {hasBothColumns ? (
              /* Case A - Main + Sides: dual-column layout */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Left: Main Dish */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#EEF2FF] flex items-center justify-center">
                      <Utensils size={14} className="text-[#4318FF]" />
                    </div>
                    <span className="text-xs font-extrabold text-[#4318FF] uppercase tracking-widest">
                      Main Dish
                    </span>
                  </div>
                  {mainRecipes.map(r => (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                    >
                      <RecipeCard recipe={r} isLatest={true} />
                    </motion.div>
                  ))}
                </div>

                {/* Right: Sides / Desserts / Snacks */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <Cookie size={14} className="text-emerald-700" />
                    </div>
                    <span className="text-xs font-extrabold text-emerald-700 uppercase tracking-widest">
                      Sides
                    </span>
                  </div>
                  {sideRecipes.map(r => (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.1 }}
                    >
                      <RecipeCard recipe={r} isLatest={true} />
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              /* Case B - Main only: full-width */
              <div className="flex flex-col gap-4">
                {latestGroup.map((r, i) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.08 }}
                  >
                    <RecipeCard recipe={r} isLatest={true} />
                  </motion.div>
                ))}
              </div>
            )}
          </section>

          {/* ── Past Recipes ───────────────────────────────────────────────── */}
          {pastRecipes.length > 0 && (
            <section>
              <p className="text-[11px] font-extrabold text-[#A3AED0] tracking-[.08em] uppercase mb-3">
                Past Recipes ({pastRecipes.length})
              </p>
              <div className="flex flex-col gap-2">
                {(showAllPast ? pastRecipes : pastRecipes.slice(0, PAST_PREVIEW_COUNT)).map(r => (
                  <PastRecipeAccordion key={r.id} recipe={r} />
                ))}
              </div>

              {pastRecipes.length > PAST_PREVIEW_COUNT && (
                <button
                  type="button"
                  onClick={() => setShowAllPast(v => !v)}
                  className="mt-3 w-full py-2.5 flex items-center justify-center gap-2 rounded-xl border border-[#E0E5F2] bg-white hover:bg-[#F4F7FE] text-[#4318FF] text-xs font-bold transition-all"
                >
                  {showAllPast ? (
                    <>
                      <ChevronUp size={14} />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} />
                      Show {pastRecipes.length - PAST_PREVIEW_COUNT} More
                    </>
                  )}
                </button>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
