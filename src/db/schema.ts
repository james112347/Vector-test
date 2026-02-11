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
  weeklyWorkHours: number;
  workSchedule: 'regular' | 'shifts' | 'flexible' | 'irregular';
  // Stile di vita e abitudini
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  sleepHours: number; // ore tipiche per notte
  smokingFrequency: 'never' | 'occasional' | 'daily' | 'heavy';
  alcoholFrequency: 'never' | 'occasional' | 'weekly' | 'daily';
  caffeineDaily: number; // tazzine/giorno
  // Valutazione energia di base
  baselinePhysical: number;  // 1-10
  baselineMental: number;    // 1-10
  baselineEmotional: number; // 1-10
  energyPattern: 'morning' | 'afternoon' | 'evening' | 'variable';
  stressLevel: 'low' | 'moderate' | 'high' | 'very_high';
  // Obiettivi
  goal: 'more_energy' | 'better_sleep' | 'fitness' | 'stress' | 'general_wellness';
  notes?: string;
  completedAt: Date;
  updatedAt: Date;
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
