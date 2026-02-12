// ---------------------------------------------------------------------------
// State Assessor — Valuta lo stato energetico corrente dall'insieme dei dati
// ---------------------------------------------------------------------------

import { db } from '../../db/db';
import type { EnergyLog, QuickCheckin, SahhaScoreLog } from '../../db/schema';
import type {
  EnergyState,
  EnergyLevel,
  EnergyDimension,
  EnergyFactor,
  TimeSlot,
} from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function getCurrentTimeSlot(): TimeSlot {
  const hour = new Date().getHours();
  if (hour < 6) return 'night';
  if (hour < 9) return 'early_morning';
  if (hour < 12) return 'morning';
  if (hour < 14) return 'midday';
  if (hour < 18) return 'afternoon';
  if (hour < 22) return 'evening';
  return 'night';
}

function classifyLevel(overall: number): EnergyLevel {
  if (overall <= 2) return 'critical';
  if (overall <= 4) return 'low';
  if (overall <= 6) return 'moderate';
  if (overall <= 8) return 'good';
  return 'peak';
}

function detectDominantFatigue(
  physical: number,
  mental: number,
  emotional: number,
): EnergyDimension | 'balanced' | null {
  const avg = (physical + mental + emotional) / 3;
  // Se tutti sono sopra 6, nessuna fatica dominante
  if (physical > 6 && mental > 6 && emotional > 6) return null;

  const diffs = [
    { dim: 'physical' as EnergyDimension, gap: avg - physical },
    { dim: 'mental' as EnergyDimension, gap: avg - mental },
    { dim: 'emotional' as EnergyDimension, gap: avg - emotional },
  ].sort((a, b) => b.gap - a.gap);

  // Se la differenza piu grande e' <1 punto, la fatica e' bilanciata
  if (diffs[0].gap < 1) return 'balanced';
  return diffs[0].dim;
}

// ---------------------------------------------------------------------------
// Analisi fattori
// ---------------------------------------------------------------------------

function analyzeCheckins(checkins: QuickCheckin[]): EnergyFactor[] {
  const factors: EnergyFactor[] = [];

  const waterCheckins = checkins.filter(c => c.type === 'water');
  const totalWater = waterCheckins.reduce((s, c) => s + c.value, 0);
  if (totalWater > 0) {
    const impact = totalWater >= 6 ? 0.5 : totalWater >= 4 ? 0.2 : -0.3;
    factors.push({
      type: 'hydration',
      impact,
      description: totalWater >= 6
        ? `Buona idratazione oggi (${totalWater} bicchieri)`
        : totalWater >= 4
          ? `Idratazione nella media (${totalWater} bicchieri)`
          : `Poca acqua oggi (${totalWater} bicchieri) — potrebbe ridurre l'energia`,
    });
  }

  const caffeineCheckins = checkins.filter(c => c.type === 'caffeine');
  const totalCaffeine = caffeineCheckins.reduce((s, c) => s + c.value, 0);
  if (totalCaffeine > 0) {
    const hour = new Date().getHours();
    const lateHit = totalCaffeine > 0 && hour >= 16;
    const impact = lateHit ? -0.3 : totalCaffeine <= 3 ? 0.2 : -0.1;
    factors.push({
      type: 'caffeine',
      impact,
      description: lateHit
        ? `Caffeina tardi nella giornata (${totalCaffeine} tazzine) — puo disturbare il sonno`
        : totalCaffeine <= 3
          ? `Caffeina moderata (${totalCaffeine} tazzine)`
          : `Molta caffeina oggi (${totalCaffeine} tazzine) — attenzione al crash`,
    });
  }

  const sleepCheckins = checkins.filter(c => c.type === 'sleep_quality');
  if (sleepCheckins.length > 0) {
    const lastSleep = sleepCheckins[sleepCheckins.length - 1].value;
    const impact = lastSleep >= 4 ? 0.6 : lastSleep >= 3 ? 0.1 : -0.5;
    factors.push({
      type: 'sleep',
      impact,
      description: lastSleep >= 4
        ? `Sonno di qualita (${lastSleep}/5) — base solida per oggi`
        : lastSleep >= 3
          ? `Sonno nella media (${lastSleep}/5)`
          : `Sonno scarso (${lastSleep}/5) — energia potrebbe risentirne`,
    });
  }

  const mealCheckins = checkins.filter(c => c.type === 'meal_time');
  if (mealCheckins.length > 0) {
    const lastMeal = mealCheckins[mealCheckins.length - 1].value;
    const impact = lastMeal >= 4 ? 0.3 : lastMeal <= 2 ? -0.3 : 0;
    factors.push({
      type: 'meal',
      impact,
      description: lastMeal >= 4
        ? `Ultimo pasto di qualita (${lastMeal}/5)`
        : lastMeal <= 2
          ? `Ultimo pasto scarso (${lastMeal}/5) — il corpo ha bisogno di nutrienti migliori`
          : `Alimentazione nella media (${lastMeal}/5)`,
    });
  }

  const activityCheckins = checkins.filter(c => c.type === 'activity_done');
  if (activityCheckins.length > 0) {
    const lastActivity = activityCheckins[activityCheckins.length - 1].value;
    const impact = lastActivity >= 3 ? 0.4 : lastActivity === 0 ? -0.2 : 0.1;
    factors.push({
      type: 'activity',
      impact,
      description: lastActivity >= 3
        ? `Buona attivita fisica oggi (${lastActivity}/5) — stimola l'energia`
        : lastActivity === 0
          ? 'Nessuna attivita fisica — il movimento aiuterebbe'
          : `Attivita leggera (${lastActivity}/5)`,
    });
  }

  return factors;
}

