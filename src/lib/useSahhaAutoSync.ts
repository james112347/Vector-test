import { useEffect, useRef } from 'react';
import { getSahhaProfile, syncAll } from './sahha-data';

const SYNC_INTERVAL = 15 * 60 * 1000; // 15 minutes
const LAST_SYNC_KEY = 'vector_sahha_last_sync';
const MIN_SYNC_GAP = 5 * 60 * 1000;   // Don't sync more than once every 5 minutes

function getLastSync(): number {
  return parseInt(localStorage.getItem(LAST_SYNC_KEY) || '0', 10);
}

function setLastSync(): void {
  localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
}

/**
 * Auto-syncs Sahha wearable data:
 * - On mount (if connected and last sync > 5 min ago)
 * - Every 15 minutes while the app is open
 * - When the app returns to foreground (visibility change)
 */
export function useSahhaAutoSync(userId: number | undefined): void {
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!userId) return;

    const doSync = async () => {
      if (syncingRef.current) return;
      if (Date.now() - getLastSync() < MIN_SYNC_GAP) return;

      const profile = await getSahhaProfile(userId);
      if (!profile) return;

      syncingRef.current = true;
      try {
        await syncAll(userId, 7);
        setLastSync();
      } catch (e) {
        console.warn('Sahha auto-sync failed:', e);
      } finally {
        syncingRef.current = false;
      }
    };

    // Sync on mount
    doSync();

    // Periodic sync
    const interval = setInterval(doSync, SYNC_INTERVAL);

    // Sync on visibility change (app comes back to foreground)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        doSync();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [userId]);
}
