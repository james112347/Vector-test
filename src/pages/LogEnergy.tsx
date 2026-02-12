import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuthState } from '../contexts/AuthContext';
import { saveEnergyLog, getTodayLog, getRecentLogs } from '../lib/energy';
import { useUserProfile } from '../lib/useUserProfile';
import {
  isAIAvailable,
  generateQuickTip,
  getCachedQuickTip,
  cacheQuickTip,
  detectLowEnergy,
  generateLowEnergyAlert,
  getCachedLowEnergyAlert,
  cacheLowEnergyAlert,
  type AIQuickTip,
  type AILowEnergyAlert,
} from '../lib/ai';

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function EnergySlider({
  label,
  value,
  onChange,
  color,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className={`text-lg font-bold ${color}`}>{value}/10</span>
      </div>
      <div className="flex gap-1.5">
        {LEVELS.map(level => (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            className={`flex-1 h-10 rounded-md text-xs font-medium transition-all ${
              level <= value
                ? `${color === 'text-blue-600 dark:text-blue-400'
                    ? 'bg-blue-500 text-white'
                    : color === 'text-green-600 dark:text-green-400'
                    ? 'bg-green-500 text-white'
                    : 'bg-amber-500 text-white'}`
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LogEnergy() {
  const { user } = useAuthState();
  const { profile } = useUserProfile(user?.id);
  const [physical, setPhysical] = useState(5);
  const [mental, setMental] = useState(5);
  const [emotional, setEmotional] = useState(5);
  const [workHoursToday, setWorkHoursToday] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [existingLog, setExistingLog] = useState(false);
  const [yesterdayValues, setYesterdayValues] = useState<{ physical: number; mental: number; emotional: number } | null>(null);
  const [quickTip, setQuickTip] = useState<AIQuickTip | null>(null);
  const [tipLoading, setTipLoading] = useState(false);
  const [lowAlert, setLowAlert] = useState<AILowEnergyAlert | null>(null);
  const [alertDismissed, setAlertDismissed] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    getTodayLog(user.id).then(log => {
      if (log) {
        setPhysical(log.physical);
        setMental(log.mental);
        setEmotional(log.emotional);
        setWorkHoursToday(log.workHoursToday?.toString() || '');
        setNotes(log.notes || '');
        setExistingLog(true);
      }
    });
    // Load yesterday's log for comparison
    getRecentLogs(user.id, 2).then(logs => {
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = logs.find(l => l.date !== today);
      if (yesterday) {
        setYesterdayValues({ physical: yesterday.physical, mental: yesterday.mental, emotional: yesterday.emotional });
      }
    });
  }, [user?.id]);

  const loadQuickTip = useCallback(async () => {
    if (!isAIAvailable() || !profile?.name) return;
    const today = new Date().toISOString().slice(0, 10);
    const cached = getCachedQuickTip(today);
    if (cached) { setQuickTip(cached); return; }
    setTipLoading(true);
    try {
      const tip = await generateQuickTip({ physical, mental, emotional }, yesterdayValues, profile.name);
      setQuickTip(tip);
      cacheQuickTip(tip, today);
    } catch { /* ignore */ }
    setTipLoading(false);
  }, [physical, mental, emotional, yesterdayValues, profile?.name]);

  const loadLowEnergyAlert = useCallback(async () => {
    if (!isAIAvailable() || !profile?.name || alertDismissed) return;
    const todayLog = { physical, mental, emotional, userId: user?.id || 0, date: new Date().toISOString().slice(0, 10), createdAt: new Date(), updatedAt: new Date() };
    if (!detectLowEnergy(todayLog)) { setLowAlert(null); return; }
    const today = new Date().toISOString().slice(0, 10);
    const cached = getCachedLowEnergyAlert(today);
    if (cached) { setLowAlert(cached); return; }
    try {
      const alert = await generateLowEnergyAlert(todayLog, profile.name);
      setLowAlert(alert);
      cacheLowEnergyAlert(alert, today);
    } catch { /* ignore */ }
  }, [physical, mental, emotional, user?.id, profile?.name, alertDismissed]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    await saveEnergyLog(user.id, {
      physical,
      mental,
      emotional,
      workHoursToday: workHoursToday ? parseFloat(workHoursToday) : undefined,
      notes: notes || undefined,
    });
    setSaving(false);
    setSaved(true);
    setExistingLog(true);
    setTimeout(() => setSaved(false), 2000);
    // Generate AI tip after saving
    loadQuickTip();
    loadLowEnergyAlert();
  };

  const avg = Math.round(((physical + mental + emotional) / 3) * 10) / 10;

  const today = new Date().toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold">Registra Energia</h1>
        <p className="text-muted-foreground mt-1 text-sm capitalize">{today}</p>
      </div>

      {/* Average */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Media giornaliera</span>
            <span className={`text-2xl font-bold ${
              avg >= 7 ? 'text-green-600 dark:text-green-400' :
              avg >= 4 ? 'text-amber-600 dark:text-amber-400' :
              'text-red-600 dark:text-red-400'
            }`}>{avg}</span>
          </div>
        </CardContent>
      </Card>

      {/* Energy Inputs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Come ti senti oggi?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <EnergySlider
            label="Energia Fisica"
            value={physical}
            onChange={setPhysical}
            color="text-blue-600 dark:text-blue-400"
          />
          <EnergySlider
            label="Energia Mentale"
            value={mental}
            onChange={setMental}
            color="text-green-600 dark:text-green-400"
          />
          <EnergySlider
            label="Energia Emotiva"
            value={emotional}
            onChange={setEmotional}
            color="text-amber-600 dark:text-amber-400"
          />
        </CardContent>
      </Card>

      {/* Work hours */}
      <Card>
        <CardContent className="pt-5">
          <label className="text-sm font-medium block mb-2">Ore di lavoro/studio oggi</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={16}
              step={0.5}
              value={workHoursToday}
              onChange={(e) => setWorkHoursToday(e.target.value)}
              placeholder="0"
              className="w-24 h-11 rounded-md border border-input bg-background px-3 text-base tabular-nums placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ fontSize: '16px' }}
            />
            <span className="text-sm text-muted-foreground">ore</span>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="pt-5">
          <label className="text-sm font-medium block mb-2">Note (opzionale)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Come è andata la giornata..."
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            style={{ fontSize: '16px' }}
          />
        </CardContent>
      </Card>

      {/* Save */}
      <Button
        className="w-full h-12 text-base"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Salvando...' : saved ? 'Salvato!' : existingLog ? 'Aggiorna' : 'Salva'}
      </Button>

      {existingLog && !saved && (
        <p className="text-xs text-muted-foreground text-center">
          Hai già registrato oggi. Puoi aggiornare i valori.
        </p>
      )}

      {/* Low Energy Alert (AI-04) */}
      {lowAlert && !alertDismissed && (
        <Card className="border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <CardContent className="pt-5 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <h4 className="text-sm font-bold text-red-700 dark:text-red-300">{lowAlert.alertTitle}</h4>
              </div>
              <button onClick={() => setAlertDismissed(true)} className="text-red-400 hover:text-red-600 shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-red-600 dark:text-red-400">{lowAlert.alertBody}</p>
            <div className="rounded-lg bg-white/60 dark:bg-white/5 p-2.5">
              <p className="text-xs font-medium">{lowAlert.urgentAdvice}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Quick Tip */}
      {quickTip && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm flex items-center gap-2">
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
              Insight IA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs">{quickTip.comparison}</p>
            <p className="text-xs font-medium text-primary">{quickTip.encouragement}</p>
            {quickTip.stressType && quickTip.stressType !== 'nessuna' && (
              <p className="text-xs text-muted-foreground">
                Tipo di fatica: <span className="font-medium">{quickTip.stressType}</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* AI Tip Loading */}
      {tipLoading && (
        <div className="flex items-center justify-center gap-2 py-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-xs text-muted-foreground">Analisi IA...</span>
        </div>
      )}

      {/* Yesterday comparison (no AI needed) */}
      {yesterdayValues && existingLog && (
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground mb-2">Confronto con ieri</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              {([
                { label: 'Fisica', today: physical, yesterday: yesterdayValues.physical, color: 'text-blue-600 dark:text-blue-400' },
                { label: 'Mentale', today: mental, yesterday: yesterdayValues.mental, color: 'text-green-600 dark:text-green-400' },
                { label: 'Emotiva', today: emotional, yesterday: yesterdayValues.emotional, color: 'text-amber-600 dark:text-amber-400' },
              ] as const).map(({ label, today, yesterday, color }) => {
                const diff = today - yesterday;
                return (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={`text-sm font-bold ${color}`}>{today}</p>
                    <p className={`text-xs ${diff > 0 ? 'text-green-600 dark:text-green-400' : diff < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                      {diff > 0 ? `+${diff}` : diff === 0 ? '=' : diff}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
