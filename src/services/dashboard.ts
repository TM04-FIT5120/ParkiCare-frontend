import api from "@/lib/api";

export interface TaskResponse {
  id: number;
  title: string;
  type: string;
  time: string;
  status: string;
}

export interface DashboardResponse {
  todayTasks: TaskResponse[];
  pendingReminders: TaskResponse[];
  overdueTasks: TaskResponse[];
  upcomingTasks: TaskResponse[];
}

export const dashboardService = {
  getDashboard: async (caregiverId: number): Promise<DashboardResponse> => {
    const res = await api.get<DashboardResponse>(`/dashboard/${caregiverId}`);
    return res.data;
  },

  getTodayTasks: async (caregiverId: number): Promise<TaskResponse[]> => {
    const res = await api.get<TaskResponse[]>(`/dashboard/${caregiverId}/today`);
    return res.data;
  },

  getPendingTasks: async (caregiverId: number): Promise<TaskResponse[]> => {
    const res = await api.get<TaskResponse[]>(`/dashboard/${caregiverId}/pending`);
    return res.data;
  },

  getOverdueTasks: async (caregiverId: number): Promise<TaskResponse[]> => {
    const res = await api.get<TaskResponse[]>(`/dashboard/${caregiverId}/overdue`);
    return res.data;
  },

  getUpcomingTasks: async (caregiverId: number): Promise<TaskResponse[]> => {
    const res = await api.get<TaskResponse[]>(`/dashboard/${caregiverId}/upcoming`);
    return res.data;
  },
};
