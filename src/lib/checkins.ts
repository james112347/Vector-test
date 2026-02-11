import { db } from '../db/db';
import type { QuickCheckin, CheckinType } from '../db/schema';

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
 * Get today's total for a specific check-in type (e.g., total water glasses).
 */
export async function getTodayTotal(userId: number, type: CheckinType): Promise<number> {
  const items = await db.quickCheckins
    .where('[userId+date+type]')
    .equals([userId, todayString(), type])
    .toArray();
  return items.reduce((sum, c) => sum + c.value, 0);
}

/**
 * Get today's totals for all check-in types.
 */
export async function getTodayTotals(userId: number): Promise<Record<CheckinType, number>> {
  const items = await getTodayCheckins(userId);
  const totals: Record<string, number> = {
    water: 0,
    meal: 0,
    caffeine: 0,
    stress: 0,
    movement: 0,
    mood: 0,
  };
  for (const c of items) {
    if (c.type === 'meal' || c.type === 'stress' || c.type === 'mood' || c.type === 'movement') {
      // For rated types, keep last value (most recent)
      totals[c.type] = c.value;
    } else {
      // For countable types (water, caffeine), sum up
      totals[c.type] += c.value;
    }
  }
  return totals as Record<CheckinType, number>;
}

/**
 * Delete a check-in entry.
 */
export async function deleteCheckin(id: number): Promise<void> {
  await db.quickCheckins.delete(id);
}

/**
 * Aggregate check-in data for AI: returns daily summaries for recent days.
 */
export interface DailyCheckinSummary {
  date: string;
  water: number;
  caffeine: number;
  mealQuality: number | null; // average of meals that day
  stressLevel: number | null; // last stress entry
  movementLevel: number | null;
  moodLevel: number | null;
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
    const waters = items.filter(i => i.type === 'water');
    const caffeines = items.filter(i => i.type === 'caffeine');
    const meals = items.filter(i => i.type === 'meal');
    const stresses = items.filter(i => i.type === 'stress');
    const movements = items.filter(i => i.type === 'movement');
    const moods = items.filter(i => i.type === 'mood');

    summaries.push({
      date,
      water: waters.reduce((s, c) => s + c.value, 0),
      caffeine: caffeines.reduce((s, c) => s + c.value, 0),
      mealQuality: meals.length > 0
        ? Math.round((meals.reduce((s, c) => s + c.value, 0) / meals.length) * 10) / 10
        : null,
      stressLevel: stresses.length > 0 ? stresses[stresses.length - 1].value : null,
      movementLevel: movements.length > 0 ? movements[movements.length - 1].value : null,
      moodLevel: moods.length > 0 ? moods[moods.length - 1].value : null,
    });
  }

  return summaries.sort((a, b) => a.date.localeCompare(b.date));
}
