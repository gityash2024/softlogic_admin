import { downloadAdminExport, getAdminList, type AdminExportFormat, type AdminListQuery } from './admin-api';
import type { AuditLogEntry } from '@/types/api';

export const activityApi = {
  list: (query?: AdminListQuery) =>
    getAdminList<AuditLogEntry>('/admin/activity', query),
  export: (query: AdminListQuery, format: AdminExportFormat) =>
    downloadAdminExport('/admin/activity/export', query, format),
};
