/**
 * Sahha data operations — read/write to local Dexie DB + sync from Sahha API.
 *
 * Supports two auth modes:
 * - Direct sandbox mode (isSahhaDirectEnabled): uses client credentials
 * - Production mode: uses Supabase Edge Functions
 */

import { db } from '../db/db';
import type { SahhaProfile, SahhaScoreLog, SahhaBiomarkerLog } from '../db/schema';
import {
  isSahhaDirectEnabled,
  getScores,
  getBiomarkers,
  registerProfile,
  registerProfileDirect,
  getProfileToken,
  getProfileTokenDirect,
  refreshProfileToken,
  findDeviceProfileDirect,
  daysAgoStart,
} from './sahha';

/** True when any Sahha auth mode is available. */
export const isSahhaAvailable = isSahhaDirectEnabled || !!import.meta.env.VITE_SUPABASE_URL;

// ---------------------------------------------------------------------------
// Profile management
// ---------------------------------------------------------------------------

export async function getSahhaProfile(userId: number): Promise<SahhaProfile | undefined> {
  return db.sahhaProfiles.where('userId').equals(userId).first();
}

export async function connectSahha(userId: number): Promise<SahhaProfile> {
  let externalId = `vector-user-${userId}`;
  let tokenResp;

  if (isSahhaDirectEnabled) {
    // In sandbox mode, first check if there's a device-linked profile with real data
    const deviceProfile = await findDeviceProfileDirect();
    if (deviceProfile) {
      externalId = deviceProfile.externalId;
      tokenResp = await getProfileTokenDirect(externalId);
    } else {
      tokenResp = await registerProfileDirect(externalId);
    }
  } else {
    // Production mode — via Supabase Edge Function
    tokenResp = await registerProfile(externalId);
    if (!tokenResp) {
      throw new Error(
        'Configura VITE_SAHHA_CLIENT_ID/SECRET oppure Supabase per usare Sahha.',
      );
    }
  }

  const now = new Date();
  // expiresIn may be a Unix timestamp or seconds; handle both
  const expiresMs =
    tokenResp.expiresIn > 1_000_000_000
      ? tokenResp.expiresIn * 1000 // Unix timestamp in seconds → ms
      : now.getTime() + tokenResp.expiresIn * 1000; // relative seconds

  const profile: SahhaProfile = {
    userId,
    externalId,
    profileToken: tokenResp.profileToken,
    refreshToken: tokenResp.refreshToken,
    tokenExpiresAt: new Date(expiresMs),
    createdAt: now,
    updatedAt: now,
  };

  // Upsert locally
  const existing = await db.sahhaProfiles.where('userId').equals(userId).first();
  if (existing?.id) {
    await db.sahhaProfiles.update(existing.id, profile);
    profile.id = existing.id;
  } else {
    profile.id = await db.sahhaProfiles.add(profile);
  }

  return profile;
}

export async function disconnectSahha(userId: number): Promise<void> {
  await db.sahhaProfiles.where('userId').equals(userId).delete();
  await db.sahhaScores.where('userId').equals(userId).delete();
  await db.sahhaBiomarkers.where('userId').equals(userId).delete();
}

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

async function getValidToken(profile: SahhaProfile): Promise<string> {
  // If token is still valid, return it
  if (profile.tokenExpiresAt > new Date()) {
    return profile.profileToken;
  }

  // Try to refresh
  try {
    const newToken = await refreshProfileToken(profile.refreshToken);
    const now = new Date();
    await db.sahhaProfiles.update(profile.id!, {
      profileToken: newToken.profileToken,
      refreshToken: newToken.refreshToken,
      tokenExpiresAt: new Date(now.getTime() + newToken.expiresIn * 1000),
      updatedAt: now,
    });
    return newToken.profileToken;
  } catch {
    // If refresh fails, try getting a new token
    let tokenResp;
    if (isSahhaDirectEnabled) {
      tokenResp = await getProfileTokenDirect(profile.externalId);
    } else {
      tokenResp = await getProfileToken(profile.externalId);
    }
    if (!tokenResp) throw new Error('Impossibile rinnovare il token Sahha');
    const now = new Date();
    await db.sahhaProfiles.update(profile.id!, {
      profileToken: tokenResp.profileToken,
      refreshToken: tokenResp.refreshToken,
      tokenExpiresAt: new Date(now.getTime() + tokenResp.expiresIn * 1000),
      updatedAt: now,
    });
    return tokenResp.profileToken;
  }
}

