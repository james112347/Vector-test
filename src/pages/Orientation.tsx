import { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuthState } from '../contexts/AuthContext';
import { useEnergyOrientation } from '../lib/useEnergyOrientation';
import { playSuggestionSound, playAlertSound } from '../lib/energy-orientation';
import ScientificEnergyCard from '../components/ScientificEnergyCard';
import {
  RefreshCw,
  X,
  Volume2,
  BellRing,
  Zap,
  Info,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function Orientation() {
  const { user } = useAuthState();
  const {
    result,
    loading,
    error,
    refresh,
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

      {/* Energy Score Card — contiene Fattori, Analisi IA e Consigli nella toolbar */}
      {user?.id && <ScientificEnergyCard userId={user.id} />}

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
