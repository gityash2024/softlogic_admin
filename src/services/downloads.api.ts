import { api } from "@/lib/api";
import type { ApiResponse } from "@/types/api";

export type AppReleaseEnvironment = "staging" | "production";
export type AppReleaseBrand = "softlogic" | "ai_smart_board";
export type AppReleasePlatform = "android" | "windows";

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
  isForced: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CurrentAppDownload {
  environment: AppReleaseEnvironment;
  brand: AppReleaseBrand;
  platform: AppReleasePlatform;
  versionName: string;
  buildNumber: number;
  releaseDate: string;
  notes: string | null;
  downloadUrl: string;
  isForced: boolean;
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
  isForced: boolean;
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
  isForced?: boolean;
}

export const currentAdminEnvironment = (): AppReleaseEnvironment => {
  const configured = String(
    import.meta.env.VITE_API_BASE_URL ?? "",
  ).toLowerCase();
  return configured.includes("api.softeractive.com") ? "production" : "staging";
};

export const downloadsApi = {
  current: async (params: {
    environment: AppReleaseEnvironment;
    brand: AppReleaseBrand;
  }) => {
    const response = await api.get<ApiResponse<CurrentAppDownload[]>>(
      "/app-updates/current",
      { params },
    );
    return response.data.data;
  },

  list: async () => {
    const response = await api.get<ApiResponse<AppRelease[]>>(
      "/admin/app-releases",
    );
    return response.data.data;
  },

  listFiltered: async (params: {
    environment?: AppReleaseEnvironment;
    brand?: AppReleaseBrand;
    platform?: AppReleasePlatform;
    currentOnly?: boolean;
  }) => {
    const response = await api.get<ApiResponse<AppRelease[]>>(
      "/admin/app-releases",
      { params },
    );
    return response.data.data;
  },

  publishFullRelease: async (payload: PublishFullReleasePayload) => {
    const response = await api.post<ApiResponse<AppRelease[]>>(
      "/admin/app-releases/full-release",
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
