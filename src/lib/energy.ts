import { db } from '../db/db';
import type { EnergyLog } from '../db/schema';

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Save or update today's energy log.
 * If a log exists for this date, it gets updated.
 */
export async function saveEnergyLog(
  userId: number,
  data: { physical: number; mental: number; emotional: number; workHoursToday?: number; notes?: string },
  date?: string
): Promise<EnergyLog> {
  const logDate = date || todayString();
  const now = new Date();

  const existing = await db.energyLogs
    .where('[userId+date]')
    .equals([userId, logDate])
    .first();

  if (existing) {
    await db.energyLogs.update(existing.id!, {
      ...data,
      updatedAt: now,
    });
    return { ...existing, ...data, updatedAt: now };
  }

  const log: EnergyLog = {
    userId,
    date: logDate,
    physical: data.physical,
    mental: data.mental,
    emotional: data.emotional,
    notes: data.notes,
    createdAt: now,
    updatedAt: now,
  };

  const id = await db.energyLogs.add(log);
  return { ...log, id };
}

/**
 * Get today's energy log for a user.
 */
export async function getTodayLog(userId: number): Promise<EnergyLog | undefined> {
  return db.energyLogs
    .where('[userId+date]')
    .equals([userId, todayString()])
    .first();
}

/**
 * Get energy logs for the last N days.
 */
export async function getRecentLogs(userId: number, days = 7): Promise<EnergyLog[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  const startStr = startDate.toISOString().slice(0, 10);

  return db.energyLogs
    .where('userId')
    .equals(userId)
    .and(log => log.date >= startStr)
    .sortBy('date');
}

/**
 * Get all energy logs for a user ordered by date descending.
 */
export async function getAllLogs(userId: number): Promise<EnergyLog[]> {
  const logs = await db.energyLogs
    .where('userId')
    .equals(userId)
    .toArray();
  return logs.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Delete an energy log.
 */
export async function deleteEnergyLog(logId: number): Promise<void> {
  await db.energyLogs.delete(logId);
}
