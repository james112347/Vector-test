// ---------------------------------------------------------------------------
// ML / Prediction Engine — Intelligence layer for Vector
//
// Analyzes historical data to find patterns, predict trends, and generate
// actionable intelligence. All computation is on-device (no API calls).
//
// Capabilities:
//   1. Pattern Detection: weekly/monthly energy, sleep, stress cycles
//   2. Trend Analysis: 7/14/30 day rolling trends with highlights
//   3. Correlation Discovery: Pearson correlations between lifestyle factors
//   4. Predictive Intelligence: energy forecasts, crash warnings, goal projections
//   5. Weekly Intelligence Report: comprehensive weekly summary
//
// Statistics: linear regression, Pearson correlation, moving averages, z-scores
// All user-facing strings in Italian.
// ---------------------------------------------------------------------------

import { db } from '../db/db';
import type {
  FoodLog,
  ScientificEnergyScore,
  UserProfile,
  Goal,
  GoalLog,
  CheckinType,
} from '../db/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DetectedPattern {
  type: 'energy_cycle' | 'sleep_pattern' | 'stress_cycle' | 'productivity_window' | 'crash_pattern';
  description: string;
  confidence: number;
  dayOfWeek?: number[];
  timeWindow?: { start: string; end: string };
  recommendation: string;
}

export interface TrendAnalysis {
  period: '7d' | '14d' | '30d';
  energyTrend: 'improving' | 'stable' | 'declining';
  energySlope: number;
  sleepTrend: 'improving' | 'stable' | 'declining';
  stressTrend: 'improving' | 'stable' | 'declining';
  moodTrend: 'improving' | 'stable' | 'declining';
  hydrationTrend: 'improving' | 'stable' | 'declining';
  highlights: TrendHighlight[];
}

export interface TrendHighlight {
  metric: string;
  change: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  insight: string;
}

export interface Correlation {
  factorA: string;
  factorB: string;
  strength: number;
  direction: 'positive' | 'negative';
  explanation: string;
  actionable: boolean;
}

export interface Prediction {
  type: 'energy_forecast' | 'crash_warning' | 'optimal_action' | 'goal_projection';
  title: string;
  body: string;
  confidence: number;
  urgency: 'low' | 'medium' | 'high';
  timeHorizon: string;
}

export interface WeeklyReport {
  weekOf: string;
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  energyAvg: number;
  bestDay: { day: string; score: number; reason: string };
  worstDay: { day: string; score: number; reason: string };
  patterns: DetectedPattern[];
  trends: TrendAnalysis;
  correlations: Correlation[];
  predictions: Prediction[];
  topInsight: string;
  actionItems: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const DAY_NAMES_IT = ['Domenica', 'Lunedi', 'Martedi', 'Mercoledi', 'Giovedi', 'Venerdi', 'Sabato'];
const DAY_NAMES_SHORT_IT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function dateToDayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T12:00:00').getDay();
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function timeToDecimal(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  return (parts[0] ?? 0) + ((parts[1] ?? 0) / 60);
}

function decimalToTime(d: number): string {
  const h = Math.floor(d);
  const m = Math.round((d - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Pearson correlation coefficient for paired arrays. Returns 0 if insufficient data. */
function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return 0;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i];
    const y = ys[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (denom === 0) return 0;
  return clamp((n * sumXY - sumX * sumY) / denom, -1, 1);
}

/** Simple linear regression: returns { slope, intercept, r2 }. */
function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number; r2: number } {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, r2: 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
    sumXY += xs[i] * ys[i];
    sumX2 += xs[i] * xs[i];
  }

  const denomX = n * sumX2 - sumX * sumX;
  if (denomX === 0) return { slope: 0, intercept: sumY / n, r2: 0 };

  const slope = (n * sumXY - sumX * sumY) / denomX;
  const intercept = (sumY - slope * sumX) / n;

  // R-squared
  const meanY = sumY / n;
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = slope * xs[i] + intercept;
    ssRes += (ys[i] - predicted) ** 2;
    ssTot += (ys[i] - meanY) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : clamp(1 - ssRes / ssTot, 0, 1);

  return { slope, intercept, r2 };
}

/** Mean and standard deviation of an array. */
function stats(arr: number[]): { mean: number; std: number } {
  if (arr.length === 0) return { mean: 0, std: 0 };
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
  return { mean, std: Math.sqrt(variance) };
}

/** Z-score for a value given mean and std. */
function zScore(value: number, mean: number, std: number): number {
  if (std === 0) return 0;
  return (value - mean) / std;
}

/** Moving average with given window size. */
function movingAverage(arr: number[], window: number): number[] {
  if (arr.length === 0) return [];
  const result: number[] = [];
  for (let i = 0; i < arr.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = arr.slice(start, i + 1);
    result.push(slice.reduce((s, v) => s + v, 0) / slice.length);
  }
  return result;
}

function slopeToTrend(slope: number, threshold: number = 0.05): 'improving' | 'stable' | 'declining' {
  if (slope > threshold) return 'improving';
  if (slope < -threshold) return 'declining';
  return 'stable';
}

function percentChange(oldVal: number, newVal: number): number {
  if (oldVal === 0) return newVal > 0 ? 100 : 0;
  return ((newVal - oldVal) / Math.abs(oldVal)) * 100;
}

// ---------------------------------------------------------------------------
// Data gathering
// ---------------------------------------------------------------------------

interface DailySnapshot {
  date: string;
  dayOfWeek: number;
  // Energy
  energyOverall: number | null;
  energyCircadian: number | null;
  energySleep: number | null;
  energyLifestyle: number | null;
  energyAllostatic: number | null;
  // From EnergyLog
  physical: number | null;
  mental: number | null;
  emotional: number | null;
  // Checkins
  sleepQuality: number | null;
  water: number;
  caffeine: number;
  caffeineLatest: number | null; // hour of last caffeine
  mealQuality: number | null;
  focus: number | null;
  activity: number | null;
  stress: number | null;
  mood: number | null;
  screenBreaks: number;
  // Food
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealsLogged: number;
  // Goal
  goalsAchieved: number;
  goalsTotal: number;
}

async function gatherSnapshots(userId: number, days: number): Promise<DailySnapshot[]> {
  const startDate = daysAgoStr(days);
  const today = todayStr();

  // Fetch all data in parallel
  const [
    checkins,
    energyLogs,
    foodLogs,
    scientificScores,
    goalLogs,
  ] = await Promise.all([
    db.quickCheckins.where('userId').equals(userId)
      .and(c => c.date >= startDate && c.date <= today).toArray(),
    db.energyLogs.where('userId').equals(userId)
      .and(l => l.date >= startDate && l.date <= today).toArray(),
    db.foodLogs.where('userId').equals(userId)
      .and(f => f.date >= startDate && f.date <= today).toArray().catch(() => [] as FoodLog[]),
    db.scientificEnergyScores.where('userId').equals(userId)
      .and(s => s.date >= startDate && s.date <= today).toArray().catch(() => [] as ScientificEnergyScore[]),
    db.goalLogs.where('userId').equals(userId)
      .and(l => l.date >= startDate && l.date <= today).toArray().catch(() => [] as GoalLog[]),
  ]);

  // Group by date
  const checkinsByDate = groupBy(checkins, c => c.date);
  const energyByDate = groupBy(energyLogs, l => l.date);
  const foodByDate = groupBy(foodLogs, f => f.date);
  const scoresByDate = groupBy(scientificScores, s => s.date);
  const goalLogsByDate = groupBy(goalLogs, l => l.date);

  // Build daily snapshots
  const snapshots: DailySnapshot[] = [];
  const current = new Date(startDate + 'T12:00:00');
  const end = new Date(today + 'T12:00:00');

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    const dow = current.getDay();

    const dayCheckins = checkinsByDate.get(dateStr) ?? [];
    const dayEnergy = energyByDate.get(dateStr) ?? [];
    const dayFood = foodByDate.get(dateStr) ?? [];
    const dayScores = scoresByDate.get(dateStr) ?? [];
    const dayGoalLogs = goalLogsByDate.get(dateStr) ?? [];

    // Checkin helpers
    const lastCheckin = (type: CheckinType): number | null => {
      const filtered = dayCheckins.filter(c => c.type === type);
      return filtered.length > 0 ? filtered[filtered.length - 1].value : null;
    };
    const sumCheckin = (type: CheckinType): number =>
      dayCheckins.filter(c => c.type === type).reduce((s, c) => s + c.value, 0);

    // Latest caffeine time
    const cafCheckins = dayCheckins.filter(c => c.type === 'caffeine');
    const caffeineLatest = cafCheckins.length > 0
      ? timeToDecimal(cafCheckins[cafCheckins.length - 1].time)
      : null;

    // Scientific score (take latest of the day)
    const sortedScores = [...dayScores].sort((a, b) => a.time.localeCompare(b.time));
    const latestScore = sortedScores.length > 0 ? sortedScores[sortedScores.length - 1] : null;

    // Energy log
    const elog = dayEnergy.length > 0 ? dayEnergy[0] : null;

    // Food totals
    const totalCalories = dayFood.reduce((s, f) => s + f.totalCalories, 0);
    const totalProtein = dayFood.reduce((s, f) => s + f.totalProtein, 0);
    const totalCarbs = dayFood.reduce((s, f) => s + f.totalCarbs, 0);
    const totalFat = dayFood.reduce((s, f) => s + f.totalFat, 0);

    snapshots.push({
      date: dateStr,
      dayOfWeek: dow,
      energyOverall: latestScore?.overallScore ?? null,
      energyCircadian: latestScore?.circadianScore ?? null,
      energySleep: latestScore?.sleepScore ?? null,
      energyLifestyle: latestScore?.lifestyleScore ?? null,
      energyAllostatic: latestScore?.allostaticScore ?? null,
      physical: elog?.physical ?? null,
      mental: elog?.mental ?? null,
      emotional: elog?.emotional ?? null,
      sleepQuality: lastCheckin('sleep_quality'),
      water: sumCheckin('water'),
      caffeine: sumCheckin('caffeine'),
      caffeineLatest,
      mealQuality: lastCheckin('meal_time'),
      focus: lastCheckin('focus'),
      activity: lastCheckin('activity_done'),
      stress: lastCheckin('stress'),
      mood: lastCheckin('mood'),
      screenBreaks: sumCheckin('screen_break'),
      calories: totalCalories,
      protein: totalProtein,
      carbs: totalCarbs,
      fat: totalFat,
      mealsLogged: dayFood.length,
      goalsAchieved: dayGoalLogs.filter(l => l.achieved).length,
      goalsTotal: dayGoalLogs.length,
    });

    current.setDate(current.getDate() + 1);
  }

