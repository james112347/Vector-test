import { useEffect, useRef } from 'react';
import { getSahhaProfile, syncAll, syncFromSupabase } from './sahha-data';

const SYNC_INTERVAL = 15 * 60 * 1000; // 15 minutes
const LAST_SYNC_KEY = 'vector_sahha_last_sync';
const LAST_SB_SYNC_KEY = 'vector_sahha_last_sb_sync';
const MIN_SYNC_GAP = 5 * 60 * 1000;   // Don't sync more than once every 5 minutes
const MIN_SB_SYNC_GAP = 2 * 60 * 1000; // Supabase sync: max once every 2 minutes

function getLastSync(): number {
  return parseInt(localStorage.getItem(LAST_SYNC_KEY) || '0', 10);
}

function setLastSync(): void {
  localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
}

function getLastSbSync(): number {
  return parseInt(localStorage.getItem(LAST_SB_SYNC_KEY) || '0', 10);
}

function setLastSbSync(): void {
  localStorage.setItem(LAST_SB_SYNC_KEY, String(Date.now()));
}

/**
 * Auto-syncs Sahha wearable data with two strategies:
 *
 * 1. **Supabase webhook data** (fast, works even if app was closed for days):
 *    The Sahha webhook pushes data to Supabase 24/7. When the app opens,
 *    it reads this data first for instant display.
 *
 * 2. **Direct Sahha API sync** (slower, freshest data):
 *    Falls back to direct API calls for the most up-to-date data.
 *
 * Triggers:
 * - On mount (immediate Supabase, then API)
 * - Every 15 minutes while the app is open (API)
 * - When the app returns to foreground (Supabase first, then API)
 */
export function useSahhaAutoSync(userId: number | undefined): void {
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!userId) return;

    // Quick sync: read webhook data from Supabase (fast, no Sahha token needed)
    const doSupabaseSync = async () => {
      if (Date.now() - getLastSbSync() < MIN_SB_SYNC_GAP) return;

      const profile = await getSahhaProfile(userId);
      if (!profile) return;

      try {
        const imported = await syncFromSupabase(userId);
        if (imported) {
          setLastSbSync();
        }
      } catch (e) {
        console.warn('Sahha Supabase sync failed:', e);
      }
    };

    // Full sync: fetch from Sahha API (slower, freshest data)
    const doApiSync = async () => {
      if (syncingRef.current) return;
      if (Date.now() - getLastSync() < MIN_SYNC_GAP) return;

      const profile = await getSahhaProfile(userId);
      if (!profile) return;

      syncingRef.current = true;
      try {
        await syncAll(userId, 7);
        setLastSync();
      } catch (e) {
        console.warn('Sahha API sync failed:', e);
      } finally {
        syncingRef.current = false;
      }
    };

    // On mount: Supabase first (instant), then API in background
    doSupabaseSync().then(() => doApiSync());

    // Periodic API sync every 15 minutes
    const interval = setInterval(doApiSync, SYNC_INTERVAL);

    // On visibility change: Supabase first (fast), then API
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        doSupabaseSync().then(() => doApiSync());
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [userId]);
}
