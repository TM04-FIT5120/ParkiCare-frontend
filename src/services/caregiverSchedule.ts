import api from "@/lib/api";

export interface CaregiverScheduleResponse {
  id: number;
  caregiverId: number;
  scheduleTitle: string;
  startDatetime: string;
  endDatetime: string;
  scheduleNote: string;
  recurrence: string | null;
  isCompleted?: number;
  isConflict?: number;
}

export const caregiverScheduleService = {
  createSchedule: async (
    caregiverId: number,
    scheduleTitle: string,
    startDatetime: string,
    endDatetime: string,
    scheduleNote: string,
    recurrence?: string | null,
  ): Promise<CaregiverScheduleResponse> => {
    const res = await api.post<CaregiverScheduleResponse>("/caregiverSchedule", {
      caregiverId,
      scheduleTitle,
      startDatetime,
      endDatetime,
      scheduleNote,
      recurrence: recurrence || null,
    });
    return res.data;
  },

  getSchedules: async (caregiverId: number): Promise<CaregiverScheduleResponse[]> => {
    const res = await api.get<CaregiverScheduleResponse[]>(
      `/caregiverSchedule/caregiver/${caregiverId}`,
    );
    return res.data;
  },

  getScheduleById: async (id: number, caregiverId: number): Promise<CaregiverScheduleResponse> => {
    const res = await api.get<CaregiverScheduleResponse>(`/caregiverSchedule/${id}?caregiverId=${caregiverId}`);
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

  deleteSchedule: async (id: number, caregiverId: number): Promise<void> => {
    await api.delete(`/caregiverSchedule/${id}?caregiverId=${caregiverId}`);
  },
};
