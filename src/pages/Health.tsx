import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuthState } from '../contexts/AuthContext';
import {
  getSahhaProfile,
  connectSahha,
  disconnectSahha,
  syncAll,
  getCachedScores,
  getCachedBiomarkers,
  getScoreHistory,
  isSahhaAvailable,
} from '../lib/sahha-data';
import { getDemoScores, getDemoBiomarkers } from '../lib/sahha-demo';
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
  FlaskConical,
  TrendingUp,
  ChevronLeft,
  Calendar,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// ScoreCard
// ---------------------------------------------------------------------------

function ScoreCard({
  score,
  onTap,
}: {
  score: SahhaScoreLog;
  onTap?: () => void;
}) {
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
    <Card
      className={onTap ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}
      onClick={onTap}
    >
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
          {onTap && (
            <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ScoreHistory — mini sparkline of score over time
// ---------------------------------------------------------------------------

function ScoreHistory({
  history,
  type,
  onBack,
}: {
  history: SahhaScoreLog[];
  type: string;
  onBack: () => void;
}) {
  const labelMap: Record<string, string> = {
    activity: 'Attivita',
    sleep: 'Sonno',
    wellbeing: 'Benessere',
    readiness: 'Prontezza',
    mental_wellbeing: 'Mente',
  };
  const colorMap: Record<string, string> = {
    activity: '#3b82f6',
    sleep: '#8b5cf6',
    wellbeing: '#22c55e',
    readiness: '#f59e0b',
    mental_wellbeing: '#ec4899',
  };

  const label = labelMap[type] || type;
  const color = colorMap[type] || '#6b7280';

  // Group by date, take most recent per day
  const byDay = new Map<string, SahhaScoreLog>();
  for (const s of history) {
    const day = s.scoreDateTime.slice(0, 10);
    const existing = byDay.get(day);
    if (!existing || s.scoreDateTime > existing.scoreDateTime) {
      byDay.set(day, s);
    }
  }
  const daily = Array.from(byDay.values()).sort((a, b) =>
    a.scoreDateTime.localeCompare(b.scoreDateTime),
  );

  const maxH = 120;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-base font-semibold">Storico {label}</h2>
      </div>

      {daily.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Nessuno storico disponibile.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-4">
            {/* Simple bar chart */}
            <div className="flex items-end gap-1 h-[140px]">
              {daily.map((s) => {
                const pct = Math.round(s.score * 100);
                const barH = Math.max(4, (pct / 100) * maxH);
                return (
                  <div
                    key={s.scoreDateTime}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {pct}
                    </span>
                    <div
                      className="w-full rounded-t-sm transition-all"
                      style={{
                        height: barH,
                        backgroundColor: color,
                        opacity: 0.8,
                      }}
                    />
                    <span className="text-[9px] text-muted-foreground">
                      {new Date(s.scoreDateTime).toLocaleDateString('it-IT', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Stats */}
            {daily.length > 1 && (
              <div className="flex justify-between mt-4 pt-3 border-t text-xs text-muted-foreground">
                <span>
                  Media:{' '}
                  <strong className="text-foreground">
                    {Math.round(
                      (daily.reduce((sum, s) => sum + s.score, 0) / daily.length) * 100,
                    )}
                    %
                  </strong>
                </span>
                <span>
                  Min:{' '}
                  <strong className="text-foreground">
                    {Math.round(Math.min(...daily.map((s) => s.score)) * 100)}%
                  </strong>
                </span>
                <span>
                  Max:{' '}
                  <strong className="text-foreground">
                    {Math.round(Math.max(...daily.map((s) => s.score)) * 100)}%
                  </strong>
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Individual entries */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Dettaglio giornaliero</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {daily.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">Nessun dato.</p>
          )}
          {daily
            .slice()
            .reverse()
            .map((s) => (
              <div
                key={s.scoreDateTime}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">
                    {new Date(s.scoreDateTime).toLocaleDateString('it-IT', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${scoreStateColor(s.state)}`}>
                    {scoreStateLabel(s.state)}
                  </span>
                  <span className="text-sm font-bold tabular-nums">
                    {Math.round(s.score * 100)}%
                  </span>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BiomarkerRow
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main Health page
// ---------------------------------------------------------------------------

export default function Health() {
  const { user } = useAuthState();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [demo, setDemo] = useState(false);
  const [scores, setScores] = useState<SahhaScoreLog[]>([]);
  const [biomarkers, setBiomarkers] = useState<SahhaBiomarkerLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyType, setHistoryType] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<SahhaScoreLog[]>([]);

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
      // Initial sync — 30 days of history
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
    setHistoryType(null);
  };

  const handleSync = async () => {
    if (!user?.id) return;
    setSyncing(true);
    setError(null);
    try {
      const { scores: s, biomarkers: b } = await syncAll(user.id, 30);
      setScores(s);
      setBiomarkers(b);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  };

  const handleDemo = () => {
    if (!user?.id) return;
    setScores(getDemoScores(user.id));
    setBiomarkers(getDemoBiomarkers(user.id));
    setDemo(true);
    setConnected(true);
    setLoading(false);
  };

  const exitDemo = () => {
    setDemo(false);
    setConnected(false);
    setScores([]);
    setBiomarkers([]);
    setHistoryType(null);
  };

  const openHistory = async (type: string) => {
    if (demo) {
      // Show demo score as single-day history
      const demoHistory = scores.filter((s) => s.type === type);
      setHistoryData(demoHistory);
      setHistoryType(type);
      return;
    }
    if (!user?.id) return;
    const history = await getScoreHistory(user.id, type);
    setHistoryData(history);
    setHistoryType(type);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        <p className="text-muted-foreground text-sm mt-2">Caricamento...</p>
      </div>
    );
  }

  // History detail view
  if (historyType) {
    return (
      <div className="space-y-4 pb-24">
        <ScoreHistory
          history={historyData}
          type={historyType}
          onBack={() => setHistoryType(null)}
        />
      </div>
    );
  }

  // No Sahha auth available and not in demo mode
  if (!isSahhaAvailable && !demo) {
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
              Configura le credenziali Sahha per abilitare l'integrazione wearable.
            </p>
            <p className="text-xs text-muted-foreground">
              Imposta VITE_SAHHA_CLIENT_ID e VITE_SAHHA_CLIENT_SECRET nel file .env
            </p>
            <Button variant="outline" size="sm" onClick={handleDemo}>
              <FlaskConical className="h-4 w-4 mr-2" />
              Prova con dati demo
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Latest score per type for the overview
  const latestByType: Record<string, SahhaScoreLog> = {};
  for (const s of scores) {
    const existing = latestByType[s.type];
    if (!existing || s.scoreDateTime > existing.scoreDateTime) {
      latestByType[s.type] = s;
    }
  }
  const latestScores = Object.values(latestByType);

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
        {connected && !demo && (
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
            <div className="flex flex-col gap-2 items-center">
              <Button onClick={handleConnect}>
                <Watch className="h-4 w-4 mr-2" />
                Collega Sahha
              </Button>
              <Button variant="outline" size="sm" onClick={handleDemo}>
                <FlaskConical className="h-4 w-4 mr-2" />
                Prova con dati demo
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {demo && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 flex items-center gap-3">
              <FlaskConical className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Modalita demo</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Dati di esempio — collega un dispositivo per dati reali.
                </p>
              </div>
            </div>
          )}

          {/* Sync info */}
          {!demo && scores.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {scores.length} score, {biomarkers.length} biomarker — ultimi 30 giorni
              </span>
            </div>
          )}

          {/* Health Scores */}
          {latestScores.length > 0 ? (
            <div>
              <h2 className="text-base font-semibold mb-3">Score di salute</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {latestScores.map((s) => (
                  <ScoreCard
                    key={s.type}
                    score={s}
                    onTap={() => openHistory(s.type)}
                  />
                ))}
              </div>
              {!demo && (
                <p className="text-xs text-muted-foreground mt-2">
                  Tocca uno score per vedere lo storico
                </p>
              )}
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

          {/* Disconnect / Exit demo */}
          <div className="pt-2">
            {demo ? (
              <Button variant="outline" size="sm" onClick={exitDemo}>
                <FlaskConical className="h-4 w-4 mr-2" />
                Esci dalla demo
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
              >
                <Unplug className="h-4 w-4 mr-2" />
                Disconnetti Sahha
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
