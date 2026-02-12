// ---------------------------------------------------------------------------
// Scientific Energy Engine — Modello energetico basato su evidenze scientifiche
//
// Componenti del punteggio (0-100):
//   1. Circadiano (0-25): cronobiologia, ritmi ultradiani, cronotipo
//   2. Sonno (0-25): durata, qualita, debito cumulativo
//   3. Stile di vita (0-25): idratazione, nutrizione, caffeina, attivita
//   4. Carico allostatico (0-25): stress, ore lavoro, recupero, trend
//
// Riferimenti scientifici:
//   - Cortisol Awakening Response: Fries et al. 2009, Psychoneuroendocrinology
//   - Ultradian rhythms: Kleitman 1963, BRAC cycles
//   - Chronotypes: Breus 2016 (Lion/Bear/Wolf/Dolphin)
//   - Sleep debt: Van Dongen et al. 2003, Sleep
//   - Post-prandial somnolence: Carskadon & Dement, circadian dip
//   - Caffeine half-life: Nehlig 2018, ~5h mean, CYP1A2 variation
//   - Allostatic load: McEwen 1998, NEJM
// ---------------------------------------------------------------------------

import { db } from '../db/db';
import type { ScientificEnergyScore, UserProfile, EnergyLog, QuickCheckin, FoodLog } from '../db/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Chronotype = 'lion' | 'bear' | 'wolf' | 'dolphin';
export type Bottleneck = 'sleep' | 'hydration' | 'nutrition' | 'stress' | 'overwork' | 'inactivity' | 'none';

export interface EnergyBreakdown {
  overall: number;          // 0-100
  circadian: number;        // 0-25
  sleep: number;            // 0-25
  lifestyle: number;        // 0-25
  allostatic: number;       // 0-25
  chronotype: Chronotype;
  predictedCurve: number[]; // 6 values (next 6 hours)
  bottleneck: Bottleneck;
  sleepDebt: number;        // ore
  factors: Record<string, number>; // dettagli per spiegazione
}

// ---------------------------------------------------------------------------
// Costanti scientifiche
// ---------------------------------------------------------------------------

/** Ore di sonno ottimali per adulti (NSF: 7-9h, media 8h) */
const OPTIMAL_SLEEP_HOURS = 8;

/** Emivita media caffeina in ore (Nehlig 2018) */
const CAFFEINE_HALF_LIFE_HOURS = 5;

/** Curve circadiane per cronotipo (0-24h, valori 0-1 normalizzati).
 *  Basate su cortisol + core body temp + alertness studies. */
