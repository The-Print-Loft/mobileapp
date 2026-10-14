import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '@/api/client';

type AsyncState<T> = {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  /** True during a reload that runs while data is already shown (pull-to-refresh). */
  refreshing: boolean;
  /** Re-run the fetch (e.g. from a Retry button or pull-to-refresh). */
  reload: () => void;
};

/**
 * Run an async loader on mount (and whenever `deps` change), tracking
 * loading/error/data and aborting the in-flight request on unmount or reload.
 * The loader receives an AbortSignal — pass it through to the API calls.
 */
export function useAsync<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: React.DependencyList,
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    // Full-screen loader only when there's nothing shown yet; a reload while
    // data is already present is a background refresh (drives pull-to-refresh).
    if (data !== null) setRefreshing(true);
    else setLoading(true);
    setError(null);

    loader(controller.signal)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (!active || controller.signal.aborted) return;
        setError(
          err instanceof ApiError
            ? err
            : new ApiError('UNKNOWN_ERROR', 'Something went wrong.', 0),
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, error, loading, refreshing, reload };
}
