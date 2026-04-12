import api from "@/lib/api";

// --- Medication types ---
export interface MedicationPlan {
  remindId: number;
  patientId: number;
  drugId: number;
  dosage: string;
  frequency: string;
  adminTimes: string;
  remindTime: string;
  startDate: string;
  planNote: string;
}

// --- Home care types ---
export interface HomeCareScheduleResponse {
  id: number;
  patientId: number;
  homeCareTitle: string;
  startDatetime: string;
  endDatetime: string;
  careNote: string;
  isUrgent: boolean;
}

// --- Outdoor types ---
export interface OutdoorScheduleResponse {
  id: number;
  patientId: number;
  outdoorTitle: string;
  startDatetime: string;
  endDatetime: string;
  prepareNote: string;
}

export const careEventsService = {
  // Medications
  createMedication: async (
    patientId: number,
    drugId: number,
    dosage: string,
    frequency: string,
    adminTimes: string,
    remindTime: string,
    startDate: string,
    planNote: string,
  ): Promise<MedicationPlan> => {
    const res = await api.post<MedicationPlan>("/reminder/plan", {
      patientId,
      drugId,
      dosage,
      frequency,
      adminTimes,
      remindTime,
      startDate,
      planNote,
    });
    return res.data;
  },

  getMedications: async (patientId: number): Promise<MedicationPlan[]> => {
    const res = await api.get<MedicationPlan[]>(`/reminder/patient/${patientId}`);
    return res.data;
  },

  confirmMedication: async (remindId: number): Promise<void> => {
    await api.patch(`/reminder/confirm/${remindId}`);
  },

  snoozeMedication: async (remindId: number): Promise<void> => {
    await api.patch(`/reminder/later/${remindId}`);
  },

  getPendingReminders: async (patientId: number): Promise<MedicationPlan[]> => {
    const res = await api.get<MedicationPlan[]>(`/reminder/pending/${patientId}`);
    return res.data;
  },

  // Home care
  createHomeCare: async (
    patientId: number,
    homeCareTitle: string,
    startDatetime: string,
    endDatetime: string,
    careNote: string,
    isUrgent: boolean = false,
  ): Promise<HomeCareScheduleResponse> => {
    const res = await api.post<HomeCareScheduleResponse>("/homeCare", {
      patientId,
      homeCareTitle,
      startDatetime,
      endDatetime,
      careNote,
      isUrgent,
    });
    return res.data;
  },

  getHomeCare: async (patientId: number): Promise<HomeCareScheduleResponse[]> => {
    const res = await api.get<HomeCareScheduleResponse[]>(`/homeCare/patient/${patientId}`);
    return res.data;
  },

  updateHomeCare: async (
    id: number,
    homeCareTitle: string,
    startDatetime: string,
    endDatetime: string,
    careNote: string,
    isUrgent: boolean = false,
  ): Promise<HomeCareScheduleResponse> => {
    const res = await api.put<HomeCareScheduleResponse>(`/homeCare/${id}`, {
      homeCareTitle,
      startDatetime,
      endDatetime,
      careNote,
      isUrgent,
    });
    return res.data;
  },

  deleteHomeCare: async (id: number): Promise<void> => {
    await api.delete(`/homeCare/${id}`);
  },

  // Outdoor events
  createOutdoor: async (
    patientId: number,
    outdoorTitle: string,
    startDatetime: string,
    endDatetime: string,
    prepareNote: string,
  ): Promise<OutdoorScheduleResponse> => {
    const res = await api.post<OutdoorScheduleResponse>("/outdoor", {
      patientId,
      outdoorTitle,
      startDatetime,
      endDatetime,
      prepareNote,
    });
    return res.data;
  },

  getOutdoor: async (patientId: number): Promise<OutdoorScheduleResponse[]> => {
    const res = await api.get<OutdoorScheduleResponse[]>(`/outdoor/patient/${patientId}`);
    return res.data;
  },

  updateOutdoor: async (
    id: number,
    outdoorTitle: string,
    startDatetime: string,
    endDatetime: string,
    prepareNote: string,
  ): Promise<OutdoorScheduleResponse> => {
    const res = await api.put<OutdoorScheduleResponse>(`/outdoor/${id}`, {
      outdoorTitle,
      startDatetime,
      endDatetime,
      prepareNote,
    });
    return res.data;
  },

  deleteOutdoor: async (id: number): Promise<void> => {
    await api.delete(`/outdoor/${id}`);
  },
};
