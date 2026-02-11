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
  ChevronRight,
  Calendar,
  Smartphone,
  CheckCircle2,
  Circle,
  Apple,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SetupStep = 'choose_platform' | 'ios_guide' | 'android_guide' | 'waiting';

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
// ScoreHistory
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
                      style={{ height: barH, backgroundColor: color, opacity: 0.8 }}
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
            {daily.length > 1 && (
              <div className="flex justify-between mt-4 pt-3 border-t text-xs text-muted-foreground">
                <span>
                  Media:{' '}
                  <strong className="text-foreground">
                    {Math.round(
                      (daily.reduce((sum, s) => sum + s.score, 0) / daily.length) * 100,
                    )}%
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
// Setup step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ step, total, current }: { step: number; total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-1.5">
          {i + 1 < current ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : i + 1 === current ? (
            <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center">
              <span className="text-[10px] font-bold text-primary-foreground">{step}</span>
            </div>
          ) : (
            <Circle className="h-4 w-4 text-muted-foreground/40" />
          )}
          {i < total - 1 && (
            <div className={`w-6 h-0.5 ${i + 1 < current ? 'bg-green-500' : 'bg-muted'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Setup wizard
// ---------------------------------------------------------------------------

function SetupWizard({
  step,
  onSelectPlatform,
  onConnect,
  onBack,
  connecting,
  error,
}: {
  step: SetupStep;
  onSelectPlatform: (platform: 'ios' | 'android') => void;
  onConnect: () => void;
  onBack: () => void;
  connecting: boolean;
  error: string | null;
}) {
  if (step === 'choose_platform') {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <StepIndicator step={1} total={3} current={1} />
        </div>
        <h2 className="text-lg font-semibold text-center">Che telefono usi?</h2>
        <p className="text-sm text-muted-foreground text-center">
          I dati del tuo wearable passano attraverso il telefono.
          Scegli la tua piattaforma per vedere le istruzioni.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Card
            className="cursor-pointer hover:border-primary active:scale-[0.98] transition-all"
            onClick={() => onSelectPlatform('ios')}
          >
            <CardContent className="py-6 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-xl bg-black text-white flex items-center justify-center">
                <Apple className="h-7 w-7" />
              </div>
              <div>
                <p className="font-semibold text-sm">iPhone</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Apple Watch, Oura, Garmin, Whoop
                </p>
              </div>
              <ChevronRight className="h-4 w-4 mx-auto text-muted-foreground" />
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-primary active:scale-[0.98] transition-all"
            onClick={() => onSelectPlatform('android')}
          >
            <CardContent className="py-6 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-xl bg-green-600 text-white flex items-center justify-center">
                <Smartphone className="h-7 w-7" />
              </div>
              <div>
                <p className="font-semibold text-sm">Android</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Fitbit, Samsung, Garmin, Oura, Whoop
                </p>
              </div>
              <ChevronRight className="h-4 w-4 mx-auto text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === 'ios_guide') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <StepIndicator step={2} total={3} current={2} />
          <div className="w-8" />
        </div>

        <h2 className="text-lg font-semibold">Configura su iPhone</h2>

        <Card>
          <CardContent className="py-4 space-y-4">
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">1</div>
              <div>
                <p className="text-sm font-medium">Collega il tuo wearable ad Apple Health</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sul tuo iPhone: Impostazioni → Salute → Origini dati.
                  Verifica che il tuo dispositivo (Apple Watch, Oura, Garmin, Whoop) sia connesso.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">2</div>
              <div>
                <p className="text-sm font-medium">Installa l'app Sahha</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cerca "Sahha" nell'App Store e installala. L'app legge i dati da Apple Health
                  in background e li sincronizza automaticamente.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">3</div>
              <div>
                <p className="text-sm font-medium">Autorizza l'accesso ai dati</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Quando l'app Sahha chiede l'accesso ad Apple Health, autorizza tutte le categorie
                  (attivita, sonno, frequenza cardiaca, ecc.). Fino a 30 giorni di storico
                  vengono importati automaticamente.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>Dispositivi supportati via Apple Health:</strong> Apple Watch, Oura Ring,
            Garmin, Whoop, Withings, Polar, Amazfit, e tutti i dispositivi che
            sincronizzano con Apple Health.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <Button className="w-full" onClick={onConnect} disabled={connecting}>
          {connecting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-2" />
          )}
          Ho configurato, collega il mio profilo
        </Button>
      </div>
    );
  }

  if (step === 'android_guide') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <StepIndicator step={2} total={3} current={2} />
          <div className="w-8" />
        </div>

        <h2 className="text-lg font-semibold">Configura su Android</h2>

        <Card>
          <CardContent className="py-4 space-y-4">
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">1</div>
              <div>
                <p className="text-sm font-medium">Installa Health Connect</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cerca "Health Connect di Google" nel Play Store. Su Android 14+
                  e gia integrato nelle Impostazioni.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">2</div>
              <div>
                <p className="text-sm font-medium">Collega il tuo wearable a Health Connect</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Apri l'app del tuo wearable (Fitbit, Garmin Connect, Samsung Health, Oura, ecc.).
                  Nelle impostazioni, attiva la sincronizzazione con Health Connect.
                  Fino a 30 giorni di dati verranno copiati.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">3</div>
              <div>
                <p className="text-sm font-medium">Installa l'app Sahha</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cerca "Sahha" nel Play Store e installala. L'app legge i dati da Health Connect
                  in background e li sincronizza con Vector automaticamente.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">4</div>
              <div>
                <p className="text-sm font-medium">Autorizza l'accesso</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Quando Sahha chiede l'accesso a Health Connect, autorizza tutte le
                  categorie per un'analisi completa.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3">
          <p className="text-xs text-green-700 dark:text-green-300">
            <strong>Dispositivi supportati via Health Connect:</strong> Fitbit, Samsung Galaxy Watch,
            Garmin, Oura Ring, Whoop, Withings, Polar, Amazfit, Xiaomi, Huawei,
            e tutti i dispositivi che sincronizzano con Health Connect.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <Button className="w-full" onClick={onConnect} disabled={connecting}>
          {connecting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-2" />
          )}
          Ho configurato, collega il mio profilo
        </Button>
      </div>
    );
  }

  // waiting step
  return (
    <div className="space-y-4">
      <div className="text-center">
        <StepIndicator step={3} total={3} current={3} />
      </div>

      <Card>
        <CardContent className="py-8 text-center space-y-4">
          <div className="relative mx-auto w-16 h-16">
            <Watch className="h-16 w-16 text-primary/20" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          </div>
          <div>
            <h2 className="font-semibold text-lg">Profilo collegato!</h2>
            <p className="text-sm text-muted-foreground mt-1">
              In attesa dei dati dal tuo dispositivo. I dati appariranno
              automaticamente dopo la prima sincronizzazione dall'app Sahha.
            </p>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>La prima sincronizzazione puo richiedere qualche minuto.</p>
            <p>Fino a 30 giorni di storico vengono importati automaticamente.</p>
          </div>
        </CardContent>
      </Card>
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
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyType, setHistoryType] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<SahhaScoreLog[]>([]);
  const [setupStep, setSetupStep] = useState<SetupStep | null>(null);

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
    setConnecting(true);
    setError(null);
    try {
      await connectSahha(user.id);
      setConnected(true);
      setSetupStep('waiting');
      // Try initial sync
      const { scores: s, biomarkers: b } = await syncAll(user.id, 30);
      setScores(s);
      setBiomarkers(b);
      if (s.length > 0 || b.length > 0) {
        setSetupStep(null); // Data available, go to dashboard
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user?.id) return;
    await disconnectSahha(user.id);
    setConnected(false);
    setScores([]);
    setBiomarkers([]);
    setHistoryType(null);
    setSetupStep(null);
  };

  const handleSync = async () => {
    if (!user?.id) return;
    setSyncing(true);
    setError(null);
    try {
      const { scores: s, biomarkers: b } = await syncAll(user.id, 30);
      setScores(s);
      setBiomarkers(b);
      if (setupStep === 'waiting' && (s.length > 0 || b.length > 0)) {
        setSetupStep(null);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const handleDemo = () => {
    if (!user?.id) return;
    setScores(getDemoScores(user.id));
    setBiomarkers(getDemoBiomarkers(user.id));
    setDemo(true);
    setConnected(true);
    setSetupStep(null);
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

  // Setup wizard active
  if (setupStep) {
    return (
      <div className="space-y-4 pb-24">
        <div>
          <h1 className="text-2xl font-bold">Salute</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Configura il tuo dispositivo wearable
          </p>
        </div>
        <SetupWizard
          step={setupStep}
          onSelectPlatform={(platform) =>
            setSetupStep(platform === 'ios' ? 'ios_guide' : 'android_guide')
          }
          onConnect={handleConnect}
          onBack={() => setSetupStep('choose_platform')}
          connecting={connecting}
          error={error}
        />
        {setupStep === 'waiting' && (
          <div className="flex flex-col items-center gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              Controlla dati
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSetupStep(null)}
              className="text-muted-foreground"
            >
              Vai alla dashboard
            </Button>
          </div>
        )}
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

  // Latest score per type for overview
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

  // Not connected — show connection landing
  if (!connected && !demo) {
    return (
      <div className="space-y-4 pb-24">
        <div>
          <h1 className="text-2xl font-bold">Salute</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Dati da dispositivi wearable
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <Watch className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h2 className="font-semibold text-lg">Collega il tuo smartwatch</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Importa automaticamente dati da 300+ dispositivi wearable
                tramite Apple Health o Health Connect.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground max-w-xs mx-auto">
              <span className="px-2 py-1.5 rounded-lg bg-muted text-center">Apple Watch</span>
              <span className="px-2 py-1.5 rounded-lg bg-muted text-center">Fitbit</span>
              <span className="px-2 py-1.5 rounded-lg bg-muted text-center">Garmin</span>
              <span className="px-2 py-1.5 rounded-lg bg-muted text-center">Oura</span>
              <span className="px-2 py-1.5 rounded-lg bg-muted text-center">Whoop</span>
              <span className="px-2 py-1.5 rounded-lg bg-muted text-center">Samsung</span>
            </div>

            <div className="flex flex-col gap-2 items-center pt-2">
              <Button onClick={() => setSetupStep('choose_platform')} className="w-full max-w-xs">
                <Watch className="h-4 w-4 mr-2" />
                Configura dispositivo
              </Button>
              <Button variant="outline" size="sm" onClick={handleDemo}>
                <FlaskConical className="h-4 w-4 mr-2" />
                Prova con dati demo
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <h3 className="text-sm font-semibold mb-2">Come funziona</h3>
            <div className="space-y-3 text-xs text-muted-foreground">
              <div className="flex gap-2">
                <Watch className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-foreground">Wearable</strong> — Il tuo smartwatch raccoglie dati
                  (passi, sonno, frequenza cardiaca, HRV, SpO2...)
                </span>
              </div>
              <div className="flex gap-2">
                <Smartphone className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-foreground">Telefono</strong> — I dati vengono sincronizzati
                  con Apple Health (iPhone) o Health Connect (Android)
                </span>
              </div>
              <div className="flex gap-2">
                <RefreshCw className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-foreground">Sahha</strong> — L'app Sahha legge i dati dal telefono
                  e li sincronizza automaticamente con Vector
                </span>
              </div>
              <div className="flex gap-2">
                <TrendingUp className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-foreground">Vector</strong> — Analizza i tuoi dati con algoritmi
                  avanzati per darti insight personalizzati su salute e benessere
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Connected — show dashboard
  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Salute</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Dati da dispositivi wearable
          </p>
        </div>
        {!demo && (
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
          <CardContent className="py-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Nessuno score disponibile ancora.
            </p>
            <p className="text-xs text-muted-foreground">
              I dati appariranno dopo la prima sincronizzazione dall'app Sahha sul tuo telefono.
            </p>
            {!demo && (
              <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                Controlla adesso
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Biomarkers by Category */}
      {Object.keys(biomarkersByCategory).length > 0 &&
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
        ))}

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
            Disconnetti
          </Button>
        )}
      </div>
    </div>
  );
}
