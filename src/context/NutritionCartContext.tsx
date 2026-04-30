import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { FoodNutrition } from "@/services/nutrition";

export interface CartItem {
  id: number;
  foodName: string;
  category: string;
  safetyStatus: string;
  quantity: number;
}

interface NutritionCartContextValue {
  items: CartItem[];
  addItem: (food: FoodNutrition) => void;
  removeItem: (id: number) => void;
  updateQuantity: (id: number, quantity: number) => void;
  clearCart: () => void;
  totalCount: number;
}

const STORAGE_KEY = "parkicare_nutrition_cart";

const NutritionCartContext = createContext<NutritionCartContextValue | null>(null);

function loadFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function NutritionCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadFromStorage);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  function addItem(food: FoodNutrition) {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === food.id);
      if (existing) {
        return prev.map((i) =>
          i.id === food.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          id: food.id,
          foodName: food.foodName,
          category: food.category,
          safetyStatus: food.safetyStatus,
          quantity: 1,
        },
      ];
    });
  }

  function removeItem(id: number) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function updateQuantity(id: number, quantity: number) {
    if (quantity < 1) {
      removeItem(id);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity } : i)),
    );
  }

  function clearCart() {
    setItems([]);
  }

  const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <NutritionCartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, totalCount }}
    >
      {children}
    </NutritionCartContext.Provider>
  );
}

export function useNutritionCart() {
  const ctx = useContext(NutritionCartContext);
  if (!ctx) throw new Error("useNutritionCart must be used inside NutritionCartProvider");
  return ctx;
}
