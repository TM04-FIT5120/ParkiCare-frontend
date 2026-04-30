import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChefHat, Loader2, AlertTriangle, ChevronDown, ChevronUp, UtensilsCrossed } from "lucide-react";
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

function HighProteinWarning({ warning, source }: { warning: string; source: string | null }) {
  return (
    <div style={{
      background: "#FFFBEB", border: "1.5px solid #FCD34D", borderRadius: 12,
      padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <AlertTriangle size={18} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 13, fontWeight: 700, color: "#78350F", lineHeight: 1.5 }}>
          {warning}
        </p>
      </div>
      {source && (
        <p style={{ fontSize: 11, color: "#92400E", paddingLeft: 28, lineHeight: 1.5 }}>
          Source: {source.startsWith("http") ? (
            <a href={source} target="_blank" rel="noopener noreferrer"
              style={{ color: "#B45309", textDecoration: "underline" }}>
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

  return (
    <div style={{
      background: "#fff", borderRadius: 16,
      border: isLatest ? "2px solid #4318FF" : "1px solid #E0E5F2",
      boxShadow: isLatest ? "0 8px 32px rgba(67,24,255,.14)" : "0 2px 12px rgba(112,144,176,.08)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        background: isLatest ? "linear-gradient(135deg,#4318FF,#6B35FF)" : "#F8FAFF",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ChefHat size={18} color={isLatest ? "#fff" : "#4318FF"} />
          <h2 style={{ fontWeight: 800, fontSize: isLatest ? 16 : 14, color: isLatest ? "#fff" : "#2B3674", margin: 0 }}>
            {recipe.recipeTitle || "Untitled Recipe"}
          </h2>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 99,
          background: isLatest ? "rgba(255,255,255,.2)" : "#EEF2FF",
          color: isLatest ? "#fff" : "#4318FF",
        }}>
          {isLatest ? "Latest" : formatDate(recipe.createdAt)}
        </span>
      </div>

      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* High Protein Warning */}
        {recipe.highProteinWarning && (
          <HighProteinWarning warning={recipe.highProteinWarning} source={recipe.referenceSource ?? null} />
        )}

        {/* Ingredients */}
        {ingredients.length > 0 && (
          <div>
            <h3 style={{ fontSize: 12, fontWeight: 800, color: "#A3AED0", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 10 }}>
              Ingredients
            </h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {ingredients.map((ing, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#2B3674" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4318FF", flexShrink: 0, marginTop: 5 }} />
                  {ing}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Steps */}
        {steps.length > 0 && (
          <div>
            <h3 style={{ fontSize: 12, fontWeight: 800, color: "#A3AED0", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 10 }}>
              Preparation Steps
            </h3>
            <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {steps.map((step, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{
                    flexShrink: 0, width: 24, height: 24, borderRadius: "50%",
                    background: "linear-gradient(135deg,#4318FF,#6B35FF)",
                    color: "#fff", fontSize: 11, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{i + 1}</span>
                  <p style={{ fontSize: 13, color: "#2B3674", lineHeight: 1.6, margin: 0 }}>{step}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Suitable / Health Tip */}
        {(recipe.suitableDesc || recipe.healthTip) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recipe.suitableDesc && (
              <div style={{ background: "#F0FDF4", borderRadius: 10, padding: "12px 14px", border: "1px solid #A7F3D0" }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#059669", letterSpacing: ".06em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                  Why it's suitable
                </span>
                <p style={{ fontSize: 12, color: "#065F46", lineHeight: 1.6, margin: 0 }}>{recipe.suitableDesc}</p>
              </div>
            )}
            {recipe.healthTip && (
              <div style={{ background: "#EEF2FF", borderRadius: 10, padding: "12px 14px", border: "1px solid #C7D2FE" }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#4318FF", letterSpacing: ".06em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                  Health Tip
                </span>
                <p style={{ fontSize: 12, color: "#312E81", lineHeight: 1.6, margin: 0 }}>{recipe.healthTip}</p>
              </div>
            )}
          </div>
        )}

        {/* Ingredients used */}
        {recipe.inputFoods && (
          <p style={{ fontSize: 11, color: "#A3AED0", borderTop: "1px solid #F4F7FE", paddingTop: 12, margin: 0 }}>
            Made from: {recipe.inputFoods}
          </p>
        )}
        {isLatest && (
          <p style={{ fontSize: 10, color: "#A3AED0", margin: 0 }}>
            Generated: {formatDate(recipe.createdAt)}
          </p>
        )}
      </div>
    </div>
  );
}

function PastRecipeAccordion({ recipe }: { recipe: GeneratedRecipe }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ border: "1px solid #E0E5F2", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", padding: "14px 16px", background: "none", border: "none",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <ChefHat size={15} color="#4318FF" style={{ flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: 13, color: "#2B3674", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {recipe.recipeTitle || "Untitled Recipe"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: "#A3AED0" }}>{formatDate(recipe.createdAt)}</span>
          {open ? <ChevronUp size={15} color="#A3AED0" /> : <ChevronDown size={15} color="#A3AED0" />}
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
            style={{ overflow: "hidden" }}
          >
            <div style={{ borderTop: "1px solid #F4F7FE" }}>
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

  useEffect(() => {
    if (!user) return;
    recipeService.getRecipeHistory(user.caregiverId)
      .then(data => { setRecipes(data); setLoading(false); })
      .catch(() => { setError("Failed to load recipes. Please try again."); setLoading(false); });
  }, [user]);

  const [latest, ...past] = recipes;

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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "96px 0" }}>
          <Loader2 size={32} color="#4318FF" className="animate-spin" />
        </div>
      ) : error ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "80px 0" }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: "#EF4444" }}>{error}</p>
          <button type="button"
            onClick={() => { setLoading(true); setError(null); recipeService.getRecipeHistory(user!.caregiverId).then(d => { setRecipes(d); setLoading(false); }).catch(() => { setError("Failed to load recipes."); setLoading(false); }); }}
            style={{ padding: "8px 18px", background: "#4318FF", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
            Retry
          </button>
        </div>
      ) : !latest ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "80px 0", textAlign: "center" }}>
          <UtensilsCrossed size={56} color="#E0E5F2" />
          <p style={{ fontWeight: 700, fontSize: 15, color: "#2B3674" }}>No recipes generated yet</p>
          <p style={{ fontSize: 13, color: "#A3AED0", maxWidth: 320, lineHeight: 1.6 }}>
            Go to the Nutrition Library to build your basket and generate your first recipe.
          </p>
          <button type="button"
            onClick={() => navigate("/nutrition-library")}
            style={{ padding: "10px 22px", background: "linear-gradient(90deg,#4318FF,#6B35FF)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Go to Nutrition Library
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {/* Latest Recipe */}
          <section>
            <p style={{ fontSize: 11, fontWeight: 800, color: "#A3AED0", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 12 }}>
              Latest Generated Recipe
            </p>
            <RecipeCard recipe={latest} isLatest={true} />
          </section>

          {/* Past Recipes */}
          {past.length > 0 && (
            <section>
              <p style={{ fontSize: 11, fontWeight: 800, color: "#A3AED0", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 12 }}>
                Past Recipes ({past.length})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {past.map(r => <PastRecipeAccordion key={r.id} recipe={r} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
