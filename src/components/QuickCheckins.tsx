import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Moon, Droplets, Coffee, UtensilsCrossed, Target, Dumbbell } from 'lucide-react';
import { addCheckin, getTodayCheckins } from '../lib/checkins';
import type { CheckinType, QuickCheckin } from '../db/schema';
import type { LucideIcon } from 'lucide-react';

// ---------------------------------------------------------------------------
// Each check-in is designed to feed the AI with actionable energy data
// ---------------------------------------------------------------------------

interface CheckinConfig {
  type: CheckinType;
  label: string;
  sublabel: string; // spiega PERCHE' viene tracciato
  icon: LucideIcon;
  color: string;
  mode: 'scale' | 'counter' | 'options';
  scaleLabels?: string[];   // per mode=scale (1-5)
  options?: string[];        // per mode=options
  target?: number;           // per mode=counter
}

const CHECKINS: CheckinConfig[] = [
  {
    type: 'sleep_quality',
    label: 'Qualita sonno',
    sublabel: 'Come hai dormito stanotte?',
    icon: Moon,
    color: '#8b5cf6',
    mode: 'scale',
    scaleLabels: ['Pessimo', 'Male', 'Sufficiente', 'Bene', 'Ottimo'],
  },
  {
    type: 'water',
    label: 'Idratazione',
    sublabel: 'Bicchieri d\'acqua oggi',
    icon: Droplets,
    color: '#3b82f6',
    mode: 'counter',
    target: 8,
  },
  {
    type: 'caffeine',
    label: 'Caffeina',
    sublabel: 'Tazzine/energy drink oggi',
    icon: Coffee,
    color: '#92400e',
    mode: 'counter',
  },
  {
    type: 'meal_time',
    label: 'Ultimo pasto',
    sublabel: 'Qualita del tuo ultimo pasto',
    icon: UtensilsCrossed,
    color: '#22c55e',
    mode: 'scale',
    scaleLabels: ['Saltato', 'Scarso', 'Sufficiente', 'Buono', 'Nutriente'],
  },
  {
    type: 'focus',
    label: 'Focus attuale',
    sublabel: 'Quanto riesci a concentrarti ora?',
    icon: Target,
    color: '#f59e0b',
    mode: 'scale',
    scaleLabels: ['Zero', 'Basso', 'Medio', 'Buono', 'Massimo'],
  },
  {
    type: 'activity_done',
    label: 'Attivita fisica',
    sublabel: 'Movimento fatto oggi',
    icon: Dumbbell,
    color: '#ef4444',
    mode: 'scale',
    scaleLabels: ['Nessuna', 'Camminata', 'Leggera', 'Moderata', 'Intensa'],
  },
];

// ---------------------------------------------------------------------------
// Scale Input (1-5 professional bar)
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
      className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/30 active:scale-[0.98] transition-all w-full text-left"
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: config.color + '15' }}>
        <Icon className="h-[18px] w-[18px]" style={{ color: config.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{config.label}</p>
        <p className="text-[10px] text-muted-foreground truncate">{config.sublabel}</p>
      </div>
      {currentValue > 0 ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(n => (
              <div
                key={n}
                className="w-1.5 h-4 rounded-sm transition-all"
                style={{
                  backgroundColor: n <= currentValue ? config.color : 'var(--muted)',
                }}
              />
            ))}
          </div>
          <span className="text-xs font-bold tabular-nums" style={{ color: config.color }}>{currentValue}</span>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground shrink-0">Registra</span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Counter Input (water, caffeine)
// ---------------------------------------------------------------------------

function CounterInput({
  config,
  currentValue,
  onAdd,
}: {
  config: CheckinConfig;
  currentValue: number;
  onAdd: () => void;
}) {
  const Icon = config.icon;
  const pct = config.target ? Math.min((currentValue / config.target) * 100, 100) : 0;

  return (
    <button
      onClick={onAdd}
      className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/30 active:scale-[0.98] transition-all w-full text-left"
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: config.color + '15' }}>
        <Icon className="h-[18px] w-[18px]" style={{ color: config.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{config.label}</p>
        <p className="text-[10px] text-muted-foreground">{config.sublabel}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-lg font-bold tabular-nums" style={{ color: config.color }}>
          {currentValue}
          {config.target && <span className="text-xs text-muted-foreground font-normal">/{config.target}</span>}
        </span>
        {config.target && (
          <div className="w-12 h-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: config.color }} />
          </div>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function QuickCheckins({ userId }: { userId: number }) {
  const [checkins, setCheckins] = useState<QuickCheckin[]>([]);

  const loadCheckins = useCallback(async () => {
    const items = await getTodayCheckins(userId);
    setCheckins(items);
  }, [userId]);

  useEffect(() => { loadCheckins(); }, [loadCheckins]);

  // Compute current values from today's checkins
  const getValue = (type: CheckinType): number => {
    const items = checkins.filter(c => c.type === type);
    if (items.length === 0) return 0;
    const config = CHECKINS.find(c => c.type === type);
    if (config?.mode === 'counter') {
      return items.reduce((s, c) => s + c.value, 0);
    }
    // For scale types, return last value
    return items[items.length - 1].value;
  };

  const handleScale = async (type: CheckinType, value: number) => {
    await addCheckin(userId, type, value);
    await loadCheckins();
  };

  const handleCounter = async (type: CheckinType) => {
    await addCheckin(userId, type, 1);
    await loadCheckins();
  };

  const filledCount = CHECKINS.filter(c => getValue(c.type) > 0).length;

  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Check-in giornaliero</CardTitle>
          <span className="text-[10px] text-muted-foreground">{filledCount}/{CHECKINS.length} completati</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {CHECKINS.map(config =>
          config.mode === 'counter' ? (
            <CounterInput
              key={config.type}
              config={config}
              currentValue={getValue(config.type)}
              onAdd={() => handleCounter(config.type)}
            />
          ) : (
            <ScaleInput
              key={config.type}
              config={config}
              currentValue={getValue(config.type)}
              onSelect={(v) => handleScale(config.type, v)}
            />
          )
        )}
      </CardContent>
    </Card>
  );
}
