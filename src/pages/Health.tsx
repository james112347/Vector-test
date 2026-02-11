import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuthState } from '../contexts/AuthContext';
import { isSupabaseEnabled } from '../lib/supabase';
import {
  getSahhaProfile,
  connectSahha,
  disconnectSahha,
  syncScores,
  syncBiomarkers,
  getCachedScores,
  getCachedBiomarkers,
} from '../lib/sahha-data';
import { scoreStateLabel, scoreStateColor } from '../lib/sahha';
import type { SahhaScoreLog, SahhaBiomarkerLog } from '../db/schema';
import {
  Activity,
  Moon,
  Heart,
  Zap,
  Brain,
  Watch,
  RefreshCw,
  Unplug,
  Loader2,
} from 'lucide-react';

function ScoreCard({ score }: { score: SahhaScoreLog }) {
  const percentage = Math.round(score.score * 100);
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  const iconMap: Record<string, typeof Activity> = {
    activity: Activity,
    sleep: Moon,
    wellbeing: Heart,
    readiness: Zap,
    mental_wellbeing: Brain,
  };
  const colorMap: Record<string, string> = {
    activity: '#3b82f6',
    sleep: '#8b5cf6',
    wellbeing: '#22c55e',
    readiness: '#f59e0b',
    mental_wellbeing: '#ec4899',
  };
  const labelMap: Record<string, string> = {
    activity: 'Attivita',
    sleep: 'Sonno',
    wellbeing: 'Benessere',
    readiness: 'Prontezza',
    mental_wellbeing: 'Mente',
  };

  const Icon = iconMap[score.type] || Activity;
  const color = colorMap[score.type] || '#6b7280';
  const label = labelMap[score.type] || score.type;

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20 shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle
                cx="40" cy="40" r={radius}
                fill="none" stroke="currentColor"
                className="text-muted" strokeWidth="6"
              />
              <circle
                cx="40" cy="40" r={radius}
                fill="none" stroke={color}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="transition-all duration-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
              {percentage}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="h-4 w-4" style={{ color }} />
              <span className="font-semibold text-sm">{label}</span>
            </div>
            <span className={`text-sm font-medium ${scoreStateColor(score.state)}`}>
              {scoreStateLabel(score.state)}
            </span>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(score.scoreDateTime).toLocaleDateString('it-IT', {
                day: 'numeric',
                month: 'short',
              })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BiomarkerRow({ biomarker }: { biomarker: SahhaBiomarkerLog }) {
  const labelMap: Record<string, string> = {
    steps: 'Passi',
    heart_rate_resting: 'FC a riposo',
    heart_rate_variability_sdnn: 'HRV (SDNN)',
    sleep_duration: 'Durata sonno',
    active_energy_burned: 'Calorie attive',
    total_energy_burned: 'Calorie totali',
    floors_climbed: 'Piani saliti',
    active_hours: 'Ore attive',
    oxygen_saturation: 'SpO2',
    respiratory_rate: 'Freq. respiratoria',
    vo2_max: 'VO2 Max',
    sleep_rem_duration: 'Sonno REM',
    sleep_deep_duration: 'Sonno profondo',
    sleep_light_duration: 'Sonno leggero',
    weight: 'Peso',
    body_mass_index: 'BMI',
  };

  const unitMap: Record<string, string> = {
    count: '',
    bpm: 'bpm',
    ms: 'ms',
    min: 'min',
    kcal: 'kcal',
    '%': '%',
    'mL/kg/min': 'mL/kg/min',
    kg: 'kg',
    'kg/m2': '',
  };

  const displayName = labelMap[biomarker.type] || biomarker.type.replaceAll('_', ' ');
  const displayUnit = unitMap[biomarker.unit] ?? biomarker.unit ?? '';
  const numValue = parseFloat(biomarker.value);
  const displayValue = Number.isFinite(numValue)
    ? numValue % 1 === 0
      ? numValue.toLocaleString('it-IT')
      : numValue.toFixed(1)
    : biomarker.value;

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-foreground">{displayName}</span>
      <span className="text-sm font-medium tabular-nums">
        {displayValue}
        {displayUnit && (
          <span className="text-muted-foreground ml-1 text-xs">{displayUnit}</span>
        )}
      </span>
    </div>
  );
}

