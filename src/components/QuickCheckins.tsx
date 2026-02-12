import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import {
  Moon, Droplets, Coffee, UtensilsCrossed, Target, Dumbbell,
  AlertCircle, Smile, BedDouble, Pill, MonitorOff,
  ChevronDown, ChevronUp, Clock,
} from 'lucide-react';
import { addCheckin, getTodayCheckins } from '../lib/checkins';
import type { CheckinType, QuickCheckin } from '../db/schema';
import type { LucideIcon } from 'lucide-react';

// ---------------------------------------------------------------------------
// Config — ogni check-in alimenta l'IA con dati azionabili
// ---------------------------------------------------------------------------

interface CheckinConfig {
  type: CheckinType;
  label: string;
  sublabel: string;
  icon: LucideIcon;
  color: string;
  mode: 'scale' | 'counter';
  scaleLabels?: string[];
  target?: number;
  /** Sezione: 'quick' per barra rapida, 'detail' per sezione espansa */
  section: 'quick' | 'detail';
}

const CHECKINS: CheckinConfig[] = [
  // --- Quick bar (azioni rapide con un tap) ---
  {
    type: 'caffeine', label: 'Caffe', sublabel: 'Tazzina bevuta adesso',
    icon: Coffee, color: '#92400e', mode: 'counter', section: 'quick',
  },
  {
    type: 'water', label: 'Acqua', sublabel: 'Bicchiere bevuto',
    icon: Droplets, color: '#3b82f6', mode: 'counter', target: 8, section: 'quick',
  },
  {
    type: 'supplement', label: 'Integr.', sublabel: 'Integratore/vitamina',
    icon: Pill, color: '#8b5cf6', mode: 'counter', section: 'quick',
  },
  {
    type: 'screen_break', label: 'Pausa', sublabel: 'Pausa schermo',
    icon: MonitorOff, color: '#06b6d4', mode: 'counter', section: 'quick',
  },
  // --- Detail section (scale 1-5) ---
  {
    type: 'sleep_quality', label: 'Qualita sonno', sublabel: 'Come hai dormito stanotte?',
    icon: Moon, color: '#8b5cf6', mode: 'scale',
    scaleLabels: ['Pessimo', 'Male', 'Sufficiente', 'Bene', 'Ottimo'], section: 'detail',
  },
  {
    type: 'mood', label: 'Umore', sublabel: 'Come ti senti adesso?',
    icon: Smile, color: '#f59e0b', mode: 'scale',
    scaleLabels: ['Pessimo', 'Giu', 'Neutro', 'Bene', 'Ottimo'], section: 'detail',
  },
  {
    type: 'stress', label: 'Stress', sublabel: 'Livello di stress attuale',
    icon: AlertCircle, color: '#ef4444', mode: 'scale',
    scaleLabels: ['Nessuno', 'Leggero', 'Moderato', 'Alto', 'Estremo'], section: 'detail',
  },
  {
    type: 'meal_time', label: 'Ultimo pasto', sublabel: 'Qualita del tuo ultimo pasto',
    icon: UtensilsCrossed, color: '#22c55e', mode: 'scale',
    scaleLabels: ['Saltato', 'Scarso', 'Sufficiente', 'Buono', 'Nutriente'], section: 'detail',
  },
  {
    type: 'focus', label: 'Focus', sublabel: 'Quanto riesci a concentrarti?',
    icon: Target, color: '#f59e0b', mode: 'scale',
    scaleLabels: ['Zero', 'Basso', 'Medio', 'Buono', 'Massimo'], section: 'detail',
  },
  {
    type: 'activity_done', label: 'Attivita fisica', sublabel: 'Movimento fatto oggi',
    icon: Dumbbell, color: '#ef4444', mode: 'scale',
    scaleLabels: ['Nessuna', 'Camminata', 'Leggera', 'Moderata', 'Intensa'], section: 'detail',
  },
  {
    type: 'nap', label: 'Pisolino', sublabel: 'Hai fatto un pisolino?',
    icon: BedDouble, color: '#6366f1', mode: 'scale',
    scaleLabels: ['No', '10min', '20min', '30min', '45min+'], section: 'detail',
  },
];

// ---------------------------------------------------------------------------
// Quick Tap Button (barra rapida — un tap per registrare)
// ---------------------------------------------------------------------------

