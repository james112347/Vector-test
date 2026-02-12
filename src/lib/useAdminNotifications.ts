import { useEffect, useRef } from 'react';
import { useAuthState } from '../contexts/AuthContext';
import { getUnreadFeedbackCount } from './feedback';
import { sendNotification, updateAppBadge } from './notifications';
import { getAppSettings } from './useAppSettings';
import { supabase } from './supabase';

const POLL_INTERVAL = 30_000; // 30 seconds (fallback)
const LAST_COUNT_KEY = 'vector_last_feedback_count';

/**
 * Hook that watches for new feedback and notifies the admin.
 * Uses Supabase Realtime for instant notifications when available,
 * falls back to polling every 30s.
 */
export function useAdminNotifications() {
  const { user } = useAuthState();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user?.isAdmin) return;

    async function checkForNewFeedback() {
      if (!getAppSettings().notificationsEnabled) return;

      try {
        const currentCount = await getUnreadFeedbackCount();
        const lastCount = parseInt(localStorage.getItem(LAST_COUNT_KEY) || '0', 10);

        if (currentCount > lastCount && lastCount >= 0) {
          const newCount = currentCount - lastCount;
          sendNotification('Nuovo feedback ricevuto', {
            body: `Hai ${newCount} ${newCount === 1 ? 'nuovo feedback' : 'nuovi feedback'} da leggere.`,
            tag: 'new-feedback',
            navigateTo: '/Vector-test/admin/feedback',
          } as any);
        }

        // Update app badge counter
        updateAppBadge(currentCount);
        localStorage.setItem(LAST_COUNT_KEY, String(currentCount));
      } catch (e) {
        console.error('Notification poll error:', e);
      }
    }

    // Initial check
    checkForNewFeedback();

    // Supabase Realtime — instant notifications on new feedback
    if (supabase) {
      const sb = supabase;
      const channel = sb
        .channel('admin-feedback-notifications')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'feedbacks' },
          (payload) => {
            if (!getAppSettings().notificationsEnabled) return;
            const email = payload.new?.user_email || 'Un utente';
            const catLabels: Record<string, string> = {
              bug: 'Bug', feature: 'Nuova funzione', improvement: 'Miglioramento',
              support: 'Supporto', other: 'Feedback',
            };
            const cat = catLabels[payload.new?.category] || 'Feedback';
            sendNotification('Nuovo feedback ricevuto', {
              body: `${email} ha inviato: ${cat}`,
              tag: 'new-feedback',
              navigateTo: '/Vector-test/admin/feedback',
            } as any);
            // Update stored count and badge
            getUnreadFeedbackCount().then(c => {
              localStorage.setItem(LAST_COUNT_KEY, String(c));
              updateAppBadge(c);
            });
          }
        )
        .subscribe();

      return () => {
        sb.removeChannel(channel);
      };
    }

    // Fallback: poll every 30s when no Supabase
    intervalRef.current = setInterval(checkForNewFeedback, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user?.isAdmin]);
}
