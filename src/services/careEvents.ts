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
  mealTiming: string | null;
  quantity: number | null;
  intakeMethod: string | null;
  endDate: string | null;
  recurrence: string | null;
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
  recurrence?: string;
  isPinned?: number;
}

// --- Outdoor types ---
export interface OutdoorScheduleResponse {
  id: number;
  patientId: number;
  outdoorTitle: string;
  startDatetime: string;
  endDatetime: string;
  prepareNote: string;
  recurrence?: string;
  isPinned?: number;
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
    mealTiming: string | null,
    quantity: number | null,
    intakeMethod: string | null,
    endDate: string | null,
    recurrence: string | null,
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
      mealTiming,
      quantity,
      intakeMethod,
      endDate,
      recurrence,
    });
    return res.data;
  },

  getMedications: async (patientId: number): Promise<MedicationPlan[]> => {
    const res = await api.get<MedicationPlan[]>(`/reminder/patient/${patientId}`);
    return res.data;
  },

  confirmMedication: async (remindId: number, caregiverId: number): Promise<void> => {
    await api.patch(`/reminder/confirm/${remindId}?caregiverId=${caregiverId}`);
  },

  deleteMedication: async (remindId: number, caregiverId: number): Promise<void> => {
    await api.delete(`/reminder/${remindId}?caregiverId=${caregiverId}`);
  },

  snoozeMedication: async (remindId: number, caregiverId: number): Promise<void> => {
    await api.patch(`/reminder/later/${remindId}?caregiverId=${caregiverId}`);
  },

  getPendingReminders: async (patientId: number, caregiverId: number): Promise<MedicationPlan[]> => {
    const res = await api.get<MedicationPlan[]>(`/reminder/pending/${patientId}?caregiverId=${caregiverId}`);
    return res.data;
  },

  // Home care
  createHomeCare: async (
    patientId: number,
    caregiverId: number,
    homeCareTitle: string,
    startDatetime: string,
    endDatetime: string,
    careNote: string,
    isUrgent: boolean = false,
    recurrence: string = "none",
  ): Promise<HomeCareScheduleResponse> => {
    const res = await api.post<HomeCareScheduleResponse>("/homeCare", {
      patientId,
      caregiverId,
      homeCareTitle,
      startDatetime,
      endDatetime,
      careNote,
      isUrgent: isUrgent ? 1 : 0,
      recurrence,
    });
    return res.data;
  },

  getHomeCare: async (patientId: number): Promise<HomeCareScheduleResponse[]> => {
    const res = await api.get<HomeCareScheduleResponse[]>(`/homeCare/patient/${patientId}`);
    return res.data;
  },

  updateHomeCare: async (
    id: number,
    patientId: number,
    caregiverId: number,
    homeCareTitle: string,
    startDatetime: string,
    endDatetime: string,
    careNote: string,
    isUrgent: boolean = false,
  ): Promise<HomeCareScheduleResponse> => {
    const res = await api.put<HomeCareScheduleResponse>(`/homeCare/${id}`, {
      patientId,
      caregiverId,
      homeCareTitle,
      startDatetime,
      endDatetime,
      careNote,
      isUrgent: isUrgent ? 1 : 0,
    });
    return res.data;
  },

  deleteHomeCare: async (id: number, caregiverId: number): Promise<void> => {
    await api.delete(`/homeCare/${id}?caregiverId=${caregiverId}`);
  },

  // Outdoor events
  createOutdoor: async (
    patientId: number,
    caregiverId: number,
    outdoorTitle: string,
    startDatetime: string,
    endDatetime: string,
    prepareNote: string,
    recurrence: string = "none",
  ): Promise<OutdoorScheduleResponse> => {
    const res = await api.post<OutdoorScheduleResponse>("/outdoor", {
      patientId,
      caregiverId,
      outdoorTitle,
      startDatetime,
      endDatetime,
      prepareNote,
      recurrence,
    });
    return res.data;
  },

  getOutdoor: async (patientId: number): Promise<OutdoorScheduleResponse[]> => {
    const res = await api.get<OutdoorScheduleResponse[]>(`/outdoor/patient/${patientId}`);
    return res.data;
  },

  updateOutdoor: async (
    id: number,
    patientId: number,
    caregiverId: number,
    outdoorTitle: string,
    startDatetime: string,
    endDatetime: string,
    prepareNote: string,
  ): Promise<OutdoorScheduleResponse> => {
    const res = await api.put<OutdoorScheduleResponse>(`/outdoor/${id}`, {
      patientId,
      caregiverId,
      outdoorTitle,
      startDatetime,
      endDatetime,
      prepareNote,
    });
    return res.data;
  },

  deleteOutdoor: async (id: number, caregiverId: number): Promise<void> => {
    await api.delete(`/outdoor/${id}?caregiverId=${caregiverId}`);
  },

  toggleHomeCarePin: async (id: number, caregiverId: number): Promise<HomeCareScheduleResponse> => {
    const res = await api.patch<HomeCareScheduleResponse>(`/homeCare/${id}/pin?caregiverId=${caregiverId}`);
    return res.data;
  },

  toggleOutdoorPin: async (id: number, caregiverId: number): Promise<OutdoorScheduleResponse> => {
    const res = await api.patch<OutdoorScheduleResponse>(`/outdoor/${id}/pin?caregiverId=${caregiverId}`);
    return res.data;
  },
};
