import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import {
  computeScientificEnergy,
  BOTTLENECK_ACTIONS,
  CHRONOTYPE_LABELS,
  type EnergyBreakdown,
} from '../lib/energy-engine';
import {
  Zap,
  RefreshCw,
  Moon,
  Sun,
  AlertTriangle,
  TrendingUp,
  Clock,
  Brain,
  Activity,
  Heart,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  userId: number;
}

// ---------------------------------------------------------------------------
// Score label in plain Italian based on overall score range
// ---------------------------------------------------------------------------

function getScoreLabel(score: number): string {
  if (score <= 25) return 'Energia bassa - priorita recupero';
  if (score <= 50) return 'Sotto la media - attento al carico';
  if (score <= 75) return 'Buon livello - zona produttiva';
  return 'Energia alta - sfrutta il momento';
}

function getScoreColor(score: number): string {
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  if (score >= 25) return '#f97316';
  return '#ef4444';
}

// ---------------------------------------------------------------------------
// Sub-score colors by category
// ---------------------------------------------------------------------------

const SUB_COLORS: Record<string, string> = {
  circadian: '#6366f1',
  sleep: '#8b5cf6',
  lifestyle: '#22c55e',
  allostatic: '#f59e0b',
};

// ---------------------------------------------------------------------------
// Bottleneck area mapping to readable short names
// ---------------------------------------------------------------------------

const BOTTLENECK_SHORT: Record<string, string> = {
  sleep: 'Sonno',
  hydration: 'Idratazione',
  nutrition: 'Nutrizione',
  stress: 'Stress',
  overwork: 'Lavoro',
  inactivity: 'Movimento',
  caffeine_late: 'Caffeina',
  screen_fatigue: 'Schermo',
  burnout_risk: 'Burnout',
  sleep_debt: 'Debito sonno',
  none: '',
};

// ---------------------------------------------------------------------------
// SubScoreCard: compact rectangular card with thin colored top bar
// ---------------------------------------------------------------------------

