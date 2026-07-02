import { api } from '@/lib/api';
import type { ApiResponse, AdminLiveSessionRecord, UserRole } from '@/types/api';

export interface ClassroomProfile {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  timezone?: string;
  language?: string;
  primaryOrganizationId?: string | null;
}

export interface ClassroomCanvas {
  id: string;
  title: string;
  description: string | null;
  updatedAt: string;
  slideCount: number;
}

export interface ClassroomMaterial {
  id: string;
  title: string;
  subtitle: string;
  kind: string;
  source: string;
  canvasId?: string;
  liveSessionId?: string;
  publicUrl?: string | null;
  createdAt: string;
}

export interface ClassroomScheduleItem {
  id: string;
  title: string;
  status: string;
  canvasId: string;
  startsAt: string | null;
  participantCount: number;
}

export interface ClassroomNotification {
  id: string;
  liveSessionId?: string | null;
  canvasId?: string | null;
  source?: string;
  type: string;
  title: string;
  actorName: string | null;
  actorRole?: UserRole | null;
  createdAt: string;
  payload: Record<string, unknown>;
}

export interface ClassroomContentAsset {
  id: string;
  source: string;
  type: string;
  title: string;
  url?: string | null;
  canvasId: string;
  slideId?: string;
  liveSessionId?: string;
  createdAt: string;
}

export interface ClassroomContentSlide {
  id: string;
  title?: string | null;
  order: number;
  thumbnail?: string | null;
  elements?: unknown;
  updatedAt?: string;
}

export interface ClassroomContentCanvas {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
  };
  organization?: {
    id: string;
    name: string;
    kind: string;
  } | null;
  firstSlide?: ClassroomContentSlide | null;
  counts: {
    slides: number;
    exports: number;
    liveSessions: number;
    imports: number;
    recordings: number;
    activity: number;
  };
  assets: ClassroomContentAsset[];
}

export interface ClassroomContentCanvasDetail extends ClassroomContentCanvas {
  slides: ClassroomContentSlide[];
  exports: Array<{
    id: string;
    format: string;
    status: string;
    fileUrl: string | null;
    fileSize: number | null;
    createdAt: string;
    completedAt: string | null;
  }>;
  liveSessions: Array<{
    id: string;
    title: string | null;
    status: string;
    joinCode: string | null;
    startedAt: string | null;
    endedAt: string | null;
    createdAt: string;
    participantCount: number;
    activityCount: number;
    mediaCount: number;
    recordingCount: number;
  }>;
  activity: ClassroomNotification[];
}

export interface ClassroomSummary {
  profile: ClassroomProfile;
  role: UserRole;
  activeSessionId: string | null;
  sessions: AdminLiveSessionRecord[];
  canvases: ClassroomCanvas[];
  teachers: Array<{
    id: string;
    email: string;
    name: string | null;
    status: string;
    primaryOrganizationId: string | null;
    primaryOrganization?: { id: string; name: string } | null;
    lastLoginAt: string | null;
  }>;
  materials: ClassroomMaterial[];
  schedule: ClassroomScheduleItem[];
  notifications: ClassroomNotification[];
  participants: unknown[];
  raisedHands: unknown[];
  controls: Record<string, unknown>;
  quizzes: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
}

export const classroomApi = {
  me: async () => {
    const res = await api.get<ApiResponse<ClassroomSummary>>('/classroom/me');
    return res.data.data;
  },
  contentCanvases: async () => {
    const res = await api.get<ApiResponse<ClassroomContentCanvas[]>>(
      '/classroom/content/canvases',
    );
    return res.data.data;
  },
  contentCanvas: async (id: string) => {
    const res = await api.get<ApiResponse<ClassroomContentCanvasDetail>>(
      `/classroom/content/canvases/${id}`,
    );
    return res.data.data;
  },
  liveSessionDetail: async (id: string) => {
    const res = await api.get<ApiResponse<AdminLiveSessionRecord>>(
      `/classroom/live-sessions/${id}/details`,
    );
    return res.data.data;
  },
  contentActivity: async (params?: { limit?: number; canvasId?: string }) => {
    const res = await api.get<ApiResponse<ClassroomNotification[]>>(
      '/classroom/content/activity',
      { params },
    );
    return res.data.data;
  },
};
