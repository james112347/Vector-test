import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from './ui/card';
import {
  Moon, Sun, Brain, Heart, Zap, Coffee, Droplets,
  Check, ChevronRight, Activity, CloudSun,
  Sunset, CloudMoon, UtensilsCrossed, BedDouble,
  Pill, MonitorOff, Plus, Minus, Pencil,
  BookOpen, Briefcase, Sofa, Dumbbell, Gamepad2,
  Users, Car, Clock,
} from 'lucide-react';
import { addCheckin, getTodayCheckins, deleteLastCheckinOfType, deletePhaseCheckins } from '../lib/checkins';
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
    <div className="flex flex-col items-center gap-0.5 min-w-0">
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
  // "Cosa stai facendo?" — activity tracking (multiple times per day)
  // ---------------------------------------------------------------------------

  /** Today's activity entries, sorted by time */
  const todayActivities = useMemo(() => {
    return checkins
      .filter(c => c.type === 'current_activity')
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [checkins]);

  /** Most recent activity value */
  const lastActivity = todayActivities.length > 0
    ? todayActivities[todayActivities.length - 1].value
    : null;

  /** Save a new current activity entry */
  const handleActivitySelect = async (value: number) => {
    if (savingActivity) return;
    setSavingActivity(true);
    await addCheckin(userId, 'current_activity', value);
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

    // Brief visual feedback before advancing
    setTimeout(() => {
      setSaving(false);
      setSelectedValue(null);
      if (currentIdx + 1 < activeQuestions.length) {
        setCurrentIdx(currentIdx + 1);
      } else {
        setAllDone(true);
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

  // Reset to re-answer
  const handleRestart = () => {
    setAllDone(false);
    setCurrentIdx(0);
    setSelectedValue(null);
    setEditingType(null);
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

  const PhaseIcon = config.icon;
  const ratings = currentQuestion?.ratings ?? DEFAULT_RATINGS;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">

        {/* ---- Phase greeting + question area ---- */}
        {!allDone && currentQuestion && (
          <div className="px-4 pt-4 pb-3 space-y-3">
            {/* Greeting */}
            <div className="flex items-center gap-2">
              <PhaseIcon className={`h-4 w-4 ${config.iconColor}`} />
              <span className="text-sm font-semibold text-foreground">
                {config.greeting}
              </span>
              <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                {currentIdx + 1}/{activeQuestions.length}
              </span>
            </div>

            {/* Question */}
            <div className="flex items-center gap-2">
              {(() => {
                const QIcon = currentQuestion.icon;
                return <QIcon className="h-4 w-4 text-muted-foreground shrink-0" />;
              })()}
              <p className="text-sm font-medium text-foreground">
                {currentQuestion.question}
              </p>
            </div>

            {/* 5-point tap rating -- clean numbered buttons */}
            <div className="flex gap-1.5">
              {ratings.map((opt) => (
                <RatingButton
                  key={opt.value}
                  option={opt}
                  selected={selectedValue === opt.value}
                  onSelect={() => handleRate(opt.value)}
                />
              ))}
            </div>

            {/* Skip / advance hint */}
            {activeQuestions.length > 1 && currentIdx < activeQuestions.length - 1 && (
              <button
                onClick={() => {
                  setSelectedValue(null);
                  setCurrentIdx(currentIdx + 1);
                }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight className="h-3 w-3" />
                Salta
              </button>
            )}
          </div>
        )}

        {/* ---- Editing a specific rated answer ---- */}
        {editingType && (() => {
          const q = config.questions.find(q => q.type === editingType);
          if (!q) return null;
          const editRatings = q.ratings ?? DEFAULT_RATINGS;
          const currentVal = answeredPhaseQuestions.find(a => a.question.type === editingType)?.value ?? null;
          const QIcon = q.icon;
          return (
            <div className="px-4 pt-4 pb-3 space-y-3">
              <div className="flex items-center gap-2">
                <QIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-sm font-medium text-foreground">
                  {q.question}
                </p>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded font-medium ml-auto">
                  Correzione
                </span>
              </div>
              <div className="flex gap-1.5">
                {editRatings.map((opt) => (
                  <RatingButton
                    key={opt.value}
                    option={opt}
                    selected={selectedValue === opt.value || (selectedValue === null && currentVal === opt.value)}
                    onSelect={() => handleEditRate(editingType, opt.value)}
                  />
                ))}
              </div>
              <button
                onClick={() => { setEditingType(null); setSelectedValue(null); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight className="h-3 w-3 rotate-180" />
                Annulla
              </button>
            </div>
          );
        })()}

        {/* ---- Completion state ---- */}
        {allDone && !editingType && (
          <div className="px-4 pt-4 pb-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  Check-in completato
                </p>
                <p className="text-xs text-muted-foreground">
                  {allLoggedTypes.size} parametri raccolti oggi
                </p>
              </div>
              <button
                onClick={handleRestart}
                className="text-xs text-primary font-medium hover:underline"
              >
                Aggiorna
              </button>
            </div>

            {/* Answered questions with correction buttons */}
            {answeredPhaseQuestions.length > 0 && (
              <div className="space-y-1">
                {answeredPhaseQuestions.map(({ question, value }) => {
                  const scale = question.ratings ?? DEFAULT_RATINGS;
                  const option = scale.find(r => r.value === value);
                  const QIcon = question.icon;
                  return (
                    <div key={question.type} className="flex items-center gap-2 py-1">
                      <QIcon className={`h-3.5 w-3.5 shrink-0 ${option?.color ?? 'text-muted-foreground'}`} />
                      <span className="text-xs text-muted-foreground">{question.label}:</span>
                      <span className={`text-xs font-medium ${option?.color ?? ''}`}>
                        {option?.label ?? String(value)} ({value}/5)
                      </span>
                      <button
                        onClick={() => setEditingType(question.type)}
                        className="ml-auto flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary font-medium transition-colors"
                      >
                        <Pencil className="h-2.5 w-2.5" />
                        Correggi
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ---- "Cosa stai facendo?" — Activity tracking ---- */}
        <div className="border-t border-border px-4 py-3 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              Cosa stai facendo?
            </span>
            {lastActivity != null && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                Ora: {getActivityOption(lastActivity)?.label}
              </span>
            )}
          </div>

          {/* Activity selection grid */}
          <div className="grid grid-cols-4 gap-1.5">
            {ACTIVITY_OPTIONS.map(act => {
              const Icon = act.icon;
              const isLast = lastActivity === act.value;
              return (
                <button
                  key={act.value}
                  onClick={() => handleActivitySelect(act.value)}
                  disabled={savingActivity}
                  className={`
                    flex flex-col items-center gap-1 py-2 px-1 rounded-xl
                    transition-all duration-150 active:scale-95 min-w-0
                    border
                    ${isLast
                      ? `${act.bgSelected} text-white shadow-sm border-transparent`
                      : `bg-muted/30 hover:bg-muted/60 text-muted-foreground border-border/50 hover:border-border`
                    }
                  `}
                >
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center
                    ${isLast
                      ? 'bg-white/25'
                      : act.bg
                    }
                  `}>
                    <Icon className={`h-4 w-4 ${isLast ? 'text-white' : act.color}`} />
                  </div>
                  <span className={`
                    text-[9px] font-semibold leading-tight text-center
                    ${isLast ? 'text-white/90' : 'text-muted-foreground'}
                  `}>
                    {act.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Activity timeline — today's logged activities */}
          {todayActivities.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                La tua giornata
              </p>
              <div className="flex flex-wrap gap-1">
                {todayActivities.map((entry, i) => {
                  const act = getActivityOption(entry.value);
                  if (!act) return null;
                  const Icon = act.icon;
                  return (
                    <div
                      key={entry.id ?? i}
                      className={`
                        inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px]
                        ${act.bg} ${act.color} font-medium
                      `}
                    >
                      <Icon className="h-3 w-3" />
                      <span>{entry.time}</span>
                      <span className="opacity-70">{act.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ---- Quick counters with measurement units ---- */}
        <div className="border-t border-border">
          <div className="flex items-start justify-around px-2 py-2.5 flex-wrap gap-y-1">
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
                flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg
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

        {/* ---- Completion tracker -- filled/empty circles with text ---- */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-t border-border bg-muted/20 flex-wrap">
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
