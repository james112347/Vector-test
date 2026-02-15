// ---------------------------------------------------------------------------
// Habit Intelligence — Apprendimento abitudini e notifiche intelligenti
// ---------------------------------------------------------------------------
// Analizza i pattern di check-in per:
// 1. Imparare quando l'utente fa certe azioni (caffe, acqua, pasti)
// 2. Generare notifiche al momento giusto con risposte rapide
// 3. Alimentare l'algoritmo ibrido IA con dati piu precisi
// ---------------------------------------------------------------------------

import { db } from '../db/db';
import type { QuickCheckin, CheckinType } from '../db/schema';

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

export interface HabitPattern {
  type: CheckinType;
  /** Orari medi in cui l'utente registra questo check-in (HH:MM) */
  typicalTimes: string[];
  /** Frequenza media giornaliera */
  avgDailyCount: number;
  /** Giorno con piu registrazioni */
  peakDay: string;
  /** Deviazione standard oraria (bassa = abitudine regolare) */
  regularity: 'very_regular' | 'regular' | 'irregular';
  /** Correlazione con energia (positiva/negativa/nessuna) */
  energyCorrelation: 'positive' | 'negative' | 'none';
  /** Trend ultimi 7 giorni vs precedenti */
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface SmartNotification {
  /** Tipo di check-in da richiedere */
  checkinType: CheckinType;
  /** Messaggio della notifica */
  title: string;
  body: string;
  /** Risposte rapide (l'utente puo rispondere con un tap) */
  quickResponses: QuickResponse[];
  /** Orario suggerito per l'invio (HH:MM) */
  suggestedTime: string;
  /** Priorita */
  priority: 'low' | 'medium' | 'high';
  /** Motivo (per debug/trasparenza) */
  reason: string;
}

export interface QuickResponse {
  label: string;
  /** Valore da registrare nel check-in */
  value: number;
  /** Tipo check-in associato */
  type: CheckinType;
}

// ---------------------------------------------------------------------------
// Analisi pattern
// ---------------------------------------------------------------------------

/**
 * Analizza i check-in degli ultimi N giorni per rilevare pattern di abitudini.
 */
export async function analyzeHabitPatterns(
  userId: number,
  days = 14,
): Promise<HabitPattern[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  const startStr = startDate.toISOString().slice(0, 10);

  const checkins = await db.quickCheckins
    .where('userId')
    .equals(userId)
    .and(c => c.date >= startStr)
    .toArray();

  if (checkins.length === 0) return [];

  // Raggruppa per tipo
  const byType = new Map<CheckinType, QuickCheckin[]>();
  for (const c of checkins) {
    const arr = byType.get(c.type) || [];
    arr.push(c);
    byType.set(c.type, arr);
  }

  // Carica log energia per correlazioni
  const energyLogs = await db.energyLogs
    .where('userId')
    .equals(userId)
    .and(l => l.date >= startStr)
    .toArray();
  const energyByDate = new Map(energyLogs.map(l => [l.date, l]));

  const patterns: HabitPattern[] = [];

  for (const [type, items] of byType) {
    if (items.length < 2) continue;

    // Orari tipici
    const times = items.map(c => c.time);
    const hours = times.map(t => parseInt(t.split(':')[0]));

    // Cluster ore per trovare orari tipici
    const hourCounts = new Map<number, number>();
    for (const h of hours) {
      hourCounts.set(h, (hourCounts.get(h) || 0) + 1);
    }
    const sortedHours = [...hourCounts.entries()].sort((a, b) => b[1] - a[1]);
    const typicalTimes = sortedHours.slice(0, 3).map(([h]) => `${String(h).padStart(2, '0')}:00`);

    // Frequenza giornaliera
    const dates = new Set(items.map(c => c.date));
    const avgDailyCount = Math.round((items.length / dates.size) * 10) / 10;

    // Giorno con piu registrazioni
    const dateCounts = new Map<string, number>();
    for (const c of items) {
      dateCounts.set(c.date, (dateCounts.get(c.date) || 0) + 1);
    }
    const peakDay = [...dateCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';

    // Regolarita (deviazione standard delle ore)
    const meanHour = hours.reduce((s, h) => s + h, 0) / hours.length;
    const variance = hours.reduce((s, h) => s + (h - meanHour) ** 2, 0) / hours.length;
    const stdDev = Math.sqrt(variance);
    const regularity: HabitPattern['regularity'] =
      stdDev < 1.5 ? 'very_regular' : stdDev < 3 ? 'regular' : 'irregular';

    // Correlazione con energia
    let energyCorrelation: HabitPattern['energyCorrelation'] = 'none';
    const daysWithCheckin = [...dates];
    if (daysWithCheckin.length >= 3 && energyLogs.length >= 3) {
      const daysWithout = energyLogs
        .filter(l => !dates.has(l.date))
        .map(l => (l.physical + l.mental + l.emotional) / 3);
      const daysWith = daysWithCheckin
        .map(d => energyByDate.get(d))
        .filter(Boolean)
        .map(l => (l!.physical + l!.mental + l!.emotional) / 3);

      if (daysWith.length > 0 && daysWithout.length > 0) {
        const avgWith = daysWith.reduce((s, v) => s + v, 0) / daysWith.length;
        const avgWithout = daysWithout.reduce((s, v) => s + v, 0) / daysWithout.length;
        if (avgWith - avgWithout > 0.8) energyCorrelation = 'positive';
        else if (avgWithout - avgWith > 0.8) energyCorrelation = 'negative';
      }
    }

    // Trend
    const midDate = new Date();
    midDate.setDate(midDate.getDate() - Math.floor(days / 2));
    const midStr = midDate.toISOString().slice(0, 10);
    const recentItems = items.filter(c => c.date >= midStr);
    const olderItems = items.filter(c => c.date < midStr);
    const recentDays = new Set(recentItems.map(c => c.date)).size || 1;
    const olderDays = new Set(olderItems.map(c => c.date)).size || 1;
    const recentRate = recentItems.length / recentDays;
    const olderRate = olderItems.length / olderDays;
    const trend: HabitPattern['trend'] =
      recentRate > olderRate * 1.3 ? 'increasing'
        : recentRate < olderRate * 0.7 ? 'decreasing'
          : 'stable';

    patterns.push({
      type,
      typicalTimes,
      avgDailyCount,
      peakDay,
      regularity,
      energyCorrelation,
      trend,
    });
  }

  return patterns;
}

// ---------------------------------------------------------------------------
// Generazione notifiche intelligenti
// ---------------------------------------------------------------------------

export const TYPE_LABELS: Record<string, string> = {
  caffeine: 'caffe', water: 'acqua', supplement: 'integratore',
  screen_break: 'pausa schermo', sleep_quality: 'qualita sonno',
  mood: 'umore', stress: 'stress', meal_time: 'pasto',
  focus: 'focus', activity_done: 'attivita fisica', nap: 'pisolino',
};

/**
 * Genera notifiche intelligenti basate sui pattern delle abitudini.
 * Da chiamare periodicamente (es. ogni 30 minuti o all'apertura dell'app).
 */
export async function generateSmartNotifications(
  userId: number,
): Promise<SmartNotification[]> {
  const patterns = await analyzeHabitPatterns(userId);
  const todayCheckins = await db.quickCheckins
    .where('[userId+date]')
    .equals([userId, new Date().toISOString().slice(0, 10)])
    .toArray();
  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;

  const notifications: SmartNotification[] = [];
  const todayTypes = new Set(todayCheckins.map(c => c.type));

  for (const pattern of patterns) {
    // Controlla se e' il momento giusto per chiedere
    for (const typicalTime of pattern.typicalTimes) {
      const [typH, typM] = typicalTime.split(':').map(Number);
      const diffMinutes = (currentHour * 60 + currentMin) - (typH * 60 + (typM || 0));

      // Notifica se siamo nei 15 minuti dopo l'orario abituale
      if (diffMinutes >= -5 && diffMinutes <= 20) {
        const typeLabel = TYPE_LABELS[pattern.type] || pattern.type;

        // Per counter (caffe, acqua): chiedi se l'ha fatto
        if (['caffeine', 'water', 'supplement', 'screen_break'].includes(pattern.type)) {
          const todayCount = todayCheckins.filter(c => c.type === pattern.type)
            .reduce((s, c) => s + c.value, 0);

          // Non chiedere se ha gia superato la media
          if (todayCount >= pattern.avgDailyCount * 1.5) continue;

          notifications.push({
            checkinType: pattern.type,
            title: `Hai preso il ${typeLabel}?`,
            body: pattern.type === 'caffeine'
              ? `Di solito a quest'ora bevi un caffe. Registralo per migliorare le previsioni.`
              : pattern.type === 'water'
                ? `Ricordati di bere! Oggi: ${todayCount} bicchieri.`
                : `Momento di registrare: ${typeLabel}`,
            quickResponses: [
              { label: 'Si, +1', value: 1, type: pattern.type },
              { label: 'No, salto', value: 0, type: pattern.type },
            ],
            suggestedTime: typicalTime,
            priority: pattern.energyCorrelation !== 'none' ? 'medium' : 'low',
            reason: `Pattern: ${typeLabel} registrato solitamente alle ${typicalTime} (regolarita: ${pattern.regularity})`,
          });
        }

        // Per scale: chiedi se non ha ancora registrato oggi
        if (['mood', 'stress', 'focus'].includes(pattern.type) && !todayTypes.has(pattern.type)) {
          const scaleLabels: Record<string, string[]> = {
            mood: ['Giu', 'Neutro', 'Bene', 'Ottimo'],
            stress: ['Basso', 'Moderato', 'Alto', 'Estremo'],
            focus: ['Basso', 'Medio', 'Buono', 'Massimo'],
          };
          const labels = scaleLabels[pattern.type] || ['1', '2', '3', '4'];

          notifications.push({
            checkinType: pattern.type,
            title: `Come va il tuo ${typeLabel}?`,
            body: `Un check-in rapido migliora la precisione dei tuoi consigli.`,
            quickResponses: labels.map((label, i) => ({
              label,
              value: i + 2, // 2-5
              type: pattern.type,
            })),
            suggestedTime: typicalTime,
            priority: 'medium',
            reason: `Check-in ${typeLabel} non ancora registrato oggi, orario tipico: ${typicalTime}`,
          });
        }
      }
    }

    // Notifica speciale: sonno non registrato entro le 10:00
    if (pattern.type === 'sleep_quality' && currentHour <= 10 && currentHour >= 7 && !todayTypes.has('sleep_quality')) {
      notifications.push({
        checkinType: 'sleep_quality',
        title: 'Come hai dormito?',
        body: 'Registra la qualita del sonno per consigli piu precisi.',
        quickResponses: [
          { label: 'Male', value: 2, type: 'sleep_quality' },
          { label: 'Ok', value: 3, type: 'sleep_quality' },
          { label: 'Bene', value: 4, type: 'sleep_quality' },
          { label: 'Ottimo', value: 5, type: 'sleep_quality' },
        ],
        suggestedTime: currentTimeStr,
        priority: 'high',
        reason: 'Qualita sonno non ancora registrata, essenziale per previsioni accurate',
      });
    }
  }

  // Notifica idratazione se pochi bicchieri e ore > 14
  if (currentHour >= 14) {
    const waterToday = todayCheckins
      .filter(c => c.type === 'water')
      .reduce((s, c) => s + c.value, 0);
    if (waterToday < 4) {
      notifications.push({
        checkinType: 'water',
        title: 'Bevi di piu!',
        body: `Solo ${waterToday} bicchieri oggi. L'idratazione influenza energia e concentrazione.`,
        quickResponses: [
          { label: 'Bevo ora', value: 1, type: 'water' },
          { label: 'Gia bevuto', value: 1, type: 'water' },
        ],
        suggestedTime: currentTimeStr,
        priority: 'high',
        reason: `Idratazione bassa: ${waterToday}/8 bicchieri alle ${currentHour}:00`,
      });
    }
  }

  // Deduplica per tipo di check-in (max 1 notifica per tipo)
  const seen = new Set<CheckinType>();
  return notifications.filter(n => {
    if (seen.has(n.checkinType)) return false;
    seen.add(n.checkinType);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Cache e scheduling
// ---------------------------------------------------------------------------

const HABIT_CACHE_KEY = 'vector_habit_patterns';
const HABIT_CACHE_TTL = 60 * 60 * 1000; // 1 ora

export function getCachedPatterns(): HabitPattern[] | null {
  try {
    const raw = sessionStorage.getItem(HABIT_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.ts > HABIT_CACHE_TTL) return null;
    return cached.data;
  } catch { return null; }
}

export function cachePatterns(data: HabitPattern[]): void {
  try {
    sessionStorage.setItem(HABIT_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* ignored */ }
}