function SubScoreCard({
  value,
  maxValue,
  label,
  color,
}: {
  value: number;
  maxValue: number;
  label: string;
  color: string;
}) {
  const pct = Math.round((value / maxValue) * 100);

  return (
    <div className="flex flex-col rounded-lg border border-border bg-muted/30 overflow-hidden">
      {/* Thin colored bar at top showing fill percentage */}
      <div className="h-1 w-full bg-muted">
        <div
          className="h-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex flex-col items-center py-2 px-1">
        <span className="text-lg font-bold leading-none" style={{ color }}>
          {value}
        </span>
        <span className="text-[10px] text-muted-foreground leading-tight">/{maxValue}</span>
        <span className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{label}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PredictedCurve: full-width energy forecast with clear annotations
// ---------------------------------------------------------------------------

function PredictedCurve({
  curve,
  currentScore,
}: {
  curve: number[];
  currentScore: number;
}) {
  const hour = new Date().getHours();
  const allValues = [currentScore, ...curve];
  const maxVal = Math.max(...allValues, 1);
  const minVal = Math.min(...allValues);
  const range = maxVal - minVal || 1;

  const width = 360;
  const height = 160;
  const paddingX = 32;
  const paddingTop = 24;
  const paddingBottom = 28;
  const chartW = width - 2 * paddingX;
  const chartH = height - paddingTop - paddingBottom;

  const points = allValues.map((v, i) => ({
    x: paddingX + (i / (allValues.length - 1)) * chartW,
    y: paddingTop + (1 - (v - minVal) / range) * chartH,
    value: v,
    hour: (hour + i) % 24,
  }));

  // Smooth bezier path
  const pathD = points
    .map((p, i) => {
      if (i === 0) return `M ${p.x},${p.y}`;
      const prev = points[i - 1];
      const cx = (prev.x + p.x) / 2;
      return `C ${cx},${prev.y} ${cx},${p.y} ${p.x},${p.y}`;
    })
    .join(' ');

  // Gradient fill
  const areaD = `${pathD} L ${points[points.length - 1].x},${paddingTop + chartH} L ${paddingX},${paddingTop + chartH} Z`;

  // Peak and dip
  const peakIdx = allValues.indexOf(Math.max(...allValues));
  const dipIdx = allValues.indexOf(Math.min(...allValues));
  const peakPoint = points[peakIdx];
  const dipPoint = points[dipIdx];

  // Hour labels every 3h + last
  const hourLabels = points.filter((_, i) => i % 3 === 0 || i === points.length - 1);
  const fmtHour = (h: number): string => `${String(h).padStart(2, '0')}:00`;

  // Unique ID for gradient
  const gradId = 'energyGrad';

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
        <TrendingUp className="h-4 w-4 text-primary" />
        Curva Energetica - prossime 12 ore
      </p>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 180 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((frac) => {
          const y = paddingTop + (1 - frac) * chartH;
          return (
            <line
              key={frac}
              x1={paddingX} y1={y}
              x2={paddingX + chartW} y2={y}
              stroke="currentColor"
              className="text-border"
              strokeWidth="0.5"
              strokeDasharray="4,4"
            />
          );
        })}

        {/* Gradient area fill */}
        <path d={areaD} fill={`url(#${gradId})`} />

        {/* Main curve */}
        <path
          d={pathD}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Current point (now) */}
        <circle cx={points[0].x} cy={points[0].y} r={5}
          fill="var(--color-primary)" stroke="var(--color-background)" strokeWidth="2.5"
        />
        <text
          x={points[0].x} y={points[0].y - 10}
          textAnchor="middle" className="fill-primary"
          fontSize="11" fontWeight="700"
        >
          {allValues[0]}
        </text>

        {/* Peak annotation */}
        {peakIdx > 0 && (
          <>
            <circle cx={peakPoint.x} cy={peakPoint.y} r={4}
              fill="#22c55e" stroke="var(--color-background)" strokeWidth="2"
            />
            <text
              x={peakPoint.x} y={peakPoint.y - 10}
              textAnchor="middle" className="fill-green-600 dark:fill-green-400"
              fontSize="11" fontWeight="700"
            >
              {peakPoint.value}
            </text>
          </>
        )}

        {/* Dip annotation */}
        {dipIdx > 0 && dipIdx !== peakIdx && Math.abs(peakPoint.x - dipPoint.x) > 35 && (
          <>
            <circle cx={dipPoint.x} cy={dipPoint.y} r={4}
              fill="#ef4444" stroke="var(--color-background)" strokeWidth="2"
            />
            <text
              x={dipPoint.x} y={dipPoint.y + 16}
              textAnchor="middle" className="fill-red-500 dark:fill-red-400"
              fontSize="11" fontWeight="700"
            >
              {dipPoint.value}
            </text>
          </>
        )}

        {/* Hour labels */}
        {hourLabels.map((p, i) => (
          <text
            key={i} x={p.x} y={height - 6}
            textAnchor="middle" className="fill-muted-foreground"
            fontSize="10"
          >
            {fmtHour(p.hour)}
          </text>
        ))}

        {/* Y axis */}
        <text x={paddingX - 5} y={paddingTop + 4} textAnchor="end" className="fill-muted-foreground" fontSize="10">{maxVal}</text>
        <text x={paddingX - 5} y={paddingTop + chartH + 4} textAnchor="end" className="fill-muted-foreground" fontSize="10">{minVal}</text>
      </svg>

      {/* Legend below */}
      <div className="flex items-center justify-center gap-5 text-xs mt-2">
        <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-medium">
          <Sun className="h-3.5 w-3.5" />
          Picco: {fmtHour(points[peakIdx].hour)}
        </span>
        {dipIdx !== peakIdx && (
          <span className="flex items-center gap-1.5 text-red-500 dark:text-red-400 font-medium">
            <Moon className="h-3.5 w-3.5" />
            Calo: {fmtHour(points[dipIdx].hour)}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TechnicalDetail: a single row in the collapsed technical section
// ---------------------------------------------------------------------------

function TechnicalDetail({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: typeof Brain;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3 w-3 shrink-0" style={{ color }} />
      <span className="text-[10px] text-muted-foreground">{label}:</span>
      <span className="text-[10px] font-medium">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

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

  useEffect(() => {
    load();
  }, [load]);

  // Loading state
  if (loading || !breakdown) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs text-muted-foreground mt-2">Calcolo energia...</p>
        </CardContent>
      </Card>
    );
  }

  const scoreColor = getScoreColor(breakdown.overall);
  const scoreLabel = getScoreLabel(breakdown.overall);
  const chrono = CHRONOTYPE_LABELS[breakdown.chronotype];

  // Build the bottleneck/action section content
  const hasBottleneck = breakdown.bottleneck !== 'none';
  const bottleneckArea = BOTTLENECK_SHORT[breakdown.bottleneck] || '';
  const hasSleepDebt = breakdown.sleepDebt > 2;

  // Build a concise action string that merges bottleneck + sleep debt
  let actionText = BOTTLENECK_ACTIONS[breakdown.bottleneck];
  if (hasSleepDebt && breakdown.bottleneck !== 'sleep_debt' && breakdown.bottleneck !== 'sleep') {
    actionText += ` Debito sonno: ${breakdown.sleepDebt.toFixed(1)}h.`;
  }

  return (
    <Card>
      {/* ---- Header ---- */}
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Energy Score
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Chronotype badge inline */}
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
              <Sun className="h-3 w-3" />
              {chrono.name}
            </span>
            <Button size="sm" variant="ghost" onClick={load} className="h-7 w-7 p-0">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ---- 1. Main Score: Large horizontal progress bar ---- */}
        <div>
          <div className="flex items-end justify-between mb-1.5">
            <span
              className="text-3xl font-bold leading-none"
              style={{ color: scoreColor }}
            >
              {breakdown.overall}
            </span>
            <span className="text-sm text-muted-foreground">/100</span>
          </div>

          {/* Progress bar track */}
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${breakdown.overall}%`,
                backgroundColor: scoreColor,
              }}
            />
          </div>

          {/* Score label */}
          <p className="text-xs text-muted-foreground mt-1.5">{scoreLabel}</p>
        </div>

        {/* ---- 2. Four sub-scores as compact rectangular cards ---- */}
        <div className="grid grid-cols-4 gap-2">
          <SubScoreCard
            value={breakdown.circadian}
            maxValue={25}
            label="Ritmo"
            color={SUB_COLORS.circadian}
          />
          <SubScoreCard
            value={breakdown.sleep}
            maxValue={25}
            label="Sonno"
            color={SUB_COLORS.sleep}
          />
          <SubScoreCard
            value={breakdown.lifestyle}
            maxValue={25}
            label="Vita"
            color={SUB_COLORS.lifestyle}
          />
          <SubScoreCard
            value={breakdown.allostatic}
            maxValue={25}
            label="Carico"
            color={SUB_COLORS.allostatic}
          />
        </div>

        {/* ---- 3. Interaction penalty (if any) ---- */}
        {breakdown.interactionPenalty > 0 && (
          <p className="text-[11px] text-center text-red-500 font-medium">
            Penalita combinata: -{breakdown.interactionPenalty} (piu fattori critici insieme)
          </p>
        )}

        {/* ---- 4. Bottleneck + actionable advice (merged) ---- */}
        {hasBottleneck ? (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">
                  Punto debole: {bottleneckArea}
                </p>
                {hasSleepDebt && (breakdown.bottleneck === 'sleep' || breakdown.bottleneck === 'sleep_debt') && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Debito di {breakdown.sleepDebt.toFixed(1)}h accumulato
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {actionText}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">Nessun problema critico</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {BOTTLENECK_ACTIONS.none}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ---- 4b. Sleep debt standalone (if not already shown in bottleneck) ---- */}
        {hasSleepDebt && breakdown.bottleneck !== 'sleep' && breakdown.bottleneck !== 'sleep_debt' && (
          <div className="flex items-center gap-2 rounded-lg bg-violet-500/10 border border-violet-500/20 p-2.5">
            <Moon className="h-4 w-4 text-violet-500 shrink-0" />
            <div>
              <p className="text-xs font-medium">
                Debito di sonno: {breakdown.sleepDebt.toFixed(1)}h
              </p>
              <p className="text-[11px] text-muted-foreground">
                Prova ad andare a letto 30 min prima per qualche notte
              </p>
            </div>
          </div>
        )}

        {/* ---- 5. Predicted curve - full width, large, annotated ---- */}
        <PredictedCurve curve={breakdown.predictedCurve} currentScore={breakdown.overall} />

        {/* ---- 6. Technical details (collapsed by default) ---- */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          {showDetails ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
          Dettagli tecnici
        </button>

        {showDetails && (
          <div className="rounded-lg bg-muted/50 border border-border p-3 space-y-2">
            {/* Chronotype detail */}
            <p className="text-[10px] text-muted-foreground">
              Cronotipo: {chrono.name} - {chrono.description}
            </p>

            <hr className="border-border" />

            {/* Two-Process Model */}
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Modello Borbely
            </p>
            <TechnicalDetail
              label="Ritmo circadiano (Process C)"
              value={`${Math.round(breakdown.processC * 100)}%`}
              icon={Sun}
              color="#6366f1"
            />
            <TechnicalDetail
              label="Pressione sonno (Process S)"
              value={`${Math.round(breakdown.processS * 100)}%`}
              icon={Moon}
              color="#8b5cf6"
            />
            <TechnicalDetail
              label="Ore sveglio"
              value={`${breakdown.hoursAwake.toFixed(1)}h${breakdown.hoursAwake > 15.84 ? ' (critico)' : ''}`}
              icon={Clock}
              color={breakdown.hoursAwake > 15.84 ? '#ef4444' : '#64748b'}
            />
            <TechnicalDetail
              label="Sveglia stimata"
              value={`${Math.floor(breakdown.wakeTime)}:${String(Math.round((breakdown.wakeTime % 1) * 60)).padStart(2, '0')}`}
              icon={Activity}
              color="#22c55e"
            />
            {breakdown.factors.caffeine_remaining_mg > 0 && (
              <TechnicalDetail
                label="Caffeina residua"
                value={`${breakdown.factors.caffeine_remaining_mg}mg`}
                icon={Zap}
                color="#f59e0b"
              />
            )}
            {breakdown.factors.hrv_indicator >= 0 && (
              <TechnicalDetail
                label="HRV (recupero autonomico)"
                value={`${Math.round(breakdown.factors.hrv_indicator * 100)}%`}
                icon={Heart}
                color={breakdown.factors.hrv_indicator > 0.5 ? '#22c55e' : '#ef4444'}
              />
            )}

            <hr className="border-border" />

            {/* Component explanations - compact cards */}
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Perche questi punteggi
            </p>
            <div className="grid grid-cols-1 gap-2">
              {([
                { key: 'circadian', label: 'Ritmo', score: breakdown.circadian, max: 25 },
                { key: 'sleep', label: 'Sonno', score: breakdown.sleep, max: 25 },
                { key: 'lifestyle', label: 'Vita', score: breakdown.lifestyle, max: 25 },
                { key: 'allostatic', label: 'Carico', score: breakdown.allostatic, max: 25 },
              ] as const).map(({ key, label, score, max }) => {
                const color = SUB_COLORS[key];
                const pct = Math.round((score / max) * 100);
                const level = pct >= 75 ? 'Ottimo' : pct >= 50 ? 'Buono' : pct >= 25 ? 'Basso' : 'Critico';
                return (
                  <div key={key} className="flex items-start gap-2.5 rounded-md bg-background/60 border border-border/50 p-2">
                    <div className="flex flex-col items-center shrink-0 w-10">
                      <span className="text-sm font-bold" style={{ color }}>{score}</span>
                      <span className="text-[8px] text-muted-foreground">/{max}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold">{label}</span>
                        <span className="text-[9px] px-1 py-0.5 rounded" style={{
                          color,
                          backgroundColor: `${color}15`,
                        }}>{level}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                        {breakdown.explanations[key]}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
