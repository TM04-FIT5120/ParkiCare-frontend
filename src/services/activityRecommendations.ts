import api from "@/lib/api";

export interface WeatherData {
  temperature: number;
  weather: string;
  weatherDesc: string;
  aqi: number | null;
}

export interface ActivitySuggestion {
  eventName: string;
  period: "on" | "off";
  type: "home_care" | "outdoor";
  startTime: string;
  durationMinutes: number;
  remark: string;
}

export interface FeedbackRequest {
  caregiverId: number;
  lat: number;
  lon: number;
  eventName: string;
  period: string;
  type: string;
  startTime: string;
  durationMinutes: number;
  remark: string;
  userFeedback: "accept" | "reject";
}

export const activityService = {
  getWeather: async (lat: number, lon: number): Promise<WeatherData> => {
    const res = await api.get<WeatherData>(`/weather/coordinate?lat=${lat}&lon=${lon}`);
    return res.data;
  },

  generateSuggestions: async (caregiverId: number, lat: number, lon: number): Promise<ActivitySuggestion[]> => {
    const res = await api.post<{ eventRecommendations: ActivitySuggestion[] }>(
      "/eventRecommendation/generate",
      { caregiverId, lat, lon },
    );
    return res.data.eventRecommendations;
  },

  submitFeedback: async (data: FeedbackRequest): Promise<void> => {
    await api.post("/eventRecommendation/feedback", data);
  },
};