  return snapshots;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const arr = map.get(key) ?? [];
    arr.push(item);
    map.set(key, arr);
  }
  return map;
}

/** Get snapshots with at least one data point (energy or checkin). */
function filterPopulated(snapshots: DailySnapshot[]): DailySnapshot[] {
  return snapshots.filter(s =>
    s.energyOverall !== null ||
    s.physical !== null ||
    s.sleepQuality !== null ||
    s.water > 0 ||
    s.stress !== null ||
    s.mood !== null
  );
}

/** Get a composite energy score from whatever is available for a day. */
function compositeEnergy(s: DailySnapshot): number | null {
  if (s.energyOverall !== null) return s.energyOverall;
  if (s.physical !== null && s.mental !== null && s.emotional !== null) {
    return Math.round(((s.physical + s.mental + s.emotional) / 3) * 10);
  }
  return null;
}

// ---------------------------------------------------------------------------
// 1. Pattern Detection
// ---------------------------------------------------------------------------

export async function analyzePatterns(userId: number, days: number = 30): Promise<DetectedPattern[]> {
  const snapshots = await gatherSnapshots(userId, days);
  const populated = filterPopulated(snapshots);

  if (populated.length < 7) {
    return [];
  }

  const patterns: DetectedPattern[] = [];

  // --- Energy by day of week ---
  detectDayOfWeekEnergy(populated, patterns);

  // --- Productivity time windows ---
  await detectProductivityWindows(userId, days, patterns);

  // --- Crash patterns ---
  detectCrashPatterns(populated, patterns);

  // --- Sleep quality correlations ---
  detectSleepPatterns(populated, patterns);

  // --- Stress accumulation ---
  detectStressCycles(populated, patterns);

  return patterns;
}

function detectDayOfWeekEnergy(snapshots: DailySnapshot[], patterns: DetectedPattern[]): void {
  // Group energy scores by day of week
  const byDow: Map<number, number[]> = new Map();
  for (const s of snapshots) {
    const energy = compositeEnergy(s);
    if (energy === null) continue;
    const arr = byDow.get(s.dayOfWeek) ?? [];
    arr.push(energy);
    byDow.set(s.dayOfWeek, arr);
  }

  if (byDow.size < 3) return;

  // Compute average per day
  const avgByDow: Map<number, number> = new Map();
  for (const [dow, vals] of byDow) {
    if (vals.length < 1) continue;
    avgByDow.set(dow, vals.reduce((s, v) => s + v, 0) / vals.length);
  }

  const allAvgs = [...avgByDow.values()];
  const overall = stats(allAvgs);
  if (overall.std < 2) return; // not enough variation

  // Best days
  const bestDays: number[] = [];
  const worstDays: number[] = [];
  for (const [dow, avg] of avgByDow) {
    const z = zScore(avg, overall.mean, overall.std);
    if (z > 0.8) bestDays.push(dow);
    if (z < -0.8) worstDays.push(dow);
  }

  if (bestDays.length > 0) {
    const bestNames = bestDays.map(d => DAY_NAMES_IT[d]).join(', ');
    const confidence = clamp(0.5 + overall.std / 20, 0.3, 0.95);
    patterns.push({
      type: 'energy_cycle',
      description: `I tuoi giorni migliori per energia sono: ${bestNames}`,
      confidence,
      dayOfWeek: bestDays,
      recommendation: `Pianifica le attivita importanti di ${bestNames.toLowerCase()} quando la tua energia e piu alta.`,
    });
  }

  if (worstDays.length > 0) {
    const worstNames = worstDays.map(d => DAY_NAMES_IT[d]).join(', ');
    const confidence = clamp(0.5 + overall.std / 20, 0.3, 0.95);
    patterns.push({
      type: 'energy_cycle',
      description: `I tuoi giorni piu difficili sono: ${worstNames}`,
      confidence,
      dayOfWeek: worstDays,
      recommendation: `Il ${worstNames.toLowerCase()} riduci il carico e programma attivita leggere o di recupero.`,
    });
  }
}

