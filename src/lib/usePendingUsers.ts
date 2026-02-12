import { useState, useEffect, useRef } from 'react';
import { getPendingUsersCount } from './auth';
import { useAuthState } from '../contexts/AuthContext';
import { supabase } from './supabase';
import { notifyNewUser } from './notifications';
import { getAppSettings } from './useAppSettings';

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
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (!user?.isAdmin) {
      setCount(0);
      return;
    }

    let cancelled = false;
    let isFirstLoad = true;

    const refresh = async () => {
      try {
        const n = await getPendingUsersCount();
        if (!cancelled) {
          // Send notification if count increased (new user registered)
          if (!isFirstLoad && n > prevCountRef.current && getAppSettings().notificationsEnabled) {
            notifyNewUser('Un nuovo utente');
          }
          prevCountRef.current = n;
          isFirstLoad = false;
          setCount(n);
        }
      } catch {
        // ignore errors
      }
    };

    // Initial fetch
    refresh();

    // Supabase Realtime — instant updates
    if (supabase) {
      const sb = supabase;
      const channel = sb
        .channel('pending-users')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'app_users' },
          (payload) => {
            // New user registered — send notification with their email
            if (getAppSettings().notificationsEnabled && payload.new && !payload.new.is_approved) {
              notifyNewUser(payload.new.email || 'Nuovo utente');
            }
            refresh();
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'app_users' },
          () => { refresh(); }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'app_users' },
          () => { refresh(); }
        )
        .subscribe();

      return () => {
        cancelled = true;
        sb.removeChannel(channel);
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