function QuickTapButton({
  config,
  currentValue,
  lastTime,
  onTap,
}: {
  config: CheckinConfig;
  currentValue: number;
  lastTime: string | null;
  onTap: () => void;
}) {
  const Icon = config.icon;
  return (
    <button
      onClick={onTap}
      className="flex flex-col items-center gap-1 p-2 rounded-xl border border-border bg-card hover:bg-muted/30 active:scale-95 transition-all min-w-[68px] relative"
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: config.color + '15' }}
      >
        <Icon className="h-4 w-4" style={{ color: config.color }} />
      </div>
      <span className="text-[10px] font-medium">{config.label}</span>
      {currentValue > 0 ? (
        <span className="text-xs font-bold tabular-nums" style={{ color: config.color }}>
          {currentValue}
          {config.target ? <span className="text-[9px] text-muted-foreground font-normal">/{config.target}</span> : ''}
        </span>
      ) : (
        <span className="text-[10px] text-muted-foreground">+1</span>
      )}
      {lastTime && (
        <span className="text-[8px] text-muted-foreground flex items-center gap-0.5">
          <Clock className="h-2 w-2" />{lastTime}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Scale Input (compatto con feedback visivo)
// ---------------------------------------------------------------------------

function ScaleInput({
  config,
  currentValue,
  onSelect,
}: {
  config: CheckinConfig;
  currentValue: number;
  onSelect: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const Icon = config.icon;
  const labels = config.scaleLabels || [];

  if (open) {
    return (
      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: config.color }} />
          <span className="text-xs font-medium">{config.sublabel}</span>
        </div>
        <div className="flex gap-1">
          {labels.map((label, i) => {
            const level = i + 1;
            const isActive = currentValue === level;
            return (
              <button
                key={level}
                onClick={() => { onSelect(level); setOpen(false); }}
                className={`flex-1 py-2 rounded-lg text-center transition-all ${
                  isActive
                    ? 'text-white font-bold text-xs'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground text-[10px]'
                }`}
                style={isActive ? { backgroundColor: config.color } : undefined}
              >
                <div className="text-xs font-bold">{level}</div>
                <div className={isActive ? 'text-[9px] text-white/80' : 'text-[9px]'}>{label}</div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-card hover:bg-muted/30 active:scale-[0.98] transition-all w-full text-left"
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: config.color + '15' }}>
        <Icon className="h-4 w-4" style={{ color: config.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{config.label}</p>
      </div>
      {currentValue > 0 ? (
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(n => (
              <div
                key={n}
                className="w-1.5 h-3.5 rounded-sm transition-all"
                style={{ backgroundColor: n <= currentValue ? config.color : 'var(--muted)' }}
              />
            ))}
          </div>
          <span className="text-xs font-bold tabular-nums" style={{ color: config.color }}>{currentValue}</span>
        </div>
      ) : (
        <span className="text-[10px] text-muted-foreground shrink-0">Registra</span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function QuickCheckins({ userId }: { userId: number }) {
  const [checkins, setCheckins] = useState<QuickCheckin[]>([]);
  const [expanded, setExpanded] = useState(false);

  const loadCheckins = useCallback(async () => {
    const items = await getTodayCheckins(userId);
    setCheckins(items);
  }, [userId]);

  useEffect(() => { loadCheckins(); }, [loadCheckins]);

  const getValue = (type: CheckinType): number => {
    const items = checkins.filter(c => c.type === type);
    if (items.length === 0) return 0;
    const config = CHECKINS.find(c => c.type === type);
    if (config?.mode === 'counter') {
      return items.reduce((s, c) => s + c.value, 0);
    }
    return items[items.length - 1].value;
  };

  const getLastTime = (type: CheckinType): string | null => {
    const items = checkins.filter(c => c.type === type);
    if (items.length === 0) return null;
    return items[items.length - 1].time;
  };

  const handleScale = async (type: CheckinType, value: number) => {
    await addCheckin(userId, type, value);
    await loadCheckins();
  };

  const handleCounter = async (type: CheckinType) => {
    await addCheckin(userId, type, 1);
    await loadCheckins();
  };

  const quickItems = CHECKINS.filter(c => c.section === 'quick');
  const detailItems = CHECKINS.filter(c => c.section === 'detail');
  const allCount = CHECKINS.length;
  const filledCount = CHECKINS.filter(c => getValue(c.type) > 0).length;

  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Check-in rapido</CardTitle>
          <span className="text-[10px] text-muted-foreground">
            {filledCount}/{allCount}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Quick bar — azioni con un tap */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {quickItems.map(config => (
            <QuickTapButton
              key={config.type}
              config={config}
              currentValue={getValue(config.type)}
              lastTime={getLastTime(config.type)}
              onTap={() => handleCounter(config.type)}
            />
          ))}
        </div>

        {/* Progress dots for quick bar */}
        {quickItems.some(c => getValue(c.type) > 0) && (
          <div className="flex items-center gap-1 justify-center">
            {quickItems.map(c => (
              <div
                key={c.type}
                className="w-1.5 h-1.5 rounded-full transition-all"
                style={{ backgroundColor: getValue(c.type) > 0 ? c.color : 'var(--muted)' }}
              />
            ))}
          </div>
        )}

        {/* Toggle detail section */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          {expanded ? (
            <>Nascondi dettagli <ChevronUp className="h-3.5 w-3.5" /></>
          ) : (
            <>Valutazioni dettagliate <ChevronDown className="h-3.5 w-3.5" /></>
          )}
        </button>

        {/* Detail section — scale inputs */}
        {expanded && (
          <div className="space-y-2">
            {detailItems.map(config => (
              <ScaleInput
                key={config.type}
                config={config}
                currentValue={getValue(config.type)}
                onSelect={(v) => handleScale(config.type, v)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
