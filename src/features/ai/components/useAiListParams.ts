import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { FilterChip } from '@/features/admin/admin-list-utils';

/**
 * URL-synced list filters for one AI tab. Keys are prefixed (e.g. `led_type`)
 * so several tabs can share the `/ai` URL without clobbering each other.
 */
export function useAiListParams<K extends string>(prefix: string, keys: readonly K[]) {
  const [params, setParams] = useSearchParams();
  const values = useMemo(() => {
    const result = {} as Record<K, string>;
    for (const key of keys) result[key] = params.get(`${prefix}_${key}`) ?? '';
    return result;
  }, [params, prefix, keys]);
  const page = Math.max(1, Number(params.get(`${prefix}_page`)) || 1);

  // Several keys in one navigation: react-router does not queue functional updates.
  const setMany = useCallback(
    (patch: Partial<Record<K | 'page', string | number | null | undefined>>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch) as Array<[string, string | number | null | undefined]>) {
            const name = `${prefix}_${key}`;
            if (value === undefined || value === null || value === '' || value === 'ALL') next.delete(name);
            else next.set(name, String(value));
          }
          if (!('page' in patch)) next.delete(`${prefix}_page`);
          return next;
        },
        { replace: true },
      );
    },
    [prefix, setParams],
  );

  const set = useCallback(
    (key: K | 'page', value: string | number | null | undefined) =>
      setMany({ [key]: value } as Partial<Record<K | 'page', string | number | null | undefined>>),
    [setMany],
  );

  const clear = useCallback(() => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        [...next.keys()].filter((name) => name.startsWith(`${prefix}_`)).forEach((name) => next.delete(name));
        return next;
      },
      { replace: true },
    );
  }, [prefix, setParams]);

  const chips = useCallback(
    (labels: Partial<Record<K, string>>): FilterChip[] =>
      keys
        .filter((key) => values[key] && labels[key])
        .map((key) => ({ key, label: labels[key] as string, value: values[key] })),
    [keys, values],
  );

  return { values, page, set, setMany, clear, chips };
}
