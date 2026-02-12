/**
 * Tracks user activity: time spent in app + session count.
 * Sends data to Supabase `user_activity` table for admin visibility.
 *
 * Schema for `user_activity` (create in Supabase):
 *   email text primary key,
 *   total_sessions int default 0,
 *   total_minutes int default 0,
 *   last_active_at timestamptz,
 *   today_minutes int default 0,
 *   today_date text
 */

import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

const HEARTBEAT_INTERVAL = 60_000; // 1 minute

export function useActivityTracker(email: string | undefined): void {
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (!email || !supabase) return;

    const todayStr = new Date().toISOString().slice(0, 10);

    // Record session start
    supabase
      .from('user_activity')
      .upsert(
        {
          email,
          last_active_at: new Date().toISOString(),
        },
        { onConflict: 'email' }
      )
      .then(({ error }) => {
        if (error) console.warn('Activity track init failed:', error.message);
      });

    // Increment session count (use RPC or raw increment)
    // Since Supabase doesn't support atomic increment in upsert easily,
    // we'll do a select + update pattern
    incrementSessionCount(email);

    // Heartbeat every 60s to track active minutes
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        recordMinute(email, todayStr);
      }
    }, HEARTBEAT_INTERVAL);

    // On visibility change, record minute when coming back
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        recordMinute(email, todayStr);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // On unload, record final active time
    const onUnload = () => {
      const mins = Math.round((Date.now() - startRef.current) / 60_000);
      if (mins > 0 && navigator.sendBeacon && supabase) {
        // Use sendBeacon for reliable delivery on page close
        const url = `${(supabase as unknown as { supabaseUrl: string }).supabaseUrl}/rest/v1/user_activity?email=eq.${encodeURIComponent(email)}`;
        const key = (supabase as unknown as { supabaseKey: string }).supabaseKey;
        if (url && key) {
          navigator.sendBeacon(
            url,
            new Blob(
              [JSON.stringify({ last_active_at: new Date().toISOString() })],
              { type: 'application/json' }
            )
          );
        }
      }
    };
    window.addEventListener('beforeunload', onUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [email]);
}

async function incrementSessionCount(email: string): Promise<void> {
  if (!supabase) return;
  try {
    const { data } = await supabase
      .from('user_activity')
      .select('total_sessions')
      .eq('email', email)
      .single();

    const current = data?.total_sessions ?? 0;
    await supabase
      .from('user_activity')
      .upsert(
        {
          email,
          total_sessions: current + 1,
          last_active_at: new Date().toISOString(),
        },
        { onConflict: 'email' }
      );
  } catch {
    // Ignore — non-critical
  }
}

async function recordMinute(email: string, todayStr: string): Promise<void> {
  if (!supabase) return;
  try {
    const { data } = await supabase
      .from('user_activity')
      .select('total_minutes, today_minutes, today_date')
      .eq('email', email)
      .single();

    const isSameDay = data?.today_date === todayStr;
    await supabase
      .from('user_activity')
      .upsert(
        {
          email,
          total_minutes: (data?.total_minutes ?? 0) + 1,
          today_minutes: isSameDay ? (data?.today_minutes ?? 0) + 1 : 1,
          today_date: todayStr,
          last_active_at: new Date().toISOString(),
        },
        { onConflict: 'email' }
      );
  } catch {
    // Ignore — non-critical
  }
}

/** Fetch activity data for all users (admin only) */
export async function getAllUserActivity(): Promise<UserActivity[]> {
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from('user_activity')
      .select('*')
      .order('last_active_at', { ascending: false });
    return (data ?? []) as UserActivity[];
  } catch {
    return [];
  }
}

export interface UserActivity {
  email: string;
  total_sessions: number;
  total_minutes: number;
  last_active_at: string;
  today_minutes: number;
  today_date: string;
}
