import {
  downloadAdminFile,
  downloadAdminExport,
  getAdminItem,
  getAdminList,
  openAdminFile,
  type AdminExportFormat,
  type AdminListQuery,
} from './admin-api';
import type {
  AdminCanvasRecord,
  AdminContentImportRecord,
  AdminExportRecord,
  AdminLiveSessionRecord,
} from '@/types/api';

export const contentApi = {
  canvases: {
    list: (query?: AdminListQuery) =>
      getAdminList<AdminCanvasRecord>('/admin/content/canvases', query),
    get: (id: string) =>
      getAdminItem<AdminCanvasRecord>(`/admin/content/canvases/${id}`),
    export: (query: AdminListQuery, format: AdminExportFormat) =>
      downloadAdminExport('/admin/content/canvases/export', query, format),
  },
  liveSessions: {
    list: (query?: AdminListQuery) =>
      getAdminList<AdminLiveSessionRecord>('/admin/content/live-sessions', query),
    get: (id: string) =>
      getAdminItem<AdminLiveSessionRecord>(`/admin/content/live-sessions/${id}`),
    export: (query: AdminListQuery, format: AdminExportFormat) =>
      downloadAdminExport('/admin/content/live-sessions/export', query, format),
  },
  exports: {
    list: (query?: AdminListQuery) =>
      getAdminList<AdminExportRecord>('/admin/content/exports', query),
    get: (id: string) =>
      getAdminItem<AdminExportRecord>(`/admin/content/exports/${id}`),
    export: (query: AdminListQuery, format: AdminExportFormat) =>
      downloadAdminExport('/admin/content/exports/export', query, format),
    openFile: (id: string) =>
      openAdminFile(`/admin/content/exports/${id}/file`),
    downloadFile: (id: string) =>
      downloadAdminFile(`/admin/content/exports/${id}/file`),
  },
  imports: {
    list: (query?: AdminListQuery) =>
      getAdminList<AdminContentImportRecord>('/admin/content/imports', query),
    get: (id: string) =>
      getAdminItem<AdminContentImportRecord>(`/admin/content/imports/${id}`),
    export: (query: AdminListQuery, format: AdminExportFormat) =>
      downloadAdminExport('/admin/content/imports/export', query, format),
    openFile: (id: string) =>
      openAdminFile(`/admin/content/imports/${id}/file`),
    downloadFile: (id: string) =>
      downloadAdminFile(`/admin/content/imports/${id}/file`),
  },
};
