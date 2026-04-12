import api from "@/lib/api";

export interface PatientResponse {
  id: number;
  caregiverId: number;
  patientNickname: string;
  ageRange: string;
}

export const patientService = {
  createPatient: async (
    caregiverId: number,
    patientNickname: string,
    ageRange: string,
  ): Promise<PatientResponse> => {
    const res = await api.post<PatientResponse>("/patient", {
      caregiverId,
      patientNickname,
      ageRange,
    });
    return res.data;
  },

  getPatient: async (patientId: number): Promise<PatientResponse> => {
    const res = await api.get<PatientResponse>(`/patient/${patientId}`);
    return res.data;
  },

  getPatientsByCaregiver: async (caregiverId: number): Promise<PatientResponse[]> => {
    const res = await api.get<PatientResponse[]>(`/patient/caregiver/${caregiverId}`);
    return res.data;
  },

  updatePatient: async (
    patientId: number,
    patientNickname: string,
    ageRange: string,
  ): Promise<PatientResponse> => {
    const res = await api.put<PatientResponse>(`/patient/${patientId}`, {
      patientNickname,
      ageRange,
    });
    return res.data;
  },

  deletePatient: async (patientId: number): Promise<void> => {
    await api.delete(`/patient/${patientId}`);
  },
};
