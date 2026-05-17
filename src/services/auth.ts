import api from "@/lib/api";

export interface RegisterResponse {
  caregiverId: number;
  nickname: string;
  uniqueId: string;
  message: string;
}

export interface LoginResponse {
  caregiverId: number;
  nickname: string;
  uniqueId: string;
  message: string;
  language: string;
}

export const authService = {
  register: async (nickname: string, password: string): Promise<RegisterResponse> => {
    const res = await api.post<RegisterResponse>("/auth/register", { nickname, password });
    return res.data;
  },

  login: async (uniqueId: string, password: string): Promise<LoginResponse> => {
    const res = await api.post<LoginResponse>("/auth/login", { uniqueId, password });
    return res.data;
  },
};
