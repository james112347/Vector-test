import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { addCheckin, getTodayTotals } from '../lib/checkins';
import type { CheckinType } from '../db/schema';

interface CheckinConfig {
  type: CheckinType;
  label: string;
  icon: string;
  color: string;
  mode: 'counter' | 'rating';
  max: number;
  unit?: string;
  target?: number; // target for counter types
}

const CHECKIN_TYPES: CheckinConfig[] = [
  { type: 'water', label: 'Acqua', icon: '💧', color: '#3b82f6', mode: 'counter', max: 15, unit: 'bicchieri', target: 8 },
  { type: 'caffeine', label: 'Caffeina', icon: '☕', color: '#92400e', mode: 'counter', max: 10, unit: 'tazzine' },
  { type: 'meal', label: 'Pasto', icon: '🍽️', color: '#22c55e', mode: 'rating', max: 5 },
  { type: 'mood', label: 'Umore', icon: '😊', color: '#f59e0b', mode: 'rating', max: 5 },
  { type: 'stress', label: 'Stress', icon: '😤', color: '#ef4444', mode: 'rating', max: 5 },
  { type: 'movement', label: 'Movimento', icon: '🏃', color: '#8b5cf6', mode: 'rating', max: 5 },
];

const MOOD_EMOJIS = ['😢', '😕', '😐', '🙂', '😄'];
const STRESS_EMOJIS = ['😌', '🙂', '😐', '😰', '🤯'];
const MEAL_EMOJIS = ['🤢', '😕', '😐', '😋', '🤩'];
const MOVE_EMOJIS = ['🛋️', '🚶', '🏃', '💪', '🔥'];

function getRatingEmojis(type: CheckinType): string[] {
  switch (type) {
    case 'mood': return MOOD_EMOJIS;
    case 'stress': return STRESS_EMOJIS;
    case 'meal': return MEAL_EMOJIS;
    case 'movement': return MOVE_EMOJIS;
    default: return ['1', '2', '3', '4', '5'];
  }
}

function CounterCheckin({
  config,
  value,
  onAdd,
}: {
  config: CheckinConfig;
  value: number;
  onAdd: () => void;
}) {
  const pct = config.target ? Math.min((value / config.target) * 100, 100) : 0;

  return (
    <button
      onClick={onAdd}
      className="flex flex-col items-center gap-1 p-2.5 rounded-xl border border-border bg-card hover:bg-muted/50 active:scale-95 transition-all min-w-[72px]"
    >
      <span className="text-xl">{config.icon}</span>
      <span className="text-lg font-bold tabular-nums" style={{ color: config.color }}>
        {value}
      </span>
      {config.target && (
        <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: config.color }}
          />
        </div>
      )}
      <span className="text-[9px] text-muted-foreground">{config.label}</span>
    </button>
  );
}

function RatingCheckin({
  config,
  value,
  onRate,
}: {
  config: CheckinConfig;
  value: number;
  onRate: (v: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const emojis = getRatingEmojis(config.type);

  if (expanded) {
    return (
      <div className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-border bg-card min-w-[72px]">
        <span className="text-[9px] text-muted-foreground font-medium">{config.label}</span>
        <div className="flex gap-1">
          {emojis.map((emoji, i) => (
            <button
              key={i}
              onClick={() => {
                onRate(i + 1);
                setExpanded(false);
              }}
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm hover:bg-muted active:scale-90 transition-all ${
                value === i + 1 ? 'ring-2 ring-offset-1' : ''
              }`}
              style={value === i + 1 ? { outlineColor: config.color } : undefined}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setExpanded(true)}
      className="flex flex-col items-center gap-1 p-2.5 rounded-xl border border-border bg-card hover:bg-muted/50 active:scale-95 transition-all min-w-[72px]"
    >
      <span className="text-xl">{value > 0 ? emojis[value - 1] : config.icon}</span>
      {value > 0 ? (
        <span className="text-xs font-bold" style={{ color: config.color }}>
          {value}/5
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">--</span>
      )}
      <span className="text-[9px] text-muted-foreground">{config.label}</span>
    </button>
  );
}

export default function QuickCheckins({ userId }: { userId: number }) {
  const [totals, setTotals] = useState<Record<CheckinType, number>>({
    water: 0, caffeine: 0, meal: 0, mood: 0, stress: 0, movement: 0,
  });

  const loadTotals = useCallback(async () => {
    const t = await getTodayTotals(userId);
    setTotals(t);
  }, [userId]);

  useEffect(() => {
    loadTotals();
  }, [loadTotals]);

  const handleCounter = async (type: CheckinType) => {
    await addCheckin(userId, type, 1);
    await loadTotals();
  };

  const handleRating = async (type: CheckinType, value: number) => {
    await addCheckin(userId, type, value);
    await loadTotals();
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Check-in rapido</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {CHECKIN_TYPES.map(config =>
            config.mode === 'counter' ? (
              <CounterCheckin
                key={config.type}
                config={config}
                value={totals[config.type]}
                onAdd={() => handleCounter(config.type)}
              />
            ) : (
              <RatingCheckin
                key={config.type}
                config={config}
                value={totals[config.type]}
                onRate={(v) => handleRating(config.type, v)}
              />
            )
          )}
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Tocca per registrare — l'IA usa questi dati per consigli personalizzati
        </p>
      </CardContent>
    </Card>
  );
}
