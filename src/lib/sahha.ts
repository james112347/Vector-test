/**
 * Sahha Health API client.
 *
 * Architecture:
 * - Account-level operations (register profile, delete) go through
 *   Supabase Edge Functions that hold the clientId/clientSecret.
 * - Profile-level reads (scores, biomarkers) can be called directly
 *   from the client using the profile token stored locally.
 * - Webhooks push data to a Supabase Edge Function which writes to
 *   the sahha_* tables.
 */

const SAHHA_API_URL =
  (import.meta.env.VITE_SAHHA_API_URL as string) ||
  'https://sandbox-api.sahha.ai';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SahhaProfileToken {
  profileToken: string;
  expiresIn: number;
  tokenType: string;
  refreshToken: string;
}

export interface SahhaScore {
  type: string;
  score: number;
  state: 'high' | 'medium' | 'low' | 'minimal';
  factors: SahhaScoreFactor[];
  dataSources: string[];
  scoreDateTime: string;
}

export interface SahhaScoreFactor {
  name: string;
  value: number;
  goal: number;
  score: number;
  state: 'high' | 'medium' | 'low' | 'minimal';
}

export interface SahhaBiomarker {
  id: string;
  type: string;
  category: string;
  value: string;
  valueType: string;
  unit: string;
  aggregation: string;
  periodicity: string;
  startDateTime: string;
  endDateTime: string;
  createdAtUtc: string;
}

// ---------------------------------------------------------------------------
// Profile-level API calls (use profile token — safe for client)
// ---------------------------------------------------------------------------

async function profileFetch<T>(
  path: string,
  profileToken: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${SAHHA_API_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `profile ${profileToken}` },
  });
  if (!res.ok) {
    throw new Error(`Sahha API ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

/** Fetch health scores for the authenticated profile. */
export async function getScores(
  profileToken: string,
  types: string[] = ['wellbeing', 'activity', 'sleep', 'readiness'],
  startDateTime?: string,
  endDateTime?: string,
): Promise<SahhaScore[]> {
  const params: Record<string, string> = {};
  types.forEach((t, i) => {
    params[`types[${i}]`] = t;
  });
  if (startDateTime) params.startDateTime = startDateTime;
  if (endDateTime) params.endDateTime = endDateTime;
  return profileFetch<SahhaScore[]>('/api/v1/profile/score', profileToken, params);
}

/** Fetch biomarkers for the authenticated profile. */
export async function getBiomarkers(
  profileToken: string,
  categories: string[] = ['activity', 'sleep', 'vitals'],
  startDateTime?: string,
  endDateTime?: string,
): Promise<SahhaBiomarker[]> {
  const params: Record<string, string> = {};
  categories.forEach((c, i) => {
    params[`categories[${i}]`] = c;
  });
  if (startDateTime) params.startDateTime = startDateTime;
  if (endDateTime) params.endDateTime = endDateTime;
  return profileFetch<SahhaBiomarker[]>(
    '/api/v1/profile/biomarker',
    profileToken,
    params,
  );
}

/** Refresh an expired profile token. */
export async function refreshProfileToken(
  currentRefreshToken: string,
): Promise<SahhaProfileToken> {
  const res = await fetch(
    `${SAHHA_API_URL}/api/v1/oauth/profile/refreshToken`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: currentRefreshToken }),
    },
  );
  if (!res.ok) {
    throw new Error(`Sahha token refresh ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<SahhaProfileToken>;
}

// ---------------------------------------------------------------------------
// Server-side proxy calls (via Supabase Edge Functions)
// ---------------------------------------------------------------------------

import { supabase } from './supabase';

/**
 * Register a Sahha profile for the current user.
 * This calls a Supabase Edge Function that holds the Sahha clientId/clientSecret.
 */
export async function registerProfile(
  externalId: string,
): Promise<SahhaProfileToken | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.functions.invoke('sahha-auth', {
    body: { action: 'register', externalId },
  });
  if (error) throw new Error(`Sahha register failed: ${error.message}`);
  return data as SahhaProfileToken;
}

/**
 * Get a profile token for an existing Sahha profile.
 * This calls a Supabase Edge Function.
 */
export async function getProfileToken(
  externalId: string,
): Promise<SahhaProfileToken | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.functions.invoke('sahha-auth', {
    body: { action: 'token', externalId },
  });
  if (error) throw new Error(`Sahha token failed: ${error.message}`);
  return data as SahhaProfileToken;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a Date as ISO string suitable for Sahha API queries. */
export function toSahhaDateTime(date: Date): string {
  return date.toISOString();
}

/** Get start of today (local timezone) as ISO string. */
export function todayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Get start of N days ago as ISO string. */
export function daysAgoStart(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Map score state to a human-readable Italian label. */
export function scoreStateLabel(state: string): string {
  switch (state) {
    case 'high':
      return 'Ottimo';
    case 'medium':
      return 'Buono';
    case 'low':
      return 'Basso';
    case 'minimal':
      return 'Scarso';
    default:
      return state;
  }
}

/** Map score state to a color class. */
export function scoreStateColor(state: string): string {
  switch (state) {
    case 'high':
      return 'text-green-600 dark:text-green-400';
    case 'medium':
      return 'text-blue-600 dark:text-blue-400';
    case 'low':
      return 'text-amber-600 dark:text-amber-400';
    case 'minimal':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-muted-foreground';
  }
}