export default function Health() {
  const { user } = useAuthState();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [scores, setScores] = useState<SahhaScoreLog[]>([]);
  const [biomarkers, setBiomarkers] = useState<SahhaBiomarkerLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const profile = await getSahhaProfile(user.id);
      setConnected(!!profile);
      if (profile) {
        const [s, b] = await Promise.all([
          getCachedScores(user.id),
          getCachedBiomarkers(user.id),
        ]);
        setScores(s);
        setBiomarkers(b);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConnect = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      await connectSahha(user.id);
      setConnected(true);
      // Initial sync
      await handleSync();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user?.id) return;
    await disconnectSahha(user.id);
    setConnected(false);
    setScores([]);
    setBiomarkers([]);
  };

  const handleSync = async () => {
    if (!user?.id) return;
    setSyncing(true);
    setError(null);
    try {
      const [s, b] = await Promise.all([
        syncScores(user.id),
        syncBiomarkers(user.id),
      ]);
      setScores(s);
      setBiomarkers(b);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        <p className="text-muted-foreground text-sm mt-2">Caricamento...</p>
      </div>
    );
  }

  if (!isSupabaseEnabled) {
    return (
      <div className="space-y-4 pb-24">
        <div>
          <h1 className="text-2xl font-bold">Salute</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Dati da dispositivi wearable
          </p>
        </div>
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <Watch className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Configura Supabase per abilitare l'integrazione con i dispositivi wearable.
            </p>
            <p className="text-xs text-muted-foreground">
              Imposta VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nel file .env
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Group biomarkers by category
  const biomarkersByCategory = biomarkers.reduce<Record<string, SahhaBiomarkerLog[]>>(
    (acc, b) => {
      const cat = b.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(b);
      return acc;
    },
    {},
  );

  const categoryLabels: Record<string, string> = {
    activity: 'Attivita',
    sleep: 'Sonno',
    vitals: 'Parametri vitali',
    body: 'Corpo',
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Salute</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Dati da dispositivi wearable
          </p>
        </div>
        {connected && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {!connected ? (
        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <Watch className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h2 className="font-semibold text-lg">Collega i tuoi dispositivi</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Connetti Sahha per importare dati da Fitbit, Garmin, Apple Watch,
                Oura, Whoop e altri 300+ dispositivi.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
              <span className="px-2 py-1 rounded-full bg-muted">Fitbit</span>
              <span className="px-2 py-1 rounded-full bg-muted">Garmin</span>
              <span className="px-2 py-1 rounded-full bg-muted">Apple Watch</span>
              <span className="px-2 py-1 rounded-full bg-muted">Oura</span>
              <span className="px-2 py-1 rounded-full bg-muted">Whoop</span>
              <span className="px-2 py-1 rounded-full bg-muted">Samsung</span>
            </div>
            <Button onClick={handleConnect}>
              <Watch className="h-4 w-4 mr-2" />
              Collega Sahha
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Health Scores */}
          {scores.length > 0 ? (
            <div>
              <h2 className="text-base font-semibold mb-3">Score di salute</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {scores.map((s, i) => (
                  <ScoreCard key={`${s.type}-${i}`} score={s} />
                ))}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Nessuno score disponibile. I dati appariranno dopo la prima sincronizzazione dal dispositivo.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Biomarkers by Category */}
          {Object.keys(biomarkersByCategory).length > 0 ? (
            Object.entries(biomarkersByCategory).map(([category, items]) => (
              <Card key={category}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {categoryLabels[category] || category}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {items.map((b, i) => (
                    <BiomarkerRow key={`${b.type}-${i}`} biomarker={b} />
                  ))}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Nessun biomarker disponibile. Sincronizza il tuo dispositivo wearable per vedere i dati.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Disconnect */}
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
            >
              <Unplug className="h-4 w-4 mr-2" />
              Disconnetti Sahha
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
