import { db } from '../db/db';
import type { QuickCheckin, CheckinType } from '../db/schema';
import { pushDataToSupabase } from './data-sync';
import { autoTrackGoals } from './goals';

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowTime(): string {
  return new Date().toTimeString().slice(0, 5);
}

/**
 * Add a quick check-in entry.
 */
export async function addCheckin(
  userId: number,
  type: CheckinType,
  value: number,
): Promise<QuickCheckin> {
  const checkin: QuickCheckin = {
    userId,
    date: todayString(),
    time: nowTime(),
    type,
    value,
    createdAt: new Date(),
  };
  const id = await db.quickCheckins.add(checkin);

  // Auto-track linked goals in background
  autoTrackGoals(userId, type).catch(() => {/* ignore */});

  // Sync to Supabase in background
  db.users.get(userId).then(u => {
    if (u?.email) pushDataToSupabase(u.email, userId);
  });

  return { ...checkin, id };
}

/**
 * Get today's check-ins for a user.
 */
export async function getTodayCheckins(userId: number): Promise<QuickCheckin[]> {
  return db.quickCheckins
    .where('[userId+date]')
    .equals([userId, todayString()])
    .sortBy('time');
}

/**
 * Get check-ins for the last N days.
 */
export async function getRecentCheckins(userId: number, days = 7): Promise<QuickCheckin[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  const startStr = startDate.toISOString().slice(0, 10);

  return db.quickCheckins
    .where('userId')
    .equals(userId)
    .and(c => c.date >= startStr)
    .sortBy('date');
}

/**
 * Delete a check-in entry.
 */
export async function deleteCheckin(id: number, userId?: number): Promise<void> {
  await db.quickCheckins.delete(id);

  if (userId) {
    db.users.get(userId).then(u => {
      if (u?.email) pushDataToSupabase(u.email, userId);
    });
  }
}

/**
 * Daily summary for AI consumption — structured data the algorithm uses
 * to correlate lifestyle factors with energy levels.
 */
export interface DailyCheckinSummary {
  date: string;
  sleepQuality: number | null;    // 1-5 soggettivo
  water: number;                   // bicchieri
  caffeine: number;                // tazzine
  mealQuality: number | null;      // 1-5 ultimo pasto
  focusLevel: number | null;       // 1-5 focus percepito
  activityDone: number | null;     // 1-5 livello attivita
  stress: number | null;           // 1-5 livello stress
  mood: number | null;             // 1-5 umore
  nap: number | null;              // 1-5 pisolino (1=no, 5=45min+)
  supplement: number;              // conta integratori
  screenBreak: number;             // conta pause schermo
  /** Orari specifici caffeina (HH:MM) per analisi pattern */
  caffeineTimes: string[];
}

export async function getCheckinSummaries(userId: number, days = 7): Promise<DailyCheckinSummary[]> {
  const checkins = await getRecentCheckins(userId, days);
  const byDate = new Map<string, QuickCheckin[]>();

  for (const c of checkins) {
    const arr = byDate.get(c.date) || [];
    arr.push(c);
    byDate.set(c.date, arr);
  }

  const summaries: DailyCheckinSummary[] = [];
  for (const [date, items] of byDate) {
    const last = (type: CheckinType) => {
      const filtered = items.filter(i => i.type === type);
      return filtered.length > 0 ? filtered[filtered.length - 1].value : null;
    };
    const sum = (type: CheckinType) =>
      items.filter(i => i.type === type).reduce((s, c) => s + c.value, 0);

    // Orari caffeina
    const caffeineTimes = items
      .filter(i => i.type === 'caffeine')
      .map(i => i.time);

    summaries.push({
      date,
      sleepQuality: last('sleep_quality'),
      water: sum('water'),
      caffeine: sum('caffeine'),
      mealQuality: last('meal_time'),
      focusLevel: last('focus'),
      activityDone: last('activity_done'),
      stress: last('stress'),
      mood: last('mood'),
      nap: last('nap'),
      supplement: sum('supplement'),
      screenBreak: sum('screen_break'),
      caffeineTimes,
    });
  }

  return summaries.sort((a, b) => a.date.localeCompare(b.date));
}