function analyzeSahhaScores(scores: SahhaScoreLog[]): EnergyFactor[] {
  const factors: EnergyFactor[] = [];
  for (const s of scores) {
    const pct = Math.round(s.score * 100);
    if (s.type === 'sleep') {
      factors.push({
        type: 'biometric',
        impact: s.score >= 0.7 ? 0.5 : s.score >= 0.4 ? 0 : -0.4,
        description: `Score sonno wearable: ${pct}% (${s.state})`,
      });
    } else if (s.type === 'readiness') {
      factors.push({
        type: 'biometric',
        impact: s.score >= 0.7 ? 0.6 : s.score >= 0.4 ? 0.1 : -0.3,
        description: `Prontezza fisica wearable: ${pct}% (${s.state})`,
      });
    }
  }
  return factors;
}

function analyzeWorkHours(log: EnergyLog): EnergyFactor[] {
  if (log.workHoursToday == null) return [];
  const hours = log.workHoursToday;
  const impact = hours > 10 ? -0.6 : hours > 8 ? -0.2 : hours <= 6 ? 0.2 : 0;
  return [{
    type: 'work_hours',
    impact,
    description: hours > 10
      ? `Giornata lunga (${hours}h di lavoro) — rischio overload`
      : hours > 8
        ? `Lavoro sopra la media (${hours}h) — pianifica pause`
        : `Ore di lavoro nella norma (${hours}h)`,
  }];
}

// ---------------------------------------------------------------------------
// API pubblica
// ---------------------------------------------------------------------------

/**
 * Valuta lo stato energetico corrente di un utente aggregando tutte le fonti dati.
 */
export async function assessEnergyState(userId: number): Promise<EnergyState> {
  const today = todayString();
  const yesterday = yesterdayString();

  // Carica dati in parallelo
  const [todayLog, yesterdayLog, todayCheckins, sahhaScores] = await Promise.all([
    db.energyLogs.where('[userId+date]').equals([userId, today]).first(),
    db.energyLogs.where('[userId+date]').equals([userId, yesterday]).first(),
    db.quickCheckins.where('[userId+date]').equals([userId, today]).toArray(),
    db.sahhaScores.where('userId').equals(userId).toArray(),
  ]);

  // Valori energetici: usa log di oggi, oppure stima dai check-in
  let physical = 5;
  let mental = 5;
  let emotional = 5;

  if (todayLog) {
    physical = todayLog.physical;
    mental = todayLog.mental;
    emotional = todayLog.emotional;
  }

  // Calcolo overall con pesi basati sulla fascia oraria
  const timeSlot = getCurrentTimeSlot();
  const weights = getTimeSlotWeights(timeSlot);
  const overall = Math.round(
    (physical * weights.physical + mental * weights.mental + emotional * weights.emotional) * 10
  ) / 10;

  // Trend rispetto a ieri
  let trendVsYesterday = 0;
  if (yesterdayLog) {
    const yesterdayOverall =
      (yesterdayLog.physical * weights.physical +
        yesterdayLog.mental * weights.mental +
        yesterdayLog.emotional * weights.emotional);
    trendVsYesterday = Math.round(((overall - yesterdayOverall) / 10) * 100) / 100;
    // Clamp tra -1 e 1
    trendVsYesterday = Math.max(-1, Math.min(1, trendVsYesterday));
  }

  // Fattori che influenzano l'energia
  const factors: EnergyFactor[] = [
    ...analyzeCheckins(todayCheckins),
    ...analyzeSahhaScores(sahhaScores.slice(-5)), // ultimi 5 scores
    ...(todayLog ? analyzeWorkHours(todayLog) : []),
  ];

  return {
    assessedAt: new Date(),
    physical,
    mental,
    emotional,
    overall,
    level: classifyLevel(overall),
    timeSlot,
    trendVsYesterday,
    factors,
    dominantFatigue: detectDominantFatigue(physical, mental, emotional),
  };
}

/**
 * Pesi per il calcolo dell'energia complessiva in base alla fascia oraria.
 * Mattina: piu peso al fisico (inizio giornata).
 * Pomeriggio: piu peso al mentale (lavoro cognitivo).
 * Sera: piu peso all'emotivo (recupero, relazioni).
 */
function getTimeSlotWeights(timeSlot: TimeSlot): {
  physical: number;
  mental: number;
  emotional: number;
} {
  switch (timeSlot) {
    case 'early_morning':
    case 'morning':
      return { physical: 0.4, mental: 0.35, emotional: 0.25 };
    case 'midday':
      return { physical: 0.33, mental: 0.34, emotional: 0.33 };
    case 'afternoon':
      return { physical: 0.25, mental: 0.45, emotional: 0.30 };
    case 'evening':
      return { physical: 0.25, mental: 0.25, emotional: 0.50 };
    case 'night':
      return { physical: 0.30, mental: 0.20, emotional: 0.50 };
  }
}
