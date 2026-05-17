import api from "@/lib/api";

export type CaregiverAlert = {
  id: number;
  alertType: string;
  payloadJson: string;
  createdAt: string | null;
};

export type ScheduleOverlapPayload = {
  conflictKind: "manual_patient" | "caregiver";
  rescheduledEvent: {
    id: number;
    source: string;
    title: string;
    start: string;
    end: string;
  };
  conflictingEvent: {
    id: number;
    source: string;
    title: string;
    start: string;
    end: string;
  };
};

export const caregiverAlertsService = {
  getUnread: async (caregiverId: number): Promise<CaregiverAlert[]> => {
    const res = await api.get<CaregiverAlert[]>(`/caregiver/${caregiverId}/alerts/unread`);
    return res.data;
  },

  dismiss: async (caregiverId: number, alertId: number): Promise<void> => {
    await api.post(`/caregiver/${caregiverId}/alerts/${alertId}/dismiss`);
  },

  dismissAll: async (caregiverId: number): Promise<void> => {
    await api.post(`/caregiver/${caregiverId}/alerts/dismiss-all`);
  },
};