async function detectProductivityWindows(userId: number, days: number, patterns: DetectedPattern[]): Promise<void> {
  const startDate = daysAgoStr(days);
  const today = todayStr();

  // Get focus checkins with time info
  const focusCheckins = await db.quickCheckins.where('userId').equals(userId)
    .and(c => c.date >= startDate && c.date <= today && c.type === 'focus')
    .toArray();

  if (focusCheckins.length < 5) return;

  // Group focus by hour
  const byHour: Map<number, number[]> = new Map();
  for (const c of focusCheckins) {
    const hour = Math.floor(timeToDecimal(c.time));
    const arr = byHour.get(hour) ?? [];
    arr.push(c.value);
    byHour.set(hour, arr);
  }

  // Find peak focus hours
  let bestHour = -1;
  let bestAvg = 0;
  for (const [hour, vals] of byHour) {
    if (vals.length < 2) continue;
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestHour = hour;
    }
  }

  if (bestHour >= 0 && bestAvg >= 3.5) {
    // Expand to a window (check adjacent hours)
    let windowStart = bestHour;
    let windowEnd = bestHour + 1;

    const prevHour = byHour.get(bestHour - 1);
    if (prevHour && prevHour.length >= 1) {
      const prevAvg = prevHour.reduce((s, v) => s + v, 0) / prevHour.length;
      if (prevAvg >= bestAvg * 0.8) windowStart = bestHour - 1;
    }

    const nextHour = byHour.get(bestHour + 1);
    if (nextHour && nextHour.length >= 1) {
      const nextAvg = nextHour.reduce((s, v) => s + v, 0) / nextHour.length;
      if (nextAvg >= bestAvg * 0.8) windowEnd = bestHour + 2;
    }

    const confidence = clamp(0.4 + (focusCheckins.length / 30) * 0.4, 0.3, 0.9);

    patterns.push({
      type: 'productivity_window',
      description: `La tua finestra di massima concentrazione e tra le ${decimalToTime(windowStart)} e le ${decimalToTime(windowEnd)}`,
      confidence,
      timeWindow: { start: decimalToTime(windowStart), end: decimalToTime(windowEnd) },
      recommendation: `Programma il lavoro profondo e le decisioni importanti tra le ${decimalToTime(windowStart)} e le ${decimalToTime(windowEnd)}.`,
    });
  }
}

function detectCrashPatterns(snapshots: DailySnapshot[], patterns: DetectedPattern[]): void {
  // Look for recurring energy drops on specific days
  const energyByDow: Map<number, number[]> = new Map();
  for (const s of snapshots) {
    const energy = compositeEnergy(s);
    if (energy === null) continue;
    const arr = energyByDow.get(s.dayOfWeek) ?? [];
    arr.push(energy);
    energyByDow.set(s.dayOfWeek, arr);
  }

  const allEnergies: number[] = [];
  for (const s of snapshots) {
    const e = compositeEnergy(s);
    if (e !== null) allEnergies.push(e);
  }
  if (allEnergies.length < 5) return;

  const overallStats = stats(allEnergies);
  const crashThreshold = overallStats.mean - overallStats.std;

  // Find days with consistent crashes
  for (const [dow, vals] of energyByDow) {
    if (vals.length < 2) continue;
    const crashCount = vals.filter(v => v < crashThreshold).length;
    const crashRate = crashCount / vals.length;

    if (crashRate >= 0.5 && crashCount >= 2) {
      const dayName = DAY_NAMES_IT[dow];
      const avgEnergy = vals.reduce((s, v) => s + v, 0) / vals.length;
      const confidence = clamp(crashRate * 0.8, 0.3, 0.9);

      patterns.push({
        type: 'crash_pattern',
        description: `Il ${dayName.toLowerCase()} la tua energia cala spesso (media ${Math.round(avgEnergy)} vs ${Math.round(overallStats.mean)} generale)`,
        confidence,
        dayOfWeek: [dow],
        recommendation: `Il ${dayName.toLowerCase()} prevedi pause extra, pasti bilanciati e riduci gli impegni pesanti.`,
      });
    }
  }
}

function detectSleepPatterns(snapshots: DailySnapshot[], patterns: DetectedPattern[]): void {
  // Correlate previous night's sleep quality with next-day energy
  const pairs: { sleep: number; energy: number; date: string }[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    const prevSleep = snapshots[i - 1].sleepQuality;
    // sleep_quality for day i is reported on day i (about the previous night), not on day i-1
    // Actually, in this app sleep_quality is logged in the morning about the previous night
    // So snapshots[i].sleepQuality predicts snapshots[i].energy
    const todaySleep = snapshots[i].sleepQuality;
    const todayEnergy = compositeEnergy(snapshots[i]);

    if (todaySleep !== null && todayEnergy !== null) {
      pairs.push({ sleep: todaySleep, energy: todayEnergy, date: snapshots[i].date });
    } else if (prevSleep !== null && todayEnergy !== null) {
      // Fallback: use previous day's sleep checkin as proxy
      pairs.push({ sleep: prevSleep, energy: todayEnergy, date: snapshots[i].date });
    }
  }

  if (pairs.length < 5) return;

  const r = pearson(pairs.map(p => p.sleep), pairs.map(p => p.energy));

  if (Math.abs(r) > 0.3) {
    // Identify what predicts good sleep
    const goodSleep = pairs.filter(p => p.sleep >= 4);
    const badSleep = pairs.filter(p => p.sleep <= 2);

    let detail = '';
    if (goodSleep.length > 0 && badSleep.length > 0) {
      const avgGoodEnergy = goodSleep.reduce((s, p) => s + p.energy, 0) / goodSleep.length;
      const avgBadEnergy = badSleep.reduce((s, p) => s + p.energy, 0) / badSleep.length;
      const diff = Math.round(avgGoodEnergy - avgBadEnergy);
      detail = ` Quando dormi bene, la tua energia e in media ${diff} punti piu alta.`;
    }

    const confidence = clamp(Math.abs(r), 0.3, 0.95);

    patterns.push({
      type: 'sleep_pattern',
      description: `Il sonno ha un impatto ${r > 0.5 ? 'molto forte' : 'significativo'} sulla tua energia.${detail}`,
      confidence,
      recommendation: 'Prioritizza la qualita del sonno: orario regolare, niente schermi 1h prima, camera fresca e buia.',
    });
  }

  // Check if specific days have worse sleep
  const sleepByDow: Map<number, number[]> = new Map();
  for (const s of snapshots) {
    if (s.sleepQuality === null) continue;
    const arr = sleepByDow.get(s.dayOfWeek) ?? [];
    arr.push(s.sleepQuality);
    sleepByDow.set(s.dayOfWeek, arr);
  }

  const allSleep = snapshots.map(s => s.sleepQuality).filter((v): v is number => v !== null);
  if (allSleep.length < 5) return;
  const sleepStats = stats(allSleep);

  for (const [dow, vals] of sleepByDow) {
    if (vals.length < 2) continue;
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    const z = zScore(avg, sleepStats.mean, sleepStats.std);

    if (z < -0.8) {
      const dayName = DAY_NAMES_IT[dow];
      // The previous day is when the behavior happened
      const prevDow = (dow + 6) % 7;
      const prevDayName = DAY_NAMES_IT[prevDow];

      patterns.push({
        type: 'sleep_pattern',
        description: `Dormi peggio la notte tra ${prevDayName.toLowerCase()} e ${dayName.toLowerCase()} (media ${avg.toFixed(1)}/5)`,
        confidence: clamp(0.4 + vals.length / 15, 0.3, 0.85),
        dayOfWeek: [dow],
        recommendation: `Il ${prevDayName.toLowerCase()} sera evita stimoli, caffeina tardiva e schermi per migliorare il sonno.`,
      });
    }
  }
}

