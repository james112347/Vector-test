export interface User {
  id?: number;
  email: string;
  passwordHash: string;
  hasAcceptedTerms: boolean;
  termsAcceptedAt?: Date;
  isApproved: boolean;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id?: number;
  userId: number;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface UserPreferences {
  id?: number;
  userId: number;
  theme: 'light' | 'dark' | 'system';
  updatedAt: Date;
}

export interface EnergyLog {
  id?: number;
  userId: number;
  date: string; // YYYY-MM-DD
  physical: number; // 1-10
  mental: number;   // 1-10
  emotional: number; // 1-10
  workHoursToday?: number; // ore di lavoro previste oggi
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// User Profile (onboarding data)
// ---------------------------------------------------------------------------

export interface UserProfile {
  id?: number;
  userId: number;
  // Dati personali
  name: string;
  birthYear: number;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  heightCm: number;
  weightKg: number;
  // Occupazione
  occupation: 'student' | 'worker' | 'student_worker' | 'unemployed' | 'retired';
  workType?: string; // tipo di lavoro (testo libero)
  workEffortType?: 'mental' | 'physical' | 'mixed' | 'creative' | 'social'; // tipo di sforzo prevalente
  dailyWorkHours: number; // ore medie al giorno
  weeklyWorkHours?: number; // @deprecated - usa dailyWorkHours
  workSchedule: 'regular' | 'shifts' | 'flexible' | 'irregular';
  // Stile di vita e abitudini
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  sleepHours: number; // ore tipiche per notte
  smokingFrequency: 'never' | 'occasional' | 'daily' | 'heavy';
  alcoholFrequency: 'never' | 'occasional' | 'weekly' | 'daily';
  caffeineDaily: number; // tazzine/giorno
  // Routine giornaliera (per calcoli energia)
  typicalWakeTime?: string;    // HH:MM - orario sveglia tipico
  typicalBedTime?: string;     // HH:MM - orario tipico di andare a dormire
  workStartTime?: string;      // HH:MM - inizio lavoro/studio
  workEndTime?: string;        // HH:MM - fine lavoro/studio
  lunchTime?: string;          // HH:MM - pranzo tipico
  dinnerTime?: string;         // HH:MM - cena tipica
  exerciseTime?: 'morning' | 'afternoon' | 'evening' | 'none'; // quando si allena
  // Campi legacy (rimossi dall'onboarding, mantenuti per compatibilita')
  baselinePhysical?: number;
  baselineMental?: number;
  baselineEmotional?: number;
  energyPattern?: 'morning' | 'afternoon' | 'evening' | 'variable';
  stressLevel?: 'low' | 'moderate' | 'high' | 'very_high';
  // Obiettivi
  goal: 'more_energy' | 'better_sleep' | 'fitness' | 'stress' | 'general_wellness';
  notes?: string;
  completedAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Quick Check-ins (micro-feedback durante la giornata)
// ---------------------------------------------------------------------------

export type CheckinType = 'sleep_quality' | 'water' | 'caffeine' | 'meal_time' | 'focus' | 'activity_done' | 'stress' | 'mood' | 'nap' | 'supplement' | 'screen_break' | 'current_activity';

/**
 * Mappa valori current_activity:
 * 0 = Fine/idle (attivita terminata)
 * 1 = Studio/concentrazione
 * 2 = Lavoro
 * 3 = Pausa/riposo
 * 4 = Sport/esercizio
 * 5 = Tempo libero/relax
 * 6 = Sociale/famiglia
 * 7 = Spostamenti/commissioni
 */

export interface QuickCheckin {
  id?: number;
  userId: number;
  date: string;   // YYYY-MM-DD
  time: string;   // HH:MM
  type: CheckinType;
  value: number;   // water: conta bicchieri, meal: 1-5 qualita, caffeine: conta, stress: 1-5, movement: 1-5, mood: 1-5
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Sahha Health Data (local cache)
// ---------------------------------------------------------------------------

export interface SahhaProfile {
  id?: number;
  userId: number;
  externalId: string;
  profileToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SahhaScoreLog {
  id?: number;
  userId: number;
  type: string; // wellbeing | activity | sleep | readiness | mental_wellbeing
  score: number; // 0-1
  state: string; // high | medium | low | minimal
  factors: string; // JSON-stringified factors array
  scoreDateTime: string; // ISO datetime from Sahha
  fetchedAt: Date;
}

// ---------------------------------------------------------------------------
// User Feedback (AI-assisted feedback to admin)
// ---------------------------------------------------------------------------

export type FeedbackStatus = 'draft' | 'sent' | 'read';

export interface UserFeedback {
  id?: number;
  userId: number;
  userEmail: string;
  category: 'bug' | 'feature' | 'improvement' | 'support' | 'other';
  message: string;       // The final formulated feedback
  chatHistory: string;   // JSON-stringified chat messages for context
  status: FeedbackStatus;
  adminReply?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SahhaBiomarkerLog {
  id?: number;
  userId: number;
  type: string; // steps, heart_rate_resting, sleep_duration, etc.
  category: string; // activity, sleep, vitals, body
  value: string;
  unit: string;
  periodicity: string; // daily, hourly
  startDateTime: string;
  endDateTime: string;
  fetchedAt: Date;
}

// ---------------------------------------------------------------------------
// Screen Time (tracciamento automatico tempo di utilizzo app)
// ---------------------------------------------------------------------------

export interface ScreenTimeLog {
  id?: number;
  userId: number;
  date: string;         // YYYY-MM-DD
  minutes: number;      // minuti attivi totali del giorno
  sessions: number;     // numero di sessioni del giorno
  longestSession: number; // sessione piu lunga in minuti
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Sistema di Orientamento Energetico
// ---------------------------------------------------------------------------

export type { OrientationLog, UserActivity, OrientationPreferences } from '../lib/energy-orientation/types';

// ---------------------------------------------------------------------------
// Scientific Energy Score (modello energetico scientifico)
// ---------------------------------------------------------------------------

export interface ScientificEnergyScore {
  id?: number;
  userId: number;
  date: string;           // YYYY-MM-DD
  time: string;           // HH:MM
  /** Punteggio complessivo 0-100 */
  overallScore: number;
  /** Componente circadiana (0-25): cronobiologia + ritmi ultradiani */
  circadianScore: number;
  /** Componente sonno (0-25): durata, qualita, debito */
  sleepScore: number;
  /** Componente stile di vita (0-25): idratazione, nutrizione, caffeina, attivita */
  lifestyleScore: number;
  /** Componente carico allostatico (0-25): stress, recupero, trend */
  allostaticScore: number;
  /** Cronotipo stimato dall'algoritmo */
  chronotype: 'lion' | 'bear' | 'wolf' | 'dolphin';
  /** Curva energetica prevista prossime 6 ore (array 6 valori 0-100) */
  predictedCurve: string;   // JSON array
  /** Collo di bottiglia identificato */
  bottleneck: string;        // 'sleep' | 'hydration' | 'nutrition' | 'stress' | 'overwork' | 'inactivity' | 'none'
  /** Debito di sonno cumulativo in ore (rolling 7 gg) */
  sleepDebt: number;
  /** Dettagli fattori (per debug e spiegazione) */
  factors: string;           // JSON object
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Goals (sistema obiettivi MCII/WOOP)
// ---------------------------------------------------------------------------

export type GoalCategory = 'energy' | 'sleep' | 'fitness' | 'stress' | 'nutrition' | 'productivity' | 'custom';
export type GoalTimeframe = 'daily' | 'weekly' | 'monthly';
export type GoalStatus = 'active' | 'completed' | 'paused' | 'abandoned';

export interface Goal {
  id?: number;
  userId: number;
  /** WOOP: Wish — cosa vuoi ottenere */
  wish: string;
  /** WOOP: Outcome — il miglior risultato possibile */
  outcome: string;
  /** WOOP: Obstacle — ostacolo interno principale */
  obstacle: string;
  /** WOOP: Plan — intenzione di implementazione "Se X, allora Y" */
  plan: string;
  category: GoalCategory;
  timeframe: GoalTimeframe;
  status: GoalStatus;
  /** Tipo di checkin collegato per tracking automatico (opzionale) */
  linkedCheckinType?: CheckinType | null;
  /** Valore target numerico (opzionale, es. 8 bicchieri acqua) */
  targetValue?: number | null;
  /** Unita del target (es. 'bicchieri', 'ore', 'minuti') */
  targetUnit?: string | null;
  /** Progresso corrente (auto-calcolato) */
  currentProgress: number;
  /** Data inizio obiettivo */
  startDate: string;        // YYYY-MM-DD
  /** Data scadenza (per obiettivi con timeframe) */
  endDate?: string | null;  // YYYY-MM-DD
  /** Streak consecutivo di giorni raggiunti */
  streak: number;
  /** Miglior streak raggiunto */
  bestStreak: number;
  /** Consiglio IA personalizzato */
  aiAdvice?: string | null;
  /** Note dell'utente */
  notes?: string | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoalLog {
  id?: number;
  userId: number;
  goalId: number;
  date: string;             // YYYY-MM-DD
  /** Valore registrato per quel giorno */
  value: number;
  /** Obiettivo raggiunto? */
  achieved: boolean;
  /** Nota opzionale */
  note?: string | null;
  createdAt: Date;
}
