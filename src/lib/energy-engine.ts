// ---------------------------------------------------------------------------
// Scientific Energy Engine v2 — Modello energetico basato su evidenze scientifiche
//
// Architettura: Modello moltiplicativo con interazioni tra componenti
//   1. Circadiano (0-25): Two-Process Model (Borbely), BRAC, post-prandiale
//   2. Sonno (0-25): Process S, durata, qualita, debito Van Dongen, nap recovery
//   3. Stile di vita (0-25): idratazione (peso-based), nutrizione (macro GI),
//      caffeina (farmacocinetica), attivita (POMS), fumo, alcol, screen time
//   4. Carico allostatico (0-25): McEwen model, HRV proxy, stress cumulativo,
//      burnout risk, recovery deficit, emotional drain
//
// Penalita di interazione: quando multipli componenti sono bassi, il declino
// e' piu che additivo (effetto moltiplicativo della fatica).
//
// Riferimenti scientifici:
//   - Two-Process Model: Borbely 1982, Process S τw=18.2h τs=4.2h
//   - Chronotypes: Breus 2016 (Lion/Bear/Wolf/Dolphin), MEQ scoring
//   - Sleep debt: Van Dongen et al. 2003, >15.84h wakefulness critical
//   - Caffeine: Nehlig 2018, t½=5h mean (1.5-9.5h CYP1A2), A2A antagonism
//   - Post-prandial: 12h harmonic of circadian temp rhythm, GI effect
//   - Hydration: Ganio 2011, 1-2% BW loss → ES=-0.14 attention
//   - Exercise/POMS: 10min acute vigor boost, 30-60min recovery
//   - HRV: SDNN<50ms high stress, >100ms healthy (Shaffer 2017)
//   - Allostatic load: McEwen 1998, 2003, 4 profiles
//   - BRAC: Kleitman 1963, 90-120min ultradian cycles
//   - Cortisol Awakening Response: Fries 2009, +15% first 30min
// ---------------------------------------------------------------------------

import { db } from '../db/db';
import type {
  ScientificEnergyScore,
  UserProfile,
  EnergyLog,
  QuickCheckin,
  SahhaBiomarkerLog,
  SahhaScoreLog,
  ScreenTimeLog,
} from '../db/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Chronotype = 'lion' | 'bear' | 'wolf' | 'dolphin';
export type Bottleneck =
  | 'sleep' | 'hydration' | 'nutrition' | 'stress'
  | 'overwork' | 'inactivity' | 'caffeine_late' | 'screen_fatigue'
  | 'burnout_risk' | 'sleep_debt' | 'none';

