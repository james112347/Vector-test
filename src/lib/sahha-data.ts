/**
 * Sahha data operations — read/write to local Dexie DB + sync from Sahha API.
 */

import { db } from '../db/db';
import type { SahhaProfile, SahhaScoreLog, SahhaBiomarkerLog } from '../db/schema';
import {
  getScores,
  getBiomarkers,
  registerProfile,
  getProfileToken,
  refreshProfileToken,
  daysAgoStart,
} from './sahha';

// ---------------------------------------------------------------------------
// Profile management
// ---------------------------------------------------------------------------

export async function getSahhaProfile(userId: number): Promise<SahhaProfile | undefined> {
  return db.sahhaProfiles.where('userId').equals(userId).first();
}

export async function connectSahha(userId: number): Promise<SahhaProfile> {
  // Generate a deterministic externalId from the user ID
  const externalId = `vector-user-${userId}`;

  // Try to register via Supabase Edge Function
  const tokenResp = await registerProfile(externalId);
  if (!tokenResp) {
    throw new Error('Supabase non configurato. Configura VITE_SUPABASE_URL per usare Sahha.');
  }

  const now = new Date();
  const profile: SahhaProfile = {
    userId,
    externalId,
    profileToken: tokenResp.profileToken,
    refreshToken: tokenResp.refreshToken,
    tokenExpiresAt: new Date(now.getTime() + tokenResp.expiresIn * 1000),
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
    // If refresh fails, try getting a new token via Edge Function
    const tokenResp = await getProfileToken(profile.externalId);
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

export async function syncScores(userId: number, days = 7): Promise<SahhaScoreLog[]> {
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
    scoreDateTime: s.scoreDateTime,
    fetchedAt: now,
  }));

  // Clear old scores for this user and re-insert
  await db.sahhaScores.where('userId').equals(userId).delete();
  if (logs.length > 0) {
    await db.sahhaScores.bulkAdd(logs);
  }

  return logs;
}

export async function syncBiomarkers(userId: number, days = 7): Promise<SahhaBiomarkerLog[]> {
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
