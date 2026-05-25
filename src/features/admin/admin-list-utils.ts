export interface FilterChip {
  key: string;
  label: string;
  value: string;
}

export function numberParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function cleanFilterValue(value: string | null) {
  return value && value !== 'ALL' ? value : undefined;
}

export function setSearchParam(
  params: URLSearchParams,
  setSearchParams: (
    nextInit: URLSearchParams,
    navigateOptions?: { replace?: boolean },
  ) => void,
  key: string,
  value: string | number | null | undefined,
) {
  const next = new URLSearchParams(params);
  if (value === undefined || value === null || value === '' || value === 'ALL') {
    next.delete(key);
  } else {
    next.set(key, String(value));
  }
  if (key !== 'page') next.delete('page');
  setSearchParams(next, { replace: true });
}

export function clearSearchParams(
  params: URLSearchParams,
  setSearchParams: (
    nextInit: URLSearchParams,
    navigateOptions?: { replace?: boolean },
  ) => void,
  keep: string[] = [],
) {
  const next = new URLSearchParams();
  keep.forEach((key) => {
    const value = params.get(key);
    if (value) next.set(key, value);
  });
  setSearchParams(next, { replace: true });
}