function detectStressCycles(snapshots: DailySnapshot[], patterns: DetectedPattern[]): void {
  // Look for stress accumulation patterns (3+ consecutive high stress days)
  const stressValues: { date: string; value: number }[] = [];
  for (const s of snapshots) {
    if (s.stress !== null) {
      stressValues.push({ date: s.date, value: s.stress });
    }
  }

  if (stressValues.length < 5) return;

  // Detect consecutive high-stress streaks
  let maxStreak = 0;
  let currentStreak = 0;
  let streakStart = '';
  const streaks: { start: string; length: number }[] = [];

  for (const sv of stressValues) {
    if (sv.value >= 4) {
      if (currentStreak === 0) streakStart = sv.date;
      currentStreak++;
    } else {
      if (currentStreak >= 3) {
        streaks.push({ start: streakStart, length: currentStreak });
      }
      if (currentStreak > maxStreak) maxStreak = currentStreak;
      currentStreak = 0;
    }
  }
  if (currentStreak >= 3) {
    streaks.push({ start: streakStart, length: currentStreak });
  }
  if (currentStreak > maxStreak) maxStreak = currentStreak;

  if (maxStreak >= 3) {
    patterns.push({
      type: 'stress_cycle',
      description: `Hai avuto ${streaks.length} periodo/i di stress elevato continuativo (fino a ${maxStreak} giorni consecutivi)`,
      confidence: clamp(0.5 + maxStreak * 0.1, 0.4, 0.9),
      recommendation: 'Dopo 2 giorni di stress alto, inserisci una sessione di recupero attivo: camminata, respirazione o mindfulness.',
    });
  }

  // Stress by day of week
  const stressByDow: Map<number, number[]> = new Map();
  for (const s of snapshots) {
    if (s.stress === null) continue;
    const arr = stressByDow.get(s.dayOfWeek) ?? [];
    arr.push(s.stress);
    stressByDow.set(s.dayOfWeek, arr);
  }

  const allStress = stressValues.map(sv => sv.value);
  const stressOverall = stats(allStress);

  const highStressDays: number[] = [];
  for (const [dow, vals] of stressByDow) {
    if (vals.length < 2) continue;
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    if (zScore(avg, stressOverall.mean, stressOverall.std) > 0.8) {
      highStressDays.push(dow);
    }
  }

  if (highStressDays.length > 0) {
    const dayNames = highStressDays.map(d => DAY_NAMES_IT[d]).join(', ');
    patterns.push({
      type: 'stress_cycle',
      description: `Lo stress e piu alto il ${dayNames.toLowerCase()}`,
      confidence: clamp(0.4 + highStressDays.length * 0.1, 0.3, 0.85),
      dayOfWeek: highStressDays,
      recommendation: `Prevedi tecniche di gestione stress (respirazione, pause) soprattutto il ${dayNames.toLowerCase()}.`,
    });
  }
}

// ---------------------------------------------------------------------------
// 2. Trend Analysis
// ---------------------------------------------------------------------------

export async function analyzeTrends(userId: number, period: '7d' | '14d' | '30d'): Promise<TrendAnalysis> {
  const days = period === '7d' ? 7 : period === '14d' ? 14 : 30;
  const snapshots = await gatherSnapshots(userId, days);

  // We need the comparison period too
  const compDays = days * 2;
  const allSnapshots = days < compDays
    ? await gatherSnapshots(userId, compDays)
    : snapshots;

  const recentSnapshots = allSnapshots.filter(s => s.date >= daysAgoStr(days));
  const previousSnapshots = allSnapshots.filter(s => s.date < daysAgoStr(days) && s.date >= daysAgoStr(compDays));

  // Energy trend
  const energyValues = recentSnapshots
    .map(s => compositeEnergy(s))
    .filter((v): v is number => v !== null);

  const xIndices = energyValues.map((_, i) => i);
  const energyReg = linearRegression(xIndices, energyValues);
  const normalizedSlope = energyValues.length > 0
    ? energyReg.slope / (stats(energyValues).mean || 1)
    : 0;

  // Per-metric trends using simple slope
  const computeMetricTrend = (extractor: (s: DailySnapshot) => number | null): {
    trend: 'improving' | 'stable' | 'declining';
    slope: number;
    recentAvg: number;
    previousAvg: number;
  } => {
    const recent = recentSnapshots.map(extractor).filter((v): v is number => v !== null);
    const previous = previousSnapshots.map(extractor).filter((v): v is number => v !== null);

    const recentAvg = recent.length > 0 ? recent.reduce((s, v) => s + v, 0) / recent.length : 0;
    const previousAvg = previous.length > 0 ? previous.reduce((s, v) => s + v, 0) / previous.length : 0;

    const reg = linearRegression(recent.map((_, i) => i), recent);
    const normalizedS = recentAvg !== 0 ? reg.slope / recentAvg : 0;

    return {
      trend: slopeToTrend(normalizedS, 0.03),
      slope: normalizedS,
      recentAvg,
      previousAvg,
    };
  };

  // Sleep: higher = better, so positive slope = improving
  const sleepMetric = computeMetricTrend(s => s.sleepQuality);
  // Stress: higher = worse, so positive slope = declining (invert)
  const stressMetric = computeMetricTrend(s => s.stress);
  const stressTrend: 'improving' | 'stable' | 'declining' =
    stressMetric.trend === 'improving' ? 'declining' :
    stressMetric.trend === 'declining' ? 'improving' :
    'stable';
  // Mood: higher = better
  const moodMetric = computeMetricTrend(s => s.mood);
  // Hydration: higher = better
  const waterMetric = computeMetricTrend(s => s.water > 0 ? s.water : null);

  // Highlights
  const highlights: TrendHighlight[] = [];

  // Energy highlight
  if (energyValues.length >= 3) {
    const prevEnergy = previousSnapshots
      .map(s => compositeEnergy(s))
      .filter((v): v is number => v !== null);
    if (prevEnergy.length > 0) {
      const recentEAvg = stats(energyValues).mean;
      const prevEAvg = stats(prevEnergy).mean;
      const change = percentChange(prevEAvg, recentEAvg);
      if (Math.abs(change) >= 3) {
        const periodLabel = period === '7d' ? 'settimana scorsa' : period === '14d' ? '2 settimane fa' : 'mese scorso';
        highlights.push({
          metric: 'Energia',
          change: `${change > 0 ? '+' : ''}${Math.round(change)}% vs ${periodLabel}`,
          sentiment: change > 5 ? 'positive' : change < -5 ? 'negative' : 'neutral',
          insight: change > 5
            ? 'La tua energia sta migliorando. Continua con le abitudini attuali.'
            : change < -5
              ? 'La tua energia e in calo. Controlla sonno, idratazione e stress.'
              : 'Energia stabile rispetto al periodo precedente.',
        });
      }
    }
  }

  // Sleep highlight
  if (sleepMetric.recentAvg > 0 && sleepMetric.previousAvg > 0) {
    const change = percentChange(sleepMetric.previousAvg, sleepMetric.recentAvg);
    if (Math.abs(change) >= 5) {
      const periodLabel = period === '7d' ? 'settimana scorsa' : period === '14d' ? '2 settimane fa' : 'mese scorso';
      highlights.push({
        metric: 'Sonno',
        change: `${change > 0 ? '+' : ''}${Math.round(change)}% vs ${periodLabel}`,
        sentiment: change > 5 ? 'positive' : change < -5 ? 'negative' : 'neutral',
        insight: change > 5
          ? 'La qualita del sonno sta migliorando, ottimo lavoro!'
          : 'La qualita del sonno e peggiorata. Rivedi la routine serale.',
      });
    }
  }

  // Water highlight
  if (waterMetric.recentAvg > 0 && waterMetric.previousAvg > 0) {
    const change = percentChange(waterMetric.previousAvg, waterMetric.recentAvg);
    if (Math.abs(change) >= 10) {
      highlights.push({
        metric: 'Idratazione',
        change: `${change > 0 ? '+' : ''}${Math.round(change)}% in questo periodo`,
        sentiment: change > 10 ? 'positive' : change < -10 ? 'negative' : 'neutral',
        insight: change > 0
          ? 'Stai bevendo di piu, questo aiuta concentrazione ed energia.'
          : 'L\'idratazione e calata. Ricorda di bere almeno 8 bicchieri al giorno.',
      });
    }
  }

  // Stress highlight
  if (stressMetric.recentAvg > 0 && stressMetric.previousAvg > 0) {
    const change = percentChange(stressMetric.previousAvg, stressMetric.recentAvg);
    if (Math.abs(change) >= 10) {
      highlights.push({
        metric: 'Stress',
        change: `${change > 0 ? '+' : ''}${Math.round(change)}% in questo periodo`,
        sentiment: change > 10 ? 'negative' : change < -10 ? 'positive' : 'neutral',
        insight: change > 10
          ? 'Lo stress e aumentato. Considera tecniche di rilassamento e pause piu frequenti.'
          : 'Lo stress si sta riducendo, continua cosi!',
      });
    }
  }

  // Mood highlight
  if (moodMetric.recentAvg > 0 && moodMetric.previousAvg > 0) {
    const change = percentChange(moodMetric.previousAvg, moodMetric.recentAvg);
    if (Math.abs(change) >= 8) {
      highlights.push({
        metric: 'Umore',
        change: `${change > 0 ? '+' : ''}${Math.round(change)}% in questo periodo`,
        sentiment: change > 5 ? 'positive' : change < -5 ? 'negative' : 'neutral',
        insight: change > 0
          ? 'Il tuo umore sta migliorando.'
          : 'L\'umore e in calo. Movimento fisico e socializzazione possono aiutare.',
      });
    }
  }

  return {
    period,
    energyTrend: slopeToTrend(normalizedSlope),
    energySlope: Math.round(normalizedSlope * 1000) / 1000,
    sleepTrend: sleepMetric.trend,
    stressTrend,
    moodTrend: moodMetric.trend,
    hydrationTrend: waterMetric.trend,
    highlights,
  };
}

