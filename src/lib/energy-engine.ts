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
  | 'burnout_risk' | 'sleep_debt' | 'circadian_misalignment'
  | 'hrv_low' | 'rhr_elevated' | 'emotional_drain' | 'none';

/** Evento futuro nella giornata con impatto energetico previsto */
export interface FutureEvent {
  time: number;             // decimal hour (e.g. 13.5 = 13:30)
  timeLabel: string;        // "13:30"
  type: 'meal' | 'work_end' | 'exercise' | 'bedtime' | 'caffeine_cutoff' | 'energy_peak' | 'energy_dip' | 'hydration_check' | 'break_needed';
  label: string;            // Italian description
  impact: number;           // -1 to +1 predicted impact
  advice: string;           // actionable tip
}

/** Proiezione futura dello stile di vita a fine giornata */
export interface LifestyleProjection {
  projectedHydrationPct: number;    // % del target idratazione a fine giornata
  caffeineAtBedtime: number;        // mg caffeina residua stimata all'ora di dormire
  projectedScreenMinutes: number;   // minuti schermo previsti a fine giornata
  exerciseDone: boolean;            // se ha gia fatto esercizio oggi
  exercisePlanned: boolean;         // se ha esercizio pianificato
  mealsRemaining: number;           // pasti principali rimanenti
  workHoursRemaining: number;       // ore lavoro rimanenti stimate
}

/** Pattern settimanale rilevato dai dati storici */
export interface WeeklyPattern {
  avgScoreByDayOfWeek: number[];    // 7 valori (0=dom, 6=sab), -1 se dato mancante
  bestDay: number;                  // giorno con media piu alta
  worstDay: number;                 // giorno con media piu bassa
  weekdayAvg: number;              // media lun-ven
  weekendAvg: number;              // media sab-dom
  isWeekendBetter: boolean;
  trendDescription: string;         // descrizione in italiano
}

/** Prospettiva futura completa della giornata */
export interface RoutineOutlook {
  events: FutureEvent[];
  lifestyleProjection: LifestyleProjection;
  weeklyPattern: WeeklyPattern;
  dailySummary: string;             // riassunto in italiano della giornata prevista
  optimalActionNow: string;         // cosa fare adesso per massimizzare la giornata
}

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
  // Future outlook: routine + lifestyle projection + weekly patterns
  futureOutlook: RoutineOutlook;
  // Component explanations (Italian, for UI)
  explanations: {
    circadian: string;
    sleep: string;
    lifestyle: string;
    allostatic: string;
  };
  // Detailed factors for AI and debug
  factors: Record<string, number>;
  // --- v3 Enhanced fields ---
  /** Confidence in the score based on data completeness and baseline maturity */
  confidence: DataConfidence;
  /** Personal baselines computed via EWMA (14-day rolling) */
  baselines: PersonalBaselines;
  /** Top 3 bottlenecks ranked by severity (not just 1) */
  topBottlenecks: RankedBottleneck[];
  /** Adaptive component weights (adjusted per individual sensitivity) */
  componentWeights: ComponentWeights;
  /** Score deviation from personal baseline (positive = above average) */
  baselineDeviation: number;
  /** Score stability indicator 0-1 (1 = very stable across recent calculations) */
  scoreStability: number;
}

// ---------------------------------------------------------------------------
// v3 Enhanced Types — Personal Baselines, Confidence, Adaptive Weights
// ---------------------------------------------------------------------------

/** EWMA-based personal baselines (Oura/WHOOP approach: compare to self, not population) */
export interface PersonalBaselines {
  avgScore: number;           // EWMA of overall scores
  avgSleep: number;           // EWMA of sleep component
  avgLifestyle: number;       // EWMA of lifestyle component
  avgAllostatic: number;      // EWMA of allostatic component
  avgCircadian: number;       // EWMA of circadian component
  avgHRV: number;             // EWMA of HRV indicator (0-1, -1 if no data)
  avgRHR: number;             // EWMA of resting heart rate bpm (-1 if no data)
  avgSleepHours: number;      // EWMA of nightly sleep hours
  avgStress: number;          // EWMA of stress levels (1-5)
  avgMood: number;            // EWMA of mood levels (1-5)
  avgSteps: number;           // EWMA of daily steps (-1 if no data)
  daysOfData: number;         // total days of historical data
  stdScore: number;           // std deviation of overall scores
  isReliable: boolean;        // true if daysOfData >= MIN_BASELINE_DAYS
}

/** Data confidence — how reliable is this score? */
export interface DataConfidence {
  overall: number;            // 0-1 composite confidence
  dataCompleteness: number;   // 0-1 how many checkin types logged today
  baselineMaturity: number;   // 0-1 how mature EWMA baselines are
  sensorQuality: number;      // 0-1 wearable/sensor data availability
  explanation: string;        // Italian description
}

/** Ranked bottleneck with severity and action */
export interface RankedBottleneck {
  type: Bottleneck;
  severity: number;           // 0-25 severity score
  label: string;              // Italian label
  action: string;             // Italian actionable advice
}

/** Adaptive component weights (sum = 100) */
export interface ComponentWeights {
  circadian: number;          // default 25
  sleep: number;              // default 25
  lifestyle: number;          // default 25
  allostatic: number;         // default 25
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
// v3 Enhanced Constants — EWMA, Confidence, Adaptive Scoring
// (Reserved for future v3 implementation — currently v2 engine active)
// ---------------------------------------------------------------------------

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
  bedTime: number;          // decimal hour (target bedtime)
  mealTimes: number[];      // decimal hours of today's meals
  mealGIEstimates: number[]; // estimated glycemic load per meal (0-1)
  futureMealTimes: number[]; // meal times not yet happened (from profile)
  workStartEstimate: number;
  workEndEstimate: number;   // when work/study ends
  exerciseTime: number | null;  // planned exercise time (decimal hour)
  exerciseDone: boolean;     // already exercised today
  lastActivityTime: number | null;
  optimalSleepHours: number; // individual optimal (profile vs default 8h)
}

