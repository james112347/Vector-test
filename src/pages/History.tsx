import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuthState } from '../contexts/AuthContext';
import { getAllLogs, deleteEnergyLog } from '../lib/energy';
import { useUserProfile } from '../lib/useUserProfile';
import {
  isAIAvailable,
  generateWeeklyAnalysis,
  getCachedWeeklyAnalysis,
  cacheWeeklyAnalysis,
  type AIWeeklyAnalysis,
} from '../lib/ai';
import type { EnergyLog } from '../db/schema';

function EnergyBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${value * 10}%` }}
        />
      </div>
      <span className="text-xs font-medium w-5 text-right">{value}</span>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (dateStr === today.toISOString().slice(0, 10)) return 'Oggi';
  if (dateStr === yesterday.toISOString().slice(0, 10)) return 'Ieri';

  return date.toLocaleDateString('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export default function History() {
  const { user } = useAuthState();
  const { profile } = useUserProfile(user?.id);
  const [logs, setLogs] = useState<EnergyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [weeklyAnalysis, setWeeklyAnalysis] = useState<AIWeeklyAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const loadLogs = async () => {
    if (!user?.id) return;
    const all = await getAllLogs(user.id);
    setLogs(all);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { loadLogs(); }, [user?.id]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const loadWeeklyAnalysis = useCallback(async () => {
    if (!isAIAvailable() || !profile?.name || logs.length < 3) return;
    const latestDate = logs[0]?.date || '';
    const cached = getCachedWeeklyAnalysis(logs.length, latestDate);
    if (cached) { setWeeklyAnalysis(cached); return; }
    setAiLoading(true);
    try {
      // Use last 7 logs for analysis
      const recentLogs = logs.slice(0, 7).reverse();
      const result = await generateWeeklyAnalysis(recentLogs, profile.name);
      setWeeklyAnalysis(result);
      cacheWeeklyAnalysis(result, logs.length, latestDate);
    } catch { /* ignore */ }
    setAiLoading(false);
  }, [logs, profile?.name]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!loading && logs.length >= 3) loadWeeklyAnalysis();
  }, [loading, logs.length, loadWeeklyAnalysis]);

  const handleDelete = async (logId: number) => {
    await deleteEnergyLog(logId);
    setConfirmDelete(null);
    await loadLogs();
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-sm">Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold">Storico</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {logs.length > 0 ? `${logs.length} registrazioni` : 'Nessuna registrazione'}
        </p>
      </div>

      {/* AI Weekly Analysis */}
      {isAIAvailable() && logs.length >= 3 && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
                </svg>
                Analisi settimanale IA
              </CardTitle>
              {!aiLoading && weeklyAnalysis && (
                <button onClick={loadWeeklyAnalysis} className="text-xs text-primary hover:underline">
                  Aggiorna
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {aiLoading && (
              <div className="py-3 text-center">
                <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-xs text-muted-foreground mt-1">Analisi in corso...</p>
              </div>
            )}
            {weeklyAnalysis && !aiLoading && (
              <div className="space-y-3">
                {/* Summary + Trend */}
                <div className="flex items-start gap-2">
                  <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    weeklyAnalysis.trend === 'up' ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : weeklyAnalysis.trend === 'down' ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}>
                    {weeklyAnalysis.trend === 'up' ? 'In salita' : weeklyAnalysis.trend === 'down' ? 'In calo' : 'Stabile'}
                  </span>
                  <p className="text-xs">{weeklyAnalysis.weekSummary}</p>
                </div>

                {/* Best & worst day */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-green-500/10 p-2.5">
                    <p className="text-[10px] font-semibold text-green-600 dark:text-green-400">Giorno migliore</p>
                    <p className="text-xs mt-0.5">{weeklyAnalysis.bestDay}</p>
                  </div>
                  <div className="rounded-lg bg-red-500/10 p-2.5">
                    <p className="text-[10px] font-semibold text-red-600 dark:text-red-400">Giorno peggiore</p>
                    <p className="text-xs mt-0.5">{weeklyAnalysis.worstDay}</p>
                  </div>
                </div>

                {/* Prediction (AI-03) */}
                <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-2.5">
                  <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">Previsione</p>
                  <p className="text-xs mt-0.5">{weeklyAnalysis.prediction}</p>
                </div>

                {/* Fatigue type (AI-07) */}
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5">
                  <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">Tipo di fatica</p>
                  <p className="text-xs mt-0.5">{weeklyAnalysis.fatigueType}</p>
                </div>

                {/* Weekly advice */}
                <div className="rounded-lg bg-primary/10 border border-primary/20 p-2.5">
                  <p className="text-[10px] font-semibold text-primary">Consiglio della settimana</p>
                  <p className="text-xs mt-0.5">{weeklyAnalysis.advice}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Non hai ancora registrato la tua energia.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Vai su "Registra" per iniziare.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {logs.map(log => {
            const avg = Math.round(((log.physical + log.mental + log.emotional) / 3) * 10) / 10;
            return (
              <Card key={log.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>{formatDate(log.date)}</span>
                    <span className={`text-base font-bold ${
                      avg >= 7 ? 'text-green-600 dark:text-green-400' :
                      avg >= 4 ? 'text-amber-600 dark:text-amber-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>
                      {avg}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-14">Fisica</span>
                      <EnergyBar value={log.physical} color="bg-blue-500" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-14">Mentale</span>
                      <EnergyBar value={log.mental} color="bg-green-500" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-14">Emotiva</span>
                      <EnergyBar value={log.emotional} color="bg-amber-500" />
                    </div>
                  </div>

                  {log.notes && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      "{log.notes}"
                    </p>
                  )}

                  {confirmDelete === log.id ? (
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8 flex-1 text-xs"
                        onClick={() => handleDelete(log.id!)}
                      >
                        Conferma
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 flex-1 text-xs"
                        onClick={() => setConfirmDelete(null)}
                      >
                        Annulla
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-muted-foreground w-full"
                      onClick={() => setConfirmDelete(log.id!)}
                    >
                      Elimina
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
