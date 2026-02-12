import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from './ui/card';
import {
  Droplets, Coffee,
  Smile, Frown, Meh, Sun, Zap, Pill,
  Check, ChevronRight,
} from 'lucide-react';
import { addCheckin, getTodayCheckins } from '../lib/checkins';
import type { CheckinType, QuickCheckin } from '../db/schema';

// ---------------------------------------------------------------------------
// Fase del giorno -> domande contestuali smart
// ---------------------------------------------------------------------------

type TimePhase = 'morning' | 'midday' | 'afternoon' | 'evening';

function getTimePhase(): TimePhase {
  const h = new Date().getHours();
  if (h < 11) return 'morning';
  if (h < 14) return 'midday';
  if (h < 18) return 'afternoon';
  return 'evening';
}

const PHASE_CONFIG: Record<TimePhase, {
  greeting: string;
  /** Domanda principale con risposte che salvano MULTIPLI check-in */
  mainQuestion: string;
  /** Risposte rapide: ogni risposta salva piu check-in contemporaneamente */
  answers: Array<{
    label: string;
    icon: typeof Smile;
    color: string;
    /** Check-in che vengono salvati con questa risposta */
    saves: Array<{ type: CheckinType; value: number }>;
  }>;
  /** Domande follow-up opzionali (max 1-2) */
  followUps: Array<{
    question: string;
    condition?: (checkins: QuickCheckin[]) => boolean;
    answers: Array<{
      label: string;
      saves: Array<{ type: CheckinType; value: number }>;
    }>;
  }>;
}> = {
  morning: {
    greeting: 'Buongiorno',
    mainQuestion: 'Come hai dormito e come ti senti?',
    answers: [
      {
        label: 'Male, stanco',
        icon: Frown,
        color: '#ef4444',
        saves: [
          { type: 'sleep_quality', value: 2 },
          { type: 'mood', value: 2 },
        ],
      },
      {
        label: 'Cosi cosi',
        icon: Meh,
        color: '#f59e0b',
        saves: [
          { type: 'sleep_quality', value: 3 },
          { type: 'mood', value: 3 },
        ],
      },
      {
        label: 'Bene, riposato',
        icon: Smile,
        color: '#22c55e',
        saves: [
          { type: 'sleep_quality', value: 4 },
          { type: 'mood', value: 4 },
        ],
      },
      {
        label: 'Alla grande!',
        icon: Zap,
        color: '#3b82f6',
        saves: [
          { type: 'sleep_quality', value: 5 },
          { type: 'mood', value: 5 },
          { type: 'stress', value: 1 },
        ],
      },
    ],
    followUps: [
      {
        question: 'Hai fatto colazione?',
        answers: [
          { label: 'Saltata', saves: [{ type: 'meal_time', value: 1 }] },
          { label: 'Veloce', saves: [{ type: 'meal_time', value: 3 }] },
          { label: 'Completa', saves: [{ type: 'meal_time', value: 5 }] },
        ],
      },
    ],
  },
  midday: {
    greeting: 'Meta giornata',
    mainQuestion: 'Come sta andando?',
    answers: [
      {
        label: 'Fatico molto',
        icon: Frown,
        color: '#ef4444',
        saves: [
          { type: 'mood', value: 2 },
          { type: 'stress', value: 4 },
          { type: 'focus', value: 2 },
        ],
      },
      {
        label: 'Un po\' stanco',
        icon: Meh,
        color: '#f59e0b',
        saves: [
          { type: 'mood', value: 3 },
          { type: 'stress', value: 3 },
          { type: 'focus', value: 3 },
        ],
      },
      {
        label: 'Tutto ok',
        icon: Smile,
        color: '#22c55e',
        saves: [
          { type: 'mood', value: 4 },
          { type: 'stress', value: 2 },
          { type: 'focus', value: 4 },
        ],
      },
      {
        label: 'Produttivo!',
        icon: Zap,
        color: '#3b82f6',
        saves: [
          { type: 'mood', value: 5 },
          { type: 'stress', value: 1 },
          { type: 'focus', value: 5 },
        ],
      },
    ],
    followUps: [
      {
        question: 'Hai pranzato?',
        answers: [
          { label: 'Non ancora', saves: [{ type: 'meal_time', value: 1 }] },
          { label: 'Qualcosa', saves: [{ type: 'meal_time', value: 3 }] },
          { label: 'Pasto completo', saves: [{ type: 'meal_time', value: 5 }] },
        ],
      },
    ],
  },
  afternoon: {
    greeting: 'Buon pomeriggio',
    mainQuestion: 'Come ti senti ora?',
    answers: [
      {
        label: 'Scarico',
        icon: Frown,
        color: '#ef4444',
        saves: [
          { type: 'mood', value: 2 },
          { type: 'focus', value: 2 },
          { type: 'stress', value: 4 },
        ],
      },
      {
        label: 'Calo energia',
        icon: Meh,
        color: '#f59e0b',
        saves: [
          { type: 'mood', value: 3 },
          { type: 'focus', value: 3 },
          { type: 'stress', value: 3 },
        ],
      },
      {
        label: 'Bene',
        icon: Smile,
        color: '#22c55e',
        saves: [
          { type: 'mood', value: 4 },
          { type: 'focus', value: 4 },
          { type: 'stress', value: 2 },
        ],
      },
      {
        label: 'Carico!',
        icon: Zap,
        color: '#3b82f6',
        saves: [
          { type: 'mood', value: 5 },
          { type: 'focus', value: 5 },
          { type: 'stress', value: 1 },
        ],
      },
    ],
    followUps: [
      {
        question: 'Movimento oggi?',
        answers: [
          { label: 'Niente', saves: [{ type: 'activity_done', value: 1 }] },
          { label: 'Poco', saves: [{ type: 'activity_done', value: 2 }] },
          { label: 'Si!', saves: [{ type: 'activity_done', value: 4 }] },
        ],
      },
    ],
  },
  evening: {
    greeting: 'Buona sera',
    mainQuestion: 'Come e\' andata oggi?',
    answers: [
      {
        label: 'Giornata no',
        icon: Frown,
        color: '#ef4444',
        saves: [
          { type: 'mood', value: 2 },
          { type: 'stress', value: 4 },
        ],
      },
      {
        label: 'Nella media',
        icon: Meh,
        color: '#f59e0b',
        saves: [
          { type: 'mood', value: 3 },
          { type: 'stress', value: 3 },
        ],
      },
      {
        label: 'Buona',
        icon: Smile,
        color: '#22c55e',
        saves: [
          { type: 'mood', value: 4 },
          { type: 'stress', value: 2 },
        ],
      },
      {
        label: 'Ottima!',
        icon: Zap,
        color: '#3b82f6',
        saves: [
          { type: 'mood', value: 5 },
          { type: 'stress', value: 1 },
        ],
      },
    ],
    followUps: [
      {
        question: 'Attivita fisica oggi?',
        condition: (checkins) => !checkins.some(c => c.type === 'activity_done'),
        answers: [
          { label: 'Nessuna', saves: [{ type: 'activity_done', value: 1 }] },
          { label: 'Leggera', saves: [{ type: 'activity_done', value: 3 }] },
          { label: 'Intensa', saves: [{ type: 'activity_done', value: 5 }] },
        ],
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Contatori inline (caffe, acqua, integratori) — sempre visibili
// ---------------------------------------------------------------------------

const COUNTERS: Array<{
  type: CheckinType;
  icon: typeof Coffee;
  label: string;
  color: string;
  target?: number;
}> = [
  { type: 'caffeine', icon: Coffee, label: 'Caffe', color: '#92400e' },
  { type: 'water', icon: Droplets, label: 'Acqua', color: '#3b82f6', target: 8 },
  { type: 'supplement', icon: Pill, label: 'Integr.', color: '#8b5cf6' },
];

// ---------------------------------------------------------------------------
// Componente principale
// ---------------------------------------------------------------------------

export default function QuickCheckins({ userId }: { userId: number }) {
  const [checkins, setCheckins] = useState<QuickCheckin[]>([]);
  const [step, setStep] = useState<'main' | 'followup' | 'done'>('main');
  const [followUpIdx, setFollowUpIdx] = useState(0);

  const phase = useMemo(() => getTimePhase(), []);
  const config = PHASE_CONFIG[phase];

  const loadCheckins = useCallback(async () => {
    const items = await getTodayCheckins(userId);
    setCheckins(items);
  }, [userId]);

  useEffect(() => { loadCheckins(); }, [loadCheckins]);

  // Controlla se l'utente ha gia risposto alla domanda di questa fase
  const hasAnsweredMain = useMemo(() => {
    // Se ha gia registrato mood in questa fase oraria, consideriamo completato
    const phaseStart = phase === 'morning' ? 5 : phase === 'midday' ? 11 : phase === 'afternoon' ? 14 : 18;
    return checkins.some(c => {
      if (c.type !== 'mood') return false;
      const [h] = c.time.split(':').map(Number);
      return h >= phaseStart;
    });
  }, [checkins, phase]);

  useEffect(() => {
    if (hasAnsweredMain) setStep('done');
  }, [hasAnsweredMain]);

  const getValue = (type: CheckinType): number => {
    return checkins
      .filter(c => c.type === type)
      .reduce((s, c) => s + c.value, 0);
  };

  const saveMultiple = async (saves: Array<{ type: CheckinType; value: number }>) => {
    for (const { type, value } of saves) {
      await addCheckin(userId, type, value);
    }
    await loadCheckins();
  };

  const handleMainAnswer = async (saves: Array<{ type: CheckinType; value: number }>) => {
    await saveMultiple(saves);
    // Check se ci sono follow-up applicabili
    const applicableFollowUps = config.followUps.filter(
      f => !f.condition || f.condition(checkins),
    );
    if (applicableFollowUps.length > 0) {
      setFollowUpIdx(0);
      setStep('followup');
    } else {
      setStep('done');
    }
  };

  const handleFollowUp = async (saves: Array<{ type: CheckinType; value: number }>) => {
    await saveMultiple(saves);
    const applicableFollowUps = config.followUps.filter(
      f => !f.condition || f.condition(checkins),
    );
    if (followUpIdx + 1 < applicableFollowUps.length) {
      setFollowUpIdx(followUpIdx + 1);
    } else {
      setStep('done');
    }
  };

  const handleCounter = async (type: CheckinType) => {
    await addCheckin(userId, type, 1);
    await loadCheckins();
  };

  // Conta dati raccolti oggi
  const typesRecorded = new Set(checkins.map(c => c.type)).size;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Contatori inline — sempre visibili, compatti */}
        <div className="flex items-center justify-around px-3 py-2.5 border-b border-border bg-muted/20">
          {COUNTERS.map(counter => {
            const Icon = counter.icon;
            const val = getValue(counter.type);
            return (
              <button
                key={counter.type}
                onClick={() => handleCounter(counter.type)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full hover:bg-muted/50 active:scale-95 transition-all"
              >
                <Icon className="h-3.5 w-3.5" style={{ color: counter.color }} />
                <span className="text-xs font-bold tabular-nums" style={{ color: counter.color }}>
                  {val}
                </span>
                {counter.target && (
                  <span className="text-[9px] text-muted-foreground">/{counter.target}</span>
                )}
                <span className="text-[10px] text-muted-foreground font-medium">+1</span>
              </button>
            );
          })}
        </div>

        {/* Domanda contestuale */}
        {step === 'main' && (
          <div className="px-4 py-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-500" />
              <div>
                <p className="text-xs text-muted-foreground">{config.greeting}</p>
                <p className="text-sm font-semibold">{config.mainQuestion}</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {config.answers.map((ans, i) => {
                const Icon = ans.icon;
                return (
                  <button
                    key={i}
                    onClick={() => handleMainAnswer(ans.saves)}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl border border-border hover:border-transparent active:scale-95 transition-all"
                    style={{ ['--hover-bg' as string]: ans.color + '15' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = ans.color + '12')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                  >
                    <Icon className="h-5 w-5" style={{ color: ans.color }} />
                    <span className="text-[10px] font-medium text-center leading-tight">{ans.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Follow-up */}
        {step === 'followup' && (() => {
          const applicableFollowUps = config.followUps.filter(
            f => !f.condition || f.condition(checkins),
          );
          const fu = applicableFollowUps[followUpIdx];
          if (!fu) return null;
          return (
            <div className="px-4 py-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-sm font-medium">{fu.question}</p>
              </div>
              <div className="flex gap-2">
                {fu.answers.map((ans, i) => (
                  <button
                    key={i}
                    onClick={() => handleFollowUp(ans.saves)}
                    className="flex-1 py-2.5 rounded-xl border border-border bg-card hover:bg-muted/30 active:scale-95 transition-all"
                  >
                    <span className="text-xs font-medium">{ans.label}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Stato completato */}
        {step === 'done' && (
          <div className="px-4 py-2.5 flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center">
              <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-xs text-muted-foreground flex-1">
              Check-in completato - {typesRecorded} parametri raccolti
            </p>
            <button
              onClick={() => setStep('main')}
              className="text-[10px] text-primary font-medium hover:underline"
            >
              Aggiorna
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
