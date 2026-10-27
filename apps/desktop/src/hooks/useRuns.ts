import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { apiRequest } from '../api/client';
import { overviewSchema, runSchema, type OverviewInfo, type Run } from '../api/evaluation';

export function useRuns() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [overview, setOverview] = useState<OverviewInfo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const [history, stats] = await Promise.all([
          apiRequest('/runs', { signal: controller.signal }),
          apiRequest('/overview', { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        setRuns(z.array(runSchema).parse(history));
        setOverview(overviewSchema.parse(stats));
        setError('');
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : 'History could not be loaded.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 3000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [revision]);
  return { runs, overview, error, loading, refresh };
}
