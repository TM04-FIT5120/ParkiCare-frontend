import api from "@/lib/api";

// --- Medication types ---
export interface MedicationPlan {
  remindId: number;
  planId: number;           // groups all reminders that belong to the same medication plan
  patientId: number;
  drugId: number;
  dosage: string;
  frequency: string;
  adminTimes: string;
  adminTime: string;        // this reminder's specific administration time (HH:MM:SS)
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

// --- Medication report types ---
export interface DailyMedicationDTO {
  date: string;
  drugId: number;
  drugName: string;
  targetFrequency: number;
  actualCount: number;
  completionRate: number;
  status: "SUCCESS" | "INCOMPLETE";
}

export interface DailySummaryDTO {
  date: string;
  targetCount: number;
  actualCount: number;
  completionRate: number;
  status: "SUCCESS" | "INCOMPLETE";
}

export interface MedicationSummaryDTO {
  drugId: number;
  drugName: string;
  targetCount: number;
  actualCount: number;
  completionRate: number;
  successDays: number;
  incompleteDays: number;
}

export interface MedicationReportDTO {
  patientId: number;
  reportMode: string;
  startDate: string;
  endDate: string;
  lastExportTime: string | null;
  currentExportTime: string;
  totalTargetCount: number;
  totalActualCount: number;
  overallCompletionRate: number;
  medicationSummaries: MedicationSummaryDTO[];
  dailySummaries: DailySummaryDTO[];
  dailyBreakdown: DailyMedicationDTO[];
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

  savePlanNote: async (remindId: number, caregiverId: number, planNote: string): Promise<void> => {
    await api.patch(`/reminder/plan-note/${remindId}?caregiverId=${caregiverId}`, { planNote });
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

  // Medication report
  getMedicationReport: async (
    patientId: number,
    mode: "custom" | "sinceLastExport",
    startDate?: string,
    endDate?: string,
  ): Promise<MedicationReportDTO> => {
    const params: Record<string, string> = { mode };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const res = await api.get<MedicationReportDTO>(`/report/${patientId}`, { params });
    return res.data;
  },

  downloadMedicationReportPdf: async (
    patientId: number,
    mode: "custom" | "sinceLastExport",
    startDate?: string,
    endDate?: string,
  ): Promise<Blob> => {
    const params: Record<string, string> = { mode };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const res = await api.get<Blob>(`/report/${patientId}/pdf`, {
      params,
      responseType: "blob",
    });
    return res.data;
  },
};
