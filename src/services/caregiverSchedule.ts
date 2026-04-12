import api from "@/lib/api";

export interface CaregiverScheduleResponse {
  id: number;
  caregiverId: number;
  scheduleTitle: string;
  startDatetime: string;
  endDatetime: string;
  scheduleNote: string;
}

export const caregiverScheduleService = {
  createSchedule: async (
    caregiverId: number,
    scheduleTitle: string,
    startDatetime: string,
    endDatetime: string,
    scheduleNote: string,
  ): Promise<CaregiverScheduleResponse> => {
    const res = await api.post<CaregiverScheduleResponse>("/caregiverSchedule", {
      caregiverId,
      scheduleTitle,
      startDatetime,
      endDatetime,
      scheduleNote,
    });
    return res.data;
  },

  getSchedules: async (caregiverId: number): Promise<CaregiverScheduleResponse[]> => {
    const res = await api.get<CaregiverScheduleResponse[]>(
      `/caregiverSchedule/caregiver/${caregiverId}`,
    );
    return res.data;
  },

  getScheduleById: async (id: number): Promise<CaregiverScheduleResponse> => {
    const res = await api.get<CaregiverScheduleResponse>(`/caregiverSchedule/${id}`);
    return res.data;
  },

  updateSchedule: async (
    id: number,
    scheduleTitle: string,
    startDatetime: string,
    endDatetime: string,
    scheduleNote: string,
  ): Promise<CaregiverScheduleResponse> => {
    const res = await api.put<CaregiverScheduleResponse>(`/caregiverSchedule/${id}`, {
      scheduleTitle,
      startDatetime,
      endDatetime,
      scheduleNote,
    });
    return res.data;
  },

  deleteSchedule: async (id: number): Promise<void> => {
    await api.delete(`/caregiverSchedule/${id}`);
  },
};