function detectRoutine(data: AllData, chronotype: Chronotype): DetectedRoutine {
  const params = CHRONO_PARAMS[chronotype];
  const profile = data.profile;
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;

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

  // 2. Bed time: profile > heuristic from wake + sleep hours
  const optimalSleepHours = profile?.sleepHours ?? OPTIMAL_SLEEP_H;
  let bedTime = 23; // default
  if (profile?.typicalBedTime) {
    bedTime = timeToDecimal(profile.typicalBedTime);
  } else {
    // Estimate: 24h - wake + optimal sleep (adjusted for typical range)
    bedTime = clamp(wakeTime + 24 - optimalSleepHours, 21, 25.5);
    if (bedTime >= 24) bedTime -= 24; // normalize
  }

  // 3. Meal times: combine profile defaults + actual checkin/food data
  const mealTimes: number[] = [];
  const mealGIs: number[] = [];
  const futureMealTimes: number[] = [];

  // Profile meal defaults
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
  if (mealTimes.length === 0) {
    for (const defaultTime of profileMealDefaults) {
      if (defaultTime <= currentHour) {
        mealTimes.push(defaultTime);
        mealGIs.push(0.5);
      }
    }
  }

  // Future meals: profile defaults that haven't happened yet
  for (const defaultTime of profileMealDefaults) {
    if (defaultTime > currentHour && !mealTimes.some(mt => Math.abs(mt - defaultTime) < 1)) {
      futureMealTimes.push(defaultTime);
    }
  }

  // 4. Work schedule: start + end
  const workStart = profile?.workStartTime
    ? timeToDecimal(profile.workStartTime)
    : wakeTime + 1.5;

  const workEnd = profile?.workEndTime
    ? timeToDecimal(profile.workEndTime)
    : workStart + (profile?.dailyWorkHours ?? 8);

  // 5. Exercise: check if done today, or when planned
  const actCheckins = data.todayCheckins.filter(c => c.type === 'activity_done');
  const sportCheckins = data.todayCheckins.filter(c => c.type === 'current_activity' && c.value === 4);
  const exerciseDone = actCheckins.some(c => c.value >= 3) || sportCheckins.length > 0;

  let exerciseTime: number | null = null;
  if (!exerciseDone && profile?.exerciseTime && profile.exerciseTime !== 'none') {
    // Map exercise preference to approximate time
    const exerciseTimeMap: Record<string, number> = {
      morning: Math.max(wakeTime + 0.5, 7),
      afternoon: 15,
      evening: 18.5,
    };
    exerciseTime = exerciseTimeMap[profile.exerciseTime] ?? null;
    // Only include if it's still in the future
    if (exerciseTime != null && exerciseTime <= currentHour) {
      exerciseTime = null; // already passed but not logged as done
    }
  }

  // 6. Last activity time
  const lastAct = actCheckins.length > 0
    ? timeToDecimal(actCheckins[actCheckins.length - 1].time)
    : null;

  return {
    wakeTime,
    bedTime,
    mealTimes,
    mealGIEstimates: mealGIs,
    futureMealTimes,
    workStartEstimate: workStart,
    workEndEstimate: workEnd,
    exerciseTime,
    exerciseDone,
    lastActivityTime: lastAct,
    optimalSleepHours,
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // Work effort type: structured field > regex fallback on workType text
  const effortType = profile?.workEffortType
    ?? (profile?.workType?.match(/fisic|manual|operai|muratore|cantiere|magazzin/i) ? 'physical' as const : undefined);

  // Work hours burden — differentiated by effort type:
  //   physical: corpo sotto stress, piu impatto fisico, recupero muscolare lento
  //   mental: sovraccarico cognitivo, attenzione cala, rischio decision fatigue
  //   creative: simile a mental + drain emotivo (perfezionismo, frustrazione)
  //   social: alto drain emotivo (empatia, conflitti), moderato mentale
  //   mixed: impatto bilanciato fisico + mentale
  if (workHours > 10) {
    switch (effortType) {
      case 'physical': score -= 7; break;  // massimo impatto fisico
      case 'mental':   score -= 6; break;  // alto impatto cognitivo
      case 'creative': score -= 6; break;  // mental + emotional
      case 'social':   score -= 5; break;  // emotional drain elevato
      case 'mixed':    score -= 6; break;  // bilanciato
      default:         score -= 6; break;
    }
  } else if (workHours > 8) {
    switch (effortType) {
      case 'physical': score -= 4; break;
      case 'mental':   score -= 3; break;
      case 'creative': score -= 3; break;
      case 'social':   score -= 3; break;
      case 'mixed':    score -= 3; break;
      default:         score -= 3; break;
    }
  }

  // Stress (today's level + cumulative trend)
  const todayStress = data.todayCheckins.filter(c => c.type === 'stress');
  if (todayStress.length > 0) {
    const stressVal = todayStress[todayStress.length - 1].value;
    if (stressVal >= 4) score -= 4;
    else if (stressVal >= 3) score -= 2;
  }
  // Cumulative stress trend penalty
  if (stressTrend > 0.3) score -= 2;

  // Mood/emotional drain — amplificato per lavoro sociale/creativo
  const todayMood = data.todayCheckins.filter(c => c.type === 'mood');
  if (todayMood.length > 0) {
    const moodVal = todayMood[todayMood.length - 1].value;
    const emotionalRole = effortType === 'social' || effortType === 'creative';
    if (moodVal <= 2) score -= emotionalRole ? 4 : 3;  // drain emotivo piu impattante
    else if (moodVal <= 3) score -= emotionalRole ? 2 : 1;
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

  // Focus drain — amplificato per lavoro mentale/creativo (cognitive overload indicator)
  const todayFocus = data.todayCheckins.filter(c => c.type === 'focus');
  if (todayFocus.length > 0) {
    const focusVal = todayFocus[todayFocus.length - 1].value;
    const cognitiveRole = effortType === 'mental' || effortType === 'creative';
    if (focusVal <= 2) score -= cognitiveRole ? 3 : 2; // cognitive exhaustion
  }

  // Current activity context: studio/lavoro prolungato = carico cognitivo
  const curActAlloCheckins = data.todayCheckins.filter(c => c.type === 'current_activity');
  if (curActAlloCheckins.length >= 3) {
    // Conteggio sessioni consecutive studio/lavoro senza pausa
    const recent = curActAlloCheckins.slice(-4);
    const consecutiveWork = recent.filter(c => c.value === 1 || c.value === 2).length;
    if (consecutiveWork >= 3) {
      // Lavoro continuativo pesa di piu se mentale/creativo (decision fatigue)
      const cognitiveRole = effortType === 'mental' || effortType === 'creative';
      score -= cognitiveRole ? 3 : 2;
    }
  }

  // Recovery factors
  const breaks = data.todayCheckins.filter(c => c.type === 'screen_break')
    .reduce((s, c) => s + c.value, 0);
  const supplements = data.todayCheckins.filter(c => c.type === 'supplement')
    .reduce((s, c) => s + c.value, 0);
  if (breaks >= 3) score += 1;        // taking breaks helps recovery
  if (supplements > 0) score += 0.5;  // minimal but positive signal

  score = clamp(Math.round(score), 0, 25);

  // Effort type labels for explanations
  const EFFORT_LABELS: Record<string, string> = {
    physical: 'fisico', mental: 'mentale', mixed: 'misto',
    creative: 'creativo', social: 'relazionale',
  };

  // Explanation
  const parts: string[] = [];
  if (workHours > 8) {
    const effortLabel = effortType ? ` (sforzo ${EFFORT_LABELS[effortType] ?? effortType})` : '';
    parts.push(`${workHours}h di lavoro${effortLabel}`);
  }
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
// 10. Bottleneck Identification (ranked by severity)
// ---------------------------------------------------------------------------

function identifyBottleneck(
  sleepAnalysis: SleepAnalysis,
  lifestyleAnalysis: LifestyleAnalysis,
  allostaticAnalysis: AllostaticAnalysis,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
// 11. Weekly Pattern Recognition
//     Analizza i dati degli ultimi 28 giorni per rilevare pattern settimanali
// ---------------------------------------------------------------------------

function analyzeWeeklyPattern(recentScores: ScientificEnergyScore[], recentLogs: EnergyLog[]): WeeklyPattern {
  // Default fallback
  const defaultPattern: WeeklyPattern = {
    avgScoreByDayOfWeek: [-1, -1, -1, -1, -1, -1, -1],
    bestDay: -1,
    worstDay: -1,
    weekdayAvg: -1,
    weekendAvg: -1,
    isWeekendBetter: false,
    trendDescription: 'Dati insufficienti per rilevare pattern settimanali',
  };

  // Combine scientific scores and energy logs to get per-day scores
  const dayScores: number[][] = [[], [], [], [], [], [], []]; // Sun(0)..Sat(6)

  for (const score of recentScores) {
    const dayOfWeek = new Date(score.date + 'T12:00:00').getDay();
    dayScores[dayOfWeek].push(score.overallScore);
  }

  // Supplement with energy logs (converted to 0-100 scale) if scientific scores are sparse
  if (recentScores.length < 7) {
    for (const log of recentLogs) {
      const dayOfWeek = new Date(log.date + 'T12:00:00').getDay();
      const logScore = Math.round(((log.physical + log.mental + log.emotional) / 3) * 10);
      dayScores[dayOfWeek].push(logScore);
    }
  }

  // Need at least 3 different days with data
  const daysWithData = dayScores.filter(d => d.length > 0).length;
  if (daysWithData < 3) return defaultPattern;

  // Compute averages per day
  const avgByDay = dayScores.map(scores =>
    scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : -1
  );

  // Find best/worst day (only among days with data)
  const validDays = avgByDay
    .map((v, i) => ({ day: i, avg: v }))
    .filter(d => d.avg >= 0);

  if (validDays.length === 0) return defaultPattern;

  validDays.sort((a, b) => b.avg - a.avg);
  const bestDay = validDays[0].day;
  const worstDay = validDays[validDays.length - 1].day;

  // Weekday (Mon-Fri = 1-5) vs weekend (Sat=6, Sun=0)
  const weekdayScores = [1, 2, 3, 4, 5].flatMap(d => dayScores[d]);
  const weekendScores = [0, 6].flatMap(d => dayScores[d]);

  const weekdayAvg = weekdayScores.length > 0
    ? Math.round(weekdayScores.reduce((s, v) => s + v, 0) / weekdayScores.length)
    : -1;
  const weekendAvg = weekendScores.length > 0
    ? Math.round(weekendScores.reduce((s, v) => s + v, 0) / weekendScores.length)
    : -1;

  const isWeekendBetter = weekendAvg > weekdayAvg && weekdayAvg >= 0 && weekendAvg >= 0;

  // Generate description
  const dayNames = ['domenica', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato'];
  const parts: string[] = [];

  if (weekdayAvg >= 0 && weekendAvg >= 0) {
    const diff = weekendAvg - weekdayAvg;
    if (Math.abs(diff) >= 5) {
      parts.push(isWeekendBetter
        ? `Energia +${diff}pt nel weekend rispetto alla settimana lavorativa`
        : `Energia ${diff}pt nel weekend (piu attivo durante la settimana)`
      );
    }
  }

  if (bestDay >= 0 && avgByDay[bestDay] >= 0) {
    parts.push(`Giorno migliore: ${dayNames[bestDay]} (media ${avgByDay[bestDay]})`);
  }
  if (worstDay >= 0 && avgByDay[worstDay] >= 0 && worstDay !== bestDay) {
    parts.push(`Giorno critico: ${dayNames[worstDay]} (media ${avgByDay[worstDay]})`);
  }

  return {
    avgScoreByDayOfWeek: avgByDay,
    bestDay,
    worstDay,
    weekdayAvg,
    weekendAvg,
    isWeekendBetter,
    trendDescription: parts.length > 0 ? parts.join('. ') : 'Pattern settimanale regolare',
  };
}

// ---------------------------------------------------------------------------
// 12. Lifestyle Projection
//     Proietta idratazione, caffeina, screen time, pasti e lavoro a fine giornata
// ---------------------------------------------------------------------------

function projectLifestyle(
  data: AllData,
  routine: DetectedRoutine,
  currentHour: number,
  lifestyleAnalysis: LifestyleAnalysis,
): LifestyleProjection {
  const profile = data.profile;

  // Hydration projection: current rate extrapolated to bedtime
  const hoursElapsed = Math.max(1, currentHour - routine.wakeTime);
  const waterPerHour = lifestyleAnalysis.waterGlasses / hoursElapsed;
  const hoursRemaining = Math.max(0, (routine.bedTime > currentHour ? routine.bedTime : routine.bedTime + 24) - currentHour);
  const dailyTarget = profile
    ? Math.round((profile.weightKg * HYDRATION_ML_PER_KG) / GLASS_ML)
    : 8;
  const projectedWater = lifestyleAnalysis.waterGlasses + waterPerHour * hoursRemaining;
  const projectedHydrationPct = dailyTarget > 0 ? Math.round((projectedWater / dailyTarget) * 100) : 100;

  // Caffeine at bedtime: compute remaining mg at bedtime from all today's intakes
  const bedTimeEffective = routine.bedTime < currentHour ? routine.bedTime + 24 : routine.bedTime;
  const cafCheckins = data.todayCheckins.filter(c => c.type === 'caffeine');
  let caffeineAtBedtime = 0;
  for (const ci of cafCheckins) {
    const intakeHour = timeToDecimal(ci.time);
    const hoursUntilBed = bedTimeEffective - intakeHour;
    if (hoursUntilBed > 0) {
      const initialMg = ci.value * CAFFEINE_MG_PER_ESPRESSO;
      caffeineAtBedtime += initialMg * Math.pow(0.5, hoursUntilBed / CAFFEINE_HALF_LIFE_H);
    }
  }

  // Screen time projection
  const screenRate = data.screenTime?.minutes
    ? data.screenTime.minutes / hoursElapsed
    : 0;
  const projectedScreenMinutes = Math.round(
    (data.screenTime?.minutes ?? 0) + screenRate * hoursRemaining
  );

  // Meals remaining
  const mealsEaten = data.todayCheckins.filter(c => c.type === 'meal_time').length;
  const expectedMeals = 3; // colazione + pranzo + cena standard
  const mealsRemaining = Math.max(0, expectedMeals - mealsEaten);

  // Work hours remaining
  let workHoursRemaining = 0;
  if (currentHour < routine.workEndEstimate) {
    workHoursRemaining = Math.max(0, routine.workEndEstimate - currentHour);
  }

  return {
    projectedHydrationPct: clamp(projectedHydrationPct, 0, 200),
    caffeineAtBedtime: Math.round(caffeineAtBedtime),
    projectedScreenMinutes,
    exerciseDone: routine.exerciseDone,
    exercisePlanned: routine.exerciseTime != null,
    mealsRemaining,
    workHoursRemaining: Math.round(workHoursRemaining * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// 13. Future Event Timeline Generator
//     Genera la sequenza di eventi futuri con impatto energetico previsto
// ---------------------------------------------------------------------------

function formatHour(decimalHour: number): string {
  const h = Math.floor(decimalHour) % 24;
  const m = Math.round((decimalHour % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function generateFutureTimeline(
  routine: DetectedRoutine,
  currentHour: number,
  currentScore: number,
  _chronotype: Chronotype,
  lifestyleAnalysis: LifestyleAnalysis,
  lifestyleProjection: LifestyleProjection,
  predictedCurve: number[],
  sleepDebt: number,
): FutureEvent[] {
  const events: FutureEvent[] = [];
  const bedTimeEffective = routine.bedTime < currentHour ? routine.bedTime + 24 : routine.bedTime;
  const hoursUntilBed = bedTimeEffective - currentHour;

  // --- Future meals from profile ---
  for (const mealTime of routine.futureMealTimes) {
    if (mealTime > currentHour) {
      const isLunch = mealTime >= 11 && mealTime <= 14.5;
      events.push({
        time: mealTime,
        timeLabel: formatHour(mealTime),
        type: 'meal',
        label: isLunch ? 'Pranzo previsto' : 'Cena prevista',
        impact: -0.2, // post-prandial dip incoming
        advice: isLunch
          ? 'Pasto bilanciato con proteine e carboidrati complessi per minimizzare il calo post-prandiale'
          : 'Cena leggera per non disturbare il sonno. Evita pasti pesanti nelle 2h prima di dormire',
      });
    }
  }

  // --- Work end ---
  if (currentHour < routine.workEndEstimate && routine.workEndEstimate <= bedTimeEffective) {
    events.push({
      time: routine.workEndEstimate,
      timeLabel: formatHour(routine.workEndEstimate),
      type: 'work_end',
      label: `Fine lavoro prevista`,
      impact: 0.3,
      advice: lifestyleProjection.workHoursRemaining > 3
        ? 'Lunga giornata davanti. Pianifica pause regolari ogni 90 minuti (ciclo BRAC)'
        : 'Quasi finito. Prepara una transizione graduale verso il relax',
    });
  }

  // --- Exercise ---
  if (routine.exerciseTime != null && routine.exerciseTime > currentHour) {
    events.push({
      time: routine.exerciseTime,
      timeLabel: formatHour(routine.exerciseTime),
      type: 'exercise',
      label: 'Esercizio pianificato',
      impact: 0.5,
      advice: currentScore < 40
        ? 'Energia bassa: considera un allenamento leggero (camminata, stretching) invece di sessioni intense'
        : 'Buon momento per allenarti. L\'esercizio dara un boost di energia (effetto POMS)',
    });
  } else if (!routine.exerciseDone && routine.exerciseTime == null && currentHour < 20) {
    // Suggest exercise if not done and not planned
    const suggestedTime = currentHour < 16 ? currentHour + 1 : 18;
    if (suggestedTime < bedTimeEffective - 2) {
      events.push({
        time: suggestedTime,
        timeLabel: formatHour(suggestedTime),
        type: 'exercise',
        label: 'Esercizio consigliato',
        impact: 0.4,
        advice: 'Anche 15-20 minuti di movimento moderato possono aumentare l\'energia per le ore successive',
      });
    }
  }

  // --- Caffeine cutoff ---
  const caffeineCutoff = routine.bedTime - CAFFEINE_HALF_LIFE_H; // 5h prima di dormire
  const cutoffEffective = caffeineCutoff < 0 ? caffeineCutoff + 24 : caffeineCutoff;
  if (currentHour < cutoffEffective && cutoffEffective < bedTimeEffective) {
    const hasCaffeine = lifestyleAnalysis.caffeineCount > 0;
    events.push({
      time: cutoffEffective,
      timeLabel: formatHour(cutoffEffective),
      type: 'caffeine_cutoff',
      label: 'Limite caffeina per il sonno',
      impact: hasCaffeine ? -0.1 : 0,
      advice: lifestyleProjection.caffeineAtBedtime > 50
        ? `Caffeina residua a letto stimata: ${lifestyleProjection.caffeineAtBedtime}mg. Smetti di bere caffe adesso per dormire meglio`
        : 'Nessuna caffeina dopo quest\'ora per proteggere la qualita del sonno',
    });
  }

  // --- Hydration check ---
  const waterRatio = lifestyleAnalysis.targetWater > 0
    ? lifestyleAnalysis.waterGlasses / lifestyleAnalysis.targetWater
    : 1;
  if (waterRatio < 0.7 && hoursUntilBed > 2) {
    const checkTime = currentHour + 1;
    events.push({
      time: checkTime,
      timeLabel: formatHour(checkTime),
      type: 'hydration_check',
      label: 'Promemoria idratazione',
      impact: 0.2,
      advice: lifestyleProjection.projectedHydrationPct < 70
        ? `Al ritmo attuale raggiungerai solo il ${lifestyleProjection.projectedHydrationPct}% del target. Bevi 2-3 bicchieri nelle prossime ore`
        : 'Bevi un bicchiere d\'acqua per mantenere l\'idratazione',
    });
  }

  // --- Break needed (if working for long consecutive period) ---
  if (lifestyleProjection.workHoursRemaining > 2 && currentHour >= routine.workStartEstimate) {
    const breakTime = currentHour + 1.5; // suggest break after ~90 min (BRAC cycle)
    if (breakTime < routine.workEndEstimate) {
      events.push({
        time: breakTime,
        timeLabel: formatHour(breakTime),
        type: 'break_needed',
        label: 'Pausa suggerita (ciclo BRAC)',
        impact: 0.15,
        advice: 'Ciclo ultrardiano di 90 minuti in arrivo. Una pausa di 10-15 minuti migliora la concentrazione',
      });
    }
  }

  // --- Energy peak and dip from predicted curve ---
  if (predictedCurve.length > 2) {
    let peakIdx = 0;
    let dipIdx = 0;
    for (let i = 1; i < predictedCurve.length; i++) {
      if (predictedCurve[i] > predictedCurve[peakIdx]) peakIdx = i;
      if (predictedCurve[i] < predictedCurve[dipIdx]) dipIdx = i;
    }

    const peakHour = currentHour + peakIdx + 1;
    const dipHour = currentHour + dipIdx + 1;

    if (predictedCurve[peakIdx] > currentScore + 5 && peakHour < bedTimeEffective) {
      events.push({
        time: peakHour,
        timeLabel: formatHour(peakHour % 24),
        type: 'energy_peak',
        label: `Picco energia previsto (${predictedCurve[peakIdx]}pt)`,
        impact: 0.6,
        advice: 'Finestra ideale per attivita ad alta concentrazione, decisioni importanti o lavoro creativo',
      });
    }

    if (predictedCurve[dipIdx] < currentScore - 5 && dipHour < bedTimeEffective && Math.abs(peakIdx - dipIdx) > 1) {
      events.push({
        time: dipHour,
        timeLabel: formatHour(dipHour % 24),
        type: 'energy_dip',
        label: `Calo energia previsto (${predictedCurve[dipIdx]}pt)`,
        impact: -0.4,
        advice: 'Previsto un calo. Pianifica attivita a basso impegno cognitivo o una pausa attiva',
      });
    }
  }

  // --- Bedtime approach ---
  if (hoursUntilBed > 0 && hoursUntilBed <= 14) {
    // Wind-down suggestion 1h before bed
    const windDownTime = bedTimeEffective - 1;
    if (windDownTime > currentHour) {
      events.push({
        time: windDownTime % 24,
        timeLabel: formatHour(windDownTime % 24),
        type: 'bedtime',
        label: 'Inizio routine serale',
        impact: 0,
        advice: sleepDebt > 3
          ? `Debito sonno di ${sleepDebt.toFixed(1)}h. Vai a letto puntuale e evita schermi nell'ultima ora`
          : 'Inizia il rilassamento: luci basse, niente schermi, attivita calme',
      });
    }
  }

  // Sort by time
  events.sort((a, b) => {
    const aTime = a.time < currentHour ? a.time + 24 : a.time;
    const bTime = b.time < currentHour ? b.time + 24 : b.time;
    return aTime - bTime;
  });

  return events;
}

// ---------------------------------------------------------------------------
// 14. Routine Outlook Summary
//     Genera il riassunto giornaliero e il consiglio ottimale per adesso
// ---------------------------------------------------------------------------

function generateDailySummary(
  currentScore: number,
  routine: DetectedRoutine,
  events: FutureEvent[],
  weeklyPattern: WeeklyPattern,
  lifestyleProjection: LifestyleProjection,
  sleepDebt: number,
  allostaticAnalysis: AllostaticAnalysis,
): { dailySummary: string; optimalActionNow: string } {
  const parts: string[] = [];
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const dayOfWeek = now.getDay();

  // Energy trajectory
  const positiveEvents = events.filter(e => e.impact > 0.2);
  const challengeCount = events.filter(e => e.impact < -0.2).length;

  if (challengeCount > 2) {
    parts.push(`${challengeCount} sfide energetiche previste`);
  }

  if (currentScore >= 70) {
    parts.push('Energia buona');
  } else if (currentScore >= 45) {
    parts.push('Energia nella media');
  } else {
    parts.push('Energia sotto la media');
  }

  // Work context
  if (lifestyleProjection.workHoursRemaining > 0) {
    parts.push(`${lifestyleProjection.workHoursRemaining}h di lavoro rimanenti`);
  } else if (currentHour > routine.workEndEstimate) {
    parts.push('giornata lavorativa conclusa');
  }

  // Lifestyle alerts
  if (lifestyleProjection.projectedHydrationPct < 60) {
    parts.push(`idratazione prevista solo ${lifestyleProjection.projectedHydrationPct}%`);
  }
  if (lifestyleProjection.caffeineAtBedtime > 80) {
    parts.push(`caffeina residua alta a letto (~${lifestyleProjection.caffeineAtBedtime}mg)`);
  }

  // Weekly context
  if (weeklyPattern.avgScoreByDayOfWeek[dayOfWeek] >= 0) {
    const todayAvg = weeklyPattern.avgScoreByDayOfWeek[dayOfWeek];
    if (currentScore > todayAvg + 10) {
      parts.push(`sopra la tua media per questo giorno della settimana (+${currentScore - todayAvg}pt)`);
    } else if (currentScore < todayAvg - 10) {
      parts.push(`sotto la tua media per questo giorno (-${todayAvg - currentScore}pt)`);
    }
  }

  // Sleep debt context
  if (sleepDebt > 3) {
    parts.push(`debito sonno ${sleepDebt.toFixed(1)}h da recuperare`);
  }

  // Burnout context
  if (allostaticAnalysis.burnoutRisk === 'high' || allostaticAnalysis.burnoutRisk === 'critical') {
    parts.push('attenzione al rischio burnout');
  }

  const dailySummary = parts.join('. ') + '.';

  // Optimal action now
  let optimalActionNow: string;
  if (currentScore <= 30) {
    optimalActionNow = 'Priorita al recupero: pausa, idratazione, respirazione profonda. Rimanda attivita cognitive intense.';
  } else if (currentScore <= 50) {
    if (lifestyleProjection.workHoursRemaining > 3) {
      optimalActionNow = 'Gestisci le energie: alterna blocchi di 25 min di lavoro con pause di 5 min (Pomodoro). Bevi acqua.';
    } else {
      optimalActionNow = 'Completa i compiti essenziali e passa ad attivita piu leggere. Il corpo chiede di rallentare.';
    }
  } else if (currentScore >= 75) {
    if (currentHour < routine.workEndEstimate) {
      optimalActionNow = 'Momento ideale per il lavoro piu impegnativo. Sfrutta questo picco per decisioni importanti e compiti creativi.';
    } else {
      optimalActionNow = 'Ottima energia. Sfruttala per attivita personali di valore: sport, studio, progetti creativi.';
    }
  } else {
    // 50-75 range
    if (!routine.exerciseDone && routine.exerciseTime == null && currentHour < 20) {
      optimalActionNow = 'Buon livello energetico. Un po\' di movimento fisico ora potrebbe darti un boost per il resto della giornata.';
    } else if (positiveEvents.length > 0) {
      optimalActionNow = `Fase stabile. Nelle prossime ore previsto: ${positiveEvents[0].label.toLowerCase()}. Gestisci i compiti con ritmo regolare.`;
    } else {
      optimalActionNow = 'Energia stabile. Procedi con le attivita pianificate e mantieni idratazione e pause regolari.';
    }
  }

  return { dailySummary, optimalActionNow };
}

// ---------------------------------------------------------------------------
// 15. Enhanced Prediction Curve (routine-aware)
//     Migliora la previsione includendo eventi routine e pattern settimanali
// ---------------------------------------------------------------------------

function predictEnergyCurveEnhanced(
  chronotype: Chronotype,
  currentHour: number,
  currentScore: number,
  sleepDebt: number,
  caffeineRemaining: number,
  routine: DetectedRoutine,
  hoursAwake: number,
  sleepQuality01: number,
  weeklyPattern: WeeklyPattern,
  allostaticAnalysis: AllostaticAnalysis,
): number[] {
  const predicted: number[] = [];
  const bedTimeEffective = routine.bedTime < currentHour ? routine.bedTime + 24 : routine.bedTime;

  for (let offset = 1; offset <= 12; offset++) {
    const futureHour = (currentHour + offset) % 24;
    const futureHoursAwake = hoursAwake + offset;

    // --- Base circadian model ---
    const circAlertness = computeCircadianAlertness(chronotype, futureHour);
    const futureS = computeProcessS(futureHoursAwake, sleepQuality01);

    // --- Post-prandial dip (include future meals from profile) ---
    const allMealTimes = [...routine.mealTimes, ...routine.futureMealTimes];
    // Add default meals if not present
    if (!allMealTimes.some(t => t >= 12 && t <= 14) && futureHour >= 12) {
      allMealTimes.push(13);
    }
    if (!allMealTimes.some(t => t >= 19 && t <= 21) && futureHour >= 19) {
      allMealTimes.push(20);
    }
    const ppDip = computePostPrandialDip(futureHour, allMealTimes,
      allMealTimes.map(() => 0.5));

    // --- Caffeine decay ---
    const cafDecay = caffeineRemaining * Math.pow(0.5, offset / CAFFEINE_HALF_LIFE_H);
    const cafBoost = clamp(cafDecay / (3 * CAFFEINE_MG_PER_ESPRESSO), 0, 0.08);

    // --- Sleep debt drag (increases with wakefulness) ---
    const debtDrag = Math.min(0.15, sleepDebt * 0.015 * (1 + futureHoursAwake * 0.01));

    // --- Work fatigue factor ---
    // Cognitive load accumulates during work hours, reduces after work ends
    let workFatigueModifier = 0;
    if (futureHour >= routine.workStartEstimate && futureHour <= routine.workEndEstimate) {
      // During work: progressive fatigue
      const workHoursSoFar = futureHour - routine.workStartEstimate;
      workFatigueModifier = -0.02 * Math.max(0, workHoursSoFar - 4); // fatigue after 4h
    } else if (futureHour > routine.workEndEstimate && futureHour < routine.workEndEstimate + 2) {
      // Post-work recovery bounce (relief effect)
      workFatigueModifier = 0.03;
    }

    // --- Exercise boost/recovery ---
    let exerciseModifier = 0;
    if (routine.exerciseTime != null) {
      const hoursAfterExercise = futureHour - routine.exerciseTime;
      if (hoursAfterExercise >= 0 && hoursAfterExercise < 0.5) {
        exerciseModifier = -0.05; // during/immediate post = slight dip
      } else if (hoursAfterExercise >= 0.5 && hoursAfterExercise < 3) {
        // POMS vigor boost: peaks ~1h after, lasts 2-3h
        exerciseModifier = 0.08 * gaussian(hoursAfterExercise, 1.5, 1.0);
      }
    }

    // --- Bedtime approach: natural wind-down ---
    let windDownModifier = 0;
    const hoursUntilBed = bedTimeEffective - (currentHour + offset);
    if (hoursUntilBed >= 0 && hoursUntilBed < 2) {
      windDownModifier = -0.05 * (1 - hoursUntilBed / 2); // gradual decrease
    }

    // --- Allostatic cumulative drag ---
    let allostaticDrag = 0;
    if (allostaticAnalysis.burnoutRisk === 'critical') allostaticDrag = -0.05;
    else if (allostaticAnalysis.burnoutRisk === 'high') allostaticDrag = -0.03;
    else if (allostaticAnalysis.burnoutRisk === 'moderate') allostaticDrag = -0.01;

    // --- Weekly pattern adjustment ---
    let weeklyAdj = 0;
    const dayOfWeek = new Date().getDay();
    if (weeklyPattern.avgScoreByDayOfWeek[dayOfWeek] >= 0 && weeklyPattern.weekdayAvg >= 0) {
      const dayAvg = weeklyPattern.avgScoreByDayOfWeek[dayOfWeek];
      const overallAvg = weeklyPattern.weekdayAvg;
      // If today is typically better/worse than average, adjust slightly
      weeklyAdj = clamp((dayAvg - overallAvg) / 100 * 0.3, -0.05, 0.05);
    }

    // --- Combined future alertness ---
    const futureAlertness = clamp(
      circAlertness
      - futureS * 0.35
      - ppDip
      + cafBoost
      - debtDrag
      + workFatigueModifier
      + exerciseModifier
      + windDownModifier
      + allostaticDrag
      + weeklyAdj,
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
// Public API
// ---------------------------------------------------------------------------

/**
 * Calcola il punteggio energetico scientifico v2.
 * Integra TUTTE le fonti dati: profilo, checkin, food scanner, screen time,
 * Sahha biomarkers, sleep debt, caffeine pharmacokinetics, HRV.
 * Include proiezione futura basata su routine e stile di vita dell'utente.
 */
export async function computeScientificEnergy(userId: number): Promise<EnergyBreakdown> {
  // 1. Gather ALL data
  const data = await gatherAllData(userId);

  // 2. Estimate chronotype
  const chronotype = estimateChronotype(data.profile);

  // 3. Detect routine (enhanced: includes bedtime, exercise, work end)
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

  // 9. Weekly pattern analysis (from historical scores + logs)
  const [recentScores] = await Promise.all([
    db.scientificEnergyScores.where('userId').equals(userId).toArray()
      .then(scores => scores.sort((a, b) => a.date.localeCompare(b.date)).slice(-28))
      .catch(() => [] as ScientificEnergyScore[]),
  ]);
  const weeklyPattern = analyzeWeeklyPattern(recentScores, data.recentEnergyLogs);

  // 10. Predicted curve (12 hours) — enhanced with routine + weekly patterns
  const predictedCurve = predictEnergyCurveEnhanced(
    chronotype, currentHour, overall, sleepResult.sleepDebt,
    lifestyleResult.caffeineRemaining, routine, hoursAwake, sleepQuality01,
    weeklyPattern, allostaticResult,
  );

  // 11. Bottleneck
  const bottleneck = identifyBottleneck(sleepResult, lifestyleResult, allostaticResult, circResult.score);

  // 12. Lifestyle projection (future projections for the rest of the day)
  const lifestyleProjection = projectLifestyle(data, routine, currentHour, lifestyleResult);

  // 13. Future event timeline
  const futureEvents = generateFutureTimeline(
    routine, currentHour, overall, chronotype,
    lifestyleResult, lifestyleProjection, predictedCurve, sleepResult.sleepDebt,
  );

  // 14. Daily summary and optimal action
  const { dailySummary, optimalActionNow } = generateDailySummary(
    overall, routine, futureEvents, weeklyPattern,
    lifestyleProjection, sleepResult.sleepDebt, allostaticResult,
  );

  // 15. Compose future outlook
  const futureOutlook: RoutineOutlook = {
    events: futureEvents,
    lifestyleProjection,
    weeklyPattern,
    dailySummary,
    optimalActionNow,
  };

  // 16. Detailed factors for AI and storage
  const factors: Record<string, number> = {
    // Circadian
    process_c: Math.round(circResult.processC * 100) / 100,
    process_s: Math.round(circResult.processS * 100) / 100,
    hours_awake: Math.round(hoursAwake * 10) / 10,
    wake_time: Math.round(routine.wakeTime * 10) / 10,
    bed_time: Math.round(routine.bedTime * 10) / 10,
    // Sleep
    sleep_quality: sleepResult.lastNightQuality ?? -1,
    sleep_hours: sleepResult.lastNightHours ?? -1,
    sleep_debt_hours: Math.round(sleepResult.sleepDebt * 10) / 10,
    nap_recovery: Math.round(sleepResult.napRecovery * 10) / 10,
    optimal_sleep_hours: routine.optimalSleepHours,
    // Lifestyle
    water_glasses: lifestyleResult.waterGlasses,
    water_target: lifestyleResult.targetWater,
    caffeine_count: lifestyleResult.caffeineCount,
    caffeine_remaining_mg: Math.round(lifestyleResult.caffeineRemaining),
    caffeine_at_bedtime_mg: lifestyleProjection.caffeineAtBedtime,
    meal_quality: lifestyleResult.mealQuality ?? -1,
    meals_logged: lifestyleResult.mealsLogged,
    meals_remaining: lifestyleProjection.mealsRemaining,
    projected_hydration_pct: lifestyleProjection.projectedHydrationPct,
    activity_level: lifestyleResult.activityLevel ?? -1,
    exercise_done: routine.exerciseDone ? 1 : 0,
    stress_level: lifestyleResult.stressLevel ?? -1,
    mood_level: lifestyleResult.moodLevel ?? -1,
    focus_level: lifestyleResult.focusLevel ?? -1,
    screen_minutes: lifestyleResult.screenMinutes,
    projected_screen_minutes: lifestyleProjection.projectedScreenMinutes,
    // Allostatic
    work_hours: allostaticResult.workHours,
    work_hours_remaining: lifestyleProjection.workHoursRemaining,
    work_end_time: Math.round(routine.workEndEstimate * 10) / 10,
    // work_effort_type: 1=mental, 2=physical, 3=mixed, 4=creative, 5=social, 0=unknown
    work_effort_type: data.profile?.workEffortType === 'mental' ? 1
      : data.profile?.workEffortType === 'physical' ? 2
      : data.profile?.workEffortType === 'mixed' ? 3
      : data.profile?.workEffortType === 'creative' ? 4
      : data.profile?.workEffortType === 'social' ? 5 : 0,
    consecutive_low_days: allostaticResult.consecutiveLowDays,
    stress_trend: Math.round(allostaticResult.stressTrend * 100) / 100,
    hrv_indicator: allostaticResult.hrvIndicator ?? -1,
    // Weekly pattern
    weekday_avg: weeklyPattern.weekdayAvg,
    weekend_avg: weeklyPattern.weekendAvg,
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
    futureOutlook,
    explanations: {
      circadian: circResult.explanation,
      sleep: sleepResult.explanation,
      lifestyle: lifestyleResult.explanation,
      allostatic: allostaticResult.explanation,
    },
    factors,
    // v3 stub defaults (populated when v3 engine is implemented)
    confidence: {
      overall: 0.5,
      dataCompleteness: 0.5,
      baselineMaturity: 0,
      sensorQuality: 0,
      explanation: 'Baseline v3 non ancora attivo — valori predefiniti.',
    },
    baselines: {
      avgScore: overall,
      avgSleep: sleepResult.score,
      avgLifestyle: lifestyleResult.score,
      avgAllostatic: allostaticResult.score,
      avgCircadian: circResult.score,
      avgHRV: -1,
      avgRHR: -1,
      avgSleepHours: -1,
      avgStress: -1,
      avgMood: -1,
      avgSteps: -1,
      daysOfData: 0,
      stdScore: 0,
      isReliable: false,
    },
    topBottlenecks: bottleneck !== 'none'
      ? [{ type: bottleneck, severity: 15, label: bottleneck, action: '' }]
      : [],
    componentWeights: { circadian: 25, sleep: 25, lifestyle: 25, allostatic: 25 },
    baselineDeviation: 0,
    scoreStability: 0.5,
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
  circadian_misalignment: 'Cerca di svegliarti e andare a letto alla stessa ora ogni giorno.',
  hrv_low: 'HRV bassa: priorita al recupero. Evita allenamenti intensi oggi.',
  rhr_elevated: 'Frequenza cardiaca alta: riposo, idratazione e gestione dello stress.',
  emotional_drain: 'Stanchezza emotiva: prenditi del tempo per te, evita decisioni importanti.',
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
  circadian_misalignment: 'Disallineamento circadiano',
  hrv_low: 'HRV bassa',
  rhr_elevated: 'Frequenza cardiaca elevata',
  emotional_drain: 'Esaurimento emotivo',
  none: 'Nessun problema critico',
};

export const CHRONOTYPE_LABELS: Record<Chronotype, { name: string; description: string }> = {
  lion:    { name: 'Leone', description: 'Mattiniero, picco cognitivo 6-10, 15% della popolazione' },
  bear:    { name: 'Orso', description: 'Segue il sole, picco 10-14, 55% della popolazione' },
  wolf:    { name: 'Lupo', description: 'Nottambulo, picco 17-21, 15% della popolazione' },
  dolphin: { name: 'Delfino', description: 'Sonno leggero, picco 10-14 con finestre brevi, 15%' },
};
