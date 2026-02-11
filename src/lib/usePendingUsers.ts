import { useState, useEffect } from 'react';
import { getPendingUsersCount } from './auth';
import { useAuthState } from '../contexts/AuthContext';
import { supabase } from './supabase';

/**
 * Hook that tracks pending user count in real-time.
 *
 * When Supabase is configured:
 *   - Subscribes to Realtime changes on `app_users` table
 *   - Updates instantly when a user registers or is approved
 *
 * Fallback (no Supabase):
 *   - Polls IndexedDB every 30 seconds
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

    const refresh = async () => {
      try {
        const n = await getPendingUsersCount();
        if (!cancelled) setCount(n);
      } catch {
        // ignore errors
      }
    };

    // Initial fetch
    refresh();

    // Supabase Realtime — instant updates
    if (supabase) {
      const channel = supabase
        .channel('pending-users')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'app_users' },
          () => {
            // Any insert/update/delete → refresh count
            refresh();
          }
        )
        .subscribe();

      return () => {
        cancelled = true;
        supabase.removeChannel(channel);
      };
    }

    // Fallback: poll every 30s when no Supabase
    const interval = setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.isAdmin]);

  return count;
}
