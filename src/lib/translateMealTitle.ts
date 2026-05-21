import i18n from "@/i18n";

// All known title forms for each meal across English + every supported locale.
// The backend LLM may return any of these, so we catch them all and always
// render the deterministic i18n value instead.
const MEAL_KEY_MAP: Record<string, "dashboard.breakfast" | "dashboard.lunch" | "dashboard.dinner"> = {
  // English (canonical DB value)
  Breakfast:             "dashboard.breakfast",
  Lunch:                 "dashboard.lunch",
  Dinner:                "dashboard.dinner",
  // Simplified Chinese
  "早餐":                "dashboard.breakfast",
  "午餐":                "dashboard.lunch",
  "晚餐":                "dashboard.dinner",
  // Malay
  "Sarapan":             "dashboard.breakfast",
  "Makan Tengah Hari":   "dashboard.lunch",
  "Makan Malam":         "dashboard.dinner",
};

/** Returns the static i18n translation if the title is a known meal, otherwise null. */
export function translateMealTitle(title: string): string | null {
  const key = MEAL_KEY_MAP[title];
  return key ? i18n.t(key) : null;
}

/** Returns true if the title is a known meal title in any supported language. */
export function isMealTitle(title: string): boolean {
  return title in MEAL_KEY_MAP;
}
