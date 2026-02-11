import { useState, useEffect } from 'react';
import { getPendingUsersCount } from './auth';
import { useAuthState } from '../contexts/AuthContext';

/**
 * Hook that polls for pending user count.
 * Only active when the current user is admin.
 * Polls every 30 seconds to detect new registrations.
 */
export function usePendingUsers() {
  const { user } = useAuthState();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user?.isAdmin) {
      setCount(0);
      return;
    }

    let cancelled = false;

    const check = async () => {
      try {
        const n = await getPendingUsersCount();
        if (!cancelled) setCount(n);
      } catch {
        // ignore errors
      }
    };

    check();
    const interval = setInterval(check, 30_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.isAdmin]);

  return count;
}
