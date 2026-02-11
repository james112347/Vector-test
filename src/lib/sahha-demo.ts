/**
 * Dati demo Sahha per testare la pagina Salute senza un dispositivo wearable reale.
 * Simula i profili di esempio disponibili nella Sahha Sandbox.
 */

import type { SahhaScoreLog, SahhaBiomarkerLog } from '../db/schema';

function isoDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(8, 0, 0, 0);
  return d.toISOString();
}

export function getDemoScores(userId: number): SahhaScoreLog[] {
  const now = new Date();
  return [
    {
      userId,
      type: 'activity',
      score: 0.72,
      state: 'medium',
      factors: JSON.stringify([
        { name: 'steps', value: 8432, goal: 10000, score: 0.84, state: 'high' },
        { name: 'active_hours', value: 5, goal: 8, score: 0.63, state: 'medium' },
        { name: 'active_calories', value: 380, goal: 500, score: 0.76, state: 'medium' },
      ]),
      scoreDateTime: isoDate(0),
      fetchedAt: now,
    },
    {
      userId,
      type: 'sleep',
      score: 0.81,
      state: 'high',
      factors: JSON.stringify([
        { name: 'duration', value: 7.5, goal: 8, score: 0.94, state: 'high' },
        { name: 'efficiency', value: 0.88, goal: 0.85, score: 0.88, state: 'high' },
        { name: 'regularity', value: 0.7, goal: 0.8, score: 0.7, state: 'medium' },
      ]),
      scoreDateTime: isoDate(0),
      fetchedAt: now,
    },
    {
      userId,
      type: 'wellbeing',
      score: 0.68,
      state: 'medium',
      factors: JSON.stringify([
        { name: 'activity_balance', value: 0.72, goal: 0.8, score: 0.72, state: 'medium' },
        { name: 'sleep_quality', value: 0.81, goal: 0.8, score: 0.81, state: 'high' },
        { name: 'recovery', value: 0.55, goal: 0.7, score: 0.55, state: 'low' },
      ]),
      scoreDateTime: isoDate(0),
      fetchedAt: now,
    },
    {
      userId,
      type: 'readiness',
      score: 0.59,
      state: 'low',
      factors: JSON.stringify([
        { name: 'hrv_balance', value: 0.52, goal: 0.7, score: 0.52, state: 'low' },
        { name: 'resting_hr', value: 0.65, goal: 0.7, score: 0.65, state: 'medium' },
        { name: 'sleep_restoration', value: 0.6, goal: 0.75, score: 0.6, state: 'low' },
      ]),
      scoreDateTime: isoDate(0),
      fetchedAt: now,
    },
    {
      userId,
      type: 'mental_wellbeing',
      score: 0.74,
      state: 'medium',
      factors: JSON.stringify([
        { name: 'stress_balance', value: 0.71, goal: 0.75, score: 0.71, state: 'medium' },
        { name: 'mood_stability', value: 0.78, goal: 0.8, score: 0.78, state: 'medium' },
      ]),
      scoreDateTime: isoDate(0),
      fetchedAt: now,
    },
  ];
}

export function getDemoBiomarkers(userId: number): SahhaBiomarkerLog[] {
  const now = new Date();
  const today = isoDate(0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 0);
  const endStr = todayEnd.toISOString();

  return [
    // Activity
    {
      userId, type: 'steps', category: 'activity',
      value: '8432', unit: 'count', periodicity: 'daily',
      startDateTime: today, endDateTime: endStr, fetchedAt: now,
    },
    {
      userId, type: 'active_energy_burned', category: 'activity',
      value: '382', unit: 'kcal', periodicity: 'daily',
      startDateTime: today, endDateTime: endStr, fetchedAt: now,
    },
    {
      userId, type: 'total_energy_burned', category: 'activity',
      value: '2150', unit: 'kcal', periodicity: 'daily',
      startDateTime: today, endDateTime: endStr, fetchedAt: now,
    },
    {
      userId, type: 'floors_climbed', category: 'activity',
      value: '7', unit: 'count', periodicity: 'daily',
      startDateTime: today, endDateTime: endStr, fetchedAt: now,
    },
    {
      userId, type: 'active_hours', category: 'activity',
      value: '5.2', unit: 'min', periodicity: 'daily',
      startDateTime: today, endDateTime: endStr, fetchedAt: now,
    },
    // Sleep
    {
      userId, type: 'sleep_duration', category: 'sleep',
      value: '452', unit: 'min', periodicity: 'daily',
      startDateTime: today, endDateTime: endStr, fetchedAt: now,
    },
    {
      userId, type: 'sleep_rem_duration', category: 'sleep',
      value: '98', unit: 'min', periodicity: 'daily',
      startDateTime: today, endDateTime: endStr, fetchedAt: now,
    },
    {
      userId, type: 'sleep_deep_duration', category: 'sleep',
      value: '85', unit: 'min', periodicity: 'daily',
      startDateTime: today, endDateTime: endStr, fetchedAt: now,
    },
    {
      userId, type: 'sleep_light_duration', category: 'sleep',
      value: '269', unit: 'min', periodicity: 'daily',
      startDateTime: today, endDateTime: endStr, fetchedAt: now,
    },
    // Vitals
    {
      userId, type: 'heart_rate_resting', category: 'vitals',
      value: '62', unit: 'bpm', periodicity: 'daily',
      startDateTime: today, endDateTime: endStr, fetchedAt: now,
    },
    {
      userId, type: 'heart_rate_variability_sdnn', category: 'vitals',
      value: '48.5', unit: 'ms', periodicity: 'daily',
      startDateTime: today, endDateTime: endStr, fetchedAt: now,
    },
    {
      userId, type: 'oxygen_saturation', category: 'vitals',
      value: '97.2', unit: '%', periodicity: 'daily',
      startDateTime: today, endDateTime: endStr, fetchedAt: now,
    },
    {
      userId, type: 'respiratory_rate', category: 'vitals',
      value: '14.8', unit: 'bpm', periodicity: 'daily',
      startDateTime: today, endDateTime: endStr, fetchedAt: now,
    },
    {
      userId, type: 'vo2_max', category: 'vitals',
      value: '42.3', unit: 'mL/kg/min', periodicity: 'daily',
      startDateTime: today, endDateTime: endStr, fetchedAt: now,
    },
    // Body
    {
      userId, type: 'weight', category: 'body',
      value: '74.5', unit: 'kg', periodicity: 'daily',
      startDateTime: today, endDateTime: endStr, fetchedAt: now,
    },
    {
      userId, type: 'body_mass_index', category: 'body',
      value: '23.8', unit: 'kg/m2', periodicity: 'daily',
      startDateTime: today, endDateTime: endStr, fetchedAt: now,
    },
  ];
}