// ---------------------------------------------------------------------------
// 3. Correlation Discovery
// ---------------------------------------------------------------------------

export async function findCorrelations(userId: number, days: number = 30): Promise<Correlation[]> {
  const snapshots = await gatherSnapshots(userId, days);
  const populated = filterPopulated(snapshots);

  if (populated.length < 7) {
    return [];
  }

  const correlations: Correlation[] = [];

  // Define factor pairs to test
  const factorPairs: {
    nameA: string;
    nameB: string;
    extractA: (s: DailySnapshot) => number | null;
    extractB: (s: DailySnapshot) => number | null;
    explainPositive: string;
    explainNegative: string;
    actionable: boolean;
    threshold: number;
    // For shifted correlations (e.g. sleep -> next day energy), set to true
    shifted?: boolean;
  }[] = [
    {
      nameA: 'Idratazione',
      nameB: 'Focus',
      extractA: s => s.water > 0 ? s.water : null,
      extractB: s => s.focus,
      explainPositive: 'Quando bevi piu acqua, la tua concentrazione migliora',
      explainNegative: 'L\'idratazione non sembra influire sul tuo focus',
      actionable: true,
      threshold: 0.25,
    },
    {
      nameA: 'Idratazione',
      nameB: 'Energia',
      extractA: s => s.water > 0 ? s.water : null,
      extractB: s => compositeEnergy(s),
      explainPositive: 'Piu bevi, piu energia hai durante la giornata',
      explainNegative: 'Bere poco potrebbe abbassare la tua energia',
      actionable: true,
      threshold: 0.2,
    },
    {
      nameA: 'Qualita sonno',
      nameB: 'Energia del giorno',
      extractA: s => s.sleepQuality,
      extractB: s => compositeEnergy(s),
      explainPositive: 'Dormire bene porta piu energia il giorno dopo',
      explainNegative: 'Dormire male abbassa significativamente la tua energia',
      actionable: true,
      threshold: 0.2,
    },
    {
      nameA: 'Caffeina',
      nameB: 'Qualita sonno (giorno dopo)',
      extractA: s => s.caffeine > 0 ? s.caffeine : null,
      extractB: s => s.sleepQuality,
      explainPositive: 'La caffeina non sembra disturbare il tuo sonno',
      explainNegative: 'Piu caffeina bevi, peggio dormi la notte',
      actionable: true,
      threshold: 0.2,
      shifted: true,
    },
    {
      nameA: 'Attivita fisica',
      nameB: 'Umore',
      extractA: s => s.activity,
      extractB: s => s.mood,
      explainPositive: 'L\'esercizio fisico migliora il tuo umore',
      explainNegative: 'L\'attivita fisica non sembra influenzare il tuo umore',
      actionable: true,
      threshold: 0.25,
    },
    {
      nameA: 'Attivita fisica',
      nameB: 'Stress',
      extractA: s => s.activity,
      extractB: s => s.stress !== null ? (6 - s.stress) : null, // invert: less stress = better
      explainPositive: 'L\'attivita fisica aiuta a ridurre il tuo stress',
      explainNegative: 'L\'attivita fisica non sembra ridurre il tuo stress',
      actionable: true,
      threshold: 0.2,
    },
    {
      nameA: 'Qualita pasti',
      nameB: 'Energia pomeridiana',
      extractA: s => s.mealQuality,
      extractB: s => compositeEnergy(s),
      explainPositive: 'Pasti di qualita migliorano la tua energia durante la giornata',
      explainNegative: 'Pasti poveri abbassano la tua energia',
      actionable: true,
      threshold: 0.2,
    },
    {
      nameA: 'Stress',
      nameB: 'Qualita sonno (giorno dopo)',
      extractA: s => s.stress,
      extractB: s => s.sleepQuality,
      explainPositive: 'Lo stress sembra non disturbare il tuo sonno',
      explainNegative: 'Piu sei stressato, peggio dormi la notte successiva',
      actionable: true,
      threshold: 0.2,
      shifted: true,
    },
    {
      nameA: 'Pause schermo',
      nameB: 'Focus',
      extractA: s => s.screenBreaks > 0 ? s.screenBreaks : null,
      extractB: s => s.focus,
      explainPositive: 'Fare pause dallo schermo aiuta la tua concentrazione',
      explainNegative: 'Le pause schermo non sembrano influire sul focus',
      actionable: true,
      threshold: 0.2,
    },
    {
      nameA: 'Umore',
      nameB: 'Energia',
      extractA: s => s.mood,
      extractB: s => compositeEnergy(s),
      explainPositive: 'Il buon umore e collegato a livelli di energia piu alti',
      explainNegative: 'L\'umore basso si associa a meno energia',
      actionable: false,
      threshold: 0.2,
    },
  ];

  for (const pair of factorPairs) {
    let as: number[];
    let bs: number[];

    if (pair.shifted) {
      // Shifted correlation: factor A on day i → factor B on day i+1
      as = [];
      bs = [];
      for (let i = 0; i < populated.length - 1; i++) {
        const a = pair.extractA(populated[i]);
        const b = pair.extractB(populated[i + 1]);
        if (a !== null && b !== null) {
          as.push(a);
          bs.push(b);
        }
      }
    } else {
      // Same-day correlation
      const pairs: [number, number][] = [];
      for (const s of populated) {
        const a = pair.extractA(s);
        const b = pair.extractB(s);
        if (a !== null && b !== null) {
          pairs.push([a, b]);
        }
      }
      as = pairs.map(p => p[0]);
      bs = pairs.map(p => p[1]);
    }

    if (as.length < 5) continue;

    const r = pearson(as, bs);
    if (Math.abs(r) < pair.threshold) continue;

    // Generate quantified explanation
    const direction: 'positive' | 'negative' = r > 0 ? 'positive' : 'negative';
    let explanation: string;

    if (direction === 'positive') {
      // Quantify: compare top tercile vs bottom tercile
      const sorted = as.map((a, i) => ({ a, b: bs[i] })).sort((x, y) => x.a - y.a);
      const tercile = Math.max(1, Math.floor(sorted.length / 3));
      const bottomB = sorted.slice(0, tercile).reduce((s, p) => s + p.b, 0) / tercile;
      const topB = sorted.slice(-tercile).reduce((s, p) => s + p.b, 0) / tercile;
      const diff = Math.round(percentChange(bottomB, topB));

      if (diff > 0) {
        explanation = `${pair.explainPositive}. Nei giorni migliori per ${pair.nameA.toLowerCase()}, ${pair.nameB.toLowerCase()} e ${diff}% piu alto.`;
      } else {
        explanation = pair.explainPositive + '.';
      }
    } else {
      const sorted = as.map((a, i) => ({ a, b: bs[i] })).sort((x, y) => x.a - y.a);
      const tercile = Math.max(1, Math.floor(sorted.length / 3));
      const bottomB = sorted.slice(0, tercile).reduce((s, p) => s + p.b, 0) / tercile;
      const topB = sorted.slice(-tercile).reduce((s, p) => s + p.b, 0) / tercile;
      const diff = Math.round(percentChange(topB, bottomB));

      if (diff > 0) {
        explanation = `${pair.explainNegative}. Quando ${pair.nameA.toLowerCase()} aumenta, ${pair.nameB.toLowerCase()} cala del ${diff}%.`;
      } else {
        explanation = pair.explainNegative + '.';
      }
    }

    correlations.push({
      factorA: pair.nameA,
      factorB: pair.nameB,
      strength: Math.round(r * 100) / 100,
      direction,
      explanation,
      actionable: pair.actionable,
    });
  }

  // Sort by absolute strength descending
  correlations.sort((a, b) => Math.abs(b.strength) - Math.abs(a.strength));

  return correlations;
}

