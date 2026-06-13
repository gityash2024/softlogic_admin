import { api } from '@/lib/api';
import type { ApiResponse } from '@/types/api';

export type AppReleaseEnvironment = 'staging' | 'production';
export type AppReleaseBrand = 'softlogic' | 'ai_smart_board';
export type AppReleasePlatform = 'android' | 'windows';

export interface AppRelease {
  id: string;
  environment: AppReleaseEnvironment;
  brand: AppReleaseBrand;
  platform: AppReleasePlatform;
  versionName: string;
  buildNumber: number;
  releaseDate: string;
  notes: string | null;
  downloadUrl: string;
  isCurrent: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublishReleaseArtifact {
  environment: AppReleaseEnvironment;
  brand: AppReleaseBrand;
  platform: AppReleasePlatform;
  downloadUrl: string;
}

export interface PublishFullReleasePayload {
  versionName: string;
  buildNumber: number;
  releaseDate: string;
  notes?: string | null;
  artifacts: PublishReleaseArtifact[];
}

export interface UpdateReleasePayload {
  versionName?: string;
  buildNumber?: number;
  releaseDate?: string;
  notes?: string | null;
  downloadUrl?: string;
  isCurrent?: boolean;
  isActive?: boolean;
}

export const downloadsApi = {
  list: async () => {
    const response = await api.get<ApiResponse<AppRelease[]>>('/admin/app-releases');
    return response.data.data;
  },

  publishFullRelease: async (payload: PublishFullReleasePayload) => {
    const response = await api.post<ApiResponse<AppRelease[]>>(
      '/admin/app-releases/full-release',
      payload,
    );
    return response.data.data;
  },

  updateRelease: async (id: string, payload: UpdateReleasePayload) => {
    const response = await api.patch<ApiResponse<AppRelease>>(
      `/admin/app-releases/${id}`,
      payload,
    );
    return response.data.data;
  },
};