// ---------------------------------------------------------------------------
// Sync scores & biomarkers from Sahha API → local DB
// ---------------------------------------------------------------------------

export async function syncScores(userId: number, days = 30): Promise<SahhaScoreLog[]> {
  const profile = await getSahhaProfile(userId);
  if (!profile) return [];

  const token = await getValidToken(profile);
  const startDateTime = daysAgoStart(days);
  const scores = await getScores(token, undefined, startDateTime);

  const now = new Date();
  const logs: SahhaScoreLog[] = scores.map((s) => ({
    userId,
    type: s.type,
    score: s.score,
    state: s.state,
    factors: JSON.stringify(s.factors),
    scoreDateTime: s.scoreDateTime || s.createdAtUtc || new Date().toISOString(),
    fetchedAt: now,
  }));

  // Clear old scores for this user and re-insert
  await db.sahhaScores.where('userId').equals(userId).delete();
  if (logs.length > 0) {
    await db.sahhaScores.bulkAdd(logs);
  }

  return logs;
}

export async function syncBiomarkers(userId: number, days = 30): Promise<SahhaBiomarkerLog[]> {
  const profile = await getSahhaProfile(userId);
  if (!profile) return [];

  const token = await getValidToken(profile);
  const startDateTime = daysAgoStart(days);
  const biomarkers = await getBiomarkers(token, undefined, startDateTime);

  const now = new Date();
  const logs: SahhaBiomarkerLog[] = biomarkers.map((b) => ({
    userId,
    type: b.type,
    category: b.category,
    value: b.value,
    unit: b.unit,
    periodicity: b.periodicity,
    startDateTime: b.startDateTime,
    endDateTime: b.endDateTime,
    fetchedAt: now,
  }));

  // Clear old biomarkers and re-insert
  await db.sahhaBiomarkers.where('userId').equals(userId).delete();
  if (logs.length > 0) {
    await db.sahhaBiomarkers.bulkAdd(logs);
  }

  return logs;
}

/** Full sync: scores + biomarkers in parallel. */
export async function syncAll(
  userId: number,
  days = 30,
): Promise<{ scores: SahhaScoreLog[]; biomarkers: SahhaBiomarkerLog[] }> {
  const [scores, biomarkers] = await Promise.all([
    syncScores(userId, days),
    syncBiomarkers(userId, days),
  ]);
  return { scores, biomarkers };
}

// ---------------------------------------------------------------------------
// Local reads (from Dexie cache)
// ---------------------------------------------------------------------------

export async function getCachedScores(userId: number): Promise<SahhaScoreLog[]> {
  return db.sahhaScores.where('userId').equals(userId).toArray();
}

export async function getCachedBiomarkers(
  userId: number,
  category?: string,
): Promise<SahhaBiomarkerLog[]> {
  if (category) {
    return db.sahhaBiomarkers
      .where('[userId+type]')
      .between([userId, ''], [userId, '\uffff'])
      .filter((b) => b.category === category)
      .toArray();
  }
  return db.sahhaBiomarkers.where('userId').equals(userId).toArray();
}

/** Get the latest score for each type (most recent per type). */
export async function getLatestScoresByType(
  userId: number,
): Promise<Record<string, SahhaScoreLog>> {
  const all = await getCachedScores(userId);
  const byType: Record<string, SahhaScoreLog> = {};
  for (const s of all) {
    const existing = byType[s.type];
    if (!existing || s.scoreDateTime > existing.scoreDateTime) {
      byType[s.type] = s;
    }
  }
  return byType;
}

/** Get score history for a specific type (sorted by date). */
export async function getScoreHistory(
  userId: number,
  type: string,
): Promise<SahhaScoreLog[]> {
  const all = await getCachedScores(userId);
  return all
    .filter((s) => s.type === type)
    .sort((a, b) => a.scoreDateTime.localeCompare(b.scoreDateTime));
}