// ---------------------------------------------------------------------------
// 4. Predictive Intelligence
// ---------------------------------------------------------------------------

export async function generatePredictions(userId: number): Promise<Prediction[]> {
  const predictions: Prediction[] = [];

  const snapshots = await gatherSnapshots(userId, 14);
  const populated = filterPopulated(snapshots);

  if (populated.length < 3) {
    return [];
  }

  const profile = await db.userProfiles.where('userId').equals(userId).first().catch(() => undefined);

  // --- Energy forecast ---
  generateEnergyForecast(populated, predictions);

  // --- Crash warnings ---
  generateCrashWarnings(populated, predictions, profile ?? null);

  // --- Optimal action suggestions ---
  generateOptimalActions(populated, predictions);

  // --- Goal projections ---
  await generateGoalProjections(userId, predictions);

  return predictions;
}

function generateEnergyForecast(snapshots: DailySnapshot[], predictions: Prediction[]): void {
  const energyValues = snapshots
    .map(s => compositeEnergy(s))
    .filter((v): v is number => v !== null);

  if (energyValues.length < 3) return;

  // Use moving average to smooth and project
  const ma = movingAverage(energyValues, 3);
  const last3 = ma.slice(-3);
  const reg = linearRegression(last3.map((_, i) => i), last3);

  const projected = Math.round(clamp(reg.slope * 3 + last3[last3.length - 1], 0, 100));
  const current = Math.round(last3[last3.length - 1]);

  const trend = reg.slope > 1 ? 'in salita' : reg.slope < -1 ? 'in discesa' : 'stabile';
  const confidence = clamp(0.4 + energyValues.length / 30, 0.3, 0.85);

  predictions.push({
    type: 'energy_forecast',
    title: 'Previsione energia',
    body: `La tua energia e ${trend}. Attuale: ${current}/100. Proiezione domani: ~${projected}/100.`,
    confidence,
    urgency: projected < 40 ? 'high' : projected < 60 ? 'medium' : 'low',
    timeHorizon: 'domani',
  });
}

function generateCrashWarnings(
  snapshots: DailySnapshot[],
  predictions: Prediction[],
  profile: UserProfile | null,
): void {
  if (snapshots.length < 3) return;

  const recent = snapshots.slice(-3);
  const latestDay = recent[recent.length - 1];

  // Warning: consecutive declining energy
  const recentEnergies = recent
    .map(s => compositeEnergy(s))
    .filter((v): v is number => v !== null);

  if (recentEnergies.length >= 3) {
    const declining = recentEnergies[0] > recentEnergies[1] && recentEnergies[1] > recentEnergies[2];
    if (declining && recentEnergies[2] < 50) {
      predictions.push({
        type: 'crash_warning',
        title: 'Attenzione: energia in calo',
        body: `L'energia e scesa per 3 giorni di fila (${recentEnergies.map(e => Math.round(e)).join(' -> ')}). Rischio crash se non intervieni.`,
        confidence: 0.7,
        urgency: recentEnergies[2] < 30 ? 'high' : 'medium',
        timeHorizon: 'prossime 24 ore',
      });
    }
  }

  // Warning: high stress + poor sleep
  if (latestDay.stress !== null && latestDay.stress >= 4 && latestDay.sleepQuality !== null && latestDay.sleepQuality <= 2) {
    predictions.push({
      type: 'crash_warning',
      title: 'Rischio sovraccarico',
      body: 'Stress alto combinato con sonno scarso: rischio burnout elevato. Prioritizza il riposo oggi.',
      confidence: 0.75,
      urgency: 'high',
      timeHorizon: 'oggi',
    });
  }

  // Warning: dehydration + low energy
  if (latestDay.water < 3 && latestDay.focus !== null && latestDay.focus <= 2) {
    predictions.push({
      type: 'crash_warning',
      title: 'Disidratazione e scarsa concentrazione',
      body: `Solo ${latestDay.water} bicchieri d'acqua con focus basso. Bevi subito per recuperare concentrazione.`,
      confidence: 0.65,
      urgency: 'medium',
      timeHorizon: 'prossime 2 ore',
    });
  }

  // Warning: caffeine pattern
  if (latestDay.caffeine >= 4 && profile?.caffeineDaily !== undefined && latestDay.caffeine > profile.caffeineDaily + 1) {
    predictions.push({
      type: 'crash_warning',
      title: 'Caffeina eccessiva',
      body: `Hai preso ${latestDay.caffeine} caffe oggi (il tuo solito: ${profile.caffeineDaily}). Troppa caffeina causa crash e disturba il sonno.`,
      confidence: 0.6,
      urgency: 'medium',
      timeHorizon: 'prossime 6 ore',
    });
  }
}

