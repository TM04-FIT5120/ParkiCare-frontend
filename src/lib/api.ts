import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8080/api",
  // baseURL: "https://futurestack.webhop.me/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error.response?.data;
    const message =
      (typeof data === "string" ? data : data?.message) ||
      error.message ||
      "An unexpected error occurred";
    return Promise.reject(new Error(String(message)));
  },
);

export interface PendingReminder {
  remindId: number;
  patientId: number;
  drugId: number;
  dosage: string;
  mealTiming: string | null;
  quantity: number | null;
  remindStatus: number;
}

/** Fetch all pending/snoozed reminders for a caregiver across all their patients. */
export async function fetchPendingRemindersForCaregiver(caregiverId: number): Promise<PendingReminder[]> {
  const res = await api.get<PendingReminder[]>(`/reminder/pending/caregiver/${caregiverId}`);
  return res.data;
}

export default api;
