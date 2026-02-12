// ---------------------------------------------------------------------------
// Goals System v2 — Gestione obiettivi basata su MCII/WOOP + AI Energy Advisor
//
// Framework: Mental Contrasting with Implementation Intentions (Oettingen 2012)
//   Wish → Outcome → Obstacle → Plan (If-Then)
//   Effect size: g = 0.277-0.465 (meta-analysis 2021)
//   2x physical activity improvement vs. information-only (4 months)
//
// v2 Features:
//   - CRUD obiettivi
//   - Tracking automatico da check-in linkati
//   - Streak tracking
//   - AI-powered goal setup: analisi dati utente, target realistici,
//     tempi ottimali, costo energetico, conflitti con altri obiettivi
//   - Energy budget: quanto costa ogni obiettivo in termini di energia
//   - Schedule ottimale: quando lavorare su ogni obiettivo basato sul cronotipo
// ---------------------------------------------------------------------------

import { db } from '../db/db';
import type { Goal, GoalLog, GoalCategory, GoalTimeframe, GoalStatus, CheckinType } from '../db/schema';
import { supabase } from './supabase';
import {
  computeScientificEnergy,
  getOptimalWindows,
  estimateActivityEnergyCost,
  type EnergyBreakdown,
  type Chronotype,
} from './energy-engine';

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

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export interface CreateGoalInput {
  wish: string;
  outcome: string;
  obstacle: string;
  plan: string;
  category: GoalCategory;
  timeframe: GoalTimeframe;
  linkedCheckinType?: CheckinType | null;
  targetValue?: number | null;
  targetUnit?: string | null;
  endDate?: string | null;
  notes?: string | null;
}

