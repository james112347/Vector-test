import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from './ui/card';
import {
  Moon, Sun, Brain, Heart, Zap, Coffee, Droplets, Pill,
  MonitorOff, Check, ChevronRight, Activity, Frown, Meh,
  Smile, SmilePlus, Sparkles, CloudSun, Sunset, CloudMoon,
  UtensilsCrossed,
} from 'lucide-react';
import { addCheckin, getTodayCheckins } from '../lib/checkins';
import type { CheckinType, QuickCheckin } from '../db/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TimePhase = 'morning' | 'midday' | 'afternoon' | 'evening';

interface RatingOption {
  value: number;
  label: string;
  icon: typeof Frown;
  color: string;
  bg: string;
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
// Default 1-5 rating scale
// ---------------------------------------------------------------------------

const DEFAULT_RATINGS: RatingOption[] = [
  { value: 1, label: 'Male',   icon: Frown,     color: 'text-red-500',    bg: 'bg-red-500' },
  { value: 2, label: 'Poco',   icon: Frown,     color: 'text-orange-500', bg: 'bg-orange-500' },
  { value: 3, label: 'Cosi',   icon: Meh,       color: 'text-amber-500',  bg: 'bg-amber-500' },
  { value: 4, label: 'Bene',   icon: Smile,     color: 'text-emerald-500',bg: 'bg-emerald-500' },
  { value: 5, label: 'Ottimo', icon: SmilePlus,  color: 'text-green-600',  bg: 'bg-green-600' },
];

/** Inverse scale: 1=high(bad), 5=low(good) — used for stress */
const INVERSE_RATINGS: RatingOption[] = [
  { value: 1, label: 'Alto',      icon: Zap,       color: 'text-red-500',    bg: 'bg-red-500' },
  { value: 2, label: 'Medio-alto',icon: Zap,       color: 'text-orange-500', bg: 'bg-orange-500' },
  { value: 3, label: 'Medio',     icon: Meh,       color: 'text-amber-500',  bg: 'bg-amber-500' },
  { value: 4, label: 'Basso',     icon: Smile,     color: 'text-emerald-500',bg: 'bg-emerald-500' },
  { value: 5, label: 'Minimo',    icon: Sparkles,  color: 'text-green-600',  bg: 'bg-green-600' },
];

const MEAL_RATINGS: RatingOption[] = [
  { value: 1, label: 'Saltato',  icon: Frown,    color: 'text-red-500',    bg: 'bg-red-500' },
  { value: 2, label: 'Snack',    icon: Frown,    color: 'text-orange-500', bg: 'bg-orange-500' },
  { value: 3, label: 'Veloce',   icon: Meh,      color: 'text-amber-500',  bg: 'bg-amber-500' },
  { value: 4, label: 'Buono',    icon: Smile,    color: 'text-emerald-500',bg: 'bg-emerald-500' },
  { value: 5, label: 'Completo', icon: SmilePlus, color: 'text-green-600',  bg: 'bg-green-600' },
];

const ACTIVITY_RATINGS: RatingOption[] = [
  { value: 1, label: 'Nessuna',  icon: Frown,    color: 'text-red-500',    bg: 'bg-red-500' },
  { value: 2, label: 'Leggera',  icon: Meh,      color: 'text-orange-500', bg: 'bg-orange-500' },
  { value: 3, label: 'Moderata', icon: Meh,      color: 'text-amber-500',  bg: 'bg-amber-500' },
  { value: 4, label: 'Buona',    icon: Smile,    color: 'text-emerald-500',bg: 'bg-emerald-500' },
  { value: 5, label: 'Intensa',  icon: SmilePlus, color: 'text-green-600',  bg: 'bg-green-600' },
];

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
// Quick counters config
// ---------------------------------------------------------------------------

const COUNTERS: Array<{
  type: CheckinType;
  icon: typeof Coffee;
  label: string;
  color: string;
  activeColor: string;
  target?: number;
}> = [
  { type: 'caffeine',     icon: Coffee,     label: 'Caffe',   color: 'text-amber-700 dark:text-amber-500',  activeColor: 'bg-amber-100 dark:bg-amber-900/30' },
  { type: 'water',        icon: Droplets,   label: 'Acqua',   color: 'text-blue-500',   activeColor: 'bg-blue-100 dark:bg-blue-900/30',   target: 8 },
  { type: 'supplement',   icon: Pill,        label: 'Integr.', color: 'text-violet-500', activeColor: 'bg-violet-100 dark:bg-violet-900/30' },
  { type: 'screen_break', icon: MonitorOff,  label: 'Pausa',   color: 'text-cyan-500',   activeColor: 'bg-cyan-100 dark:bg-cyan-900/30' },
];

// ---------------------------------------------------------------------------
// All trackable types for completion display
// ---------------------------------------------------------------------------

const ALL_TRACKED_TYPES: Array<{ type: CheckinType; label: string }> = [
  { type: 'sleep_quality', label: 'Sonno' },
  { type: 'mood',          label: 'Umore' },
  { type: 'stress',        label: 'Stress' },
  { type: 'focus',         label: 'Focus' },
  { type: 'meal_time',     label: 'Pasto' },
  { type: 'activity_done', label: 'Attivita' },
  { type: 'water',         label: 'Acqua' },
  { type: 'caffeine',      label: 'Caffe' },
];

// ---------------------------------------------------------------------------
// RatingButton sub-component
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
  const Icon = option.icon;

  return (
    <button
      onClick={onSelect}
      className={`
        flex flex-col items-center gap-1 py-2 px-1 rounded-xl
        transition-all duration-150 active:scale-95 flex-1 min-w-0
        ${selected
          ? `${option.bg} text-white shadow-sm`
          : 'bg-muted/40 hover:bg-muted/70 text-muted-foreground'
        }
      `}
    >
      <div className={`
        w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
        ${selected
          ? 'bg-white/20 text-white'
          : `bg-background ${option.color}`
        }
      `}>
        {option.value}
      </div>
      <Icon className={`h-3.5 w-3.5 ${selected ? 'text-white/80' : option.color}`} />
      <span className={`text-[10px] font-medium leading-tight ${selected ? 'text-white/90' : ''}`}>
        {option.label}
      </span>
    </button>
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
              <span className="text-xs text-muted-foreground ml-auto">
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

            {/* 5-point tap rating */}
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

        {/* ---- Completion state ---- */}
        {allDone && (
          <div className="px-4 pt-4 pb-3">
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
          </div>
        )}

        {/* ---- Quick counters ---- */}
        <div className="flex items-center justify-around px-3 py-2 border-t border-border">
          {COUNTERS.map(counter => {
            const Icon = counter.icon;
            const val = getCounterValue(counter.type);
            const hasValue = val > 0;
            return (
              <button
                key={counter.type}
                onClick={() => handleCounter(counter.type)}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                  transition-all active:scale-95
                  ${hasValue ? counter.activeColor : 'hover:bg-muted/50'}
                `}
              >
                <Icon className={`h-3.5 w-3.5 ${counter.color}`} />
                <span className={`text-xs font-bold tabular-nums ${counter.color}`}>
                  {val}
                </span>
                {counter.target && (
                  <span className="text-[9px] text-muted-foreground">/{counter.target}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ---- Completion tracker ---- */}
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
