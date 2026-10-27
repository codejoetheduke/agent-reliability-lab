import { useCallback, useEffect, useState } from 'react';
import { getHealth, type Health } from '../api/client';
export type Connection =
  | { status: 'checking' }
  | { status: 'connected'; health: Health; checkedAt: Date }
  | { status: 'offline' };

export function useHealth() {
  const [connection, setConnection] = useState<Connection>({ status: 'checking' });
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => {
    setConnection({ status: 'checking' });
    setRevision((value) => value + 1);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    async function check() {
      try {
        const health = await getHealth(controller.signal);
        if (!controller.signal.aborted)
          setConnection({ status: 'connected', health, checkedAt: new Date() });
      } catch {
        if (!controller.signal.aborted) setConnection({ status: 'offline' });
      }
    }
    void check();
    const timer = window.setInterval(() => void check(), 15000);
    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
  }, [revision]);
  return { connection, refresh };
}
