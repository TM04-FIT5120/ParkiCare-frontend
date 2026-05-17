import api from "@/lib/api";

export const caregiverService = {
  updateLanguage: async (caregiverId: number, language: string): Promise<void> => {
    await api.patch(`/auth/caregiver/${caregiverId}/language`, { language });
  },
};
