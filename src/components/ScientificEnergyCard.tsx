import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import {
  computeScientificEnergy,
  BOTTLENECK_LABELS,
  CHRONOTYPE_LABELS,
  type EnergyBreakdown,
} from '../lib/energy-engine';
import {
  Zap,
  RefreshCw,
  Moon,
  Sun,
  Droplets,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';

interface Props {
  userId: number;
}

function ScoreRing({
  value,
  maxValue,
  label,
  color,
  size = 'sm',
}: {
  value: number;
  maxValue: number;
  label: string;
  color: string;
  size?: 'sm' | 'lg';
}) {
  const percentage = (value / maxValue) * 100;
  const radius = size === 'lg' ? 44 : 24;
  const strokeWidth = size === 'lg' ? 8 : 4;
  const viewSize = size === 'lg' ? 100 : 56;
  const center = viewSize / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`relative ${size === 'lg' ? 'w-24 h-24' : 'w-14 h-14'}`}>
        <svg
          className={`${size === 'lg' ? 'w-24 h-24' : 'w-14 h-14'} -rotate-90`}
          viewBox={`0 0 ${viewSize} ${viewSize}`}
        >
          <circle
            cx={center} cy={center} r={radius}
            fill="none" stroke="currentColor"
            className="text-muted" strokeWidth={strokeWidth}
          />
          <circle
            cx={center} cy={center} r={radius}
            fill="none" stroke={color}
            strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-bold ${size === 'lg' ? 'text-2xl' : 'text-sm'}`}
            style={{ color }}
          >
            {value}
          </span>
          {size === 'lg' && (
            <span className="text-[10px] text-muted-foreground">/{maxValue}</span>
          )}
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground text-center">{label}</span>
    </div>
  );
}

function PredictedCurve({ curve, currentScore }: { curve: number[]; currentScore: number }) {
  const hour = new Date().getHours();
  const allValues = [currentScore, ...curve];
  const maxVal = Math.max(...allValues, 1);
  const points = allValues.map((v, i) => {
    const x = (i / (allValues.length - 1)) * 200;
    const y = 40 - (v / maxVal) * 35;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="mt-2">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
        Previsione prossime 6 ore
      </p>
      <svg viewBox="0 0 200 45" className="w-full h-10">
        <polyline
          points={points}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {allValues.map((v, i) => (
          <circle
            key={i}
            cx={(i / (allValues.length - 1)) * 200}
            cy={40 - (v / maxVal) * 35}
            r="2.5"
            fill={i === 0 ? 'var(--color-primary)' : 'var(--color-muted-foreground)'}
          />
        ))}
      </svg>
      <div className="flex justify-between text-[9px] text-muted-foreground">
        <span>Ora</span>
        {curve.map((_, i) => (
          <span key={i}>{((hour + i + 1) % 24).toString().padStart(2, '0')}:00</span>
        ))}
      </div>
    </div>
  );
}

export default function ScientificEnergyCard({ userId }: Props) {
  const [breakdown, setBreakdown] = useState<EnergyBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await computeScientificEnergy(userId);
      setBreakdown(result);
    } catch (e) {
      console.error('Scientific energy computation error:', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  if (loading || !breakdown) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs text-muted-foreground mt-2">Calcolo energia scientifica...</p>
        </CardContent>
      </Card>
    );
  }

  const scoreColor = breakdown.overall >= 75 ? '#22c55e'
    : breakdown.overall >= 50 ? '#f59e0b'
    : breakdown.overall >= 25 ? '#f97316'
    : '#ef4444';

  const chrono = CHRONOTYPE_LABELS[breakdown.chronotype];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Energy Score
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={load} className="h-7 w-7 p-0">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Main score + breakdown */}
        <div className="flex items-center gap-4">
          <ScoreRing value={breakdown.overall} maxValue={100} label="Totale" color={scoreColor} size="lg" />
          <div className="flex-1 grid grid-cols-2 gap-2">
            <ScoreRing value={breakdown.circadian} maxValue={25} label="Circadiano" color="#6366f1" />
            <ScoreRing value={breakdown.sleep} maxValue={25} label="Sonno" color="#8b5cf6" />
            <ScoreRing value={breakdown.lifestyle} maxValue={25} label="Stile di vita" color="#22c55e" />
            <ScoreRing value={breakdown.allostatic} maxValue={25} label="Carico" color="#f59e0b" />
          </div>
        </div>

        {/* Chronotype badge */}
        <div className="flex items-center gap-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-2">
          <Sun className="h-4 w-4 text-indigo-500 shrink-0" />
          <div>
            <p className="text-xs font-medium">Cronotipo: {chrono.name}</p>
            <p className="text-[10px] text-muted-foreground">{chrono.description}</p>
          </div>
        </div>

        {/* Bottleneck */}
        {breakdown.bottleneck !== 'none' && (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-2">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <div>
              <p className="text-xs font-medium">Collo di bottiglia</p>
              <p className="text-[10px] text-muted-foreground">
                {BOTTLENECK_LABELS[breakdown.bottleneck]}
              </p>
            </div>
          </div>
        )}

        {/* Sleep debt */}
        {breakdown.sleepDebt > 2 && (
          <div className="flex items-center gap-2 rounded-lg bg-violet-500/10 border border-violet-500/20 p-2">
            <Moon className="h-4 w-4 text-violet-500 shrink-0" />
            <div>
              <p className="text-xs font-medium">
                Debito di sonno: {breakdown.sleepDebt.toFixed(1)}h
              </p>
              <p className="text-[10px] text-muted-foreground">
                Recupero necessario per prestazioni ottimali
              </p>
            </div>
          </div>
        )}

        {/* Predicted curve */}
        <PredictedCurve curve={breakdown.predictedCurve} currentScore={breakdown.overall} />
      </CardContent>
    </Card>
  );
}
