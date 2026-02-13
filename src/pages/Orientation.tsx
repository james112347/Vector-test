import { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuthState } from '../contexts/AuthContext';
import { useEnergyOrientation } from '../lib/useEnergyOrientation';
import { playSuggestionSound, playAlertSound, CATEGORY_LABELS, COGNITIVE_LOAD_LABELS } from '../lib/energy-orientation';
import type { Recommendation, AIOrientationInsight } from '../lib/energy-orientation';
import ScientificEnergyCard from '../components/ScientificEnergyCard';
import {
  RefreshCw,
  Check,
  X,
  TrendingUp,
  Minus,
  Volume2,
  BellRing,
  Zap,
  Info,
  Sparkles,
  Clock,
  MessageCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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
    recommendations,
    loading,
    error,
    refresh,
    markFollowed,
    markDismissed,
  } = useEnergyOrientation(user?.id);

  const [testingSound, setTestingSound] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

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
            <Zap className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Energy Score</h1>
            <button
              onClick={() => setShowInfo(true)}
              className="w-6 h-6 rounded-full bg-muted flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
              aria-label="Info Energy Score"
            >
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
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

      {/* Info Modal */}
      {showInfo && <EnergyScoreInfoModal onClose={() => setShowInfo(false)} />}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Energy Score Card */}
      {user?.id && <ScientificEnergyCard userId={user.id} />}

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
      {!user?.id && !error && !loading && (
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <Zap className="h-10 w-10 mx-auto text-muted-foreground" />
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
        Vector calcola il tuo Energy Score in tempo reale combinando dati scientifici, check-in e wearable per guidarti su cosa fare, quando e con quale intensita.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Energy Score Info Modal
// ---------------------------------------------------------------------------

function EnergyScoreInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">Cos'e l'Energy Score?</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1" aria-label="Chiudi">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          L'Energy Score e un punteggio da <strong>0 a 100</strong> che rappresenta il tuo livello energetico complessivo in tempo reale. Sostituisce la semplice percezione soggettiva con un calcolo scientifico basato su dati reali.
        </p>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Come viene calcolato</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            E la somma di 4 componenti (0-25 ciascuna), basate su modelli scientifici validati:
          </p>
          <div className="space-y-2">
            {[
              { color: '#6366f1', name: 'Ritmo circadiano', desc: 'Orologio biologico, cronotipo, ore sveglio, pasti' },
              { color: '#8b5cf6', name: 'Sonno', desc: 'Qualita, durata, debito cumulativo, dati wearable' },
              { color: '#22c55e', name: 'Stile di vita', desc: 'Idratazione, caffeina, pasti, attivita, screen time' },
              { color: '#f59e0b', name: 'Carico allostatico', desc: 'Stress, lavoro, umore, HRV, rischio burnout' },
            ].map(c => (
              <div key={c.name} className="flex items-start gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-1" style={{ backgroundColor: c.color }} />
                <div>
                  <span className="text-xs font-semibold">{c.name}</span>
                  <span className="text-xs text-muted-foreground"> — {c.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Cosa include</h4>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <span><strong>Fattori</strong> — idratazione, caffeina, sonno, pasti e dati wearable Sahha</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <span><strong>Punto debole</strong> — identifica il fattore critico e ti dice cosa fare</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <span><strong>Curva predittiva</strong> — proietta la tua energia nelle prossime 12 ore</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <span><strong>Spiegazione</strong> — perche hai quel punteggio, componente per componente</span>
            </li>
          </ul>
        </div>

        <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Piu dati registri (check-in, energy log, wearable), piu il punteggio diventa preciso. Tutti i calcoli avvengono in locale sul tuo dispositivo.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Ho capito
        </button>
      </div>
    </div>
  );
}