export interface EnergyBreakdown {
  overall: number;          // 0-100
  circadian: number;        // 0-25
  sleep: number;            // 0-25
  lifestyle: number;        // 0-25
  allostatic: number;       // 0-25
  chronotype: Chronotype;
  predictedCurve: number[]; // 12 values (next 12 hours)
  bottleneck: Bottleneck;
  sleepDebt: number;        // ore cumulative
  // New precision data
  processS: number;         // Homeostatic sleep pressure 0-1
  processC: number;         // Circadian alertness 0-1
  hoursAwake: number;       // Hours since detected wake
  wakeTime: number;         // Detected wake hour (e.g. 7.5 = 7:30)
  interactionPenalty: number; // Cross-component penalty applied
  // Component explanations (Italian, for UI)
  explanations: {
    circadian: string;
    sleep: string;
    lifestyle: string;
    allostatic: string;
  };
  // Detailed factors for AI and debug
  factors: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Scientific Constants
// ---------------------------------------------------------------------------

/** Borbely Two-Process Model time constants */
const TAU_WAKE = 18.2;   // hours — homeostatic pressure build-up during wake

/** Van Dongen critical wakefulness threshold */
const CRITICAL_WAKEFULNESS_H = 15.84;

/** Sleep parameters */
const OPTIMAL_SLEEP_H = 8;

/** Caffeine pharmacokinetics (Nehlig 2018) */
const CAFFEINE_HALF_LIFE_H = 5;       // mean
const CAFFEINE_MG_PER_ESPRESSO = 80;  // mg per espresso/tazzina
const CAFFEINE_LATE_CUTOFF = 14;       // after 14:00, caffeine has sleep impact

/** Hydration (Ganio 2011 meta-analysis) */
const HYDRATION_ML_PER_KG = 33;       // daily requirement ml per kg body weight
const GLASS_ML = 250;                 // ml per standard glass

/** Ultradian BRAC cycle (Kleitman) */
const BRAC_PERIOD_MIN = 100;          // minutes per cycle
const BRAC_REST_PHASE_MIN = 20;       // rest phase duration

/** Post-prandial dip parameters */
const PP_DIP_DELAY_H = 2;             // hours after meal for peak dip
const PP_DIP_SIGMA = 0.7;             // Gaussian width in hours
const PP_DIP_MAX_PENALTY = 0.12;      // max alertness reduction

/** Cortisol Awakening Response */
const CAR_PEAK_MIN = 30;              // minutes after wake for CAR peak
const CAR_BOOST = 0.10;               // 10% alertness boost

/** Chronotype circadian parameters: peak alertness hour, amplitude, baseline */
const CHRONO_PARAMS: Record<Chronotype, {
  peak: number; amplitude: number; base: number; typicalWake: number;
}> = {
  lion:    { peak: 8,  amplitude: 0.40, base: 0.55, typicalWake: 5.5 },
  bear:    { peak: 11, amplitude: 0.35, base: 0.60, typicalWake: 7.0 },
  wolf:    { peak: 18, amplitude: 0.35, base: 0.55, typicalWake: 9.0 },
  dolphin: { peak: 12, amplitude: 0.25, base: 0.50, typicalWake: 7.5 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function gaussian(x: number, mu: number, sigma: number): number {
  return Math.exp(-((x - mu) ** 2) / (2 * sigma ** 2));
}

function timeToDecimal(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h + (m || 0) / 60;
}

// ---------------------------------------------------------------------------
// 1. Chronotype Estimation (enhanced)
// ---------------------------------------------------------------------------

export function estimateChronotype(profile: UserProfile | null): Chronotype {
  if (!profile) return 'bear';

  const age = new Date().getFullYear() - profile.birthYear;
  const pattern = profile.energyPattern;
  const sleepHours = profile.sleepHours;
  const schedule = profile.workSchedule;
  const activity = profile.activityLevel;

  // Use actual wake/bed times from profile routine when available
  if (profile.typicalWakeTime && profile.typicalBedTime) {
    const wake = timeToDecimal(profile.typicalWakeTime);
    const bed = timeToDecimal(profile.typicalBedTime);
    // Early riser (before 6am) + early bed (before 22) = lion
    if (wake <= 6 && bed <= 22) return 'lion';
    // Late riser (after 9am) + late bed (after midnight) = wolf
    if (wake >= 9 && (bed >= 24 || bed < 2)) return 'wolf';
    // Irregular sleep (short duration, light sleeper) = dolphin
    const sleepDuration = bed > wake ? (24 - bed + wake) : (wake - bed);
    if (sleepDuration < 6 && (schedule === 'irregular' || schedule === 'shifts')) return 'dolphin';
  }

  // Direct mapping from declared pattern (legacy)
  if (pattern === 'morning') return 'lion';
  if (pattern === 'evening') return 'wolf';
  if (pattern === 'variable' || schedule === 'irregular' || schedule === 'shifts') {
    return sleepHours < 6 ? 'dolphin' : 'bear';
  }

  // Age-based heuristic (MEQ correlation)
  if (age < 22) return 'wolf';   // adolescents/young adults tend wolf
  if (age > 55) return 'lion';   // older adults tend lion
  if (activity === 'very_active' && age > 30) return 'lion'; // active older → morning
  return 'bear';                  // 55% population default
}

// ---------------------------------------------------------------------------
// 2. Comprehensive Data Gathering
// ---------------------------------------------------------------------------

interface AllData {
  profile: UserProfile | null;
  todayCheckins: QuickCheckin[];
  recentCheckins: QuickCheckin[];         // 7 days
  recentEnergyLogs: EnergyLog[];          // 7 days
  todayEnergyLog: EnergyLog | null;
  screenTime: ScreenTimeLog | null;
  sahhaBiomarkers: SahhaBiomarkerLog[];   // recent
  sahhaScores: SahhaScoreLog[];           // recent
}

async function gatherAllData(userId: number): Promise<AllData> {
  const today = todayStr();
  const weekAgo = daysAgoStr(7);

  const [
    profile,
    todayCheckins,
    recentCheckins,
    recentEnergyLogs,
    todayEnergyLog,
    screenTime,
    sahhaBiomarkers,
    sahhaScores,
  ] = await Promise.all([
    db.userProfiles.where('userId').equals(userId).first().then(p => p ?? null),
    db.quickCheckins.where('[userId+date]').equals([userId, today]).toArray(),
    db.quickCheckins.where('userId').equals(userId).and(c => c.date >= weekAgo).toArray(),
    db.energyLogs.where('userId').equals(userId).and(l => l.date >= weekAgo).toArray(),
    db.energyLogs.where('[userId+date]').equals([userId, today]).first().then(l => l ?? null),
    db.screenTimeLogs.where('[userId+date]').equals([userId, today]).first().then(s => s ?? null).catch(() => null),
    db.sahhaBiomarkers.where('userId').equals(userId)
      .and(b => b.startDateTime >= weekAgo).toArray().catch(() => [] as SahhaBiomarkerLog[]),
    db.sahhaScores.where('userId').equals(userId).toArray().catch(() => [] as SahhaScoreLog[]),
  ]);

  recentEnergyLogs.sort((a, b) => a.date.localeCompare(b.date));

  return {
    profile, todayCheckins, recentCheckins,
    recentEnergyLogs, todayEnergyLog, screenTime, sahhaBiomarkers, sahhaScores,
  };
}

// ---------------------------------------------------------------------------
// 3. Routine Detection
// ---------------------------------------------------------------------------

interface DetectedRoutine {
  wakeTime: number;         // decimal hour
  mealTimes: number[];      // decimal hours of today's meals
  mealGIEstimates: number[]; // estimated glycemic load per meal (0-1)
  workStartEstimate: number;
  lastActivityTime: number | null;
}

function detectRoutine(data: AllData, chronotype: Chronotype): DetectedRoutine {
  const params = CHRONO_PARAMS[chronotype];
  const profile = data.profile;

  // 1. Wake time: prefer profile data > checkin detection > chronotype default
  let wakeTime = params.typicalWake;
  if (profile?.typicalWakeTime) {
    wakeTime = timeToDecimal(profile.typicalWakeTime);
  } else if (data.todayCheckins.length > 0) {
    const sorted = [...data.todayCheckins].sort((a, b) => a.time.localeCompare(b.time));
    const earliest = timeToDecimal(sorted[0].time);
    if (earliest >= 4 && earliest <= 13) {
      wakeTime = Math.max(earliest - 0.25, 4);
    }
  }

  // 2. Meal times: combine profile defaults + actual checkin/food data
  const mealTimes: number[] = [];
  const mealGIs: number[] = [];

  // Use profile meal times as baseline (if user ate at all, timing is approximate)
  const profileMealDefaults: number[] = [];
  if (profile?.lunchTime) profileMealDefaults.push(timeToDecimal(profile.lunchTime));
  if (profile?.dinnerTime) profileMealDefaults.push(timeToDecimal(profile.dinnerTime));

  // Meal checkins
  const mealCheckins = data.todayCheckins.filter(c => c.type === 'meal_time');
  for (const mc of mealCheckins) {
    const t = timeToDecimal(mc.time);
    if (!mealTimes.some(mt => Math.abs(mt - t) < 0.5)) {
      mealTimes.push(t);
      mealGIs.push(0.5);
    }
  }

  // If no actual meal data today but profile has meal times, use those
  // (predicts post-prandial dips even before the meal is logged)
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  if (mealTimes.length === 0) {
    for (const defaultTime of profileMealDefaults) {
      if (defaultTime <= currentHour) {
        mealTimes.push(defaultTime);
        mealGIs.push(0.5);
      }
    }
  }

  // 3. Work start: prefer profile > heuristic
  const workStart = profile?.workStartTime
    ? timeToDecimal(profile.workStartTime)
    : wakeTime + 1.5;

  // 4. Last activity time
  const actCheckins = data.todayCheckins.filter(c => c.type === 'activity_done');
  const lastAct = actCheckins.length > 0
    ? timeToDecimal(actCheckins[actCheckins.length - 1].time)
    : null;

  return {
    wakeTime,
    mealTimes,
    mealGIEstimates: mealGIs,
    workStartEstimate: workStart,
    lastActivityTime: lastAct,
  };
}

// ---------------------------------------------------------------------------
// 4. Circadian Component (0-25)
//    Two-Process Model + Ultradian BRAC + Post-prandial + CAR
// ---------------------------------------------------------------------------

function computeCircadianAlertness(chronotype: Chronotype, hour: number): number {
  const p = CHRONO_PARAMS[chronotype];
  // Primary circadian wave (24h cosine centered on peak)
  const primary = p.base + p.amplitude * Math.cos((2 * Math.PI / 24) * (hour - p.peak));
  // 12h harmonic — models the natural post-lunch dip seen in body temperature rhythm
  const harmonic12h = 0.06 * Math.cos((2 * Math.PI / 12) * (hour - p.peak));
  return clamp(primary - harmonic12h, 0.05, 1);
}

function computeProcessS(hoursAwake: number, sleepQuality01: number): number {
  // Homeostatic sleep pressure: builds exponentially during wake
  // S(t) = UA - (UA - S0) * exp(-t/τw)
  // S0 is initial pressure after sleep (lower = better sleep)
  const S0 = 0.1 + (1 - sleepQuality01) * 0.3; // 0.1 (perfect sleep) to 0.4 (terrible)
  const pressure = 1 - (1 - S0) * Math.exp(-hoursAwake / TAU_WAKE);
  return clamp(pressure, 0, 1);
}

function computeUltradianMod(minutesSinceWake: number): number {
  // BRAC: 90-120 min cycles with 20 min rest phases
  const cyclePos = minutesSinceWake % BRAC_PERIOD_MIN;
  // Active phase: 0-80min → positive, Rest phase: 80-100min → dip
  if (cyclePos < (BRAC_PERIOD_MIN - BRAC_REST_PHASE_MIN)) {
    return 0.02 * Math.sin((Math.PI * cyclePos) / (BRAC_PERIOD_MIN - BRAC_REST_PHASE_MIN));
  }
  // Rest phase: small dip
  const restPos = cyclePos - (BRAC_PERIOD_MIN - BRAC_REST_PHASE_MIN);
  return -0.03 * Math.sin((Math.PI * restPos) / BRAC_REST_PHASE_MIN);
}

function computePostPrandialDip(hour: number, mealTimes: number[], mealGIs: number[]): number {
  // Gaussian dip for each meal, amplitude depends on GI estimate
  let totalDip = 0;
  for (let i = 0; i < mealTimes.length; i++) {
    const mealTime = mealTimes[i];
    const gi = mealGIs[i] ?? 0.5;
    const dipCenter = mealTime + PP_DIP_DELAY_H;
    const amplitude = PP_DIP_MAX_PENALTY * (0.5 + gi * 0.5); // higher GI → worse dip
    totalDip += amplitude * gaussian(hour, dipCenter, PP_DIP_SIGMA);
  }
  // Also add innate circadian dip even without meal (14:00-15:00)
  totalDip += 0.04 * gaussian(hour, 14.5, 1.0);
  return clamp(totalDip, 0, 0.20);
}

function computeCortisalAwakenResponse(minutesSinceWake: number): number {
  // CAR: cortisol surge in first ~30 minutes after wake → alertness boost
  if (minutesSinceWake < 0 || minutesSinceWake > 60) return 0;
  return CAR_BOOST * gaussian(minutesSinceWake, CAR_PEAK_MIN, 15);
}

function computeCircadianScore(
  chronotype: Chronotype,
  currentHour: number,
  hoursAwake: number,
  sleepQuality01: number,
  routine: DetectedRoutine,
): { score: number; processC: number; processS: number; explanation: string } {
  // Process C: circadian alertness
  const processC = computeCircadianAlertness(chronotype, currentHour);

  // Process S: homeostatic sleep pressure
  const processS = computeProcessS(hoursAwake, sleepQuality01);

  // Ultradian modulation
  const minutesSinceWake = hoursAwake * 60;
  const ultradianMod = computeUltradianMod(minutesSinceWake);

  // Post-prandial dip
  const ppDip = computePostPrandialDip(currentHour, routine.mealTimes, routine.mealGIEstimates);

  // Cortisol Awakening Response
  const car = computeCortisalAwakenResponse(minutesSinceWake);

  // Combined alertness: high processC and low processS = high alertness
  // Alertness = C - weight*S + modifiers
  const alertness = clamp(processC - processS * 0.35 + ultradianMod - ppDip + car, 0.05, 1);

  // Scale to 0-25
  const score = clamp(Math.round(alertness * 25), 0, 25);

  // Explanation
  const explanations: string[] = [];
  if (processC > 0.7) explanations.push('fase circadiana favorevole');
  else if (processC < 0.4) explanations.push('fase circadiana bassa');
  if (hoursAwake > CRITICAL_WAKEFULNESS_H) explanations.push(`sveglio da ${hoursAwake.toFixed(1)}h (>15.8h critico)`);
  if (ppDip > 0.05) explanations.push('calo post-prandiale in corso');
  if (car > 0.02) explanations.push('risposta cortisolo mattutino attiva');

  const chrName = CHRONOTYPE_LABELS[chronotype].name;
  const explanation = explanations.length > 0
    ? `Cronotipo ${chrName}: ${explanations.join(', ')}`
    : `Cronotipo ${chrName}: ritmo circadiano nella norma`;

  return { score, processC, processS, explanation };
}

// ---------------------------------------------------------------------------
// 5. Sleep Component (0-25)
//    Quality + Duration + Cumulative Debt (Van Dongen) + Nap Recovery
// ---------------------------------------------------------------------------

interface SleepAnalysis {
  score: number;
  sleepDebt: number;
  lastNightQuality: number | null;   // 1-5
  lastNightHours: number | null;
  napRecovery: number;               // hours recovered from naps
  sahhaReadiness: number;            // 0-1 or -1 if unavailable
  sahhaSleepScore: number;           // 0-1 or -1 if unavailable
  explanation: string;
}

async function analyzeSleep(data: AllData, _chronotype: Chronotype): Promise<SleepAnalysis> {
  // 1. Last night quality from today's checkin
  const sleepCheckins = data.todayCheckins.filter(c => c.type === 'sleep_quality');
  const lastNightQuality = sleepCheckins.length > 0
    ? sleepCheckins[sleepCheckins.length - 1].value
    : null;

  // 2. Duration from Sahha biomarker or profile fallback
  let lastNightHours: number | null = null;
  const sleepBio = data.sahhaBiomarkers
    .filter(b => b.type === 'sleep_duration')
    .sort((a, b) => b.startDateTime.localeCompare(a.startDateTime))[0];
  if (sleepBio) {
    lastNightHours = parseFloat(sleepBio.value) / 60;
  }
  if (lastNightHours == null && data.profile) {
    lastNightHours = data.profile.sleepHours;
  }

  // 3. Alcohol impact on sleep quality estimation
  let alcoholSleepPenalty = 0;
  if (data.profile) {
    switch (data.profile.alcoholFrequency) {
      case 'daily': alcoholSleepPenalty = 0.15; break;   // chronic sleep disruption
      case 'weekly': alcoholSleepPenalty = 0.05; break;
      default: alcoholSleepPenalty = 0; break;
    }
  }

  // 4. Cumulative sleep debt (Van Dongen model: slow allostatic process)
  // Debt = sum of (optimal - actual) over 7 days, with partial recovery
  let sleepDebt = 0;
  const days7 = [];
  for (let d = 1; d <= 7; d++) {
    const dateStr = daysAgoStr(d);
    const daySleepCheckins = data.recentCheckins
      .filter(c => c.type === 'sleep_quality' && c.date === dateStr);

    let dayHours: number;
    if (daySleepCheckins.length > 0) {
      const quality = daySleepCheckins[daySleepCheckins.length - 1].value;
      // Better estimation: quality 5→8.5h, 4→7.5h, 3→6.5h, 2→5.5h, 1→4.5h
      dayHours = 2.5 + quality * 1.2;
    } else if (lastNightHours != null) {
      dayHours = lastNightHours; // assume similar to last known
    } else {
      dayHours = 7; // generic fallback
    }

    // More recent days contribute more (recency weighting)
    const recencyWeight = 1 - (d - 1) * 0.08; // day 1: 1.0, day 7: 0.52
    const deficit = Math.max(0, OPTIMAL_SLEEP_H - dayHours);
    sleepDebt += deficit * recencyWeight;
    days7.push({ date: dateStr, hours: dayHours, deficit });
  }

  // 5. Nap recovery (from today's nap checkins)
  const napCheckins = data.todayCheckins.filter(c => c.type === 'nap');
  let napRecovery = 0;
  if (napCheckins.length > 0) {
    // nap value 1-5: 1=very short, 5=long nap
    // Recovery: ~20-30 min nap (value 2-3) recovers ~0.5-1h of debt
    const napValue = napCheckins.reduce((s, c) => s + c.value, 0) / napCheckins.length;
    napRecovery = clamp(napValue * 0.3, 0, 1.5);
    sleepDebt = Math.max(0, sleepDebt - napRecovery);
  }

  // 6. Sahha readiness score as additional signal
  const readinessScore = data.sahhaScores
    .filter(s => s.type === 'readiness')
    .sort((a, b) => b.scoreDateTime.localeCompare(a.scoreDateTime))[0];
  const sahhaSleepScore = data.sahhaScores
    .filter(s => s.type === 'sleep')
    .sort((a, b) => b.scoreDateTime.localeCompare(a.scoreDateTime))[0];

  // === Compute Sleep Score (0-25) ===
  let score = 25;

  // Quality deduction: (5 - quality) / 5 * 10 → max -10
  if (lastNightQuality != null) {
    const qualityFactor = lastNightQuality / 5; // 0.2-1.0
    score -= Math.round((1 - qualityFactor) * 10);
  }

  // Duration deduction: deviation from optimal → max -8
  if (lastNightHours != null) {
    const deviation = Math.abs(lastNightHours - OPTIMAL_SLEEP_H);
    score -= Math.round(Math.min(8, deviation * 2.5));
  }

  // Sleep debt deduction (Van Dongen: cumulative impairment)
  // >14h debt equivalent to ~2 nights total deprivation
  const debtPenalty = Math.min(7, Math.round(sleepDebt * 0.45));
  score -= debtPenalty;

  // Alcohol penalty on sleep architecture
  score -= Math.round(alcoholSleepPenalty * 10);

  // Sahha bonus/penalty
  if (readinessScore) {
    if (readinessScore.score >= 0.7) score += 1;  // well recovered
    else if (readinessScore.score < 0.4) score -= 2; // poor recovery
  }
  if (sahhaSleepScore) {
    if (sahhaSleepScore.score >= 0.7) score += 1;
    else if (sahhaSleepScore.score < 0.4) score -= 1;
  }

  // Nap partial recovery bonus
  if (napRecovery > 0) score += Math.round(napRecovery);

  score = clamp(score, 0, 25);

  // Explanation
  const parts: string[] = [];
  if (lastNightQuality != null) parts.push(`qualita ${lastNightQuality}/5`);
  if (lastNightHours != null) parts.push(`durata ~${lastNightHours.toFixed(1)}h`);
  if (sleepDebt > 2) parts.push(`debito cumulativo ${sleepDebt.toFixed(1)}h`);
  if (napRecovery > 0) parts.push(`recupero pisolino +${napRecovery.toFixed(1)}h`);
  if (alcoholSleepPenalty > 0) parts.push('impatto alcol sulla qualita');
  const explanation = parts.length > 0 ? parts.join(', ') : 'Dati sonno insufficienti';

  return {
    score, sleepDebt, lastNightQuality, lastNightHours, napRecovery,
    sahhaReadiness: readinessScore?.score ?? -1,
    sahhaSleepScore: sahhaSleepScore?.score ?? -1,
    explanation,
  };
}

// ---------------------------------------------------------------------------
// 6. Lifestyle Component (0-25)
//    Hydration + Nutrition + Caffeine + Activity + Smoking + Alcohol + Screen
// ---------------------------------------------------------------------------

interface LifestyleAnalysis {
  score: number;
  waterGlasses: number;
  targetWater: number;
  caffeineCount: number;
  caffeineRemaining: number;     // mg remaining active
  mealQuality: number | null;
  mealsLogged: number;
  activityLevel: number | null;
  stressLevel: number | null;
  moodLevel: number | null;
  focusLevel: number | null;
  screenMinutes: number;
  explanation: string;
}

function estimateWaterTarget(profile: UserProfile | null, currentHour: number): number {
  if (!profile) return Math.round((currentHour / 24) * 8);
  const dailyMl = profile.weightKg * HYDRATION_ML_PER_KG;
  const dailyGlasses = Math.round(dailyMl / GLASS_ML);
  // Proportional to hour of day
  return Math.max(1, Math.round((currentHour / 24) * dailyGlasses));
}

function computeCaffeineRemaining(checkins: QuickCheckin[], currentHour: number): number {
  // Track each caffeine intake and compute remaining effect via half-life
  const cafCheckins = checkins.filter(c => c.type === 'caffeine');
  let totalRemainingMg = 0;

  for (const ci of cafCheckins) {
    const intakeHour = timeToDecimal(ci.time);
    const hoursSince = currentHour - intakeHour;
    if (hoursSince < 0) continue; // future somehow
    const initialMg = ci.value * CAFFEINE_MG_PER_ESPRESSO;
    const remaining = initialMg * Math.pow(0.5, hoursSince / CAFFEINE_HALF_LIFE_H);
    totalRemainingMg += remaining;
  }

  return totalRemainingMg;
}

function analyzeNutrition(mealCheckins: QuickCheckin[]): {
  avgMealQuality: number | null;
} {
  const mealValues = mealCheckins.map(c => c.value);
  const avgMealQuality = mealValues.length > 0
    ? mealValues.reduce((s, v) => s + v, 0) / mealValues.length
    : null;

  return { avgMealQuality };
}

function analyzeLifestyle(data: AllData, currentHour: number): LifestyleAnalysis {
  const profile = data.profile;

  // === Water ===
  const waterCheckins = data.todayCheckins.filter(c => c.type === 'water');
  const waterGlasses = waterCheckins.reduce((s, c) => s + c.value, 0);
  const targetWater = estimateWaterTarget(profile, currentHour);

  // === Caffeine ===
  const cafCheckins = data.todayCheckins.filter(c => c.type === 'caffeine');
  const caffeineCount = cafCheckins.reduce((s, c) => s + c.value, 0);
  const caffeineRemaining = computeCaffeineRemaining(data.todayCheckins, currentHour);

  // === Nutrition ===
  const mealCheckins = data.todayCheckins.filter(c => c.type === 'meal_time');
  const { avgMealQuality } = analyzeNutrition(mealCheckins);
  const mealsLogged = mealCheckins.length;

  // === Activity ===
  const actCheckins = data.todayCheckins.filter(c => c.type === 'activity_done');
  const activityLevel = actCheckins.length > 0
    ? actCheckins[actCheckins.length - 1].value
    : null;

  // === Stress & Mood & Focus ===
  const stressCheckins = data.todayCheckins.filter(c => c.type === 'stress');
  const moodCheckins = data.todayCheckins.filter(c => c.type === 'mood');
  const focusCheckins = data.todayCheckins.filter(c => c.type === 'focus');
  const stressLevel = stressCheckins.length > 0 ? stressCheckins[stressCheckins.length - 1].value : null;
  const moodLevel = moodCheckins.length > 0 ? moodCheckins[moodCheckins.length - 1].value : null;
  const focusLevel = focusCheckins.length > 0 ? focusCheckins[focusCheckins.length - 1].value : null;

  // === Screen Time ===
  const screenMinutes = data.screenTime?.minutes ?? 0;

  // === Compute Score (0-25) ===
  let score = 25;

  // Hydration: meta-analysis ES=-0.14 at 1-2% BW loss, -0.52 for attention
  const waterRatio = targetWater > 0 ? waterGlasses / targetWater : 1;
  if (waterRatio < 0.4) score -= 5;      // severe dehydration risk
  else if (waterRatio < 0.6) score -= 3;  // moderate
  else if (waterRatio < 0.8) score -= 1;  // mild

  // Nutrition from checkin quality
  if (avgMealQuality != null) {
    if (avgMealQuality <= 2) score -= 3;
    else if (avgMealQuality <= 3) score -= 1;
  } else if (currentHour > 13 && mealsLogged === 0) {
    score -= 3; // probable missed meal
  }

  // Caffeine pharmacokinetics
  if (caffeineCount > 0) {
    // Late caffeine: remaining effect at bedtime estimation
    const lastCafTime = cafCheckins.length > 0
      ? timeToDecimal(cafCheckins[cafCheckins.length - 1].time)
      : null;

    if (lastCafTime != null && lastCafTime >= CAFFEINE_LATE_CUTOFF) {
      // Caffeine after 14:00 affects tonight's sleep
      score -= 2;
    }
    if (caffeineCount > 4) score -= 2;    // > 400mg/day
    if (caffeineCount > 6) score -= 2;    // > 600mg/day anxiety risk
    // Early caffeine boost (before noon, moderate amount)
    if (caffeineCount <= 3 && lastCafTime != null && lastCafTime < 12) {
      score += 1; // positive effect of moderate morning caffeine
    }
  }

  // Physical activity (POMS: acute vigor boost post-exercise)
  if (activityLevel != null) {
    if (activityLevel >= 4) score += 1;    // exercise energy boost
    else if (activityLevel <= 1 && currentHour > 15) score -= 2; // prolonged inactivity
  }

  // Current activity context: pausa/sport = recovery bonus
  const curActCheckins = data.todayCheckins.filter(c => c.type === 'current_activity');
  const curActivity = curActCheckins.length > 0
    ? curActCheckins[curActCheckins.length - 1].value
    : null;
  if (curActivity === 3) score += 1;       // pausa = micro-recovery
  if (curActivity === 4) score += 1;       // sport = vigor boost

  // Smoking penalty (chronic vasoconstriction, reduced O2 transport)
  if (profile) {
    switch (profile.smokingFrequency) {
      case 'heavy': score -= 3; break;
      case 'daily': score -= 2; break;
      case 'occasional': score -= 1; break;
    }
  }

  // Alcohol penalty (beyond sleep effects: dehydration, cognitive)
  if (profile) {
    switch (profile.alcoholFrequency) {
      case 'daily': score -= 2; break;
      case 'weekly': score -= 1; break;
    }
  }

  // Screen time fatigue
  if (screenMinutes > 0) {
    if (screenMinutes > 300) score -= 2;      // > 5h continuous
    else if (screenMinutes > 180) score -= 1;  // > 3h
  }
  // Screen break bonus
  const breakCheckins = data.todayCheckins.filter(c => c.type === 'screen_break');
  const breakCount = breakCheckins.reduce((s, c) => s + c.value, 0);
  if (breakCount >= 4 && screenMinutes > 120) score += 1; // good break habits

  score = clamp(score, 0, 25);

  // Explanation
  const parts: string[] = [];
  if (waterRatio < 0.6) parts.push(`idratazione ${Math.round(waterRatio * 100)}% del target`);
  if (caffeineCount > 4) parts.push(`caffeina elevata (${caffeineCount} tazzine)`);
  if (activityLevel != null && activityLevel >= 4) parts.push('buona attivita fisica');
  if (curActivity === 3) parts.push('in pausa (recupero)');
  if (curActivity === 4) parts.push('sport (boost energia)');
  if (profile?.smokingFrequency === 'daily' || profile?.smokingFrequency === 'heavy') parts.push('impatto fumo');
  if (screenMinutes > 180) parts.push(`${Math.round(screenMinutes / 60)}h screen time`);
  const explanation = parts.length > 0 ? parts.join(', ') : 'Stile di vita nella norma';

  return {
    score, waterGlasses, targetWater, caffeineCount, caffeineRemaining,
    mealQuality: avgMealQuality, mealsLogged,
    activityLevel, stressLevel, moodLevel, focusLevel, screenMinutes, explanation,
  };
}

// ---------------------------------------------------------------------------
// 7. Allostatic Load Component (0-25)
//    McEwen model: Work + Stress + Emotional + HRV + Recovery + Burnout
// ---------------------------------------------------------------------------

interface AllostaticAnalysis {
  score: number;
  workHours: number;
  consecutiveLowDays: number;
  stressTrend: number;           // -1 to 1 (negative = increasing stress)
  hrvIndicator: number | null;   // 0-1 (higher = better recovery)
  burnoutRisk: 'low' | 'moderate' | 'high' | 'critical';
  explanation: string;
}

function analyzeAllostaticLoad(data: AllData): AllostaticAnalysis {
  const profile = data.profile;

  // === Work hours ===
  const workHours = data.todayEnergyLog?.workHoursToday ?? profile?.dailyWorkHours ?? 8;

  // === Consecutive low energy days (burnout indicator) ===
  let consecutiveLowDays = 0;
  const sortedLogs = [...data.recentEnergyLogs].sort((a, b) => b.date.localeCompare(a.date));
  for (const log of sortedLogs) {
    const avg = (log.physical + log.mental + log.emotional) / 3;
    if (avg <= 4) consecutiveLowDays++;
    else break;
  }

  // === Stress trend (7-day) ===
  let stressTrend = 0;
  const stressCheckins = data.recentCheckins.filter(c => c.type === 'stress');
  if (stressCheckins.length >= 4) {
    const sorted = [...stressCheckins].sort((a, b) => a.date.localeCompare(b.date));
    const mid = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, mid);
    const secondHalf = sorted.slice(mid);
    const firstAvg = firstHalf.reduce((s, c) => s + c.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, c) => s + c.value, 0) / secondHalf.length;
    stressTrend = clamp((secondAvg - firstAvg) / 5, -1, 1); // positive = stress increasing
  }

  // === HRV as stress/recovery proxy ===
  let hrvIndicator: number | null = null;
  const hrvBio = data.sahhaBiomarkers
    .filter(b => b.type === 'heart_rate_variability_sdnn')
    .sort((a, b) => b.startDateTime.localeCompare(a.startDateTime))[0];
  if (hrvBio) {
    const sdnn = parseFloat(hrvBio.value);
    if (Number.isFinite(sdnn)) {
      // SDNN < 50ms: high stress, > 100ms: healthy
      hrvIndicator = clamp((sdnn - 30) / 80, 0, 1); // normalized 0-1
    }
  }

  // === Mood trend ===
  const moodCheckins = data.recentCheckins.filter(c => c.type === 'mood');
  let moodTrendDown = false;
  if (moodCheckins.length >= 4) {
    const sorted = [...moodCheckins].sort((a, b) => a.date.localeCompare(b.date));
    const recent = sorted.slice(-3);
    const older = sorted.slice(0, 3);
    const recentAvg = recent.reduce((s, c) => s + c.value, 0) / recent.length;
    const olderAvg = older.reduce((s, c) => s + c.value, 0) / older.length;
    moodTrendDown = (olderAvg - recentAvg) > 0.8;
  }

  // === Compute Score (0-25) ===
  let score = 25;

  // Work hours burden (cognitive vs physical from work type)
  const isPhysicalWork = profile?.workType?.match(/fisic|manual|operai|muratore|cantiere|magazzin/i);
  if (workHours > 10) score -= isPhysicalWork ? 7 : 6;
  else if (workHours > 8) score -= isPhysicalWork ? 4 : 3;

  // Stress (today's level + cumulative trend)
  const todayStress = data.todayCheckins.filter(c => c.type === 'stress');
  if (todayStress.length > 0) {
    const stressVal = todayStress[todayStress.length - 1].value;
    if (stressVal >= 4) score -= 4;
    else if (stressVal >= 3) score -= 2;
  }
  // Cumulative stress trend penalty
  if (stressTrend > 0.3) score -= 2;

  // Mood/emotional drain
  const todayMood = data.todayCheckins.filter(c => c.type === 'mood');
  if (todayMood.length > 0) {
    const moodVal = todayMood[todayMood.length - 1].value;
    if (moodVal <= 2) score -= 3;
    else if (moodVal <= 3) score -= 1;
  }
  if (moodTrendDown) score -= 1;

  // Energy trend (3-day rolling decline)
  if (data.recentEnergyLogs.length >= 6) {
    const last3 = data.recentEnergyLogs.slice(-3);
    const prev3 = data.recentEnergyLogs.slice(-6, -3);
    const last3Avg = last3.reduce((s, l) => s + (l.physical + l.mental + l.emotional) / 3, 0) / 3;
    const prev3Avg = prev3.reduce((s, l) => s + (l.physical + l.mental + l.emotional) / 3, 0) / 3;
    const decline = prev3Avg - last3Avg;
    if (decline > 2) score -= 4;
    else if (decline > 1) score -= 2;
  }

  // HRV recovery bonus/penalty
  if (hrvIndicator != null) {
    if (hrvIndicator > 0.7) score += 2;       // good autonomic balance
    else if (hrvIndicator < 0.3) score -= 3;   // sympathetic dominance (stress)
  }

  // Burnout risk (consecutive low days — exponential impact)
  let burnoutRisk: 'low' | 'moderate' | 'high' | 'critical' = 'low';
  if (consecutiveLowDays >= 7) {
    score -= 7; burnoutRisk = 'critical';
  } else if (consecutiveLowDays >= 5) {
    score -= 5; burnoutRisk = 'high';
  } else if (consecutiveLowDays >= 3) {
    score -= 3; burnoutRisk = 'moderate';
  } else if (consecutiveLowDays >= 2) {
    score -= 1;
  }

  // Focus drain (low focus = cognitive overload indicator)
  const todayFocus = data.todayCheckins.filter(c => c.type === 'focus');
  if (todayFocus.length > 0) {
    const focusVal = todayFocus[todayFocus.length - 1].value;
    if (focusVal <= 2) score -= 2; // cognitive exhaustion
  }

  // Current activity context: studio/lavoro prolungato = carico cognitivo
  const curActAlloCheckins = data.todayCheckins.filter(c => c.type === 'current_activity');
  if (curActAlloCheckins.length >= 3) {
    // Conteggio sessioni consecutive studio/lavoro senza pausa
    const recent = curActAlloCheckins.slice(-4);
    const consecutiveWork = recent.filter(c => c.value === 1 || c.value === 2).length;
    if (consecutiveWork >= 3) score -= 2;  // lavoro/studio senza pause
  }

  // Recovery factors
  const breaks = data.todayCheckins.filter(c => c.type === 'screen_break')
    .reduce((s, c) => s + c.value, 0);
  const supplements = data.todayCheckins.filter(c => c.type === 'supplement')
    .reduce((s, c) => s + c.value, 0);
  if (breaks >= 3) score += 1;        // taking breaks helps recovery
  if (supplements > 0) score += 0.5;  // minimal but positive signal

  score = clamp(Math.round(score), 0, 25);

  // Explanation
  const parts: string[] = [];
  if (workHours > 8) parts.push(`${workHours}h di lavoro`);
  if (burnoutRisk !== 'low') parts.push(`rischio burnout: ${burnoutRisk}`);
  if (hrvIndicator != null && hrvIndicator < 0.4) parts.push('HRV bassa (stress autonomico)');
  if (hrvIndicator != null && hrvIndicator > 0.7) parts.push('HRV buona (buon recupero)');
  if (stressTrend > 0.3) parts.push('stress in aumento');
  if (moodTrendDown) parts.push('umore in calo');
  const explanation = parts.length > 0 ? parts.join(', ') : 'Carico allostatico nella norma';

  return {
    score, workHours, consecutiveLowDays, stressTrend,
    hrvIndicator, burnoutRisk, explanation,
  };
}

// ---------------------------------------------------------------------------
// 8. Interaction Penalties
//    When multiple components are low, total impact is multiplicative
// ---------------------------------------------------------------------------

function computeInteractionPenalty(
  circadian: number, sleep: number, lifestyle: number, allostatic: number,
): number {
  const threshold = 12; // below this = component in trouble
  const components = [circadian, sleep, lifestyle, allostatic];
  const lowCount = components.filter(c => c < threshold).length;

  // No penalty for 0-1 low components (linear territory)
  if (lowCount <= 1) return 0;

  // Penalty increases non-linearly with more low components
  // 2 low: -3, 3 low: -8, 4 low: -15
  const penalties = [0, 0, 3, 8, 15];
  return penalties[lowCount] ?? 0;
}

// ---------------------------------------------------------------------------
// 9. Predicted Energy Curve (next 12 hours)
// ---------------------------------------------------------------------------

function predictEnergyCurve(
  chronotype: Chronotype,
  currentHour: number,
  currentScore: number,
  sleepDebt: number,
  caffeineRemaining: number,
  routine: DetectedRoutine,
  hoursAwake: number,
  sleepQuality01: number,
): number[] {
  const predicted: number[] = [];

  for (let offset = 1; offset <= 12; offset++) {
    const futureHour = (currentHour + offset) % 24;
    const futureHoursAwake = hoursAwake + offset;

    // Circadian base
    const circAlertness = computeCircadianAlertness(chronotype, futureHour);

    // Process S at future time
    const futureS = computeProcessS(futureHoursAwake, sleepQuality01);

    // Post-prandial dip (estimate future meals if not yet happened)
    const futureMealTimes = [...routine.mealTimes];
    // If no lunch yet and it's before 13, assume lunch at 13
    if (!futureMealTimes.some(t => t >= 12 && t <= 14) && futureHour >= 12) {
      futureMealTimes.push(13);
    }
    // If no dinner yet and it's before 20, assume dinner at 20
    if (!futureMealTimes.some(t => t >= 19 && t <= 21) && futureHour >= 19) {
      futureMealTimes.push(20);
    }
    const ppDip = computePostPrandialDip(futureHour, futureMealTimes,
      futureMealTimes.map(() => 0.5));

    // Caffeine decay
    const cafDecay = caffeineRemaining * Math.pow(0.5, offset / CAFFEINE_HALF_LIFE_H);
    const cafBoost = clamp(cafDecay / (3 * CAFFEINE_MG_PER_ESPRESSO), 0, 0.08);

    // Sleep debt drag increases with wakefulness
    const debtDrag = Math.min(0.15, sleepDebt * 0.015 * (1 + futureHoursAwake * 0.01));

    // Combined future alertness
    const futureAlertness = clamp(
      circAlertness - futureS * 0.35 - ppDip + cafBoost - debtDrag,
      0.05, 1,
    );

    const futureScore = Math.round(futureAlertness * 100);

    // Blend: closer hours lean toward current score, farther toward model prediction
    const blendFactor = offset / 12;
    const blended = lerp(currentScore, futureScore, blendFactor);

    predicted.push(clamp(Math.round(blended), 0, 100));
  }

  return predicted;
}

// ---------------------------------------------------------------------------
// 10. Bottleneck Identification (ranked by severity)
// ---------------------------------------------------------------------------

function identifyBottleneck(
  sleepAnalysis: SleepAnalysis,
  lifestyleAnalysis: LifestyleAnalysis,
  allostaticAnalysis: AllostaticAnalysis,
  _circadianScore: number,
): Bottleneck {
  const issues: { type: Bottleneck; severity: number }[] = [];

  // Sleep
  if (sleepAnalysis.score <= 10) issues.push({ type: 'sleep', severity: 25 - sleepAnalysis.score });
  if (sleepAnalysis.sleepDebt > 5) issues.push({ type: 'sleep_debt', severity: Math.round(sleepAnalysis.sleepDebt) });

  // Hydration
  const waterRatio = lifestyleAnalysis.targetWater > 0
    ? lifestyleAnalysis.waterGlasses / lifestyleAnalysis.targetWater : 1;
  if (waterRatio < 0.5) issues.push({ type: 'hydration', severity: 6 });
  else if (waterRatio < 0.7) issues.push({ type: 'hydration', severity: 3 });

  // Nutrition
  if (lifestyleAnalysis.mealQuality != null && lifestyleAnalysis.mealQuality <= 2) {
    issues.push({ type: 'nutrition', severity: 4 });
  }

  // Caffeine
  if (lifestyleAnalysis.caffeineCount > 4) {
    issues.push({ type: 'caffeine_late', severity: 3 });
  }

  // Stress
  if (lifestyleAnalysis.stressLevel != null && lifestyleAnalysis.stressLevel >= 4) {
    issues.push({ type: 'stress', severity: 5 });
  }

  // Overwork
  if (allostaticAnalysis.workHours > 10) {
    issues.push({ type: 'overwork', severity: 5 });
  }

  // Inactivity
  if (lifestyleAnalysis.activityLevel != null && lifestyleAnalysis.activityLevel <= 1) {
    issues.push({ type: 'inactivity', severity: 3 });
  }

  // Screen fatigue
  if (lifestyleAnalysis.screenMinutes > 300) {
    issues.push({ type: 'screen_fatigue', severity: 3 });
  }

  // Burnout risk
  if (allostaticAnalysis.burnoutRisk === 'critical') {
    issues.push({ type: 'burnout_risk', severity: 10 });
  } else if (allostaticAnalysis.burnoutRisk === 'high') {
    issues.push({ type: 'burnout_risk', severity: 7 });
  }

  if (issues.length === 0) return 'none';
  issues.sort((a, b) => b.severity - a.severity);
  return issues[0].type;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calcola il punteggio energetico scientifico v2.
 * Integra TUTTE le fonti dati: profilo, checkin, food scanner, screen time,
 * Sahha biomarkers, sleep debt, caffeine pharmacokinetics, HRV.
 */
export async function computeScientificEnergy(userId: number): Promise<EnergyBreakdown> {
  // 1. Gather ALL data
  const data = await gatherAllData(userId);

  // 2. Estimate chronotype
  const chronotype = estimateChronotype(data.profile);

  // 3. Detect routine
  const routine = detectRoutine(data, chronotype);

  // 4. Current time calculations
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const hoursAwake = currentHour >= routine.wakeTime
    ? currentHour - routine.wakeTime
    : (currentHour + 24 - routine.wakeTime); // crossed midnight

  // 5. Sleep quality as 0-1 for Process S
  const todaySleepQ = data.todayCheckins
    .filter(c => c.type === 'sleep_quality')
    .pop();
  const sleepQuality01 = todaySleepQ ? todaySleepQ.value / 5 : 0.6;

  // 6. Compute all components
  const circResult = computeCircadianScore(chronotype, currentHour, hoursAwake, sleepQuality01, routine);
  const sleepResult = await analyzeSleep(data, chronotype);
  const lifestyleResult = analyzeLifestyle(data, currentHour);
  const allostaticResult = analyzeAllostaticLoad(data);

  // 7. Interaction penalty
  const interactionPenalty = computeInteractionPenalty(
    circResult.score, sleepResult.score, lifestyleResult.score, allostaticResult.score,
  );

  // 8. Overall score
  const rawTotal = circResult.score + sleepResult.score + lifestyleResult.score + allostaticResult.score;
  const overall = clamp(rawTotal - interactionPenalty, 0, 100);

  // 9. Predicted curve (12 hours)
  const predictedCurve = predictEnergyCurve(
    chronotype, currentHour, overall, sleepResult.sleepDebt,
    lifestyleResult.caffeineRemaining, routine, hoursAwake, sleepQuality01,
  );

  // 10. Bottleneck
  const bottleneck = identifyBottleneck(sleepResult, lifestyleResult, allostaticResult, circResult.score);

  // 11. Detailed factors for AI and storage
  const factors: Record<string, number> = {
    // Circadian
    process_c: Math.round(circResult.processC * 100) / 100,
    process_s: Math.round(circResult.processS * 100) / 100,
    hours_awake: Math.round(hoursAwake * 10) / 10,
    wake_time: Math.round(routine.wakeTime * 10) / 10,
    // Sleep
    sleep_quality: sleepResult.lastNightQuality ?? -1,
    sleep_hours: sleepResult.lastNightHours ?? -1,
    sleep_debt_hours: Math.round(sleepResult.sleepDebt * 10) / 10,
    nap_recovery: Math.round(sleepResult.napRecovery * 10) / 10,
    // Lifestyle
    water_glasses: lifestyleResult.waterGlasses,
    water_target: lifestyleResult.targetWater,
    caffeine_count: lifestyleResult.caffeineCount,
    caffeine_remaining_mg: Math.round(lifestyleResult.caffeineRemaining),
    meal_quality: lifestyleResult.mealQuality ?? -1,
    meals_logged: lifestyleResult.mealsLogged,
    activity_level: lifestyleResult.activityLevel ?? -1,
    stress_level: lifestyleResult.stressLevel ?? -1,
    mood_level: lifestyleResult.moodLevel ?? -1,
    focus_level: lifestyleResult.focusLevel ?? -1,
    screen_minutes: lifestyleResult.screenMinutes,
    // Allostatic
    work_hours: allostaticResult.workHours,
    consecutive_low_days: allostaticResult.consecutiveLowDays,
    stress_trend: Math.round(allostaticResult.stressTrend * 100) / 100,
    hrv_indicator: allostaticResult.hrvIndicator ?? -1,
    // Meta
    interaction_penalty: interactionPenalty,
    smoking: data.profile?.smokingFrequency === 'heavy' ? 3
      : data.profile?.smokingFrequency === 'daily' ? 2
      : data.profile?.smokingFrequency === 'occasional' ? 1 : 0,
    alcohol: data.profile?.alcoholFrequency === 'daily' ? 3
      : data.profile?.alcoholFrequency === 'weekly' ? 2
      : data.profile?.alcoholFrequency === 'occasional' ? 1 : 0,
    // Sahha wearable scores (0-1, or -1 if unavailable)
    sahha_readiness: sleepResult.sahhaReadiness,
    sahha_sleep_score: sleepResult.sahhaSleepScore,
  };

  return {
    overall,
    circadian: circResult.score,
    sleep: sleepResult.score,
    lifestyle: lifestyleResult.score,
    allostatic: allostaticResult.score,
    chronotype,
    predictedCurve,
    bottleneck,
    sleepDebt: sleepResult.sleepDebt,
    processS: circResult.processS,
    processC: circResult.processC,
    hoursAwake,
    wakeTime: routine.wakeTime,
    interactionPenalty,
    explanations: {
      circadian: circResult.explanation,
      sleep: sleepResult.explanation,
      lifestyle: lifestyleResult.explanation,
      allostatic: allostaticResult.explanation,
    },
    factors,
  };
}

/**
 * Calcola e salva il punteggio energetico scientifico in DB.
 */
export async function saveScientificEnergyScore(userId: number): Promise<ScientificEnergyScore> {
  const breakdown = await computeScientificEnergy(userId);
  const now = new Date();

  const score: ScientificEnergyScore = {
    userId,
    date: todayStr(),
    time: now.toTimeString().slice(0, 5),
    overallScore: breakdown.overall,
    circadianScore: breakdown.circadian,
    sleepScore: breakdown.sleep,
    lifestyleScore: breakdown.lifestyle,
    allostaticScore: breakdown.allostatic,
    chronotype: breakdown.chronotype,
    predictedCurve: JSON.stringify(breakdown.predictedCurve),
    bottleneck: breakdown.bottleneck,
    sleepDebt: breakdown.sleepDebt,
    factors: JSON.stringify(breakdown.factors),
    createdAt: now,
  };

  const id = await db.scientificEnergyScores.add(score);
  return { ...score, id };
}

/**
 * Ottieni l'ultimo punteggio scientifico di oggi (se esiste).
 */
export async function getTodayScientificScore(userId: number): Promise<ScientificEnergyScore | undefined> {
  return db.scientificEnergyScores
    .where('[userId+date]')
    .equals([userId, todayStr()])
    .last();
}

/**
 * Calcola l'optimal time window per un'attivita in base al cronotipo e routine.
 */
export function getOptimalWindows(chronotype: Chronotype): {
  peakCognitive: string;
  peakPhysical: string;
  recovery: string;
  creative: string;
} {
  switch (chronotype) {
    case 'lion':
      return {
        peakCognitive: '06:00-10:00',
        peakPhysical: '07:00-09:00',
        recovery: '14:00-16:00',
        creative: '10:00-12:00',
      };
    case 'bear':
      return {
        peakCognitive: '10:00-14:00',
        peakPhysical: '09:00-11:00',
        recovery: '14:00-16:00',
        creative: '16:00-18:00',
      };
    case 'wolf':
      return {
        peakCognitive: '17:00-21:00',
        peakPhysical: '16:00-18:00',
        recovery: '13:00-15:00',
        creative: '21:00-23:00',
      };
    case 'dolphin':
      return {
        peakCognitive: '10:00-14:00',
        peakPhysical: '10:00-12:00',
        recovery: '15:00-17:00',
        creative: '16:00-18:00',
      };
  }
}

/**
 * Stima il costo energetico di un'attivita.
 * Returns impact on physical (0-10), mental (0-10), emotional (0-10).
 */
export function estimateActivityEnergyCost(
  category: string,
  durationMin: number,
): { physical: number; mental: number; emotional: number; total: number } {
  const hourFactor = durationMin / 60;

  const baseCosts: Record<string, { p: number; m: number; e: number }> = {
    fitness:       { p: 4, m: 1, e: 0.5 },
    productivity:  { p: 0.5, m: 4, e: 1 },
    energy:        { p: 2, m: 2, e: 1 },
    sleep:         { p: -2, m: -1, e: -1 }, // recovery
    stress:        { p: 0.5, m: 1, e: 3 },
    nutrition:     { p: 0.5, m: 1, e: 0.5 },
    custom:        { p: 2, m: 2, e: 2 },
  };

  const base = baseCosts[category] ?? baseCosts.custom;
  const physical = clamp(base.p * hourFactor, -3, 10);
  const mental = clamp(base.m * hourFactor, -3, 10);
  const emotional = clamp(base.e * hourFactor, -3, 10);

  return {
    physical,
    mental,
    emotional,
    total: physical + mental + emotional,
  };
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

/** Actionable advice for each bottleneck — used by UI to show quick recommendations */
export const BOTTLENECK_ACTIONS: Record<Bottleneck, string> = {
  sleep: 'Vai a letto 30 minuti prima stasera e evita schermi nell\'ultima ora.',
  hydration: 'Bevi un bicchiere d\'acqua adesso. Obiettivo: almeno 8 bicchieri oggi.',
  nutrition: 'Il prossimo pasto dovrebbe includere proteine, carboidrati complessi e verdure.',
  stress: 'Fai 5 minuti di respirazione profonda (4s inspira, 7s trattieni, 8s espira).',
  overwork: 'Stacca per almeno 15 minuti. Fai una camminata breve.',
  inactivity: 'Anche 10 minuti di movimento leggero miglioreranno la tua energia.',
  caffeine_late: 'Non assumere piu caffeina oggi. L\'effetto dura 5+ ore.',
  screen_fatigue: 'Fai una pausa dallo schermo. Guarda lontano per 20 secondi ogni 20 minuti.',
  burnout_risk: 'Priorita al recupero oggi. Riposo, natura, zero sovraccarico cognitivo.',
  sleep_debt: 'Dormi 1 ora in piu per le prossime notti per recuperare il debito.',
  none: 'Tutto nella norma. Sfrutta questo stato per attivita ad alto valore.',
};

export const BOTTLENECK_LABELS: Record<Bottleneck, string> = {
  sleep: 'Sonno insufficiente',
  hydration: 'Disidratazione',
  nutrition: 'Nutrizione scarsa',
  stress: 'Stress elevato',
  overwork: 'Sovraccarico lavorativo',
  inactivity: 'Sedentarieta',
  caffeine_late: 'Caffeina tardiva',
  screen_fatigue: 'Affaticamento da schermo',
  burnout_risk: 'Rischio burnout',
  sleep_debt: 'Debito di sonno accumulato',
  none: 'Nessun problema critico',
};

export const CHRONOTYPE_LABELS: Record<Chronotype, { name: string; description: string }> = {
  lion:    { name: 'Leone', description: 'Mattiniero, picco cognitivo 6-10, 15% della popolazione' },
  bear:    { name: 'Orso', description: 'Segue il sole, picco 10-14, 55% della popolazione' },
  wolf:    { name: 'Lupo', description: 'Nottambulo, picco 17-21, 15% della popolazione' },
  dolphin: { name: 'Delfino', description: 'Sonno leggero, picco 10-14 con finestre brevi, 15%' },
};
