import { useState, useEffect, useCallback } from 'react';

export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  pollMs?: number
): { data: T | null; loading: boolean; error: string | null; refetch: () => void } {
  const [data, setData]       = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const run = useCallback(async () => {
    try {
      const result = await fetcher();
      setData(result);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void run();
    if (!pollMs) return;
    const id = setInterval(() => void run(), pollMs);
    return () => clearInterval(id);
  }, [run, pollMs]);

  return { data, loading, error, refetch: run };
}
