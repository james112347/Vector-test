import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent } from './ui/card';
import {
  Droplets, Coffee, Sun, Pill,
  Check, ChevronRight, Send,
} from 'lucide-react';
import { addCheckin, getTodayCheckins } from '../lib/checkins';
import type { CheckinType, QuickCheckin } from '../db/schema';

// ---------------------------------------------------------------------------
// Fase del giorno -> mapping percentuale smart
// ---------------------------------------------------------------------------

type TimePhase = 'morning' | 'midday' | 'afternoon' | 'evening';

function getTimePhase(): TimePhase {
  const h = new Date().getHours();
  if (h < 11) return 'morning';
  if (h < 14) return 'midday';
  if (h < 18) return 'afternoon';
  return 'evening';
}

/** Converte percentuale 0-100 in valore 1-5 arrotondato */
function pctTo5(pct: number): number {
  return Math.max(1, Math.min(5, Math.round(1 + (pct / 100) * 4)));
}

/** Inverso: 100% -> 1 (basso stress), 0% -> 5 (alto stress) */
function pctTo5Inv(pct: number): number {
  return pctTo5(100 - pct);
}

// ---------------------------------------------------------------------------
// Emoji per contesto (energia, cibo, attivita)
// ---------------------------------------------------------------------------

type EmojiInfo = { emoji: string; label: string; color: string };

function emojiEnergia(pct: number): EmojiInfo {
  if (pct <= 15) return { emoji: '😩', label: 'Pessimo', color: '#dc2626' };
  if (pct <= 30) return { emoji: '😟', label: 'Male', color: '#ef4444' };
  if (pct <= 45) return { emoji: '😐', label: 'Cosi cosi', color: '#f59e0b' };
  if (pct <= 60) return { emoji: '🙂', label: 'Discreto', color: '#eab308' };
  if (pct <= 75) return { emoji: '😊', label: 'Bene', color: '#22c55e' };
  if (pct <= 90) return { emoji: '😄', label: 'Molto bene', color: '#16a34a' };
  return { emoji: '🔥', label: 'Alla grande!', color: '#3b82f6' };
}

function emojiCibo(pct: number): EmojiInfo {
  if (pct <= 10) return { emoji: '🚫', label: 'Saltato', color: '#dc2626' };
  if (pct <= 30) return { emoji: '🍪', label: 'Snack', color: '#ef4444' };
  if (pct <= 50) return { emoji: '🥐', label: 'Veloce', color: '#f59e0b' };
  if (pct <= 70) return { emoji: '🍽️', label: 'Discreto', color: '#eab308' };
  if (pct <= 85) return { emoji: '🥗', label: 'Completo', color: '#22c55e' };
  return { emoji: '🍱', label: 'Ottimo pasto', color: '#16a34a' };
}

function emojiAttivita(pct: number): EmojiInfo {
  if (pct <= 10) return { emoji: '🛋️', label: 'Nessuna', color: '#dc2626' };
  if (pct <= 30) return { emoji: '🚶', label: 'Passeggiata', color: '#f59e0b' };
  if (pct <= 50) return { emoji: '🏃', label: 'Moderata', color: '#eab308' };
  if (pct <= 70) return { emoji: '💪', label: 'Buona', color: '#22c55e' };
  if (pct <= 85) return { emoji: '🏋️', label: 'Intensa', color: '#16a34a' };
  return { emoji: '🔥', label: 'Top!', color: '#3b82f6' };
}

type EmojiMapper = (pct: number) => EmojiInfo;

// ---------------------------------------------------------------------------
// Configurazione fasi
// ---------------------------------------------------------------------------

interface SliderMap {
  type: CheckinType;
  label: string;
  inverse?: boolean;
}

interface FollowUpConfig {
  question: string;
  condition?: (checkins: QuickCheckin[]) => boolean;
  maps: SliderMap[];
  emojiMapper: EmojiMapper;
  gradient: string;
}

interface PhaseConfig {
  greeting: string;
  mainQuestion: string;
  maps: SliderMap[];
  followUps: FollowUpConfig[];
}

const GRADIENT_ENERGIA = 'linear-gradient(90deg, #dc2626 0%, #f59e0b 35%, #22c55e 65%, #3b82f6 100%)';
const GRADIENT_CIBO = 'linear-gradient(90deg, #dc2626 0%, #f59e0b 30%, #22c55e 60%, #16a34a 100%)';
const GRADIENT_ATTIVITA = 'linear-gradient(90deg, #94a3b8 0%, #f59e0b 30%, #22c55e 60%, #3b82f6 100%)';

