import i18n from "@/i18n";

/**
 * Translate an enum/code value coming from the API (canonical English) into the
 * active language. Returns the original value when no translation exists, so it
 * is safe for unknown values.
 */
export function translateEnum(
  group:
    | "mealType"
    | "mealTiming"
    | "remindStatus"
    | "priority"
    | "safetyStatus"
    | "foodCategory"
    | "sourceType"
    | "recurrence"
    | "frequency",
  value: string | null | undefined,
): string {
  if (!value) return "";
  const key = `enums.${group}.${value}`;
  const translated = i18n.t(key);
  return translated === key ? value : translated;
}
