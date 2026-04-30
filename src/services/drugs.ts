import api from "@/lib/api";

export interface DrugBase {
  drugId: number;
  drugName: string;
  dosage: string;
  frequency: string;
  manufacturerName: string;
  intervalMinutes?: number;
}

export const drugsService = {
  searchDrugs: async (keyword: string): Promise<DrugBase[]> => {
    const res = await api.get<DrugBase[]>("/reference/search", {
      params: { keyword },
    });
    return res.data;
  },

  getAllDrugs: async (): Promise<DrugBase[]> => {
    const res = await api.get<DrugBase[]>("/reference/getAll");
    return res.data;
  },

  getDrugById: async (drugId: number): Promise<DrugBase> => {
    const res = await api.get<DrugBase>(`/reference/${drugId}`);
    return res.data;
  },

  searchManufacturers: async (keyword: string): Promise<string[]> => {
    const res = await api.get<string[]>("/reference/manufacturers", {
      params: { keyword },
    });
    return res.data;
  },
};