const PHASE_CONFIG: Record<TimePhase, PhaseConfig> = {
  morning: {
    greeting: 'Buongiorno',
    mainQuestion: 'Come hai dormito e come ti senti?',
    maps: [
      { type: 'sleep_quality', label: 'Sonno' },
      { type: 'mood', label: 'Umore' },
      { type: 'stress', label: 'Stress', inverse: true },
    ],
    followUps: [
      {
        question: 'Colazione?',
        maps: [{ type: 'meal_time', label: 'Pasto' }],
        emojiMapper: emojiCibo,
        gradient: GRADIENT_CIBO,
      },
    ],
  },
  midday: {
    greeting: 'Meta giornata',
    mainQuestion: 'Come sta andando?',
    maps: [
      { type: 'mood', label: 'Umore' },
      { type: 'focus', label: 'Focus' },
      { type: 'stress', label: 'Stress', inverse: true },
    ],
    followUps: [
      {
        question: 'Pranzo?',
        maps: [{ type: 'meal_time', label: 'Pasto' }],
        emojiMapper: emojiCibo,
        gradient: GRADIENT_CIBO,
      },
    ],
  },
  afternoon: {
    greeting: 'Buon pomeriggio',
    mainQuestion: 'Come ti senti ora?',
    maps: [
      { type: 'mood', label: 'Umore' },
      { type: 'focus', label: 'Focus' },
      { type: 'stress', label: 'Stress', inverse: true },
    ],
    followUps: [
      {
        question: 'Movimento oggi?',
        maps: [{ type: 'activity_done', label: 'Attivita' }],
        emojiMapper: emojiAttivita,
        gradient: GRADIENT_ATTIVITA,
      },
    ],
  },
  evening: {
    greeting: 'Buona sera',
    mainQuestion: "Com'e' andata oggi?",
    maps: [
      { type: 'mood', label: 'Umore' },
      { type: 'stress', label: 'Stress', inverse: true },
    ],
    followUps: [
      {
        question: 'Attivita fisica oggi?',
        condition: (checkins) => !checkins.some(c => c.type === 'activity_done'),
        maps: [{ type: 'activity_done', label: 'Attivita' }],
        emojiMapper: emojiAttivita,
        gradient: GRADIENT_ATTIVITA,
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Contatori inline
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
// Slider percentuale touch-friendly (riusabile)
// ---------------------------------------------------------------------------

function PercentSlider({
  value,
  onChange,
  onConfirm,
  maps,
  emojiMapper = emojiEnergia,
  gradient = GRADIENT_ENERGIA,
  compact = false,
}: {
  value: number;
  onChange: (v: number) => void;
  onConfirm: () => void;
  maps: SliderMap[];
  emojiMapper?: EmojiMapper;
  gradient?: string;
  compact?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const info = emojiMapper(value);

  const updateFromEvent = (clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    onChange(Math.round(pct));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateFromEvent(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    updateFromEvent(e.clientX);
  };

  const handlePointerUp = () => {
    dragging.current = false;
  };

  const trackHeight = compact ? 'h-8' : 'h-10';
  const thumbSize = compact ? 'w-6 h-6' : 'w-7 h-7';
  const thumbOffset = compact ? '12px' : '14px';
  const emojiSize = compact ? 'text-xl' : 'text-2xl';
  const pctSize = compact ? 'text-xl' : 'text-2xl';

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {/* Emoji + Percentuale */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={emojiSize} role="img">{info.emoji}</span>
          <span className="text-sm font-medium" style={{ color: info.color }}>
            {info.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`${pctSize} font-bold tabular-nums`} style={{ color: info.color }}>
            {value}%
          </span>
          <button
            onClick={onConfirm}
            className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-all"
            style={{ backgroundColor: info.color }}
          >
            <Send className="h-3.5 w-3.5 text-white" />
          </button>
        </div>
      </div>

      {/* Track slider */}
      <div
        ref={trackRef}
        className={`relative ${trackHeight} rounded-xl cursor-pointer touch-none select-none`}
        style={{ background: gradient }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Thumb */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 ${thumbSize} rounded-full bg-white border-2 shadow-md transition-[left] duration-75`}
          style={{
            left: `calc(${value}% - ${thumbOffset})`,
            borderColor: info.color,
          }}
        />
        {/* Tick marks */}
        <div className="absolute inset-0 flex items-end justify-between px-3 pb-1 pointer-events-none">
          <span className="text-[8px] text-white/60 font-medium">0</span>
          <span className="text-[8px] text-white/60 font-medium">25</span>
          <span className="text-[8px] text-white/60 font-medium">50</span>
          <span className="text-[8px] text-white/60 font-medium">75</span>
          <span className="text-[8px] text-white/60 font-medium">100</span>
        </div>
      </div>

      {/* Preview mapping */}
      <div className="flex items-center gap-2 flex-wrap">
        {maps.map(m => {
          const val = m.inverse ? pctTo5Inv(value) : pctTo5(value);
          return (
            <span
              key={m.type}
              className="text-[10px] px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground"
            >
              {m.label} <strong className="text-foreground">{val}/5</strong>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principale
// ---------------------------------------------------------------------------

export default function QuickCheckins({ userId }: { userId: number }) {
  const [checkins, setCheckins] = useState<QuickCheckin[]>([]);
  const [step, setStep] = useState<'main' | 'followup' | 'done'>('main');
  const [followUpIdx, setFollowUpIdx] = useState(0);
  const [sliderValue, setSliderValue] = useState(50);
  const [followUpSliderValue, setFollowUpSliderValue] = useState(50);

  const phase = useMemo(() => getTimePhase(), []);
  const config = PHASE_CONFIG[phase];

  const loadCheckins = useCallback(async () => {
    const items = await getTodayCheckins(userId);
    setCheckins(items);
  }, [userId]);

  useEffect(() => { loadCheckins(); }, [loadCheckins]);

  const hasAnsweredMain = useMemo(() => {
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

  const saveFromSlider = async (maps: SliderMap[], pct: number) => {
    for (const m of maps) {
      const value = m.inverse ? pctTo5Inv(pct) : pctTo5(pct);
      await addCheckin(userId, m.type, value);
    }
    await loadCheckins();
  };

  const handleMainConfirm = async () => {
    await saveFromSlider(config.maps, sliderValue);
    const applicableFollowUps = config.followUps.filter(
      f => !f.condition || f.condition(checkins),
    );
    if (applicableFollowUps.length > 0) {
      setFollowUpIdx(0);
      setFollowUpSliderValue(50);
      setStep('followup');
    } else {
      setStep('done');
    }
  };

  const handleFollowUpConfirm = async () => {
    const applicableFollowUps = config.followUps.filter(
      f => !f.condition || f.condition(checkins),
    );
    const fu = applicableFollowUps[followUpIdx];
    if (!fu) return;

    await saveFromSlider(fu.maps, followUpSliderValue);

    if (followUpIdx + 1 < applicableFollowUps.length) {
      setFollowUpIdx(followUpIdx + 1);
      setFollowUpSliderValue(50);
    } else {
      setStep('done');
    }
  };

  const handleCounter = async (type: CheckinType) => {
    await addCheckin(userId, type, 1);
    await loadCheckins();
  };

  const typesRecorded = new Set(checkins.map(c => c.type)).size;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Contatori inline — sempre visibili */}
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

        {/* Slider percentuale principale */}
        {step === 'main' && (
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-500" />
              <div>
                <p className="text-xs text-muted-foreground">{config.greeting}</p>
                <p className="text-sm font-semibold">{config.mainQuestion}</p>
              </div>
            </div>
            <PercentSlider
              value={sliderValue}
              onChange={setSliderValue}
              onConfirm={handleMainConfirm}
              maps={config.maps}
            />
          </div>
        )}

        {/* Follow-up — anche questi con slider percentuale */}
        {step === 'followup' && (() => {
          const applicableFollowUps = config.followUps.filter(
            f => !f.condition || f.condition(checkins),
          );
          const fu = applicableFollowUps[followUpIdx];
          if (!fu) return null;
          return (
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-sm font-medium">{fu.question}</p>
              </div>
              <PercentSlider
                value={followUpSliderValue}
                onChange={setFollowUpSliderValue}
                onConfirm={handleFollowUpConfirm}
                maps={fu.maps}
                emojiMapper={fu.emojiMapper}
                gradient={fu.gradient}
                compact
              />
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
              Check-in completato — {typesRecorded} parametri raccolti
            </p>
            <button
              onClick={() => { setStep('main'); setSliderValue(50); setFollowUpSliderValue(50); }}
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
