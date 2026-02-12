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
  Brain,
  Clock,
  Activity,
  Heart,
  Info,
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
  explanation,
}: {
  value: number;
  maxValue: number;
  label: string;
  color: string;
  size?: 'sm' | 'lg';
  explanation?: string;
}) {
  const [showTip, setShowTip] = useState(false);
  const percentage = (value / maxValue) * 100;
  const radius = size === 'lg' ? 44 : 24;
  const strokeWidth = size === 'lg' ? 8 : 4;
  const viewSize = size === 'lg' ? 100 : 56;
  const center = viewSize / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1 relative">
      <div
        className={`relative ${size === 'lg' ? 'w-24 h-24' : 'w-14 h-14'} cursor-pointer`}
        onClick={() => explanation && setShowTip(!showTip)}
      >
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
      {showTip && explanation && (
        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-20 w-48 rounded-lg bg-popover border border-border p-2 shadow-lg">
          <p className="text-[10px] text-foreground">{explanation}</p>
          <button onClick={() => setShowTip(false)} className="text-[9px] text-primary mt-1">Chiudi</button>
        </div>
      )}
    </div>
  );
}

function PredictedCurve({ curve, currentScore }: { curve: number[]; currentScore: number }) {
  const hour = new Date().getHours();
  const allValues = [currentScore, ...curve];
  const maxVal = Math.max(...allValues, 1);
  const minVal = Math.min(...allValues);
  const range = maxVal - minVal || 1;

  // Build smooth path
  const width = 280;
  const height = 50;
  const padding = 5;
  const points = allValues.map((v, i) => ({
    x: padding + (i / (allValues.length - 1)) * (width - 2 * padding),
    y: padding + (1 - (v - minVal) / range) * (height - 2 * padding),
  }));

  const pathD = points.map((p, i) => {
    if (i === 0) return `M ${p.x},${p.y}`;
    const prev = points[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `C ${cx},${prev.y} ${cx},${p.y} ${p.x},${p.y}`;
  }).join(' ');

  // Find best and worst hour
  const bestIdx = allValues.indexOf(Math.max(...allValues));
  const worstIdx = allValues.indexOf(Math.min(...allValues.slice(1))) + (allValues.indexOf(Math.min(...allValues.slice(1))) >= 0 ? 0 : 0);

  return (
    <div className="mt-3">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
        <TrendingUp className="h-3 w-3" />
        Previsione prossime 12 ore
      </p>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-12">
        {/* Area fill */}
        <path
          d={`${pathD} L ${points[points.length - 1].x},${height - padding} L ${padding},${height - padding} Z`}
          fill="var(--color-primary)"
          fillOpacity="0.08"
        />
        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x} cy={p.y}
            r={i === 0 ? 3 : 2}
            fill={i === 0 ? 'var(--color-primary)' : 'var(--color-muted-foreground)'}
            fillOpacity={i === 0 ? 1 : 0.5}
          />
        ))}
        {/* Value labels for first, peak, and last */}
        <text x={points[0].x} y={points[0].y - 5} textAnchor="middle" className="fill-primary text-[7px] font-bold">{allValues[0]}</text>
        {bestIdx > 0 && bestIdx < allValues.length - 1 && (
          <text x={points[bestIdx].x} y={points[bestIdx].y - 5} textAnchor="middle" className="fill-green-500 text-[7px] font-bold">{allValues[bestIdx]}</text>
        )}
      </svg>
      <div className="flex justify-between text-[8px] text-muted-foreground px-1">
        <span className="font-medium">Ora</span>
        {curve.filter((_, i) => i % 2 === 0).map((_, i) => (
          <span key={i}>{((hour + (i * 2) + 1) % 24).toString().padStart(2, '0')}:00</span>
        ))}
        <span>{((hour + 12) % 24).toString().padStart(2, '0')}:00</span>
      </div>
    </div>
  );
}

function ProcessIndicator({ label, value, icon: Icon, color }: {
  label: string; value: string; icon: typeof Brain; color: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3 w-3 shrink-0" style={{ color }} />
      <span className="text-[10px] text-muted-foreground">{label}:</span>
      <span className="text-[10px] font-medium">{value}</span>
    </div>
  );
}

export default function ScientificEnergyCard({ userId }: Props) {
  const [breakdown, setBreakdown] = useState<EnergyBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

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
            <ScoreRing
              value={breakdown.circadian} maxValue={25} label="Circadiano" color="#6366f1"
              explanation={breakdown.explanations?.circadian}
            />
            <ScoreRing
              value={breakdown.sleep} maxValue={25} label="Sonno" color="#8b5cf6"
              explanation={breakdown.explanations?.sleep}
            />
            <ScoreRing
              value={breakdown.lifestyle} maxValue={25} label="Stile di vita" color="#22c55e"
              explanation={breakdown.explanations?.lifestyle}
            />
            <ScoreRing
              value={breakdown.allostatic} maxValue={25} label="Carico" color="#f59e0b"
              explanation={breakdown.explanations?.allostatic}
            />
          </div>
        </div>

        {/* Interaction penalty */}
        {breakdown.interactionPenalty > 0 && (
          <div className="text-[10px] text-center text-red-500 font-medium">
            Penalita interazione: -{breakdown.interactionPenalty} (multipli fattori critici)
          </div>
        )}

        {/* Chronotype badge */}
        <div className="flex items-center gap-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-2">
          <Sun className="h-4 w-4 text-indigo-500 shrink-0" />
          <div className="flex-1">
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

        {/* Two-Process Model indicators */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
        >
          <Info className="h-3 w-3" />
          {showDetails ? 'Nascondi dettagli scientifici' : 'Mostra dettagli scientifici'}
        </button>

        {showDetails && (
          <div className="rounded-lg bg-muted/50 border border-border p-2.5 space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Two-Process Model (Borbely)
            </p>
            <ProcessIndicator
              label="Process C (circadiano)"
              value={`${Math.round(breakdown.processC * 100)}%`}
              icon={Sun} color="#6366f1"
            />
            <ProcessIndicator
              label="Process S (pressione sonno)"
              value={`${Math.round(breakdown.processS * 100)}%`}
              icon={Moon} color="#8b5cf6"
            />
            <ProcessIndicator
              label="Ore sveglio"
              value={`${breakdown.hoursAwake.toFixed(1)}h${breakdown.hoursAwake > 15.84 ? ' (critico)' : ''}`}
              icon={Clock} color={breakdown.hoursAwake > 15.84 ? '#ef4444' : '#64748b'}
            />
            <ProcessIndicator
              label="Sveglia stimata"
              value={`${Math.floor(breakdown.wakeTime)}:${String(Math.round((breakdown.wakeTime % 1) * 60)).padStart(2, '0')}`}
              icon={Activity} color="#22c55e"
            />
            {breakdown.factors.caffeine_remaining_mg > 0 && (
              <ProcessIndicator
                label="Caffeina residua"
                value={`${breakdown.factors.caffeine_remaining_mg}mg`}
                icon={Zap} color="#f59e0b"
              />
            )}
            {breakdown.factors.hrv_indicator >= 0 && (
              <ProcessIndicator
                label="HRV (recupero)"
                value={`${Math.round(breakdown.factors.hrv_indicator * 100)}%`}
                icon={Heart} color={breakdown.factors.hrv_indicator > 0.5 ? '#22c55e' : '#ef4444'}
              />
            )}
          </div>
        )}

        {/* Predicted curve */}
        <PredictedCurve curve={breakdown.predictedCurve} currentScore={breakdown.overall} />
      </CardContent>
    </Card>
  );
}