function generateOptimalActions(snapshots: DailySnapshot[], predictions: Prediction[]): void {
  if (snapshots.length < 5) return;

  const latestDay = snapshots[snapshots.length - 1];

  // Find what worked best in recent history
  const withEnergy = snapshots.filter(s => compositeEnergy(s) !== null);
  if (withEnergy.length < 5) return;

  const sorted = [...withEnergy].sort((a, b) => (compositeEnergy(b) ?? 0) - (compositeEnergy(a) ?? 0));
  const topDays = sorted.slice(0, Math.max(2, Math.floor(sorted.length * 0.3)));

  // Analyze what was different about top days
  const topWater = stats(topDays.map(s => s.water));
  const topSleep = stats(topDays.filter(s => s.sleepQuality !== null).map(s => s.sleepQuality as number));
  const topActivity = stats(topDays.filter(s => s.activity !== null).map(s => s.activity as number));

  // Generate actionable recommendations
  if (latestDay.water < topWater.mean - 1 && topWater.mean > 4) {
    predictions.push({
      type: 'optimal_action',
      title: 'Bevi di piu per stare meglio',
      body: `Nei tuoi giorni migliori bevi in media ${Math.round(topWater.mean)} bicchieri. Oggi solo ${latestDay.water}. Aumenta l'idratazione.`,
      confidence: 0.6,
      urgency: 'low',
      timeHorizon: 'oggi',
    });
  }

  if (latestDay.sleepQuality !== null && topSleep.mean > 0 && latestDay.sleepQuality < topSleep.mean - 0.5) {
    predictions.push({
      type: 'optimal_action',
      title: 'Migliora il sonno stasera',
      body: `Il sonno di oggi (${latestDay.sleepQuality}/5) e sotto la media dei tuoi giorni migliori (${topSleep.mean.toFixed(1)}/5). Stasera vai a letto 30min prima.`,
      confidence: 0.55,
      urgency: 'low',
      timeHorizon: 'stasera',
    });
  }

  if (latestDay.activity === null && topActivity.mean > 2.5) {
    predictions.push({
      type: 'optimal_action',
      title: 'Movimento per piu energia',
      body: `Nei tuoi giorni migliori fai attivita fisica (media ${topActivity.mean.toFixed(1)}/5). Oggi non hai registrato movimento. Anche 15 minuti aiutano.`,
      confidence: 0.5,
      urgency: 'low',
      timeHorizon: 'oggi',
    });
  }
}