export async function createGoal(userId: number, input: CreateGoalInput): Promise<Goal> {
  const now = new Date();
  const goal: Goal = {
    userId,
    wish: input.wish,
    outcome: input.outcome,
    obstacle: input.obstacle,
    plan: input.plan,
    category: input.category,
    timeframe: input.timeframe,
    status: 'active',
    linkedCheckinType: input.linkedCheckinType ?? null,
    targetValue: input.targetValue ?? null,
    targetUnit: input.targetUnit ?? null,
    currentProgress: 0,
    startDate: todayStr(),
    endDate: input.endDate ?? null,
    streak: 0,
    bestStreak: 0,
    aiAdvice: null,
    notes: input.notes ?? null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const id = await db.goals.add(goal);
  return { ...goal, id };
}

export async function updateGoal(
  goalId: number,
  updates: Partial<Pick<Goal, 'wish' | 'outcome' | 'obstacle' | 'plan' | 'category' | 'timeframe' | 'targetValue' | 'targetUnit' | 'endDate' | 'notes' | 'status'>>,
): Promise<void> {
  await db.goals.update(goalId, {
    ...updates,
    updatedAt: new Date(),
  });
}

export async function deleteGoal(goalId: number): Promise<void> {
  await db.transaction('rw', [db.goals, db.goalLogs], async () => {
    await db.goalLogs.where('goalId').equals(goalId).delete();
    await db.goals.delete(goalId);
  });
}

export async function completeGoal(goalId: number): Promise<void> {
  await db.goals.update(goalId, {
    status: 'completed' as GoalStatus,
    completedAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function pauseGoal(goalId: number): Promise<void> {
  await db.goals.update(goalId, {
    status: 'paused' as GoalStatus,
    updatedAt: new Date(),
  });
}

export async function resumeGoal(goalId: number): Promise<void> {
  await db.goals.update(goalId, {
    status: 'active' as GoalStatus,
    updatedAt: new Date(),
  });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getActiveGoals(userId: number): Promise<Goal[]> {
  return db.goals
    .where('[userId+status]')
    .equals([userId, 'active'])
    .toArray();
}

export async function getAllGoals(userId: number): Promise<Goal[]> {
  const goals = await db.goals.where('userId').equals(userId).toArray();
  return goals.sort((a, b) => {
    // Attivi prima, poi completati, poi paused, poi abandoned
    const order: Record<GoalStatus, number> = { active: 0, paused: 1, completed: 2, abandoned: 3 };
    return (order[a.status] - order[b.status]) || b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export async function getGoalById(goalId: number): Promise<Goal | undefined> {
  return db.goals.get(goalId);
}

export async function getGoalLogs(goalId: number, days = 30): Promise<GoalLog[]> {
  const startDate = daysAgoStr(days);
  return db.goalLogs
    .where('goalId')
    .equals(goalId)
    .and(l => l.date >= startDate)
    .toArray();
}

// ---------------------------------------------------------------------------
// Progress tracking
// ---------------------------------------------------------------------------

/**
 * Registra un progresso manuale per un obiettivo.
 */
export async function logGoalProgress(
  userId: number,
  goalId: number,
  value: number,
  note?: string,
): Promise<GoalLog> {
  const today = todayStr();
  const goal = await db.goals.get(goalId);
  if (!goal) throw new Error('Obiettivo non trovato');

  const achieved = goal.targetValue != null ? value >= goal.targetValue : value > 0;

  // Upsert: aggiorna se esiste gia per oggi
  const existing = await db.goalLogs
    .where('[goalId+date]')
    .equals([goalId, today])
    .first();

  const now = new Date();
  let logEntry: GoalLog;

  if (existing) {
    await db.goalLogs.update(existing.id!, { value, achieved, note: note ?? null });
    logEntry = { ...existing, value, achieved, note: note ?? null };
  } else {
    logEntry = {
      userId,
      goalId,
      date: today,
      value,
      achieved,
      note: note ?? null,
      createdAt: now,
    };
    const id = await db.goalLogs.add(logEntry);
    logEntry = { ...logEntry, id };
  }

  // Aggiorna streak e progresso
  await updateGoalStreak(goalId);

  return logEntry;
}

/**
 * Auto-track: aggiorna il progresso di obiettivi linkati a un tipo di check-in.
 * Chiamato ogni volta che si aggiunge un checkin.
 */
export async function autoTrackGoals(userId: number, checkinType: CheckinType): Promise<void> {
  const linkedGoals = await db.goals
    .where('[userId+status]')
    .equals([userId, 'active'])
    .and(g => g.linkedCheckinType === checkinType)
    .toArray();

  if (linkedGoals.length === 0) return;

  const today = todayStr();

  for (const goal of linkedGoals) {
    // Calcola il valore totale di oggi per quel tipo di checkin
    const todayCheckins = await db.quickCheckins
      .where('[userId+date]')
      .equals([userId, today])
      .and(c => c.type === checkinType)
      .toArray();

    const totalValue = todayCheckins.reduce((s, c) => s + c.value, 0);

    await logGoalProgress(userId, goal.id!, totalValue);
  }
}

/**
 * Aggiorna streak e bestStreak per un obiettivo.
 */
async function updateGoalStreak(goalId: number): Promise<void> {
  const goal = await db.goals.get(goalId);
  if (!goal) return;

  const logs = await db.goalLogs
    .where('goalId')
    .equals(goalId)
    .toArray();

  logs.sort((a, b) => b.date.localeCompare(a.date)); // piu recenti prima

  // Conta giorni consecutivi con achieved=true
  let streak = 0;
  const today = todayStr();

  for (let i = 0; i < logs.length; i++) {
    const expectedDate = daysAgoStr(i);
    const log = logs.find(l => l.date === expectedDate);

    if (log && log.achieved) {
      streak++;
    } else if (log && !log.achieved) {
      break; // giorno non raggiunto, fine streak
    } else {
      // Giorno senza log — se e' oggi, ok (non ancora registrato)
      if (expectedDate === today && i === 0) continue;
      break;
    }
  }

  const bestStreak = Math.max(goal.bestStreak, streak);
  const currentProgress = logs.length > 0 && logs[0].date === today ? logs[0].value : 0;

  await db.goals.update(goalId, {
    streak,
    bestStreak,
    currentProgress,
    updatedAt: new Date(),
  });
}

// ---------------------------------------------------------------------------
// Statistiche
// ---------------------------------------------------------------------------

export interface GoalStats {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  totalAchievedDays: number;
  longestStreak: number;
  currentStreak: number;
  completionRate: number; // 0-1
}

export async function getGoalStats(userId: number): Promise<GoalStats> {
  const goals = await db.goals.where('userId').equals(userId).toArray();
  const allLogs = await db.goalLogs.where('userId').equals(userId).toArray();

  const activeGoals = goals.filter(g => g.status === 'active');
  const completedGoals = goals.filter(g => g.status === 'completed');
  const achievedLogs = allLogs.filter(l => l.achieved);

  const longestStreak = goals.reduce((max, g) => Math.max(max, g.bestStreak), 0);
  const currentStreak = activeGoals.reduce((max, g) => Math.max(max, g.streak), 0);

  const completionRate = allLogs.length > 0
    ? achievedLogs.length / allLogs.length
    : 0;

  return {
    totalGoals: goals.length,
    activeGoals: activeGoals.length,
    completedGoals: completedGoals.length,
    totalAchievedDays: achievedLogs.length,
    longestStreak,
    currentStreak,
    completionRate,
  };
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const CATEGORY_LABELS: Record<GoalCategory, string> = {
  energy: 'Energia',
  sleep: 'Sonno',
  fitness: 'Fitness',
  stress: 'Stress',
  nutrition: 'Nutrizione',
  productivity: 'Produttivita',
  custom: 'Personalizzato',
};

export const CATEGORY_COLORS: Record<GoalCategory, string> = {
  energy: '#f59e0b',
  sleep: '#6366f1',
  fitness: '#22c55e',
  stress: '#ef4444',
  nutrition: '#f97316',
  productivity: '#3b82f6',
  custom: '#8b5cf6',
};

export const TIMEFRAME_LABELS: Record<GoalTimeframe, string> = {
  daily: 'Giornaliero',
  weekly: 'Settimanale',
  monthly: 'Mensile',
};

export const STATUS_LABELS: Record<GoalStatus, string> = {
  active: 'Attivo',
  completed: 'Completato',
  paused: 'In pausa',
  abandoned: 'Abbandonato',
};

// ---------------------------------------------------------------------------
// Template obiettivi suggeriti
// ---------------------------------------------------------------------------

export interface GoalTemplate {
  wish: string;
  outcome: string;
  obstacle: string;
  plan: string;
  category: GoalCategory;
  timeframe: GoalTimeframe;
  linkedCheckinType?: CheckinType;
  targetValue?: number;
  targetUnit?: string;
}

export const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    wish: 'Bere almeno 8 bicchieri d\'acqua al giorno',
    outcome: 'Mi sentiro piu energico e concentrato, la mia pelle sara piu idratata',
    obstacle: 'Mi dimentico di bere durante le ore di lavoro intenso',
    plan: 'Se passo un\'ora senza bere, allora riempio subito un bicchiere',
    category: 'nutrition',
    timeframe: 'daily',
    linkedCheckinType: 'water',
    targetValue: 8,
    targetUnit: 'bicchieri',
  },
  {
    wish: 'Dormire almeno 7 ore per notte',
    outcome: 'Mi sveglio riposato, la mia energia durante il giorno sara costante',
    obstacle: 'Resto sveglio tardi a guardare lo schermo',
    plan: 'Se sono le 22:30, allora metto il telefono in modalita notte e inizio la routine serale',
    category: 'sleep',
    timeframe: 'daily',
    linkedCheckinType: 'sleep_quality',
    targetValue: 4,
    targetUnit: 'qualita',
  },
  {
    wish: 'Fare attivita fisica almeno 3 volte a settimana',
    outcome: 'Avro piu energia, dormiro meglio e mi sentiro piu sicuro',
    obstacle: 'Dopo il lavoro non ho voglia di muovermi',
    plan: 'Se finisco di lavorare, allora mi cambio immediatamente per fare sport',
    category: 'fitness',
    timeframe: 'weekly',
    linkedCheckinType: 'activity_done',
    targetValue: 3,
    targetUnit: 'sessioni',
  },
  {
    wish: 'Limitare la caffeina a 3 tazzine al giorno',
    outcome: 'Dormiro meglio e la mia energia sara piu stabile durante la giornata',
    obstacle: 'Prendo un caffe per abitudine ogni volta che faccio una pausa',
    plan: 'Se ho voglia di un quarto caffe, allora bevo un bicchiere d\'acqua o te verde',
    category: 'energy',
    timeframe: 'daily',
    linkedCheckinType: 'caffeine',
    targetValue: 3,
    targetUnit: 'tazzine',
  },
  {
    wish: 'Praticare 10 minuti di mindfulness al giorno',
    outcome: 'Gestiro meglio lo stress e le emozioni difficili',
    obstacle: 'Mi sembra di non avere tempo e la mia mente vaga continuamente',
    plan: 'Se mi siedo per la colazione, allora prima faccio 10 minuti di respirazione',
    category: 'stress',
    timeframe: 'daily',
  },
  {
    wish: 'Fare una pausa schermo ogni 2 ore',
    outcome: 'I miei occhi si stancheranno meno e manterro la concentrazione',
    obstacle: 'Quando sono concentrato dimentico di fare pause',
    plan: 'Se il timer di 2 ore suona, allora mi alzo e guardo fuori dalla finestra per 5 minuti',
    category: 'productivity',
    timeframe: 'daily',
    linkedCheckinType: 'screen_break',
    targetValue: 4,
    targetUnit: 'pause',
  },
];

// ---------------------------------------------------------------------------
// AI-Powered Goal Advisor
// ---------------------------------------------------------------------------

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

let _cachedApiKey: string | null | undefined = undefined;

async function getGoalApiKey(): Promise<string | null> {
  if (_cachedApiKey !== undefined) return _cachedApiKey;
  const envKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
  if (envKey && envKey !== 'your_groq_api_key_here') {
    _cachedApiKey = envKey;
    return _cachedApiKey;
  }
  if (supabase) {
    try {
      const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'groq_api_key')
        .single();
      _cachedApiKey = data?.value || null;
      return _cachedApiKey;
    } catch { /* no key */ }
  }
  _cachedApiKey = null;
  return null;
}

export interface GoalSetupAdvice {
  suggestedTarget: number | null;
  suggestedUnit: string | null;
  optimalTimeOfDay: string;
  estimatedEnergyCost: 'basso' | 'medio' | 'alto';
  conflicts: string[];
  implementationTips: string[];
  improvedPlan: string;
  expectedTimeline: string;
  linkedCheckinSuggestion: CheckinType | null;
}

/**
 * AI analizza i dati utente e suggerisce come ottimizzare un obiettivo.
 * Considera: cronobiologia, routine attuale, energia disponibile, altri obiettivi.
 */
export async function generateGoalSetupAdvice(
  userId: number,
  goalInput: Partial<CreateGoalInput>,
): Promise<GoalSetupAdvice | null> {
  const apiKey = await getGoalApiKey();
  if (!apiKey) return null;

  // Gather context
  let energy: EnergyBreakdown | null = null;
  try { energy = await computeScientificEnergy(userId); } catch { /* no data */ }

  const activeGoals = await getActiveGoals(userId);
  const profile = await db.userProfiles.where('userId').equals(userId).first();
  const stats = await getGoalStats(userId);

  const windows = energy ? getOptimalWindows(energy.chronotype) : null;

  const activeGoalsSummary = activeGoals.map(g =>
    `- ${g.wish} (${CATEGORY_LABELS[g.category]}, ${TIMEFRAME_LABELS[g.timeframe]}${g.targetValue ? `, target: ${g.targetValue} ${g.targetUnit || ''}` : ''})`
  ).join('\n');

  const prompt = `Sei un coach energetico italiano esperto di cronobiologia e obiettivi WOOP/MCII.
L'utente vuole creare un nuovo obiettivo. Analizza i suoi dati e suggerisci come ottimizzarlo.

NUOVO OBIETTIVO:
- Desiderio: ${goalInput.wish || '(non specificato)'}
- Categoria: ${goalInput.category || '(non specificata)'}
- Frequenza: ${goalInput.timeframe || '(non specificata)'}
${goalInput.outcome ? `- Risultato: ${goalInput.outcome}` : ''}
${goalInput.obstacle ? `- Ostacolo: ${goalInput.obstacle}` : ''}
${goalInput.plan ? `- Piano: ${goalInput.plan}` : ''}

PROFILO UTENTE:
${profile ? `- Nome: ${profile.name}, Eta: ${new Date().getFullYear() - profile.birthYear}
- Lavoro: ${profile.occupation}, ${profile.dailyWorkHours}h/giorno, orario: ${profile.workSchedule}
- Attivita: ${profile.activityLevel}, Sonno: ${profile.sleepHours}h
- Caffeina: ${profile.caffeineDaily}/giorno` : 'Non disponibile'}

STATO ENERGETICO ATTUALE:
${energy ? `- Score: ${energy.overall}/100 (circadiano: ${energy.circadian}/25, sonno: ${energy.sleep}/25, lifestyle: ${energy.lifestyle}/25, carico: ${energy.allostatic}/25)
- Cronotipo: ${energy.chronotype}
- Debito sonno: ${energy.sleepDebt.toFixed(1)}h
- Collo di bottiglia: ${energy.bottleneck}
- Ore sveglio: ${energy.hoursAwake.toFixed(1)}h` : 'Non disponibile'}

${windows ? `FINESTRE OTTIMALI (cronotipo ${energy?.chronotype}):
- Picco cognitivo: ${windows.peakCognitive}
- Picco fisico: ${windows.peakPhysical}
- Recupero: ${windows.recovery}
- Creativita: ${windows.creative}` : ''}

OBIETTIVI GIA ATTIVI (${activeGoals.length}):
${activeGoalsSummary || 'Nessuno'}

STATISTICHE: ${stats.totalGoals} obiettivi totali, ${stats.completionRate > 0 ? Math.round(stats.completionRate * 100) + '% tasso di successo' : 'nessuno storico'}

Rispondi in JSON con questa struttura:
{
  "suggestedTarget": numero_target_realistico o null se non applicabile,
  "suggestedUnit": "unita_di_misura" o null,
  "optimalTimeOfDay": "fascia oraria migliore basata sul cronotipo e sulla categoria (es. 'mattina presto 6-8', 'tarda mattina 10-12', 'pomeriggio 15-17', 'sera 19-21')",
  "estimatedEnergyCost": "basso" o "medio" o "alto",
  "conflicts": ["conflitto 1 con obiettivi esistenti o routine", ...] (array vuoto se nessuno),
  "implementationTips": ["consiglio specifico 1", "consiglio specifico 2", "consiglio specifico 3"],
  "improvedPlan": "Piano Se-Allora migliorato basato sui dati dell'utente, piu specifico e legato alla sua routine",
  "expectedTimeline": "Timeline realistica per vedere risultati (es. '2-3 settimane per notare miglioramenti')",
  "linkedCheckinSuggestion": "tipo_checkin_suggerito" o null
}

REGOLE:
- Solo JSON valido, niente testo fuori
- Il target deve essere REALISTICO basato sui dati attuali dell'utente
- L'orario deve rispettare il cronotipo (non suggerire mattina presto a un Wolf)
- Identifica conflitti reali con gli obiettivi esistenti (sovraccarico, orari sovrapposti)
- I consigli devono essere specifici, non generici
- Il piano migliorato deve usare dettagli dalla routine dell'utente
- In italiano`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as GoalSetupAdvice;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Energy Budget
// ---------------------------------------------------------------------------

export interface EnergyBudget {
  dailyCapacity: number;        // estimated total daily energy (0-100)
  allocatedToGoals: number;     // energy committed to active goals
  available: number;            // remaining capacity
  goalAllocations: {
    goalId: number;
    wish: string;
    category: GoalCategory;
    energyCost: number;         // estimated daily energy cost
  }[];
  overloaded: boolean;          // true if goals exceed 60% of capacity
}

/**
 * Calcola il budget energetico: quanta energia e' allocata agli obiettivi attivi.
 */
export async function getGoalEnergyBudget(userId: number): Promise<EnergyBudget> {
  let energy: EnergyBreakdown | null = null;
  try { energy = await computeScientificEnergy(userId); } catch { /* no data */ }

  const dailyCapacity = energy?.overall ?? 60;
  const activeGoals = await getActiveGoals(userId);

  const goalAllocations = activeGoals.map(g => {
    // Estimate energy cost based on category and timeframe
    const durationEstimate = g.timeframe === 'daily' ? 30 : g.timeframe === 'weekly' ? 60 : 90;
    const cost = estimateActivityEnergyCost(g.category, durationEstimate);
    const dailyCost = g.timeframe === 'daily'
      ? cost.total
      : g.timeframe === 'weekly'
        ? cost.total / 7
        : cost.total / 30;

    return {
      goalId: g.id!,
      wish: g.wish,
      category: g.category,
      energyCost: Math.round(dailyCost * 10) / 10,
    };
  });

  const allocatedToGoals = goalAllocations.reduce((s, g) => s + g.energyCost, 0);
  const available = Math.max(0, dailyCapacity * 0.6 - allocatedToGoals); // reserve 40% for life

  return {
    dailyCapacity,
    allocatedToGoals: Math.round(allocatedToGoals * 10) / 10,
    available: Math.round(available * 10) / 10,
    goalAllocations,
    overloaded: allocatedToGoals > dailyCapacity * 0.6,
  };
}

// ---------------------------------------------------------------------------
// Optimal Schedule
// ---------------------------------------------------------------------------

export interface GoalScheduleSlot {
  goalId: number;
  wish: string;
  category: GoalCategory;
  suggestedTime: string;        // "10:00-11:00"
  reason: string;               // perche' questo orario
  energyDimension: 'physical' | 'mental' | 'emotional';
}

/**
 * Genera un programma giornaliero ottimale per gli obiettivi attivi,
 * basato su cronotipo e tipo di attivita.
 */
export async function getOptimalGoalSchedule(userId: number): Promise<{
  chronotype: Chronotype;
  schedule: GoalScheduleSlot[];
  peakWindows: ReturnType<typeof getOptimalWindows>;
}> {
  let energy: EnergyBreakdown | null = null;
  try { energy = await computeScientificEnergy(userId); } catch { /* no data */ }

  const chronotype: Chronotype = energy?.chronotype ?? 'bear';
  const windows = getOptimalWindows(chronotype);
  const activeGoals = await getActiveGoals(userId);

  const categoryTimeMap: Record<GoalCategory, { time: string; reason: string; dim: 'physical' | 'mental' | 'emotional' }> = {
    fitness:       { time: windows.peakPhysical, reason: 'Picco energia fisica', dim: 'physical' },
    productivity:  { time: windows.peakCognitive, reason: 'Picco cognitivo del tuo cronotipo', dim: 'mental' },
    energy:        { time: windows.peakCognitive, reason: 'Massima attenzione disponibile', dim: 'mental' },
    sleep:         { time: windows.recovery, reason: 'Fase di recupero naturale', dim: 'physical' },
    stress:        { time: windows.recovery, reason: 'Momento ideale per decompressione', dim: 'emotional' },
    nutrition:     { time: windows.peakCognitive, reason: 'Buona concentrazione per scelte consapevoli', dim: 'mental' },
    custom:        { time: windows.creative, reason: 'Finestra creativa/flessibile', dim: 'emotional' },
  };

  const schedule: GoalScheduleSlot[] = activeGoals
    .filter(g => g.timeframe === 'daily' || g.timeframe === 'weekly')
    .map(g => {
      const mapping = categoryTimeMap[g.category];
      return {
        goalId: g.id!,
        wish: g.wish,
        category: g.category,
        suggestedTime: mapping.time,
        reason: mapping.reason,
        energyDimension: mapping.dim,
      };
    });

  return { chronotype, schedule, peakWindows: windows };
}
