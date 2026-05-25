import { api } from '@/lib/api';
import type { ApiResponse, ApiMeta, PaginatedResult } from '@/types/api';

export type AdminListQuery = Record<string, string | number | boolean | null | undefined>;
export type AdminExportFormat = 'xlsx' | 'csv';

export function cleanQuery(query: AdminListQuery = {}) {
  return Object.fromEntries(
    Object.entries(query).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  );
}

export async function getAdminList<T>(
  path: string,
  query: AdminListQuery = {},
): Promise<PaginatedResult<T>> {
  const res = await api.get<ApiResponse<T[]>>(path, { params: cleanQuery(query) });
  return {
    data: res.data.data,
    meta: res.data.meta ?? {},
  };
}

export async function getAdminItem<T>(path: string): Promise<T> {
  const res = await api.get<ApiResponse<T>>(path);
  return res.data.data;
}

export async function downloadAdminExport(
  path: string,
  query: AdminListQuery,
  format: AdminExportFormat,
) {
  const res = await api.get<Blob>(path, {
    params: cleanQuery({ ...query, format }),
    responseType: 'blob',
  });
  const disposition = res.headers['content-disposition'];
  const match = /filename="([^"]+)"/.exec(disposition ?? '');
  const filename = match?.[1] ?? `softlogic-export.${format}`;
  const url = URL.createObjectURL(res.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function emptyMeta(): ApiMeta {
  return { page: 1, perPage: 20, total: 0, totalPages: 1 };
}
