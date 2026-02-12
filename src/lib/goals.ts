// ---------------------------------------------------------------------------
// Goals System — Gestione obiettivi basata su MCII/WOOP
//
// Framework: Mental Contrasting with Implementation Intentions (Oettingen 2012)
//   Wish → Outcome → Obstacle → Plan (If-Then)
//
// Features:
//   - CRUD obiettivi
//   - Tracking automatico da check-in linkati
//   - Streak tracking
//   - AI advice generation via Groq
// ---------------------------------------------------------------------------

import { db } from '../db/db';
import type { Goal, GoalLog, GoalCategory, GoalTimeframe, GoalStatus, CheckinType } from '../db/schema';

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
      .where('[userId+date+type]')
      .equals([userId, today, checkinType])
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
