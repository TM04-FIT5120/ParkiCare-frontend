import api from "../lib/api";

export interface RecipeItem {
  recipeTitle: string;
  category: "MAIN" | "SIDE" | "DESSERT" | "SNACK";
  ingredients: string[];
  steps: string[];
  suitableDesc: string;
  unsuitableDesc: string;
  healthTip: string;
}

export interface RecipeGenerateResult {
  recipes: RecipeItem[];
  highProteinWarning: string;
  referenceSource: string;
}

export interface GeneratedRecipe {
  id: number;
  caregiverId: number;
  inputFoods: string;
  recipeTitle: string;
  category: "MAIN" | "SIDE" | "DESSERT" | "SNACK" | null;
  ingredients: string;
  steps: string;
  suitableDesc: string;
  unsuitableDesc: string;
  healthTip: string;
  highProteinWarning: string | null;
  referenceSource: string | null;
  createdAt: string;
}

export const recipeService = {
  generateRecipe: async (foods: string[], caregiverId: number): Promise<RecipeGenerateResult> => {
    const res = await api.post<RecipeGenerateResult>("/recipe/generate", { foods, caregiverId });
    return res.data;
  },

  getRecipeHistory: async (caregiverId: number): Promise<GeneratedRecipe[]> => {
    const res = await api.get<GeneratedRecipe[]>("/recipe/history", { params: { caregiverId } });
    return res.data;
  },
};
