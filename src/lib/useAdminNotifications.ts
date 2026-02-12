import { useEffect, useRef } from 'react';
import { useAuthState } from '../contexts/AuthContext';
import { getUnreadFeedbackCount } from './feedback';
import { sendNotification } from './notifications';
import { getAppSettings } from './useAppSettings';

const POLL_INTERVAL = 30_000; // 30 seconds
const LAST_COUNT_KEY = 'vector_last_feedback_count';

/**
 * Hook that polls for new feedback and sends a notification to the admin.
 * Only active when the logged-in user is admin and notifications are enabled.
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
          });
        }

        localStorage.setItem(LAST_COUNT_KEY, String(currentCount));
      } catch (e) {
        console.error('Notification poll error:', e);
      }
    }

    // Initial check
    checkForNewFeedback();

    // Start polling
    intervalRef.current = setInterval(checkForNewFeedback, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user?.isAdmin]);
}
