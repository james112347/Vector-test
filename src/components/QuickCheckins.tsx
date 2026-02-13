import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from './ui/card';
import {
  Moon, Sun, Brain, Heart, Zap, Coffee, Droplets,
  Check, ChevronRight, ChevronDown, Activity, CloudSun,
  Sunset, CloudMoon, UtensilsCrossed, BedDouble,
  Pill, MonitorOff, Plus, Minus, Pencil, X,
  BookOpen, Briefcase, Sofa, Dumbbell, Gamepad2,
  Users, Car, Clock, Square, Pause,
} from 'lucide-react';
import { addCheckin, getTodayCheckins, deleteLastCheckinOfType, deletePhaseCheckins, deleteCheckin, updateCheckin } from '../lib/checkins';
import type { CheckinType, QuickCheckin } from '../db/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TimePhase = 'morning' | 'midday' | 'afternoon' | 'evening';

interface RatingOption {
  value: number;
  label: string;
  color: string;
  bg: string;
  border: string;
  textSelected: string;
}

interface CheckinQuestion {
  type: CheckinType;
  label: string;
  question: string;
  icon: typeof Moon;
  inverse?: boolean;
  /** Only show if this type hasn't been logged today */
  skipIfLogged?: boolean;
  /** Custom rating labels */
  ratings?: RatingOption[];
}

