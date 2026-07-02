import { api } from '@/lib/api';
import type { ApiResponse, UserRole } from '@/types/api';

export type MaintenanceState = 'none' | 'upcoming' | 'active';
export type MaintenanceWindowStatus =
  | 'upcoming'
  | 'active'
  | 'completed'
  | 'cancelled';

export interface PublicMaintenanceWindow {
  id: string;
  title: string;
  message: string;
  timezone: string;
  startsAt: string;
  endsAt: string;
  secondsUntilStart: number;
  secondsUntilEnd: number;
}

export interface MaintenanceStatus {
  state: MaintenanceState;
  serverTime: string;
  window: PublicMaintenanceWindow | null;
}

interface MaintenanceActorSummary {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

export interface MaintenanceWindowRecord extends PublicMaintenanceWindow {
  internalNote: string | null;
  status: MaintenanceWindowStatus;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: MaintenanceActorSummary | null;
  updatedBy: MaintenanceActorSummary | null;
  cancelledBy: MaintenanceActorSummary | null;
}

export interface MaintenanceWindowPayload {
  title: string;
  message: string;
  startsAt: string;
  endsAt: string;
  timezone?: string;
  internalNote?: string | null;
}

export const maintenanceApi = {
  status: async () => {
    const response = await api.get<ApiResponse<MaintenanceStatus>>(
      '/maintenance/status',
    );
    return response.data.data;
  },
  listWindows: async () => {
    const response = await api.get<ApiResponse<MaintenanceWindowRecord[]>>(
      '/admin/maintenance/windows',
    );
    return response.data.data;
  },
  createWindow: async (payload: MaintenanceWindowPayload) => {
    const response = await api.post<ApiResponse<MaintenanceWindowRecord>>(
      '/admin/maintenance/windows',
      payload,
    );
    return response.data.data;
  },
  updateWindow: async (id: string, payload: Partial<MaintenanceWindowPayload>) => {
    const response = await api.patch<ApiResponse<MaintenanceWindowRecord>>(
      `/admin/maintenance/windows/${id}`,
      payload,
    );
    return response.data.data;
  },
  cancelWindow: async (id: string) => {
    const response = await api.post<ApiResponse<MaintenanceWindowRecord>>(
      `/admin/maintenance/windows/${id}/cancel`,
      {},
    );
    return response.data.data;
  },
};
