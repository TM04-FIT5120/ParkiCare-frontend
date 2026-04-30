import api from "@/lib/api";

export type MealScheduleEntry = {
  id?: number;
  caregiverId: number;
  mealType: string; // "BREAKFAST" | "LUNCH" | "DINNER"
  mealTime: string; // "HH:mm"
};

export async function getMealSchedules(caregiverId: number): Promise<MealScheduleEntry[]> {
  const res = await api.get<MealScheduleEntry[]>(`/meal-schedule/caregiver/${caregiverId}`);
  return res.data;
}

export async function updateMealTime(
  caregiverId: number,
  mealType: string,
  mealTime: string
): Promise<MealScheduleEntry> {
  const res = await api.put<MealScheduleEntry>(
    `/meal-schedule/caregiver/${caregiverId}/meal/${mealType}`,
    { mealTime }
  );
  return res.data;
}

export async function generateWeeklyMeals(caregiverId: number): Promise<void> {
  await api.post(`/meal-schedule/caregiver/${caregiverId}/generate-week`);
}
