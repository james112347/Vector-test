import { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuthState } from '../contexts/AuthContext';
import { useEnergyOrientation } from '../lib/useEnergyOrientation';
import { playSuggestionSound, playAlertSound, CATEGORY_LABELS, COGNITIVE_LOAD_LABELS } from '../lib/energy-orientation';
import type { Recommendation, EnergyState, EnergyLevel, EnergyFactor, AIOrientationInsight } from '../lib/energy-orientation';
import {
  Compass,
  RefreshCw,
  Check,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Volume2,
  BellRing,
  Zap,
  Brain,
  Heart,
  AlertTriangle,
  Info,
  Sparkles,
  Clock,
  MessageCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EnergyGauge({ state }: { state: EnergyState }) {
  const levelColors: Record<EnergyLevel, string> = {
    critical: '#ef4444',
    low: '#f59e0b',
    moderate: '#eab308',
    good: '#22c55e',
    peak: '#10b981',
  };
  const levelLabels: Record<EnergyLevel, string> = {
    critical: 'Critico',
    low: 'Basso',
    moderate: 'Nella media',
    good: 'Buono',
    peak: 'Al massimo',
  };

  const color = levelColors[state.level];
  const percentage = state.overall * 10;
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60" cy="60" r={radius} fill="none"
            stroke="currentColor" className="text-muted" strokeWidth="10"
          />
          <circle
            cx="60" cy="60" r={radius} fill="none"
            stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color }}>
            {state.overall.toFixed(1)}
          </span>
          <span className="text-xs text-muted-foreground">/10</span>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span
          className="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: color }}
        >
          {levelLabels[state.level]}
        </span>
        {state.trendVsYesterday !== 0 && (
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
            {state.trendVsYesterday > 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
            )}
            vs ieri
          </span>
        )}
      </div>
    </div>
  );
}

