/**
 * Sahha Health API client.
 *
 * Supports two auth modes:
 * 1. Direct (sandbox): Uses VITE_SAHHA_CLIENT_ID/SECRET for client-side auth.
 *    Suitable for sandbox testing without Supabase Edge Functions.
 * 2. Proxy (production): Uses Supabase Edge Functions that hold credentials.
 */

const SAHHA_API_URL =
  (import.meta.env.VITE_SAHHA_API_URL as string) ||
  'https://sandbox-api.sahha.ai';

const SAHHA_CLIENT_ID =
  (import.meta.env.VITE_SAHHA_CLIENT_ID as string) || '';
const SAHHA_CLIENT_SECRET =
  (import.meta.env.VITE_SAHHA_CLIENT_SECRET as string) || '';

/** True when direct Sahha credentials are configured (sandbox/test mode). */
export const isSahhaDirectEnabled = !!(SAHHA_CLIENT_ID && SAHHA_CLIENT_SECRET);

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
  dataSources?: string[];
  scoreDateTime?: string;
  createdAtUtc?: string;
}

export interface SahhaScoreFactor {
  name: string;
  value: number;
  goal: number;
  score: number;
  state: 'high' | 'medium' | 'low' | 'minimal';
}

export interface SahhaBiomarker {
  id?: string;
  type: string;
  category: string;
  value: string;
  valueType?: string;
  unit: string;
  aggregation?: string;
  periodicity: string;
  startDateTime: string;
  endDateTime: string;
  createdAtUtc?: string;
}

// ---------------------------------------------------------------------------
// Account token (direct sandbox mode)
// ---------------------------------------------------------------------------

let cachedAccountToken: { token: string; expiresAt: number } | null = null;

/** Get an account token using client credentials. */
export async function getAccountToken(): Promise<string> {
  if (cachedAccountToken && cachedAccountToken.expiresAt > Date.now() + 60_000) {
    return cachedAccountToken.token;
  }

  const res = await fetch(`${SAHHA_API_URL}/api/v1/oauth/account/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: SAHHA_CLIENT_ID,
      clientSecret: SAHHA_CLIENT_SECRET,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Impossibile autenticarsi con Sahha (${res.status}). ` +
      `Verifica che VITE_SAHHA_CLIENT_ID e VITE_SAHHA_CLIENT_SECRET siano corretti.` +
      (body ? ` Dettagli: ${body.slice(0, 200)}` : ''),
    );
  }
  const data = await res.json();
  cachedAccountToken = {
    token: data.accountToken,
    expiresAt: Date.now() + 86400 * 1000,
  };
  return cachedAccountToken.token;
}

/** Register a profile directly using account token (sandbox mode). */
export async function registerProfileDirect(
  externalId: string,
): Promise<SahhaProfileToken> {
  const accountToken = await getAccountToken();
  const res = await fetch(`${SAHHA_API_URL}/api/v1/oauth/profile/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `account ${accountToken}`,
    },
    body: JSON.stringify({ externalId }),
  });

  if (!res.ok) {
    // Profile may already exist — try getting token instead
    if (res.status === 400) {
      return getProfileTokenDirect(externalId);
    }
    const body = await res.text().catch(() => '');
    throw new Error(
      `Errore durante la registrazione del profilo Sahha (${res.status}).` +
      (body ? ` Dettagli: ${body.slice(0, 200)}` : ''),
    );
  }
  return res.json() as Promise<SahhaProfileToken>;
}

/** Get profile token directly using account token (sandbox mode). */
export async function getProfileTokenDirect(
  externalId: string,
): Promise<SahhaProfileToken> {
  const accountToken = await getAccountToken();
  const res = await fetch(`${SAHHA_API_URL}/api/v1/oauth/profile/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `account ${accountToken}`,
    },
    body: JSON.stringify({ externalId }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Impossibile ottenere il token del profilo (${res.status}).` +
      (body ? ` Dettagli: ${body.slice(0, 200)}` : ''),
    );
  }
  return res.json() as Promise<SahhaProfileToken>;
}

// ---------------------------------------------------------------------------
// Profile search (find device-linked profiles on the account)
// ---------------------------------------------------------------------------

export interface SahhaAccountProfile {
  profileId: string;
  accountId: string;
  externalId: string;
  sdkId: string | null;
  deviceType: string | null;
  dataLastReceivedAtUtc: string | null;
  createdAtUtc: string;
  isSampleProfile: boolean;
}

/** Search for profiles on the account that have a linked device with data. */
export async function findDeviceProfileDirect(): Promise<SahhaAccountProfile | null> {
  const accountToken = await getAccountToken();
  const res = await fetch(`${SAHHA_API_URL}/api/v1/account/profile/search`, {
    headers: { Authorization: `account ${accountToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const items: SahhaAccountProfile[] = data.items || [];
  // Prefer a non-sample profile that has received data from a real device
  const deviceProfile = items.find(
    (p) => !p.isSampleProfile && p.deviceType && p.dataLastReceivedAtUtc,
  );
  return deviceProfile || null;
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
  types: string[] = ['wellbeing', 'activity', 'sleep', 'readiness', 'mental_wellbeing'],
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
  categories: string[] = ['activity', 'sleep', 'vitals', 'body'],
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
 * Register a Sahha profile via Supabase Edge Function (production mode).
 */
export async function registerProfile(
  externalId: string,
): Promise<SahhaProfileToken | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.functions.invoke('sahha-auth', {
    body: { action: 'register', externalId },
  });
  if (error) {
    throw new Error(
      'Connessione al server non riuscita. Le Edge Functions di Supabase non sono ancora configurate. ' +
      'Configura VITE_SAHHA_CLIENT_ID e VITE_SAHHA_CLIENT_SECRET per usare la modalita sandbox diretta.',
    );
  }
  return data as SahhaProfileToken;
}

/**
 * Get a profile token via Supabase Edge Function (production mode).
 */
export async function getProfileToken(
  externalId: string,
): Promise<SahhaProfileToken | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.functions.invoke('sahha-auth', {
    body: { action: 'token', externalId },
  });
  if (error) {
    throw new Error(
      'Impossibile ottenere il token dal server. Verifica che le Edge Functions siano configurate.',
    );
  }
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