async function generateGoalProjections(userId: number, predictions: Prediction[]): Promise<void> {
  const activeGoals = await db.goals.where('[userId+status]')
    .equals([userId, 'active']).toArray().catch(() => [] as Goal[]);

  if (activeGoals.length === 0) return;

  for (const goal of activeGoals) {
    if (!goal.id) continue;

    const logs = await db.goalLogs.where('goalId').equals(goal.id)
      .toArray().catch(() => [] as GoalLog[]);

    if (logs.length < 3) continue;

    // Calculate success rate
    const achievedCount = logs.filter(l => l.achieved).length;
    const successRate = achievedCount / logs.length;

    // Streak analysis
    const currentStreak = goal.streak;
    const bestStreak = goal.bestStreak;

    if (successRate >= 0.7 && currentStreak >= 3) {
      predictions.push({
        type: 'goal_projection',
        title: `"${goal.wish}" procede bene`,
        body: `Streak di ${currentStreak} giorni e tasso di successo del ${Math.round(successRate * 100)}%. Stai creando un'abitudine solida!`,
        confidence: clamp(successRate * 0.9, 0.4, 0.9),
        urgency: 'low',
        timeHorizon: 'prossima settimana',
      });
    } else if (successRate < 0.4 && logs.length >= 5) {
      predictions.push({
        type: 'goal_projection',
        title: `"${goal.wish}" in difficolta`,
        body: `Tasso di successo del ${Math.round(successRate * 100)}%. Considera di ridurre il target o cambiare orario.${bestStreak > 0 ? ` Il tuo miglior streak e stato ${bestStreak} giorni.` : ''}`,
        confidence: 0.65,
        urgency: 'medium',
        timeHorizon: 'prossimi 7 giorni',
      });
    } else if (successRate >= 0.5 && currentStreak === 0) {
      predictions.push({
        type: 'goal_projection',
        title: `"${goal.wish}": ricomincia lo streak`,
        body: `Hai un buon tasso di successo (${Math.round(successRate * 100)}%) ma lo streak e a zero. Oggi e il giorno giusto per ricominciare!`,
        confidence: 0.55,
        urgency: 'medium',
        timeHorizon: 'oggi',
      });
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Weekly Intelligence Report
// ---------------------------------------------------------------------------

export async function generateWeeklyReport(userId: number): Promise<WeeklyReport> {
  // Determine the Monday of the current week
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(monday.getDate() - mondayOffset);
  const weekOf = monday.toISOString().slice(0, 10);

  // Gather data for 14 days (current week + previous for comparison)
  const snapshots = await gatherSnapshots(userId, 14);
  const thisWeek = snapshots.filter(s => s.date >= weekOf);
  const lastWeekEnd = weekOf;
  const lastWeekStart = daysAgoStr(mondayOffset + 7);
  const prevWeek = snapshots.filter(s => s.date >= lastWeekStart && s.date < lastWeekEnd);

  // Energy average
  const weekEnergies = thisWeek
    .map(s => compositeEnergy(s))
    .filter((v): v is number => v !== null);
  const energyAvg = weekEnergies.length > 0
    ? Math.round(weekEnergies.reduce((s, v) => s + v, 0) / weekEnergies.length)
    : 0;

  // Overall grade
  const overallGrade = computeGrade(energyAvg, thisWeek);

  // Best and worst day
  const { bestDay, worstDay } = findBestWorstDay(thisWeek);

  // Patterns, trends, correlations, predictions (in parallel)
  const [patterns, trends, correlations, predictions] = await Promise.all([
    analyzePatterns(userId, 30),
    analyzeTrends(userId, '7d'),
    findCorrelations(userId, 30),
    generatePredictions(userId),
  ]);

  // Top insight
  const topInsight = generateTopInsight(thisWeek, prevWeek, trends, correlations);

  // Action items
  const actionItems = generateActionItems(thisWeek, trends, correlations, patterns);

  return {
    weekOf,
    overallGrade,
    energyAvg,
    bestDay,
    worstDay,
    patterns,
    trends,
    correlations,
    predictions,
    topInsight,
    actionItems,
  };
}

function computeGrade(energyAvg: number, weekSnapshots: DailySnapshot[]): 'A' | 'B' | 'C' | 'D' | 'F' {
  // Composite score from multiple dimensions
  let score = 0;

  // Energy weight: 40%
  score += (energyAvg / 100) * 40;

  // Sleep weight: 20%
  const sleepValues = weekSnapshots.map(s => s.sleepQuality).filter((v): v is number => v !== null);
  if (sleepValues.length > 0) {
    const sleepAvg = sleepValues.reduce((s, v) => s + v, 0) / sleepValues.length;
    score += (sleepAvg / 5) * 20;
  } else {
    score += 10; // neutral if no data
  }

  // Stress weight: 15% (inverse)
  const stressValues = weekSnapshots.map(s => s.stress).filter((v): v is number => v !== null);
  if (stressValues.length > 0) {
    const stressAvg = stressValues.reduce((s, v) => s + v, 0) / stressValues.length;
    score += ((5 - stressAvg) / 5) * 15;
  } else {
    score += 7.5;
  }

  // Mood weight: 15%
  const moodValues = weekSnapshots.map(s => s.mood).filter((v): v is number => v !== null);
  if (moodValues.length > 0) {
    const moodAvg = moodValues.reduce((s, v) => s + v, 0) / moodValues.length;
    score += (moodAvg / 5) * 15;
  } else {
    score += 7.5;
  }

  // Data engagement bonus: 10% (reward consistent tracking)
  const daysWithData = weekSnapshots.filter(s =>
    s.sleepQuality !== null || s.water > 0 || s.stress !== null || compositeEnergy(s) !== null
  ).length;
  score += (Math.min(daysWithData, 7) / 7) * 10;

  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'F';
}

function findBestWorstDay(weekSnapshots: DailySnapshot[]): {
  bestDay: { day: string; score: number; reason: string };
  worstDay: { day: string; score: number; reason: string };
} {
  const withEnergy = weekSnapshots.filter(s => compositeEnergy(s) !== null);

  if (withEnergy.length === 0) {
    return {
      bestDay: { day: 'N/D', score: 0, reason: 'Dati insufficienti' },
      worstDay: { day: 'N/D', score: 0, reason: 'Dati insufficienti' },
    };
  }

  const sorted = [...withEnergy].sort((a, b) => (compositeEnergy(b) ?? 0) - (compositeEnergy(a) ?? 0));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  const bestEnergy = compositeEnergy(best) ?? 0;
  const worstEnergy = compositeEnergy(worst) ?? 0;

  // Determine reasons
  const bestReasons: string[] = [];
  if (best.sleepQuality !== null && best.sleepQuality >= 4) bestReasons.push('buon sonno');
  if (best.water >= 6) bestReasons.push('buona idratazione');
  if (best.activity !== null && best.activity >= 3) bestReasons.push('attivita fisica');
  if (best.stress !== null && best.stress <= 2) bestReasons.push('stress basso');
  if (best.mood !== null && best.mood >= 4) bestReasons.push('umore alto');

  const worstReasons: string[] = [];
  if (worst.sleepQuality !== null && worst.sleepQuality <= 2) worstReasons.push('sonno scarso');
  if (worst.water < 3) worstReasons.push('poca acqua');
  if (worst.stress !== null && worst.stress >= 4) worstReasons.push('stress alto');
  if (worst.mood !== null && worst.mood <= 2) worstReasons.push('umore basso');
  if (worst.caffeine >= 5) worstReasons.push('troppa caffeina');

  const bestDayName = DAY_NAMES_SHORT_IT[dateToDayOfWeek(best.date)];
  const worstDayName = DAY_NAMES_SHORT_IT[dateToDayOfWeek(worst.date)];

  return {
    bestDay: {
      day: `${bestDayName} ${best.date.slice(8, 10)}/${best.date.slice(5, 7)}`,
      score: bestEnergy,
      reason: bestReasons.length > 0 ? bestReasons.join(', ') : 'energia generalmente alta',
    },
    worstDay: {
      day: `${worstDayName} ${worst.date.slice(8, 10)}/${worst.date.slice(5, 7)}`,
      score: worstEnergy,
      reason: worstReasons.length > 0 ? worstReasons.join(', ') : 'energia generalmente bassa',
    },
  };
}

function generateTopInsight(
  thisWeek: DailySnapshot[],
  prevWeek: DailySnapshot[],
  trends: TrendAnalysis,
  correlations: Correlation[],
): string {
  // Priority 1: Strong actionable correlation
  const actionableCorr = correlations.find(c => c.actionable && Math.abs(c.strength) >= 0.4);
  if (actionableCorr) {
    return actionableCorr.explanation;
  }

  // Priority 2: Significant trend change
  if (trends.energyTrend === 'declining') {
    const thisEnergies = thisWeek.map(s => compositeEnergy(s)).filter((v): v is number => v !== null);
    const prevEnergies = prevWeek.map(s => compositeEnergy(s)).filter((v): v is number => v !== null);
    if (thisEnergies.length > 0 && prevEnergies.length > 0) {
      const thisAvg = Math.round(stats(thisEnergies).mean);
      const prevAvg = Math.round(stats(prevEnergies).mean);
      return `La tua energia e calata da ${prevAvg} a ${thisAvg} rispetto alla settimana scorsa. Controlla sonno e stress.`;
    }
  }
  if (trends.energyTrend === 'improving') {
    return 'La tua energia e in miglioramento. Le abitudini che stai seguendo funzionano, mantienile.';
  }

  // Priority 3: Sleep insight
  if (trends.sleepTrend === 'declining') {
    return 'La qualita del sonno sta peggiorando. Questo e il singolo fattore che piu influenza la tua energia.';
  }

  // Priority 4: General insight
  const thisEnergies = thisWeek.map(s => compositeEnergy(s)).filter((v): v is number => v !== null);
  if (thisEnergies.length > 0) {
    const avg = Math.round(stats(thisEnergies).mean);
    if (avg >= 70) return `Settimana solida con energia media di ${avg}/100. Continua con queste abitudini.`;
    if (avg >= 50) return `Energia nella media (${avg}/100). Piccoli miglioramenti su sonno e idratazione possono fare la differenza.`;
    return `Settimana difficile con energia media di ${avg}/100. Concentra gli sforzi su sonno, idratazione e gestione dello stress.`;
  }

  return 'Registra piu dati questa settimana per ricevere analisi personalizzate sulla tua energia.';
}

function generateActionItems(
  thisWeek: DailySnapshot[],
  trends: TrendAnalysis,
  correlations: Correlation[],
  patterns: DetectedPattern[],
): string[] {
  const items: string[] = [];

  // From trends
  if (trends.sleepTrend === 'declining') {
    items.push('Vai a dormire 30 minuti prima per le prossime 3 notti e registra la qualita del sonno.');
  }
  if (trends.hydrationTrend === 'declining') {
    items.push('Aumenta l\'idratazione a 8+ bicchieri al giorno. Tieni una bottiglia sempre vicina.');
  }
  if (trends.stressTrend === 'declining') {
    items.push('Lo stress e in aumento: inserisci 10 minuti di respirazione o camminata ogni giorno.');
  }

  // From correlations
  const waterCorr = correlations.find(c => c.factorA === 'Idratazione' && c.actionable && c.direction === 'positive');
  if (waterCorr && items.length < 3) {
    const avgWater = stats(thisWeek.map(s => s.water)).mean;
    if (avgWater < 6) {
      items.push(`Bevi almeno ${Math.ceil(avgWater + 2)} bicchieri al giorno. La correlazione con la tua energia e forte.`);
    }
  }

  // From patterns
  const crashPattern = patterns.find(p => p.type === 'crash_pattern');
  if (crashPattern && items.length < 3) {
    items.push(crashPattern.recommendation);
  }

  const productivityPattern = patterns.find(p => p.type === 'productivity_window');
  if (productivityPattern && items.length < 3) {
    items.push(productivityPattern.recommendation);
  }

  // Fill remaining with generic but data-informed advice
  if (items.length < 3) {
    const weekMood = thisWeek.map(s => s.mood).filter((v): v is number => v !== null);
    if (weekMood.length > 0) {
      const avgMood = stats(weekMood).mean;
      if (avgMood < 3) {
        items.push('L\'umore e stato basso. Prova 20 minuti di attivita fisica o socializzazione ogni giorno.');
      }
    }
  }
  if (items.length < 3) {
    const weekActivity = thisWeek.filter(s => s.activity !== null).length;
    if (weekActivity < 3) {
      items.push('Registra almeno 3 sessioni di attivita fisica questa settimana, anche 15 minuti contano.');
    }
  }
  if (items.length < 3) {
    items.push('Registra check-in ogni giorno per ricevere analisi sempre piu precise.');
  }

  return items.slice(0, 3);
}