function EnergyDimensions({ state }: { state: EnergyState }) {
  const dims = [
    { label: 'Fisica', value: state.physical, icon: Zap, color: '#3b82f6' },
    { label: 'Mentale', value: state.mental, icon: Brain, color: '#22c55e' },
    { label: 'Emotiva', value: state.emotional, icon: Heart, color: '#f59e0b' },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {dims.map(dim => {
        const Icon = dim.icon;
        const pct = dim.value * 10;
        return (
          <div key={dim.label} className="flex flex-col items-center gap-1">
            <Icon className="h-4 w-4" style={{ color: dim.color }} />
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: dim.color }}
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">{dim.label}</span>
              <span className="text-xs font-bold">{dim.value}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FactorsList({ factors }: { factors: EnergyFactor[] }) {
  if (factors.length === 0) return null;
  return (
    <div className="space-y-1.5 mt-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Fattori
      </p>
      {factors.map((f, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className={`mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full ${
            f.impact > 0.2 ? 'bg-green-500' : f.impact < -0.2 ? 'bg-red-500' : 'bg-yellow-500'
          }`} />
          <p className="text-xs text-muted-foreground">{f.description}</p>
        </div>
      ))}
    </div>
  );
}

function RecommendationCard({
  rec,
  onFollow,
  onDismiss,
}: {
  rec: Recommendation;
  onFollow: () => void;
  onDismiss: () => void;
}) {
  const priorityStyles = {
    urgent: 'border-red-500/30 bg-red-500/5',
    recommended: 'border-primary/30 bg-primary/5',
    suggestion: 'border-border',
  };
  const priorityLabels = {
    urgent: 'Urgente',
    recommended: 'Consigliato',
    suggestion: 'Suggerimento',
  };
  const priorityColors = {
    urgent: 'text-red-600 dark:text-red-400 bg-red-500/10',
    recommended: 'text-primary bg-primary/10',
    suggestion: 'text-muted-foreground bg-muted',
  };

  const isActioned = rec.followedAt || rec.dismissedAt;

  return (
    <div className={`rounded-xl border p-3 transition-all ${priorityStyles[rec.priority]} ${
      isActioned ? 'opacity-60' : ''
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${priorityColors[rec.priority]}`}>
              {priorityLabels[rec.priority]}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {CATEGORY_LABELS[rec.activity.category]}
            </span>
          </div>
          <p className="text-sm font-medium">{rec.activity.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{rec.reason}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span>{rec.durationMin} min</span>
            <span className="flex items-center gap-0.5">
              <Minus className="h-3 w-3" />
              {COGNITIVE_LOAD_LABELS[rec.activity.cognitiveLoad]}
            </span>
            <span>Match {rec.matchScore}%</span>
          </div>
          {/* Barra intensita */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Intensita</span>
            <div className="flex-1 bg-muted rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-primary transition-all duration-300"
                style={{ width: `${rec.intensity * 100}%` }}
              />
            </div>
            <span className="text-[10px] font-mono">{Math.round(rec.intensity * 100)}%</span>
          </div>
        </div>
      </div>
      {!isActioned && (
        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            variant="default"
            className="flex-1 h-8 text-xs"
            onClick={onFollow}
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            Lo faccio
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs px-3"
            onClick={onDismiss}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      {rec.followedAt && (
        <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
          <Check className="h-3 w-3" /> Completato
        </p>
      )}
      {rec.dismissedAt && (
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <X className="h-3 w-3" /> Saltato
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Insight Card
// ---------------------------------------------------------------------------

function AIInsightCard({ insight }: { insight: AIOrientationInsight }) {
  const urgencyColors: Record<string, string> = {
    none: 'border-border',
    low: 'border-blue-500/20 bg-blue-500/5',
    medium: 'border-amber-500/20 bg-amber-500/5',
    high: 'border-orange-500/20 bg-orange-500/5',
    critical: 'border-red-500/20 bg-red-500/5',
  };
  const urgencyLabels: Record<string, string> = {
    none: 'Stabile',
    low: 'Sotto controllo',
    medium: 'Da monitorare',
    high: 'Richiede azione',
    critical: 'Intervento urgente',
  };

  return (
    <Card className={urgencyColors[insight.urgencyLevel] || ''}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Analisi IA
          <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-primary/10 text-primary ml-auto">
            {urgencyLabels[insight.urgencyLevel] || 'Attivo'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* State Analysis */}
        <div>
          <p className="text-sm leading-relaxed">{insight.stateAnalysis}</p>
        </div>

        {/* Primary Advice */}
        <div className="rounded-lg bg-primary/5 border border-primary/10 p-2.5">
          <p className="text-xs font-semibold text-primary mb-1">Consiglio principale</p>
          <p className="text-sm">{insight.primaryAdvice}</p>
        </div>

        {/* Recommendation Rationale */}
        {insight.recommendationRationale && (
          <div className="flex items-start gap-2">
            <MessageCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">{insight.recommendationRationale}</p>
          </div>
        )}

        {/* Short-term Forecast */}
        {insight.shortTermForecast && (
          <div className="flex items-start gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Previsione</p>
              <p className="text-xs text-muted-foreground">{insight.shortTermForecast}</p>
            </div>
          </div>
        )}

        {/* Next notification timing */}
        {insight.nextNotificationTiming && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border">
            <Clock className="h-3.5 w-3.5" />
            <span>Prossima notifica: {insight.nextNotificationTiming}</span>
          </div>
        )}

        {/* Auto-responses scheduled */}
        {insight.autoResponses.length > 0 && (
          <div className="pt-1 border-t border-border">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Notifiche programmate
            </p>
            <div className="space-y-1">
              {insight.autoResponses.map((auto, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    auto.type === 'alert' ? 'bg-red-500' : 'bg-blue-500'
                  }`} />
                  <span className="text-muted-foreground">{auto.trigger}:</span>
                  <span className="truncate">{auto.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function Orientation() {
  const { user } = useAuthState();
  const {
    result,
    energyState,
    recommendations,
    loading,
    error,
    refresh,
    markFollowed,
    markDismissed,
  } = useEnergyOrientation(user?.id);

  const [testingSound, setTestingSound] = useState<string | null>(null);

  const testSound = useCallback(async (type: 'suggestion' | 'alert') => {
    setTestingSound(type);
    try {
      if (type === 'suggestion') {
        await playSuggestionSound();
      } else {
        await playAlertSound();
      }
    } finally {
      setTestingSound(null);
    }
  }, []);

  if (loading && !result) {
    return (
      <div className="text-center py-12">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-muted-foreground text-sm mt-3">Analisi in corso...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Guida Energetica</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Cosa fare, quando e con quale intensita
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={refresh}
          disabled={loading}
          className="h-8"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Energy State */}
      {energyState && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Stato energetico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <EnergyGauge state={energyState} />
            <EnergyDimensions state={energyState} />
            {energyState.dominantFatigue && energyState.dominantFatigue !== 'balanced' && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-xs">
                  Fatica dominante: <span className="font-semibold">
                    {energyState.dominantFatigue === 'physical' ? 'fisica'
                      : energyState.dominantFatigue === 'mental' ? 'mentale' : 'emotiva'}
                  </span>
                </p>
              </div>
            )}
            <FactorsList factors={energyState.factors} />
          </CardContent>
        </Card>
      )}

      {/* AI Insight */}
      {result?.aiInsight && (
        <AIInsightCard insight={result.aiInsight} />
      )}

      {/* Notifications from orientation */}
      {result && result.notifications.length > 0 && (
        <div className="space-y-2">
          {result.notifications.map(notif => (
            <div
              key={notif.id}
              className={`rounded-lg border p-3 flex items-start gap-2.5 ${
                notif.type === 'alert'
                  ? 'border-red-500/30 bg-red-500/5'
                  : 'border-blue-500/20 bg-blue-500/5'
              }`}
            >
              {notif.type === 'alert' ? (
                <BellRing className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              ) : (
                <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-sm font-medium">{notif.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{notif.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Raccomandazioni
          </h2>
          {recommendations.map(rec => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              onFollow={() => markFollowed(rec)}
              onDismiss={() => markDismissed(rec)}
            />
          ))}
        </div>
      )}

      {/* No data state */}
      {!energyState && !error && !loading && (
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <Compass className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Registra la tua energia per ricevere raccomandazioni personalizzate
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sound test */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Suoni notifiche
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            I suggerimenti hanno un suono calmo, gli avvisi un suono piu presente.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-9 text-xs"
              onClick={() => testSound('suggestion')}
              disabled={testingSound !== null}
            >
              <Volume2 className="h-3.5 w-3.5 mr-1.5" />
              {testingSound === 'suggestion' ? 'In riproduzione...' : 'Suggerimento'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-9 text-xs"
              onClick={() => testSound('alert')}
              disabled={testingSound !== null}
            >
              <BellRing className="h-3.5 w-3.5 mr-1.5" />
              {testingSound === 'alert' ? 'In riproduzione...' : 'Avviso'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Footer info */}
      <p className="text-[10px] text-center text-muted-foreground px-4">
        Vector analizza il tuo stato energetico in tempo reale per guidarti su cosa fare, quando e con quale intensita — massimizzando risultati e sostenibilita.
      </p>
    </div>
  );
}
