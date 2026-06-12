"use client";

import { useEffect, useState } from "react";

export function useApi<T>(
  fetcher: () => Promise<T>,
  fallback: T
): { data: T; loading: boolean; fromApi: boolean; error: string | null } {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const [fromApi, setFromApi] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await fetcher();
        if (!cancelled) {
          setData(result);
          setFromApi(true);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setData(fallback);
          setFromApi(false);
          setError(err instanceof Error ? err.message : "API unavailable");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetcher, fallback]);

  return { data, loading, fromApi, error };
}
