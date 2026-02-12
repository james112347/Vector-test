import { useState, useEffect, useCallback, useRef } from 'react';
import {
  incrementSession,
  recordActiveMinute,
  getTodayScreenTime,
  getRecentScreenTime,
} from './screen-time';
import type { ScreenTimeLog } from '../db/schema';

const HEARTBEAT_MS = 60_000; // 1 minuto

export function useScreenTime(userId: number | undefined) {
  const [today, setToday] = useState<ScreenTimeLog | null>(null);
  const [weekData, setWeekData] = useState<ScreenTimeLog[]>([]);
  const sessionMinutes = useRef(0);

  const reload = useCallback(async () => {
    if (!userId) return;
    const [t, w] = await Promise.all([
      getTodayScreenTime(userId),
      getRecentScreenTime(userId, 7),
    ]);
    setToday(t);
    setWeekData(w);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    // Registra nuova sessione
    incrementSession(userId).then(reload);

    // Heartbeat: ogni 60s se la tab e visibile
    const interval = setInterval(async () => {
      if (document.visibilityState === 'visible') {
        sessionMinutes.current += 1;
        await recordActiveMinute(userId, sessionMinutes.current);
        await reload();
      }
    }, HEARTBEAT_MS);

    // Quando la tab torna visibile, registra un minuto
    const onVisibility = async () => {
      if (document.visibilityState === 'visible') {
        sessionMinutes.current += 1;
        await recordActiveMinute(userId, sessionMinutes.current);
        await reload();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [userId, reload]);

  // Load iniziale
  useEffect(() => { reload(); }, [reload]);

  return { today, weekData, reload };
}
