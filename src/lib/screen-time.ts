import { db } from '../db/db';
import type { ScreenTimeLog } from '../db/schema';

const todayStr = () => new Date().toISOString().slice(0, 10);

/** Ottieni o crea il record di oggi */
async function getOrCreateToday(userId: number): Promise<ScreenTimeLog> {
  const date = todayStr();
  const existing = await db.screenTimeLogs
    .where('[userId+date]')
    .equals([userId, date])
    .first();

  if (existing) return existing;

  const id = await db.screenTimeLogs.add({
    userId,
    date,
    minutes: 0,
    sessions: 0,
    longestSession: 0,
    updatedAt: new Date(),
  });
  return (await db.screenTimeLogs.get(id))!;
}

/** Incrementa sessioni di oggi */
export async function incrementSession(userId: number): Promise<void> {
  const log = await getOrCreateToday(userId);
  if (log.id) {
    await db.screenTimeLogs.update(log.id, {
      sessions: log.sessions + 1,
      updatedAt: new Date(),
    });
  }
}

/** Registra un minuto attivo + aggiorna sessione piu lunga */
export async function recordActiveMinute(
  userId: number,
  currentSessionMinutes: number,
): Promise<void> {
  const log = await getOrCreateToday(userId);
  if (log.id) {
    await db.screenTimeLogs.update(log.id, {
      minutes: log.minutes + 1,
      longestSession: Math.max(log.longestSession, currentSessionMinutes),
      updatedAt: new Date(),
    });
  }
}

/** Ritorna il log di oggi */
export async function getTodayScreenTime(userId: number): Promise<ScreenTimeLog | null> {
  const date = todayStr();
  return (
    (await db.screenTimeLogs
      .where('[userId+date]')
      .equals([userId, date])
      .first()) ?? null
  );
}

/** Ritorna i log degli ultimi N giorni */
export async function getRecentScreenTime(userId: number, days: number): Promise<ScreenTimeLog[]> {
  const dates: [number, string][] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push([userId, d.toISOString().slice(0, 10)]);
  }
  return db.screenTimeLogs
    .where('[userId+date]')
    .anyOf(dates)
    .toArray();
}

/** Formatta minuti in "Xh Ym" */
export function formatMinutes(m: number): string {
  if (m <= 0) return '0min';
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest > 0 ? `${h}h ${rest}m` : `${h}h`;
}
