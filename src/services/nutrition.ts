import api from "@/lib/api";

export interface FoodNutrition {
  id: number;
  foodName: string;
  category: string;
  safetyStatus: "Safe" | "Recommended" | "Avoid" | "Caution";
  measure: string;
  grams: number;
  calories: number;
  protein100g: number;
  saturatedFats100g: number;
  fat100g: number;
  fiber100g: number;
  carbs100g: number;
  remark: string | null;
  source: string | null;
  imageUrl: string | null;
}

export const FOOD_CATEGORIES = [
  "Dairy products",
  "Fruits",
  "Vegetables",
  "Meat, Poultry",
  "Fish, Seafood",
  "Breads, cereals, fastfood,grains",
  "Desserts, sweets",
  "Drinks,Alcohol, Beverages",
  "Fats, Oils, Shortenings",
  "Seeds and Nuts",
  "Soups",
  "Jams, Jellies",
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export const nutritionService = {
  getAll: (): Promise<FoodNutrition[]> =>
    api.get<FoodNutrition[]>("/foods").then((r) => r.data),

  filter: (params: {
    category?: string;
    safetyStatus?: string;
    keyword?: string;
  }): Promise<FoodNutrition[]> =>
    api
      .get<FoodNutrition[]>("/foods/filter", {
        params: {
          ...(params.category ? { category: params.category } : {}),
          ...(params.safetyStatus ? { safetyStatus: params.safetyStatus } : {}),
          ...(params.keyword ? { keyword: params.keyword } : {}),
        },
      })
      .then((r) => r.data),
};