const CIRCADIAN_CURVES: Record<Chronotype, number[]> = {
  // Lion (early bird): picco 6-10, calo 14-16, leggero recupero 17-19
  lion:    [0.15, 0.10, 0.10, 0.12, 0.20, 0.45, 0.75, 0.90, 0.95, 1.00, 0.92, 0.85, 0.75, 0.55, 0.45, 0.50, 0.55, 0.60, 0.50, 0.40, 0.30, 0.25, 0.20, 0.15],
  // Bear (standard): segue il sole, picco 9-13, post-lunch dip, recupero 16-18
  bear:    [0.10, 0.08, 0.08, 0.10, 0.15, 0.30, 0.50, 0.70, 0.85, 0.92, 0.95, 1.00, 0.90, 0.65, 0.55, 0.60, 0.70, 0.75, 0.65, 0.50, 0.35, 0.25, 0.15, 0.10],
  // Wolf (night owl): lento la mattina, picco 12-14 e 17-21
  wolf:    [0.20, 0.15, 0.12, 0.10, 0.10, 0.15, 0.25, 0.35, 0.50, 0.60, 0.70, 0.80, 0.90, 0.85, 0.75, 0.80, 0.88, 0.95, 1.00, 0.92, 0.80, 0.65, 0.45, 0.30],
  // Dolphin (light sleeper): irregolare, picco 10-14, brevi finestre
  dolphin: [0.20, 0.15, 0.15, 0.12, 0.15, 0.25, 0.40, 0.55, 0.65, 0.75, 0.85, 0.90, 0.92, 0.80, 0.65, 0.70, 0.80, 0.85, 0.75, 0.60, 0.50, 0.40, 0.30, 0.25],
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

// ---------------------------------------------------------------------------
// 1. Stima cronotipo dal profilo utente
// ---------------------------------------------------------------------------

export function estimateChronotype(profile: UserProfile | null): Chronotype {
  if (!profile) return 'bear'; // default piu comune (55% pop.)

  const age = new Date().getFullYear() - profile.birthYear;
  const pattern = profile.energyPattern;
  const sleepHours = profile.sleepHours;
  const schedule = profile.workSchedule;

  // Euristica basata su pattern dichiarato + eta + sonno
  if (pattern === 'morning') {
    return age > 50 || sleepHours <= 6.5 ? 'lion' : 'lion';
  }
  if (pattern === 'evening') {
    return 'wolf';
  }
  if (pattern === 'variable' || schedule === 'irregular' || schedule === 'shifts') {
    return sleepHours < 6 ? 'dolphin' : 'bear';
  }

  // Default per eta
  if (age < 25) return 'wolf';  // giovani tendono a wolf
  if (age > 55) return 'lion';  // anziani tendono a lion
  return 'bear';
}

// ---------------------------------------------------------------------------
// 2. Componente circadiana (0-25)
// ---------------------------------------------------------------------------

function computeCircadianScore(chronotype: Chronotype, hour: number): number {
  const curve = CIRCADIAN_CURVES[chronotype];
  const h = Math.floor(hour) % 24;
  const frac = hour - Math.floor(hour);
  const current = lerp(curve[h], curve[(h + 1) % 24], frac);

  // Post-prandial dip penalty (13:00-15:00) — Carskadon & Dement
  let postPrandialPenalty = 0;
  if (hour >= 13 && hour <= 15) {
    const dipCenter = 14;
    const dist = Math.abs(hour - dipCenter);
    postPrandialPenalty = Math.max(0, 0.08 * (1 - dist));
  }

  return clamp(Math.round((current - postPrandialPenalty) * 25), 0, 25);
}

// ---------------------------------------------------------------------------
// 3. Componente sonno (0-25)
// ---------------------------------------------------------------------------

interface SleepData {
  lastNightQuality: number | null;  // 1-5 checkin
  lastNightHours: number | null;    // da biomarker o profilo
  sleepDebt: number;                // ore cumulative rolling 7gg
}

async function gatherSleepData(userId: number, profile: UserProfile | null): Promise<SleepData> {
  const today = todayStr();
  const yesterday = daysAgoStr(1);

  // Qualita sonno da checkin di oggi (spesso registrata la mattina)
  const sleepCheckins = await db.quickCheckins
    .where('[userId+date]')
    .equals([userId, today])
    .and(c => c.type === 'sleep_quality')
    .toArray();
  const lastNightQuality = sleepCheckins.length > 0
    ? sleepCheckins[sleepCheckins.length - 1].value
    : null;

  // Durata sonno da biomarker Sahha
  let lastNightHours: number | null = null;
  try {
    const sleepBio = await db.sahhaBiomarkers
      .where('userId').equals(userId)
      .and(b => b.type === 'sleep_duration' && b.startDateTime >= yesterday)
      .last();
    if (sleepBio) {
      lastNightHours = parseFloat(sleepBio.value) / 60; // min -> ore
    }
  } catch { /* nessun dato biometrico */ }

  // Fallback alle ore dichiarate nel profilo
  if (lastNightHours == null && profile) {
    lastNightHours = profile.sleepHours;
  }

  // Calcolo debito di sonno rolling 7 giorni
  // Debito = somma(OPTIMAL - ore_dormite) per gli ultimi 7 giorni
  let sleepDebt = 0;
  if (lastNightHours != null) {
    // Semplificazione: usiamo la media delle ultime notti note
    const recentSleepCheckins = await db.quickCheckins
      .where('userId').equals(userId)
      .and(c => c.type === 'sleep_quality' && c.date >= daysAgoStr(7))
      .toArray();

    if (recentSleepCheckins.length > 0) {
      // Stima ore da qualita: quality 5->8h, 4->7h, 3->6h, 2->5h, 1->4h
      const estimatedHours = recentSleepCheckins.map(c => 3 + c.value);
      const totalDeficit = estimatedHours.reduce(
        (sum, h) => sum + Math.max(0, OPTIMAL_SLEEP_HOURS - h), 0
      );
      sleepDebt = totalDeficit;
    } else {
      // Stima dal profilo
      const dailyDeficit = Math.max(0, OPTIMAL_SLEEP_HOURS - (lastNightHours || 7));
      sleepDebt = dailyDeficit * 3; // assume 3 giorni di stesso pattern
    }
  }

  return { lastNightQuality, lastNightHours, sleepDebt };
}

function computeSleepScore(data: SleepData): { score: number; debt: number } {
  let score = 25; // partenza perfetta

  // Qualita sonno (-0 a -10)
  if (data.lastNightQuality != null) {
    const qualityFactor = data.lastNightQuality / 5; // 0.2-1.0
    score -= Math.round((1 - qualityFactor) * 10);
  }

  // Durata sonno (-0 a -8)
  if (data.lastNightHours != null) {
    const deviation = Math.abs(data.lastNightHours - OPTIMAL_SLEEP_HOURS);
    score -= Math.round(Math.min(8, deviation * 2.5));
  }

  // Debito cumulativo (-0 a -7) — Van Dongen: debito >20h = prestazione critica
  const debtPenalty = Math.min(7, Math.round(data.sleepDebt * 0.35));
  score -= debtPenalty;

  return { score: clamp(score, 0, 25), debt: data.sleepDebt };
}

// ---------------------------------------------------------------------------
// 4. Componente stile di vita (0-25)
// ---------------------------------------------------------------------------

interface LifestyleData {
  waterGlasses: number;
  caffeineCount: number;
  lastCaffeineHour: number | null;
  mealQuality: number | null;    // 1-5
  mealsLogged: number;
  activityLevel: number | null;  // 1-5 from checkin
  stressLevel: number | null;    // 1-5
  moodLevel: number | null;      // 1-5
}

async function gatherLifestyleData(userId: number): Promise<LifestyleData> {
  const today = todayStr();

  const checkins = await db.quickCheckins
    .where('[userId+date]')
    .equals([userId, today])
    .toArray();

  const waterCheckins = checkins.filter(c => c.type === 'water');
  const caffeineCheckins = checkins.filter(c => c.type === 'caffeine');
  const mealCheckins = checkins.filter(c => c.type === 'meal_time');
  const activityCheckins = checkins.filter(c => c.type === 'activity_done');
  const stressCheckins = checkins.filter(c => c.type === 'stress');
  const moodCheckins = checkins.filter(c => c.type === 'mood');

  // Ultimo orario caffeina
  let lastCaffeineHour: number | null = null;
  if (caffeineCheckins.length > 0) {
    const lastTime = caffeineCheckins[caffeineCheckins.length - 1].time;
    const [h, m] = lastTime.split(':').map(Number);
    lastCaffeineHour = h + m / 60;
  }

  // Conta pasti da food scanner
  let mealsLogged = 0;
  try {
    const foods = await db.foodLogs
      .where('[userId+date]')
      .equals([userId, today])
      .toArray();
    mealsLogged = foods.length;
  } catch { /* no food data */ }

  return {
    waterGlasses: waterCheckins.reduce((s, c) => s + c.value, 0),
    caffeineCount: caffeineCheckins.reduce((s, c) => s + c.value, 0),
    lastCaffeineHour,
    mealQuality: mealCheckins.length > 0 ? mealCheckins[mealCheckins.length - 1].value : null,
    mealsLogged,
    activityLevel: activityCheckins.length > 0 ? activityCheckins[activityCheckins.length - 1].value : null,
    stressLevel: stressCheckins.length > 0 ? stressCheckins[stressCheckins.length - 1].value : null,
    moodLevel: moodCheckins.length > 0 ? moodCheckins[moodCheckins.length - 1].value : null,
  };
}

function computeLifestyleScore(data: LifestyleData, currentHour: number): number {
  let score = 25;

  // Idratazione: target 8 bicchieri/giorno, proporzionale all'ora
  const expectedWater = Math.max(1, Math.round((currentHour / 24) * 8));
  if (data.waterGlasses < expectedWater * 0.5) {
    score -= 5; // molto disidratato
  } else if (data.waterGlasses < expectedWater * 0.75) {
    score -= 2;
  }

  // Caffeina: boost se <16:00, penalita se tardi
  if (data.caffeineCount > 0 && data.lastCaffeineHour != null) {
    if (data.lastCaffeineHour >= 16) {
      // Caffeina tardi: penalita basata su farmacocinetica
      // A 5h di emivita, alle 21:00 una caffeina delle 16:00 ha ancora 50% effetto
      const hoursAgo = currentHour - data.lastCaffeineHour;
      const remainingEffect = Math.pow(0.5, hoursAgo / CAFFEINE_HALF_LIFE_HOURS);
      if (remainingEffect > 0.3) score -= 3;
    }
    if (data.caffeineCount > 4) score -= 2; // troppa
  }

  // Nutrizione
  if (data.mealQuality != null) {
    if (data.mealQuality >= 4) score += 0; // nessun cambio, gia buono
    else if (data.mealQuality <= 2) score -= 4;
    else score -= 1;
  } else if (currentHour > 13 && data.mealsLogged === 0) {
    score -= 3; // probabilmente ha saltato un pasto
  }

  // Attivita fisica: benefici acuti (POMS studies)
  if (data.activityLevel != null) {
    if (data.activityLevel >= 4) score += 0; // gia incluso nel baseline
    else if (data.activityLevel <= 1 && currentHour > 15) score -= 3; // inattivita
  }

  // Stress (inversamente proporzionale)
  if (data.stressLevel != null) {
    if (data.stressLevel >= 4) score -= 4;
    else if (data.stressLevel >= 3) score -= 2;
  }

  // Mood (correlazione diretta)
  if (data.moodLevel != null) {
    if (data.moodLevel <= 2) score -= 2;
  }

  return clamp(score, 0, 25);
}

// ---------------------------------------------------------------------------
// 5. Componente carico allostatico (0-25)
// ---------------------------------------------------------------------------

interface AllostaticData {
  workHoursToday: number | null;
  dailyWorkHoursProfile: number;
  recentEnergyLogs: EnergyLog[];
  consecutiveLowDays: number;
}

async function gatherAllostaticData(userId: number, profile: UserProfile | null): Promise<AllostaticData> {
  const today = todayStr();
  const todayLog = await db.energyLogs
    .where('[userId+date]')
    .equals([userId, today])
    .first();

  const recentLogs = await db.energyLogs
    .where('userId').equals(userId)
    .and(l => l.date >= daysAgoStr(7))
    .toArray();
  recentLogs.sort((a, b) => a.date.localeCompare(b.date));

  // Conta giorni consecutivi con energia bassa
  let consecutiveLow = 0;
  for (let i = recentLogs.length - 1; i >= 0; i--) {
    const avg = (recentLogs[i].physical + recentLogs[i].mental + recentLogs[i].emotional) / 3;
    if (avg <= 4) consecutiveLow++;
    else break;
  }

  return {
    workHoursToday: todayLog?.workHoursToday ?? null,
    dailyWorkHoursProfile: profile?.dailyWorkHours ?? 8,
    recentEnergyLogs: recentLogs,
    consecutiveLowDays: consecutiveLow,
  };
}

function computeAllostaticScore(data: AllostaticData): number {
  let score = 25;

  // Ore di lavoro eccessive
  const workHours = data.workHoursToday ?? data.dailyWorkHoursProfile;
  if (workHours > 10) score -= 6;
  else if (workHours > 8) score -= 3;

  // Trend energetico (sliding window)
  if (data.recentEnergyLogs.length >= 3) {
    const last3 = data.recentEnergyLogs.slice(-3);
    const last3Avg = last3.reduce((s, l) => s + (l.physical + l.mental + l.emotional) / 3, 0) / 3;

    if (data.recentEnergyLogs.length >= 6) {
      const prev3 = data.recentEnergyLogs.slice(-6, -3);
      const prev3Avg = prev3.reduce((s, l) => s + (l.physical + l.mental + l.emotional) / 3, 0) / 3;
      const decline = prev3Avg - last3Avg;
      if (decline > 2) score -= 5;
      else if (decline > 1) score -= 2;
    }

    // Media bassa generale
    if (last3Avg <= 3) score -= 5;
    else if (last3Avg <= 5) score -= 2;
  }

  // Giorni consecutivi bassi (rischio burnout)
  if (data.consecutiveLowDays >= 5) score -= 6;
  else if (data.consecutiveLowDays >= 3) score -= 3;
  else if (data.consecutiveLowDays >= 2) score -= 1;

  return clamp(score, 0, 25);
}

// ---------------------------------------------------------------------------
// 6. Curva predittiva (prossime 6 ore)
// ---------------------------------------------------------------------------

function predictEnergyCurve(
  chronotype: Chronotype,
  currentHour: number,
  currentScore: number,
  sleepDebt: number,
  lifestyleData: LifestyleData,
): number[] {
  const curve = CIRCADIAN_CURVES[chronotype];
  const predicted: number[] = [];

  for (let offset = 1; offset <= 6; offset++) {
    const futureHour = (currentHour + offset) % 24;
    const h = Math.floor(futureHour);

    // Base circadiana
    let baseScore = curve[h] * 100;

    // Attenuazione per debito sonno
    const sleepPenalty = Math.min(20, sleepDebt * 1.5);
    baseScore -= sleepPenalty;

    // Effetto caffeina residuo
    if (lifestyleData.lastCaffeineHour != null && lifestyleData.caffeineCount > 0) {
      const hoursSinceCaffeine = futureHour - lifestyleData.lastCaffeineHour;
      if (hoursSinceCaffeine > 0) {
        const remaining = Math.pow(0.5, hoursSinceCaffeine / CAFFEINE_HALF_LIFE_HOURS);
        baseScore += remaining * 5; // piccolo boost residuo
      }
    }

    // Post-prandial dip
    if (futureHour >= 13 && futureHour <= 15) {
      baseScore -= 8;
    }

    // Smooth verso lo score corrente
    const blendFactor = offset / 6; // piu ci allontaniamo, piu vale la curva circadiana
    const blended = lerp(currentScore, baseScore, blendFactor);

    predicted.push(clamp(Math.round(blended), 0, 100));
  }

  return predicted;
}

// ---------------------------------------------------------------------------
// 7. Identificazione collo di bottiglia
// ---------------------------------------------------------------------------

function identifyBottleneck(
  sleepScore: number,
  sleepData: SleepData,
  lifestyleData: LifestyleData,
  allostaticData: AllostaticData,
  lifestyleScore: number,
  allostaticScore: number,
): Bottleneck {
  const issues: { type: Bottleneck; severity: number }[] = [];

  if (sleepScore <= 12) issues.push({ type: 'sleep', severity: 25 - sleepScore });
  if (lifestyleData.waterGlasses < 3) issues.push({ type: 'hydration', severity: 5 });
  if (lifestyleData.mealQuality != null && lifestyleData.mealQuality <= 2) issues.push({ type: 'nutrition', severity: 4 });
  if (lifestyleData.stressLevel != null && lifestyleData.stressLevel >= 4) issues.push({ type: 'stress', severity: 5 });
  if (allostaticData.workHoursToday != null && allostaticData.workHoursToday > 10) issues.push({ type: 'overwork', severity: 4 });
  if (lifestyleData.activityLevel != null && lifestyleData.activityLevel <= 1) issues.push({ type: 'inactivity', severity: 3 });

  if (issues.length === 0) return 'none';
  issues.sort((a, b) => b.severity - a.severity);
  return issues[0].type;
}

// ---------------------------------------------------------------------------
// API Pubblica
// ---------------------------------------------------------------------------

/**
 * Calcola il punteggio energetico scientifico per l'utente in questo momento.
 * Aggrega: circadian rhythm, sleep architecture, lifestyle factors, allostatic load.
 */
export async function computeScientificEnergy(userId: number): Promise<EnergyBreakdown> {
  // Carica profilo
  const profile = await db.userProfiles.where('userId').equals(userId).first() ?? null;

  // Stima cronotipo
  const chronotype = estimateChronotype(profile);

  // Ora corrente con frazioni
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;

  // Raccogli dati in parallelo
  const [sleepData, lifestyleData, allostaticData] = await Promise.all([
    gatherSleepData(userId, profile),
    gatherLifestyleData(userId),
    gatherAllostaticData(userId, profile),
  ]);

  // Calcola ogni componente
  const circadian = computeCircadianScore(chronotype, currentHour);
  const { score: sleep, debt: sleepDebt } = computeSleepScore(sleepData);
  const lifestyle = computeLifestyleScore(lifestyleData, currentHour);
  const allostatic = computeAllostaticScore(allostaticData);

  const overall = circadian + sleep + lifestyle + allostatic;

  // Curva predittiva
  const predictedCurve = predictEnergyCurve(
    chronotype, currentHour, overall, sleepDebt, lifestyleData,
  );

  // Bottleneck
  const bottleneck = identifyBottleneck(
    sleep, sleepData, lifestyleData, allostaticData, lifestyle, allostatic,
  );

  // Fattori dettagliati per spiegazione
  const factors: Record<string, number> = {
    circadian_base: circadian,
    sleep_quality: sleepData.lastNightQuality ?? -1,
    sleep_hours: sleepData.lastNightHours ?? -1,
    sleep_debt_hours: sleepDebt,
    water_glasses: lifestyleData.waterGlasses,
    caffeine_count: lifestyleData.caffeineCount,
    meal_quality: lifestyleData.mealQuality ?? -1,
    activity_level: lifestyleData.activityLevel ?? -1,
    stress_level: lifestyleData.stressLevel ?? -1,
    mood_level: lifestyleData.moodLevel ?? -1,
    work_hours: allostaticData.workHoursToday ?? allostaticData.dailyWorkHoursProfile,
    consecutive_low_days: allostaticData.consecutiveLowDays,
  };

  return {
    overall,
    circadian,
    sleep,
    lifestyle,
    allostatic,
    chronotype,
    predictedCurve,
    bottleneck,
    sleepDebt,
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
 * Label italiane per bottleneck.
 */
export const BOTTLENECK_LABELS: Record<Bottleneck, string> = {
  sleep: 'Sonno insufficiente',
  hydration: 'Disidratazione',
  nutrition: 'Nutrizione scarsa',
  stress: 'Stress elevato',
  overwork: 'Sovraccarico lavorativo',
  inactivity: 'Sedentarieta',
  none: 'Nessun problema critico',
};

/**
 * Label italiane per cronotipo.
 */
export const CHRONOTYPE_LABELS: Record<Chronotype, { name: string; description: string }> = {
  lion: { name: 'Leone', description: 'Mattiniero, picco energetico 6-10' },
  bear: { name: 'Orso', description: 'Segue il sole, picco 9-13' },
  wolf: { name: 'Lupo', description: 'Nottambulo, picco 17-21' },
  dolphin: { name: 'Delfino', description: 'Sonno leggero, finestre brevi di picco' },
};
