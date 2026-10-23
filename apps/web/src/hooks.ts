import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

/** Fetches `path` (skipped when null) and exposes a reload function. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    if (!path) return;
    api<T>(path).then(setData, (e: Error) => setError(e.message));
  }, [path]);
  useEffect(load, [load]);
  return { data, error, reload: load };
}
