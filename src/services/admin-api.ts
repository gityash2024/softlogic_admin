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

function filenameFromDisposition(disposition?: string) {
  const match =
    /filename\*=UTF-8''([^;]+)/i.exec(disposition ?? '') ??
    /filename="([^"]+)"/i.exec(disposition ?? '') ??
    /filename=([^;]+)/i.exec(disposition ?? '');
  const rawName = match?.[1]?.trim();
  if (!rawName) return null;
  const cleanedName = rawName.replace(/^"|"$/g, '');
  try {
    return decodeURIComponent(cleanedName);
  } catch {
    return cleanedName;
  }
}

async function fetchAdminFile(path: string, download: boolean) {
  const res = await api.get<Blob>(path, {
    params: download ? { download: true } : undefined,
    responseType: 'blob',
  });
  return {
    blob: res.data,
    filename:
      filenameFromDisposition(res.headers['content-disposition']) ?? 'softlogic-file',
  };
}

export async function openAdminFile(path: string) {
  const target = window.open('about:blank', '_blank');
  if (target) {
    target.opener = null;
  }
  try {
    const { blob } = await fetchAdminFile(path, false);
    const url = URL.createObjectURL(blob);
    if (target) {
      target.location.href = url;
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    target?.close();
    throw error;
  }
}

export async function downloadAdminFile(path: string) {
  const { blob, filename } = await fetchAdminFile(path, true);
  const url = URL.createObjectURL(blob);
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