interface PhaseConfig {
  greeting: string;
  icon: typeof Sun;
  iconColor: string;
  questions: CheckinQuestion[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Milliliters per glass of water */
const ML_PER_GLASS = 250;
/** Target glasses of water per day */
const WATER_TARGET = 8;
/** Approximate mg of caffeine per espresso */
const MG_PER_ESPRESSO = 80;

// ---------------------------------------------------------------------------
// Time phase detection
// ---------------------------------------------------------------------------

function getTimePhase(): TimePhase {
  const h = new Date().getHours();
  if (h < 11) return 'morning';
  if (h < 14) return 'midday';
  if (h < 18) return 'afternoon';
  return 'evening';
}

// ---------------------------------------------------------------------------
// Rating scales - clean numbered buttons with text labels, no emoji icons
// ---------------------------------------------------------------------------

const DEFAULT_RATINGS: RatingOption[] = [
  { value: 1, label: 'Male',   color: 'text-red-500',     bg: 'bg-red-500',     border: 'border-red-300 dark:border-red-700',       textSelected: 'text-white' },
  { value: 2, label: 'Poco',   color: 'text-orange-500',  bg: 'bg-orange-500',  border: 'border-orange-300 dark:border-orange-700', textSelected: 'text-white' },
  { value: 3, label: 'Medio',  color: 'text-amber-500',   bg: 'bg-amber-500',   border: 'border-amber-300 dark:border-amber-700',   textSelected: 'text-white' },
  { value: 4, label: 'Bene',   color: 'text-emerald-500', bg: 'bg-emerald-500', border: 'border-emerald-300 dark:border-emerald-700', textSelected: 'text-white' },
  { value: 5, label: 'Ottimo', color: 'text-green-600',   bg: 'bg-green-600',   border: 'border-green-300 dark:border-green-700',   textSelected: 'text-white' },
];

/** Inverse scale: 1=high(bad), 5=low(good) -- used for stress */
const INVERSE_RATINGS: RatingOption[] = [
  { value: 1, label: 'Alto',   color: 'text-red-500',     bg: 'bg-red-500',     border: 'border-red-300 dark:border-red-700',       textSelected: 'text-white' },
  { value: 2, label: 'Medio+', color: 'text-orange-500',  bg: 'bg-orange-500',  border: 'border-orange-300 dark:border-orange-700', textSelected: 'text-white' },
  { value: 3, label: 'Medio',  color: 'text-amber-500',   bg: 'bg-amber-500',   border: 'border-amber-300 dark:border-amber-700',   textSelected: 'text-white' },
  { value: 4, label: 'Basso',  color: 'text-emerald-500', bg: 'bg-emerald-500', border: 'border-emerald-300 dark:border-emerald-700', textSelected: 'text-white' },
  { value: 5, label: 'Minimo', color: 'text-green-600',   bg: 'bg-green-600',   border: 'border-green-300 dark:border-green-700',   textSelected: 'text-white' },
];

const MEAL_RATINGS: RatingOption[] = [
  { value: 1, label: 'Saltato',  color: 'text-red-500',     bg: 'bg-red-500',     border: 'border-red-300 dark:border-red-700',       textSelected: 'text-white' },
  { value: 2, label: 'Snack',    color: 'text-orange-500',  bg: 'bg-orange-500',  border: 'border-orange-300 dark:border-orange-700', textSelected: 'text-white' },
  { value: 3, label: 'Veloce',   color: 'text-amber-500',   bg: 'bg-amber-500',   border: 'border-amber-300 dark:border-amber-700',   textSelected: 'text-white' },
  { value: 4, label: 'Buono',    color: 'text-emerald-500', bg: 'bg-emerald-500', border: 'border-emerald-300 dark:border-emerald-700', textSelected: 'text-white' },
  { value: 5, label: 'Completo', color: 'text-green-600',   bg: 'bg-green-600',   border: 'border-green-300 dark:border-green-700',   textSelected: 'text-white' },
];

const ACTIVITY_RATINGS: RatingOption[] = [
  { value: 1, label: 'Nessuna',  color: 'text-red-500',     bg: 'bg-red-500',     border: 'border-red-300 dark:border-red-700',       textSelected: 'text-white' },
  { value: 2, label: 'Leggera',  color: 'text-orange-500',  bg: 'bg-orange-500',  border: 'border-orange-300 dark:border-orange-700', textSelected: 'text-white' },
  { value: 3, label: 'Moderata', color: 'text-amber-500',   bg: 'bg-amber-500',   border: 'border-amber-300 dark:border-amber-700',   textSelected: 'text-white' },
  { value: 4, label: 'Buona',    color: 'text-emerald-500', bg: 'bg-emerald-500', border: 'border-emerald-300 dark:border-emerald-700', textSelected: 'text-white' },
  { value: 5, label: 'Intensa',  color: 'text-green-600',   bg: 'bg-green-600',   border: 'border-green-300 dark:border-green-700',   textSelected: 'text-white' },
];

// ---------------------------------------------------------------------------
// Current Activity options — "Cosa stai facendo?"
// Maps to CheckinType 'current_activity' values 1-7 (see schema.ts)
// ---------------------------------------------------------------------------

interface ActivityOption {
  value: number;
  label: string;
  description: string;
  icon: typeof BookOpen;
  color: string;
  bg: string;
  bgSelected: string;
}

const ACTIVITY_OPTIONS: ActivityOption[] = [
  {
    value: 1,
    label: 'Studio',
    description: 'Studio, lettura, concentrazione',
    icon: BookOpen,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/10',
    bgSelected: 'bg-blue-500',
  },
  {
    value: 2,
    label: 'Lavoro',
    description: 'Lavoro, riunioni, produttivita',
    icon: Briefcase,
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-500/10',
    bgSelected: 'bg-slate-500',
  },
  {
    value: 3,
    label: 'Pausa',
    description: 'Pausa, riposo, relax breve',
    icon: Sofa,
    color: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-500/10',
    bgSelected: 'bg-teal-500',
  },
  {
    value: 4,
    label: 'Sport',
    description: 'Allenamento, camminata, esercizio',
    icon: Dumbbell,
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-500/10',
    bgSelected: 'bg-orange-500',
  },
  {
    value: 5,
    label: 'Tempo libero',
    description: 'Hobby, TV, social, svago',
    icon: Gamepad2,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-500/10',
    bgSelected: 'bg-purple-500',
  },
  {
    value: 6,
    label: 'Sociale',
    description: 'Famiglia, amici, socialita',
    icon: Users,
    color: 'text-pink-600 dark:text-pink-400',
    bg: 'bg-pink-500/10',
    bgSelected: 'bg-pink-500',
  },
  {
    value: 7,
    label: 'Spostamenti',
    description: 'Tragitto, commissioni, viaggi',
    icon: Car,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    bgSelected: 'bg-amber-500',
  },
];

/** Get activity option by value */
function getActivityOption(value: number): ActivityOption | undefined {
  return ACTIVITY_OPTIONS.find(a => a.value === value);
}

// ---------------------------------------------------------------------------
// Phase configurations
// ---------------------------------------------------------------------------

const PHASE_CONFIG: Record<TimePhase, PhaseConfig> = {
  morning: {
    greeting: 'Buongiorno',
    icon: Sun,
    iconColor: 'text-amber-500',
    questions: [
      {
        type: 'sleep_quality',
        label: 'Sonno',
        question: 'Come hai dormito?',
        icon: Moon,
      },
      {
        type: 'mood',
        label: 'Umore',
        question: 'Come ti senti stamattina?',
        icon: Heart,
      },
      {
        type: 'stress',
        label: 'Stress',
        question: 'Livello di stress?',
        icon: Zap,
        inverse: true,
        ratings: INVERSE_RATINGS,
      },
      {
        type: 'meal_time',
        label: 'Colazione',
        question: 'Colazione?',
        icon: UtensilsCrossed,
        ratings: MEAL_RATINGS,
      },
    ],
  },
  midday: {
    greeting: 'Buon proseguimento',
    icon: CloudSun,
    iconColor: 'text-sky-500',
    questions: [
      {
        type: 'focus',
        label: 'Focus',
        question: 'Come va la concentrazione?',
        icon: Brain,
      },
      {
        type: 'stress',
        label: 'Stress',
        question: 'Livello di stress?',
        icon: Zap,
        inverse: true,
        ratings: INVERSE_RATINGS,
      },
      {
        type: 'mood',
        label: 'Umore',
        question: 'Come ti senti?',
        icon: Heart,
      },
      {
        type: 'meal_time',
        label: 'Pranzo',
        question: 'Pranzo?',
        icon: UtensilsCrossed,
        ratings: MEAL_RATINGS,
      },
    ],
  },
  afternoon: {
    greeting: 'Buon pomeriggio',
    icon: Sunset,
    iconColor: 'text-orange-500',
    questions: [
      {
        type: 'focus',
        label: 'Focus',
        question: 'Come va la concentrazione?',
        icon: Brain,
      },
      {
        type: 'mood',
        label: 'Umore',
        question: 'Come ti senti?',
        icon: Heart,
      },
      {
        type: 'meal_time',
        label: 'Spuntino',
        question: 'Spuntino pomeridiano?',
        icon: UtensilsCrossed,
        ratings: MEAL_RATINGS,
      },
      {
        type: 'activity_done',
        label: 'Attivita',
        question: 'Movimento oggi?',
        icon: Activity,
        ratings: ACTIVITY_RATINGS,
      },
      {
        type: 'stress',
        label: 'Stress',
        question: 'Livello di stress?',
        icon: Zap,
        inverse: true,
        ratings: INVERSE_RATINGS,
      },
    ],
  },
  evening: {
    greeting: 'Buona sera',
    icon: CloudMoon,
    iconColor: 'text-indigo-400',
    questions: [
      {
        type: 'mood',
        label: 'Umore',
        question: "Com'e' andata oggi?",
        icon: Heart,
      },
      {
        type: 'meal_time',
        label: 'Cena',
        question: 'Cena?',
        icon: UtensilsCrossed,
        ratings: MEAL_RATINGS,
      },
      {
        type: 'stress',
        label: 'Stress',
        question: 'Livello di stress?',
        icon: Zap,
        inverse: true,
        ratings: INVERSE_RATINGS,
      },
      {
        type: 'activity_done',
        label: 'Attivita',
        question: 'Attivita fisica oggi?',
        icon: Activity,
        skipIfLogged: true,
        ratings: ACTIVITY_RATINGS,
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Quick counters config -- with measurement units
// ---------------------------------------------------------------------------

interface CounterConfig {
  type: CheckinType;
  icon: typeof Coffee;
  label: string;
  unit: string;
  color: string;
  activeColor: string;
  target?: number;
  /** Value per tap in relevant unit (for display) */
  unitPerTap: number;
  unitSuffix: string;
}

/** Default counters always visible */
const DEFAULT_COUNTERS: CounterConfig[] = [
  {
    type: 'caffeine',
    icon: Coffee,
    label: 'Caffeina',
    unit: '1 tazzina',
    color: 'text-amber-700 dark:text-amber-500',
    activeColor: 'bg-amber-100 dark:bg-amber-900/30',
    unitPerTap: MG_PER_ESPRESSO,
    unitSuffix: 'mg',
  },
  {
    type: 'water',
    icon: Droplets,
    label: 'Acqua',
    unit: `${ML_PER_GLASS}ml/bicch.`,
    color: 'text-blue-500',
    activeColor: 'bg-blue-100 dark:bg-blue-900/30',
    target: WATER_TARGET,
    unitPerTap: ML_PER_GLASS,
    unitSuffix: 'ml',
  },
];

/** Extra counters the user can enable — all already functional in energy engine */
const EXTRA_COUNTERS: CounterConfig[] = [
  {
    type: 'nap',
    icon: BedDouble,
    label: 'Pisolino',
    unit: '20-30 min',
    color: 'text-indigo-500',
    activeColor: 'bg-indigo-100 dark:bg-indigo-900/30',
    unitPerTap: 1,
    unitSuffix: '',
  },
  {
    type: 'supplement',
    icon: Pill,
    label: 'Integratore',
    unit: '1 dose',
    color: 'text-emerald-600 dark:text-emerald-500',
    activeColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    unitPerTap: 1,
    unitSuffix: '',
  },
  {
    type: 'screen_break',
    icon: MonitorOff,
    label: 'Pausa schermo',
    unit: '1 pausa',
    color: 'text-violet-600 dark:text-violet-500',
    activeColor: 'bg-violet-100 dark:bg-violet-900/30',
    unitPerTap: 1,
    unitSuffix: '',
  },
];

const STORAGE_KEY = 'vector_extra_counters';

function loadEnabledExtras(): CheckinType[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveEnabledExtras(types: CheckinType[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(types));
}

// ---------------------------------------------------------------------------
// All trackable types for completion display
// ---------------------------------------------------------------------------

const ALL_TRACKED_TYPES: Array<{ type: CheckinType; label: string }> = [
  { type: 'current_activity', label: 'Attivita' },
  { type: 'sleep_quality', label: 'Sonno' },
  { type: 'mood',          label: 'Umore' },
  { type: 'stress',        label: 'Stress' },
  { type: 'focus',         label: 'Focus' },
  { type: 'meal_time',     label: 'Pasto' },
  { type: 'activity_done', label: 'Movimento' },
  { type: 'water',         label: 'Acqua' },
  { type: 'caffeine',      label: 'Caffe' },
  { type: 'nap',           label: 'Pisolino' },
  { type: 'supplement',    label: 'Integratore' },
  { type: 'screen_break',  label: 'Pausa' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format water volume: show liters when >= 1000ml, otherwise ml */
function formatWaterVolume(glasses: number): string {
  const ml = glasses * ML_PER_GLASS;
  if (ml >= 1000) {
    const liters = (ml / 1000).toFixed(1).replace('.0', '');
    return `${liters}L`;
  }
  return `${ml}ml`;
}

/** Format caffeine: show approximate total mg */
function formatCaffeine(cups: number): string {
  const mg = cups * MG_PER_ESPRESSO;
  return `~${mg}mg`;
}

/** Get meal label based on time of day */
function getMealLabel(time: string): string {
  const h = parseInt(time.split(':')[0]);
  if (h < 11) return 'Colazione';
  if (h < 14) return 'Pranzo';
  if (h < 18) return 'Spuntino';
  return 'Cena';
}

// ---------------------------------------------------------------------------
// RatingButton sub-component -- clean numbered circles, no emoji icons
// ---------------------------------------------------------------------------

function RatingButton({
  option,
  selected,
  onSelect,
}: {
  option: RatingOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`
        flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl
        transition-all duration-150 active:scale-95 flex-1 min-w-0
        border
        ${selected
          ? `${option.bg} ${option.textSelected} shadow-sm border-transparent`
          : `bg-muted/30 hover:bg-muted/60 text-muted-foreground ${option.border}`
        }
      `}
    >
      {/* Numbered circle */}
      <div className={`
        w-9 h-9 rounded-full flex items-center justify-center
        text-sm font-bold tracking-tight
        ${selected
          ? 'bg-white/25 text-white'
          : `bg-background shadow-sm ${option.color}`
        }
      `}>
        {option.value}
      </div>
      {/* Text label */}
      <span className={`
        text-[10px] font-semibold leading-tight tracking-wide uppercase
        ${selected ? 'text-white/90' : 'text-muted-foreground'}
      `}>
        {option.label}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// CounterButton sub-component -- with measurement context
// ---------------------------------------------------------------------------

function CounterButton({
  counter,
  value,
  onTap,
  onDecrement,
}: {
  counter: CounterConfig;
  value: number;
  onTap: () => void;
  onDecrement: () => void;
}) {
  const Icon = counter.icon;
  const hasValue = value > 0;

  // Build the measurement display string
  let measurementText = '';
  if (counter.type === 'water' && hasValue) {
    measurementText = formatWaterVolume(value);
  } else if (counter.type === 'caffeine' && hasValue) {
    measurementText = formatCaffeine(value);
  } else if (hasValue && counter.unitSuffix) {
    measurementText = `${value * counter.unitPerTap}${counter.unitSuffix}`;
  }

  return (
    <div className="flex flex-col items-center gap-0.5 min-w-0 shrink-0">
      {/* Icon + count row */}
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${counter.color}`} />
        <span className={`text-xs font-bold tabular-nums ${counter.color}`}>
          {value}
        </span>
        {counter.target != null && (
          <span className="text-[9px] text-muted-foreground">/{counter.target}</span>
        )}
      </div>

      {/* Label */}
      <span className="text-[9px] text-muted-foreground font-medium leading-tight">
        {counter.label}
      </span>

      {/* Measurement context */}
      {measurementText && (
        <span className="text-[8px] text-muted-foreground/70 font-medium tabular-nums">
          ({measurementText})
        </span>
      )}
      {counter.unit && !measurementText && (
        <span className="text-[8px] text-muted-foreground/60 font-normal">
          {counter.unit}
        </span>
      )}

      {/* +/- buttons */}
      <div className="flex items-center gap-1 mt-0.5">
        {hasValue && (
          <button
            onClick={onDecrement}
            className="w-6 h-6 rounded-full border border-border bg-muted/50 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors active:scale-90"
            aria-label={`Rimuovi 1 ${counter.label}`}
          >
            <Minus className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
        <button
          onClick={onTap}
          className={`
            w-6 h-6 rounded-full border flex items-center justify-center transition-colors active:scale-90
            ${hasValue
              ? `${counter.activeColor} border-transparent`
              : 'border-border bg-muted/50 hover:bg-muted'
            }
          `}
          aria-label={`Aggiungi 1 ${counter.label}`}
        >
          <Plus className={`h-3 w-3 ${hasValue ? counter.color : 'text-muted-foreground'}`} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function QuickCheckins({ userId }: { userId: number }) {
  const [checkins, setCheckins] = useState<QuickCheckin[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedValue, setSelectedValue] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [enabledExtras, setEnabledExtras] = useState<CheckinType[]>(loadEnabledExtras);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [editingType, setEditingType] = useState<CheckinType | null>(null);
  const [savingActivity, setSavingActivity] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<number | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  const phase = useMemo(() => getTimePhase(), []);
  const config = PHASE_CONFIG[phase];

  // Load today's checkins
  const loadCheckins = useCallback(async () => {
    const items = await getTodayCheckins(userId);
    setCheckins(items);
  }, [userId]);

  useEffect(() => { loadCheckins(); }, [loadCheckins]);

  // Determine which types have been logged today (rated types, not counters)
  const loggedTypes = useMemo(() => {
    const rated = new Set<CheckinType>();
    const phaseStart = phase === 'morning' ? 5 : phase === 'midday' ? 11 : phase === 'afternoon' ? 14 : 18;
    for (const c of checkins) {
      // For phase-specific checks, only count if logged during current phase
      const [h] = c.time.split(':').map(Number);
      if (h >= phaseStart) {
        rated.add(c.type);
      }
      // Counters and some types count regardless of phase
      if (['water', 'caffeine', 'supplement', 'screen_break'].includes(c.type)) {
        rated.add(c.type);
      }
    }
    return rated;
  }, [checkins, phase]);

  // Filter questions: skip already-logged and conditional skips
  const activeQuestions = useMemo(() => {
    return config.questions.filter(q => {
      if (q.skipIfLogged && loggedTypes.has(q.type)) return false;
      // Don't re-ask questions already answered this phase
      if (loggedTypes.has(q.type)) return false;
      return true;
    });
  }, [config.questions, loggedTypes]);

  // Check if all phase questions are done
  useEffect(() => {
    if (activeQuestions.length === 0 && checkins.length > 0) {
      setAllDone(true);
    }
  }, [activeQuestions, checkins]);

  const currentQuestion = activeQuestions[currentIdx] ?? null;

  // Counter value getter
  const getCounterValue = (type: CheckinType): number => {
    return checkins
      .filter(c => c.type === type)
      .reduce((s, c) => s + c.value, 0);
  };

  // ---------------------------------------------------------------------------
  // "Cosa stai facendo?" — activity tracking with start/stop/pause
  // ---------------------------------------------------------------------------

  /** Today's activity entries, sorted by time (value 0 = "fine"/idle) */
  const todayActivities = useMemo(() => {
    return checkins
      .filter(c => c.type === 'current_activity')
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [checkins]);

  /** Most recent activity entry */
  const lastActivityEntry = todayActivities.length > 0
    ? todayActivities[todayActivities.length - 1]
    : null;

  /** Currently active activity value (null = idle, 0 = explicitly stopped) */
  const lastActivity = lastActivityEntry?.value ?? null;
  const isActivityRunning = lastActivity != null && lastActivity > 0;

  /** Elapsed time since last activity started */
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!isActivityRunning || !lastActivityEntry) {
      setElapsed('');
      return;
    }
    const update = () => {
      const [h, m] = lastActivityEntry.time.split(':').map(Number);
      const started = new Date();
      started.setHours(h, m, 0, 0);
      const diff = Math.max(0, Math.floor((Date.now() - started.getTime()) / 60000));
      if (diff < 60) {
        setElapsed(`${diff}min`);
      } else {
        setElapsed(`${Math.floor(diff / 60)}h${diff % 60 > 0 ? `${diff % 60}m` : ''}`);
      }
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [isActivityRunning, lastActivityEntry]);

  /** Start a new activity or switch to a different one */
  const handleActivitySelect = async (value: number) => {
    if (savingActivity) return;
    // If tapping the same running activity, do nothing (use stop button)
    if (isActivityRunning && lastActivity === value) return;
    setSavingActivity(true);
    await addCheckin(userId, 'current_activity', value);
    await loadCheckins();
    setTimeout(() => setSavingActivity(false), 300);
  };

  /** Stop the current activity (log value 0 = idle) */
  const handleActivityStop = async () => {
    if (savingActivity || !isActivityRunning) return;
    setSavingActivity(true);
    await addCheckin(userId, 'current_activity', 0);
    await loadCheckins();
    setTimeout(() => setSavingActivity(false), 300);
  };

  /** Delete a specific activity entry from the timeline */
  const handleDeleteActivity = async (entry: QuickCheckin) => {
    if (entry.id == null) return;
    await deleteCheckin(entry.id, userId);
    await loadCheckins();
  };

  /** Edit a specific activity entry — change its activity type */
  const handleEditActivityValue = async (entryId: number, newValue: number) => {
    setSavingActivity(true);
    await updateCheckin(entryId, { value: newValue }, userId);
    await loadCheckins();
    setEditingActivityId(null);
    setTimeout(() => setSavingActivity(false), 300);
  };

  /** Edit the start time of an activity entry */
  const handleEditActivityTime = async (entryId: number, newTime: string) => {
    setSavingActivity(true);
    await updateCheckin(entryId, { time: newTime }, userId);
    await loadCheckins();
    setTimeout(() => setSavingActivity(false), 300);
  };

  // Save a rated answer and advance
  const handleRate = async (value: number) => {
    if (!currentQuestion || saving) return;
    setSelectedValue(value);
    setSaving(true);

    // For inverse types (stress), the value is stored directly:
    // 1 = high stress (bad), 5 = low stress (good)
    // The UI labels already reflect this via INVERSE_RATINGS
    await addCheckin(userId, currentQuestion.type, value);
    await loadCheckins();

    // Brief visual feedback then clear state.
    // The answered question is auto-removed from activeQuestions via loggedTypes,
    // so currentIdx now naturally points to the next unanswered question.
    setTimeout(() => {
      setSaving(false);
      setSelectedValue(null);
      if (activeQuestions.length <= 1) {
        // This was the last question
        setAllDone(true);
      } else {
        // Clamp index in case user was at the end after skipping
        setCurrentIdx(prev => Math.min(prev, activeQuestions.length - 2));
      }
    }, 300);
  };

  // Build active counters list: defaults + user-enabled extras
  const activeCounters = useMemo(() => {
    const extras = EXTRA_COUNTERS.filter(c => enabledExtras.includes(c.type));
    return [...DEFAULT_COUNTERS, ...extras];
  }, [enabledExtras]);

  // Toggle an extra counter on/off
  const toggleExtra = (type: CheckinType) => {
    setEnabledExtras(prev => {
      const next = prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type];
      saveEnabledExtras(next);
      return next;
    });
  };

  // Counter increment
  const handleCounter = async (type: CheckinType) => {
    await addCheckin(userId, type, 1);
    await loadCheckins();
  };

  // Phase start hour for filtering phase-specific checkins
  const phaseStartHour = phase === 'morning' ? 5 : phase === 'midday' ? 11 : phase === 'afternoon' ? 14 : 18;

  // Answered questions in the current phase (for showing corrections)
  const answeredPhaseQuestions = useMemo(() => {
    return config.questions
      .map(q => {
        const matching = checkins.filter(c => {
          if (c.type !== q.type) return false;
          const [h] = c.time.split(':').map(Number);
          return h >= phaseStartHour;
        });
        if (matching.length === 0) return null;
        const last = matching[matching.length - 1];
        return { question: q, value: last.value };
      })
      .filter(Boolean) as { question: CheckinQuestion; value: number }[];
  }, [config.questions, checkins, phaseStartHour]);

  // Counter decrement: remove last entry of that type today
  const handleDecrement = async (type: CheckinType) => {
    await deleteLastCheckinOfType(userId, type);
    await loadCheckins();
  };

  // Edit a rated answer: delete old, save new
  const handleEditRate = async (type: CheckinType, newValue: number) => {
    setSaving(true);
    setSelectedValue(newValue);
    await deletePhaseCheckins(userId, type, phaseStartHour);
    await addCheckin(userId, type, newValue);
    await loadCheckins();
    setTimeout(() => {
      setSaving(false);
      setSelectedValue(null);
      setEditingType(null);
    }, 300);
  };

  // Completion counts for the tracker
  const allLoggedTypes = useMemo(() => {
    return new Set(checkins.map(c => c.type));
  }, [checkins]);

  // All questions visible for this phase (including answered, excluding skipIfLogged from previous phases)
  const allPhaseQuestions = useMemo(() => {
    return config.questions.filter(q => {
      if (q.skipIfLogged) {
        // Only hide if logged BEFORE this phase
        return !checkins.some(c => {
          if (c.type !== q.type) return false;
          const [h] = c.time.split(':').map(Number);
          return h < phaseStartHour;
        });
      }
      return true;
    });
  }, [config.questions, checkins, phaseStartHour]);

  // Full day summary for the scrollable completion window
  const todaySummary = useMemo(() => {
    const counterTypes: CheckinType[] = ['water', 'caffeine', 'nap', 'supplement', 'screen_break'];
    const items: Array<{
      key: string;
      type: CheckinType;
      icon: typeof Moon;
      label: string;
      displayValue: string;
      color: string;
      time?: string;
    }> = [];

    const typeMeta: Record<string, { icon: typeof Moon; label: string; ratings?: RatingOption[] }> = {
      sleep_quality: { icon: Moon, label: 'Sonno' },
      mood: { icon: Heart, label: 'Umore' },
      stress: { icon: Zap, label: 'Stress', ratings: INVERSE_RATINGS },
      focus: { icon: Brain, label: 'Focus' },
      activity_done: { icon: Activity, label: 'Movimento', ratings: ACTIVITY_RATINGS },
    };

    // Meal entries — each shown separately with meal name
    const mealCheckins = checkins.filter(c => c.type === 'meal_time');
    for (const entry of mealCheckins) {
      const opt = MEAL_RATINGS.find(r => r.value === entry.value);
      items.push({
        key: `meal_${entry.id ?? entry.time}`,
        type: 'meal_time',
        icon: UtensilsCrossed,
        label: getMealLabel(entry.time),
        displayValue: opt ? `${opt.label} (${entry.value}/5)` : `${entry.value}/5`,
        color: opt?.color ?? 'text-muted-foreground',
        time: entry.time,
      });
    }

    // Other rated types — latest per type
    for (const [type, meta] of Object.entries(typeMeta)) {
      const entries = checkins.filter(c => c.type === type);
      if (entries.length === 0) continue;
      const latest = entries[entries.length - 1];
      const scale = meta.ratings ?? DEFAULT_RATINGS;
      const opt = scale.find(r => r.value === latest.value);
      items.push({
        key: type,
        type: type as CheckinType,
        icon: meta.icon,
        label: meta.label,
        displayValue: opt ? `${opt.label} (${latest.value}/5)` : `${latest.value}/5`,
        color: opt?.color ?? 'text-muted-foreground',
        time: latest.time,
      });
    }

    // Current activity
    const activityEntries = checkins.filter(c => c.type === 'current_activity');
    if (activityEntries.length > 0) {
      const latest = activityEntries[activityEntries.length - 1];
      const act = getActivityOption(latest.value);
      if (act) {
        items.push({
          key: 'current_activity',
          type: 'current_activity',
          icon: Clock,
          label: 'Attivita',
          displayValue: latest.value > 0 ? act.label : 'Inattivo',
          color: latest.value > 0 ? act.color : 'text-muted-foreground',
          time: latest.time,
        });
      }
    }

    // Counters
    const counterMeta: Record<string, { icon: typeof Moon; label: string; format: (v: number) => string }> = {
      water: { icon: Droplets, label: 'Acqua', format: v => `${v} bicch. (${formatWaterVolume(v)})` },
      caffeine: { icon: Coffee, label: 'Caffeina', format: v => `${v} caffe (${formatCaffeine(v)})` },
      nap: { icon: BedDouble, label: 'Pisolino', format: v => `${v}` },
      supplement: { icon: Pill, label: 'Integratore', format: v => `${v} dosi` },
      screen_break: { icon: MonitorOff, label: 'Pausa schermo', format: v => `${v} pause` },
    };

    for (const cType of counterTypes) {
      const total = checkins.filter(c => c.type === cType).reduce((s, c) => s + c.value, 0);
      if (total <= 0) continue;
      const meta = counterMeta[cType];
      if (!meta) continue;
      items.push({
        key: cType,
        type: cType as CheckinType,
        icon: meta.icon,
        label: meta.label,
        displayValue: meta.format(total),
        color: 'text-foreground',
      });
    }

    return items;
  }, [checkins]);

  const PhaseIcon = config.icon;

  // Count of all unique types that have been logged today
  const completedCount = allLoggedTypes.size;

  return (
    <Card className="overflow-visible">
      <CardContent className="p-0">

        {/* ---- Collapsible header: tap to toggle ---- */}
        <button
          onClick={() => setIsOpen(prev => !prev)}
          className="w-full flex items-center gap-2 px-4 pt-4 pb-3 text-left"
        >
          <PhaseIcon className={`h-4 w-4 ${config.iconColor}`} />
          <span className="text-sm font-semibold text-foreground">
            {isOpen ? config.greeting : 'Check-in'}
          </span>
          {!isOpen && completedCount > 0 && (
            <span className="text-[11px] bg-green-500/10 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-bold tabular-nums">
              {completedCount} completat{completedCount === 1 ? 'o' : 'i'}
            </span>
          )}
          {!isOpen && completedCount === 0 && (
            <span className="text-[11px] text-muted-foreground">
              Tocca per aprire
            </span>
          )}
          {isOpen && allDone ? (
            <div className="ml-auto flex items-center gap-1.5">
              <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <Check className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold">Completato</span>
              </div>
            </div>
          ) : isOpen ? (
            <span className="ml-auto text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold tabular-nums">
              {answeredPhaseQuestions.length}/{allPhaseQuestions.length}
            </span>
          ) : null}
          <ChevronDown className={`h-4 w-4 text-muted-foreground ml-auto shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* ---- Collapsible content ---- */}
        {isOpen && <>

        {/* ---- Unified check-in section ---- */}
        <div className="px-4 pb-3 space-y-3">

          {/* Phase questions window — always visible */}
          <div className="rounded-xl border border-border shadow-sm bg-card">
            <div className="max-h-52 overflow-y-auto" style={{ touchAction: 'pan-y', overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch' }}>
              {allPhaseQuestions.map((q, i) => {
                const answered = answeredPhaseQuestions.find(a => a.question.type === q.type);
                const isCurrentQ = !allDone && !editingType && currentQuestion?.type === q.type;
                const isEditingQ = editingType === q.type;
                const QIcon = q.icon;
                const hasBorder = i < allPhaseQuestions.length - 1;

                // ---- Answered question: green check, value, clickable to edit ----
                if (answered) {
                  const scale = q.ratings ?? DEFAULT_RATINGS;
                  const opt = scale.find(r => r.value === answered.value);
                  return (
                    <button
                      key={q.type}
                      onClick={() => setEditingType(q.type)}
                      className={`
                        w-full flex items-center gap-2.5 px-3 py-2.5 transition-colors
                        ${hasBorder ? 'border-b border-border/30' : ''}
                        ${isEditingQ ? 'bg-amber-500/10' : 'hover:bg-muted/30'}
                      `}
                    >
                      <div className="w-5 h-5 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                      </div>
                      <QIcon className={`h-3.5 w-3.5 shrink-0 ${opt?.color ?? 'text-muted-foreground'}`} />
                      <span className="text-xs text-muted-foreground">{q.label}</span>
                      <span className={`text-xs font-semibold ${opt?.color ?? ''}`}>
                        {opt?.label ?? String(answered.value)}
                      </span>
                      <Pencil className="h-2.5 w-2.5 text-muted-foreground/40 ml-auto shrink-0" />
                    </button>
                  );
                }

                // ---- Current question: highlighted with indicator ----
                if (isCurrentQ) {
                  return (
                    <div
                      key={q.type}
                      className={`
                        flex items-center gap-2.5 px-3 py-2.5 bg-primary/5 border-l-2 border-l-primary
                        ${hasBorder ? 'border-b border-border/30' : ''}
                      `}
                    >
                      <div className="w-5 h-5 rounded-full border-2 border-primary/50 flex items-center justify-center shrink-0">
                        <ChevronRight className="h-3 w-3 text-primary" />
                      </div>
                      <QIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="text-xs font-semibold text-foreground">{q.label}</span>
                      <span className="text-[10px] text-primary font-medium ml-auto">attuale</span>
                    </div>
                  );
                }

                // ---- Pending question: grayed out ----
                return (
                  <div
                    key={q.type}
                    className={`
                      flex items-center gap-2.5 px-3 py-2.5 opacity-40
                      ${hasBorder ? 'border-b border-border/30' : ''}
                    `}
                  >
                    <div className="w-5 h-5 rounded-full border border-muted-foreground/30 shrink-0" />
                    <QIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{q.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rating buttons — for current question OR editing question */}
          {(() => {
            const activeQ = editingType
              ? config.questions.find(q => q.type === editingType)
              : (!allDone ? currentQuestion : null);
            if (!activeQ) return null;
            const isEditing = editingType != null;
            const activeRatings = activeQ.ratings ?? DEFAULT_RATINGS;
            const currentVal = isEditing
              ? (answeredPhaseQuestions.find(a => a.question.type === editingType)?.value ?? null)
              : null;
            const QIcon = activeQ.icon;

            return (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <QIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="text-sm font-medium text-foreground">{activeQ.question}</p>
                  {isEditing && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded font-medium ml-auto">
                      Correzione
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  {activeRatings.map(opt => (
                    <RatingButton
                      key={opt.value}
                      option={opt}
                      selected={isEditing
                        ? (selectedValue === opt.value || (selectedValue === null && currentVal === opt.value))
                        : selectedValue === opt.value
                      }
                      onSelect={() => isEditing
                        ? handleEditRate(editingType!, opt.value)
                        : handleRate(opt.value)
                      }
                    />
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  {isEditing && (
                    <button
                      onClick={() => { setEditingType(null); setSelectedValue(null); }}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronRight className="h-3 w-3 rotate-180" />
                      Annulla
                    </button>
                  )}
                  {!isEditing && activeQuestions.length > 1 && currentIdx < activeQuestions.length - 1 && (
                    <button
                      onClick={() => { setSelectedValue(null); setCurrentIdx(currentIdx + 1); }}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronRight className="h-3 w-3" />
                      Salta
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Day summary window — always visible when there are logged items */}
          {!editingType && todaySummary.length > 0 && (
            <div className="rounded-xl border border-border shadow-sm bg-card">
              <div className="bg-muted/30 px-3 py-1.5 border-b border-border flex items-center gap-2">
                <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                <span className="text-[11px] font-semibold text-foreground">Riepilogo giornata</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{todaySummary.length} parametri</span>
              </div>
              <div className="max-h-56 overflow-y-auto divide-y divide-border/30" style={{ touchAction: 'pan-y', overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch' }}>
                {todaySummary.map(item => {
                  const Icon = item.icon;
                  const phaseAnswer = answeredPhaseQuestions.find(a => a.question.type === item.type);
                  return (
                    <div key={item.key} className="flex items-center gap-2.5 px-3 py-2">
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${item.color}`} />
                      <span className="text-xs text-muted-foreground shrink-0">{item.label}</span>
                      <span className={`text-xs font-medium ${item.color} truncate`}>{item.displayValue}</span>
                      {item.time && (
                        <span className="text-[10px] text-muted-foreground/50 tabular-nums ml-auto shrink-0">{item.time}</span>
                      )}
                      {phaseAnswer && (
                        <button
                          onClick={() => setEditingType(phaseAnswer.question.type)}
                          className="shrink-0 ml-auto w-6 h-6 rounded-full flex items-center justify-center hover:bg-muted/50 transition-colors"
                        >
                          <Pencil className="h-2.5 w-2.5 text-muted-foreground hover:text-primary" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ---- "Cosa stai facendo?" — Activity tracking with start/stop ---- */}
        <div className="border-t border-border px-4 py-3 space-y-2.5">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              Cosa stai facendo?
            </span>
            {isActivityRunning && lastActivity != null && (() => {
              const act = getActivityOption(lastActivity);
              return act ? (
                <span className={`ml-auto inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${act.bg} ${act.color}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  {act.label} {elapsed && `· ${elapsed}`}
                </span>
              ) : null;
            })()}
          </div>

          {/* Horizontal scroll activity strip */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            {ACTIVITY_OPTIONS.map(act => {
              const Icon = act.icon;
              const isActive = isActivityRunning && lastActivity === act.value;
              return (
                <button
                  key={act.value}
                  onClick={() => handleActivitySelect(act.value)}
                  disabled={savingActivity}
                  className={`
                    flex flex-col items-center gap-0.5 py-1.5 px-2.5 rounded-xl shrink-0
                    transition-all duration-150 active:scale-95
                    border
                    ${isActive
                      ? `${act.bgSelected} text-white shadow-sm border-transparent`
                      : `bg-muted/30 hover:bg-muted/60 text-muted-foreground border-border/50`
                    }
                  `}
                >
                  <Icon className={`h-5 w-5 ${isActive ? 'text-white' : act.color}`} />
                  <span className={`
                    text-[9px] font-semibold leading-tight whitespace-nowrap
                    ${isActive ? 'text-white/90' : 'text-muted-foreground'}
                  `}>
                    {act.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active activity controls: stop button */}
          {isActivityRunning && lastActivity != null && (() => {
            const act = getActivityOption(lastActivity);
            if (!act) return null;
            return (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleActivityStop}
                  disabled={savingActivity}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors active:scale-[0.98]"
                >
                  <Square className="h-3 w-3" />
                  Fine {act.label}
                </button>
                <button
                  onClick={() => handleActivitySelect(3)}
                  disabled={savingActivity || lastActivity === 3}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/30 py-1.5 px-3 text-xs font-medium text-muted-foreground hover:bg-muted/60 transition-colors active:scale-[0.98]"
                >
                  <Pause className="h-3 w-3" />
                  Pausa
                </button>
              </div>
            );
          })()}

          {/* ---- "La tua giornata" — collapsible window with preview bar ---- */}
          {todayActivities.filter(e => e.value > 0).length > 0 && (() => {
            // Compute timeline data for the preview bar
            const activeEntries = todayActivities.filter(e => e.value > 0);
            const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
            const firstMin = (() => { const [h, m] = activeEntries[0].time.split(':').map(Number); return h * 60 + m; })();
            const totalSpan = Math.max(1, nowMin - firstMin);
            // Total active time
            let totalActiveMins = 0;
            for (let i = 0; i < todayActivities.length; i++) {
              const e = todayActivities[i];
              if (e.value <= 0) continue;
              const [sh, sm] = e.time.split(':').map(Number);
              const startM = sh * 60 + sm;
              const next = todayActivities[i + 1];
              const endM = next ? (() => { const [nh, nm] = next.time.split(':').map(Number); return nh * 60 + nm; })() : nowMin;
              totalActiveMins += Math.max(0, endM - startM);
            }
            const totalDurLabel = totalActiveMins < 60
              ? `${totalActiveMins}min`
              : `${Math.floor(totalActiveMins / 60)}h${totalActiveMins % 60 > 0 ? `${totalActiveMins % 60}m` : ''}`;

            return (
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                {/* Header — tap to toggle */}
                <button
                  onClick={() => setTimelineOpen(!timelineOpen)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors"
                >
                  <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-[11px] font-semibold text-foreground">La tua giornata</span>
                  <span className="text-[10px] text-muted-foreground">
                    {activeEntries.length} attivita · {totalDurLabel}
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0 transition-transform ${timelineOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Preview bar — always visible (colored segments) */}
                <div className="px-3 pb-2">
                  <div className="flex h-3 rounded-full overflow-hidden bg-muted/30 gap-px">
                    {todayActivities.map((entry, i) => {
                      if (entry.value <= 0) return null;
                      const act = getActivityOption(entry.value);
                      if (!act) return null;
                      const [sh, sm] = entry.time.split(':').map(Number);
                      const startM = sh * 60 + sm;
                      const next = todayActivities[i + 1];
                      const endM = next ? (() => { const [nh, nm] = next.time.split(':').map(Number); return nh * 60 + nm; })() : nowMin;
                      const dur = Math.max(1, endM - startM);
                      const pct = Math.max(2, (dur / totalSpan) * 100);
                      return (
                        <div
                          key={entry.id ?? i}
                          className={`${act.bgSelected} rounded-sm relative group`}
                          style={{ width: `${pct}%` }}
                          title={`${act.label} ${entry.time} (${dur < 60 ? `${dur}m` : `${Math.floor(dur / 60)}h${dur % 60 > 0 ? `${dur % 60}m` : ''}`})`}
                        />
                      );
                    })}
                  </div>
                  {/* Time labels under bar */}
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[9px] text-muted-foreground">{activeEntries[0].time}</span>
                    <span className="text-[9px] text-muted-foreground">adesso</span>
                  </div>
                </div>

                {/* Expanded detail view */}
                {timelineOpen && (
                  <div className="border-t border-border px-3 py-2 space-y-1.5">
                    {todayActivities.map((entry, i) => {
                      const act = getActivityOption(entry.value);
                      if (!act) return null;
                      const Icon = act.icon;
                      const isLast = i === todayActivities.length - 1 && entry.value > 0;
                      const isEditing = editingActivityId === entry.id;
                      const nextEntry = todayActivities[i + 1];
                      // Duration calc
                      let dur = '';
                      let endTimeStr = '';
                      if (entry.value > 0) {
                        const [sh, sm] = entry.time.split(':').map(Number);
                        const startM = sh * 60 + sm;
                        let endM: number;
                        if (nextEntry) {
                          const [nh, nm] = nextEntry.time.split(':').map(Number);
                          endM = nh * 60 + nm;
                          endTimeStr = nextEntry.time;
                        } else {
                          const now = new Date();
                          endM = now.getHours() * 60 + now.getMinutes();
                          endTimeStr = now.toTimeString().slice(0, 5);
                        }
                        const diff = Math.max(0, endM - startM);
                        dur = diff < 60 ? `${diff}m` : `${Math.floor(diff / 60)}h${diff % 60 > 0 ? `${diff % 60}m` : ''}`;
                      }
                      return (
                        <div key={entry.id ?? i} className="space-y-1">
                          {/* Main row */}
                          <div
                            className={`
                              flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px]
                              ${isLast ? `${act.bgSelected} text-white` : `${act.bg} ${act.color}`}
                              ${isEditing ? 'ring-2 ring-amber-500/50' : ''}
                              font-medium
                            `}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            <span className="font-semibold min-w-0">{act.label}</span>
                            {/* Time range */}
                            <span className={`text-[10px] tabular-nums ${isLast ? 'text-white/70' : 'opacity-60'}`}>
                              {entry.time} — {isLast ? 'ora' : endTimeStr}
                            </span>
                            {dur && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isLast ? 'bg-white/20 text-white/80' : 'bg-foreground/5 text-muted-foreground'}`}>
                                {dur}
                              </span>
                            )}
                            {/* Edit */}
                            <button
                              onClick={() => setEditingActivityId(isEditing ? null : (entry.id ?? null))}
                              className={`
                                ml-auto w-6 h-6 rounded-full flex items-center justify-center shrink-0
                                transition-colors active:scale-90
                                ${isEditing
                                  ? (isLast ? 'bg-white/40' : 'bg-amber-500/20')
                                  : (isLast ? 'bg-white/20 hover:bg-white/30' : 'bg-foreground/5 hover:bg-foreground/10')
                                }
                              `}
                              aria-label="Modifica"
                            >
                              <Pencil className="h-2.5 w-2.5" />
                            </button>
                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteActivity(entry)}
                              className={`
                                w-6 h-6 rounded-full flex items-center justify-center shrink-0
                                transition-colors active:scale-90
                                ${isLast ? 'bg-white/20 hover:bg-red-400/40' : 'bg-foreground/5 hover:bg-red-500/15'}
                              `}
                              aria-label="Elimina"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </div>

                          {/* Edit panel — activity type + time editing */}
                          {isEditing && (
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 ml-2 space-y-2.5">
                              {/* Time editing */}
                              <div className="space-y-1">
                                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">Orario</span>
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-muted-foreground">Inizio:</span>
                                    <input
                                      type="time"
                                      defaultValue={entry.time}
                                      onBlur={(e) => {
                                        const newTime = e.target.value;
                                        if (newTime && newTime !== entry.time && entry.id != null) {
                                          handleEditActivityTime(entry.id, newTime);
                                        }
                                      }}
                                      className="h-7 px-1.5 text-[11px] rounded border border-border bg-background tabular-nums w-[70px]"
                                    />
                                  </div>
                                  {nextEntry && nextEntry.id != null && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] text-muted-foreground">Fine:</span>
                                      <input
                                        type="time"
                                        defaultValue={nextEntry.time}
                                        onBlur={(e) => {
                                          const newTime = e.target.value;
                                          if (newTime && newTime !== nextEntry.time && nextEntry.id != null) {
                                            handleEditActivityTime(nextEntry.id, newTime);
                                          }
                                        }}
                                        className="h-7 px-1.5 text-[11px] rounded border border-border bg-background tabular-nums w-[70px]"
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                              {/* Activity type change */}
                              <div className="space-y-1">
                                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">Tipo attivita</span>
                                <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                                  {ACTIVITY_OPTIONS.map(opt => {
                                    const OptIcon = opt.icon;
                                    const isCurrent = entry.value === opt.value;
                                    return (
                                      <button
                                        key={opt.value}
                                        onClick={() => {
                                          if (!isCurrent && entry.id != null) {
                                            handleEditActivityValue(entry.id, opt.value);
                                          }
                                        }}
                                        disabled={savingActivity || isCurrent}
                                        className={`
                                          flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-xl shrink-0
                                          transition-all duration-150 active:scale-95 border
                                          ${isCurrent
                                            ? `${opt.bgSelected} text-white shadow-sm border-transparent`
                                            : 'bg-muted/30 hover:bg-muted/60 text-muted-foreground border-border/50'
                                          }
                                        `}
                                      >
                                        <OptIcon className={`h-4 w-4 ${isCurrent ? 'text-white' : opt.color}`} />
                                        <span className={`
                                          text-[9px] font-semibold leading-tight whitespace-nowrap
                                          ${isCurrent ? 'text-white/90' : 'text-muted-foreground'}
                                        `}>
                                          {opt.label}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* ---- Quick counters with measurement units — horizontal scroll ---- */}
        <div className="border-t border-border">
          <div className="flex items-start gap-3 px-3 py-2.5 overflow-x-auto scrollbar-none">
            {activeCounters.map(counter => {
              const val = getCounterValue(counter.type);
              return (
                <CounterButton
                  key={counter.type}
                  counter={counter}
                  value={val}
                  onTap={() => handleCounter(counter.type)}
                  onDecrement={() => handleDecrement(counter.type)}
                />
              );
            })}

            {/* Add / manage counters button */}
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className={`
                flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg shrink-0
                transition-all active:scale-95 min-w-0
                ${showAddMenu ? 'bg-muted/60' : 'hover:bg-muted/50'}
              `}
            >
              <div className="flex items-center gap-1.5">
                <Plus className={`h-3.5 w-3.5 text-muted-foreground ${showAddMenu ? 'rotate-45' : ''} transition-transform`} />
              </div>
              <span className="text-[9px] text-muted-foreground font-medium leading-tight">
                {showAddMenu ? 'Chiudi' : 'Altro'}
              </span>
            </button>
          </div>

          {/* Add/remove extra counters menu */}
          {showAddMenu && (
            <div className="px-3 pb-3 space-y-2">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider px-1">
                Gestisci contatori
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {EXTRA_COUNTERS.map(counter => {
                  const Icon = counter.icon;
                  const isEnabled = enabledExtras.includes(counter.type);
                  return (
                    <button
                      key={counter.type}
                      onClick={() => toggleExtra(counter.type)}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all
                        ${isEnabled
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-border bg-muted/20 hover:bg-muted/40'
                        }
                      `}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0
                        ${isEnabled ? counter.activeColor : 'bg-muted/50'}`}
                      >
                        <Icon className={`h-3.5 w-3.5 ${isEnabled ? counter.color : 'text-muted-foreground'}`} />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className={`text-xs font-medium ${isEnabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {counter.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{counter.unit}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                        ${isEnabled
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground/30'
                        }`}
                      >
                        {isEnabled && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground/70 px-1">
                Questi contatori influenzano il tuo Energy Score
              </p>
            </div>
          )}
        </div>

        </>}

        {/* ---- Completion tracker -- filled/empty circles with text ---- */}
        <div className={`flex items-center gap-1.5 px-4 py-2 border-t border-border bg-muted/20 flex-wrap ${!isOpen ? 'hidden' : ''}`}>
          {ALL_TRACKED_TYPES.map(({ type, label }) => {
            const done = allLoggedTypes.has(type);
            return (
              <span
                key={type}
                className={`
                  inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full
                  ${done
                    ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                    : 'bg-muted/50 text-muted-foreground'
                  }
                `}
              >
                {done ? (
                  <Check className="h-2.5 w-2.5" />
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full border border-current opacity-40" />
                )}
                {label}
              </span>
            );
          })}
        </div>

      </CardContent>
    </Card>
  );
}
