import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuthState } from '../contexts/AuthContext';
import { getTodayLog, getRecentLogs } from '../lib/energy';
import { getCheckinSummaries } from '../lib/checkins';
import { usePendingUsers } from '../lib/usePendingUsers';
import { useUserProfile } from '../lib/useUserProfile';
import { isAIAvailable, generateInsights, getCachedInsights, cacheInsights, type AIAnalysis, type AIContext } from '../lib/ai';
import { getCachedScores, getCachedBiomarkers, getSahhaProfile } from '../lib/sahha-data';
import { getAppSettings } from '../lib/useAppSettings';
import { getUnreadFeedbackCount } from '../lib/feedback';
import { getAllUsers } from '../lib/auth';
import { getAllUserActivity } from '../lib/useActivityTracker';
import QuickCheckins from '../components/QuickCheckins';
import ScreenTimeCard from '../components/ScreenTimeCard';
import SmartHabitPrompt from '../components/SmartHabitPrompt';
import type { EnergyLog, SahhaScoreLog, SahhaBiomarkerLog } from '../db/schema';
import type { DailyCheckinSummary } from '../lib/checkins';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

function EnergyRing({ value, label, color }: { value: number; label: string; color: string }) {
  const percentage = value * 10;
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={radius} fill="none" stroke="currentColor" className="text-muted" strokeWidth="6" />
          <circle
            cx="40" cy="40" r={radius} fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">{value}</span>
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuthState();
  const navigate = useNavigate();
  const pendingCount = usePendingUsers();
  const { profile } = useUserProfile(user?.id);
  const [todayLog, setTodayLog] = useState<EnergyLog | null>(null);
  const [weekLogs, setWeekLogs] = useState<EnergyLog[]>([]);
  const [checkinSummaries, setCheckinSummaries] = useState<DailyCheckinSummary[]>([]);
  const [sahhaScores, setSahhaScores] = useState<SahhaScoreLog[]>([]);
  const [sahhaBiomarkers, setSahhaBiomarkers] = useState<SahhaBiomarkerLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState<AIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  // Admin widget stats
  const [adminStats, setAdminStats] = useState<{
    totalUsers: number;
    approvedUsers: number;
    unreadFeedback: number;
    totalSessions: number;
    activeTodayCount: number;
  } | null>(null);

  const refreshing = useRef(false);

  const loadData = useCallback(async (showLoader = true) => {
    const uid = user?.id;
    if (!uid || refreshing.current) return;
    refreshing.current = true;
    if (showLoader) setLoading(true);
    try {
      const [today, week, summaries] = await Promise.all([
        getTodayLog(uid),
        getRecentLogs(uid, 7),
        getCheckinSummaries(uid, 7),
      ]);
      setTodayLog(today || null);
      setWeekLogs(week);
      setCheckinSummaries(summaries);

      // Load Sahha data if connected
      try {
        const sahhaProfile = await getSahhaProfile(uid);
        if (sahhaProfile) {
          const [scores, biomarkers] = await Promise.all([
            getCachedScores(uid),
            getCachedBiomarkers(uid),
          ]);
          setSahhaScores(scores);
          setSahhaBiomarkers(biomarkers);
        }
      } catch {
        // Sahha not connected, ignore
      }
    } finally {
      refreshing.current = false;
      setLoading(false);
    }
  }, [user?.id]);

  // Initial load
  useEffect(() => { loadData(); }, [loadData]);

  // Load admin widget stats
  useEffect(() => {
    if (!user?.isAdmin) return;
    async function loadAdminStats() {
      try {
        const [allUsers, unread, activity] = await Promise.all([
          getAllUsers(),
          getUnreadFeedbackCount(),
          getAllUserActivity(),
        ]);
        const todayStr = new Date().toISOString().slice(0, 10);
        setAdminStats({
          totalUsers: allUsers.length,
          approvedUsers: allUsers.filter(u => u.isApproved).length,
          unreadFeedback: unread,
          totalSessions: activity.reduce((s, a) => s + a.total_sessions, 0),
          activeTodayCount: activity.filter(a => a.today_date === todayStr && a.today_minutes > 0).length,
        });
      } catch {
        // Non-critical — widgets just won't show
      }
    }
    loadAdminStats();
  }, [user?.isAdmin]);

  // Auto-refresh when app comes back to foreground
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && getAppSettings().autoRefresh) {
        loadData(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadData]);

  const buildAIContext = useCallback((): AIContext | null => {
    if (!profile || weekLogs.length < 2) return null;
    return {
      profile,
      energyLogs: weekLogs,
      checkinSummaries: checkinSummaries.length > 0 ? checkinSummaries : undefined,
      sahhaScores: sahhaScores.length > 0 ? sahhaScores : undefined,
      sahhaBiomarkers: sahhaBiomarkers.length > 0 ? sahhaBiomarkers : undefined,
    };
  }, [profile, weekLogs, checkinSummaries, sahhaScores, sahhaBiomarkers]);

  const loadInsights = useCallback(async () => {
    if (!isAIAvailable()) return;
    const ctx = buildAIContext();
    if (!ctx) return;

    const cached = getCachedInsights(ctx);
    if (cached) {
      setAiInsights(cached);
      return;
    }
    setAiLoading(true);
    setAiError('');
    try {
      const result = await generateInsights(ctx);
      setAiInsights(result);
      cacheInsights(result, ctx);
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setAiLoading(false);
    }
  }, [buildAIContext]);

  useEffect(() => {
    if (!loading && weekLogs.length >= 2 && profile && isAIAvailable()) {
      loadInsights();
    }
  }, [loading, weekLogs.length, profile, loadInsights]);

  const chartData = weekLogs.map(log => {
    const [, , d] = log.date.split('-');
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
    const [y, m, day] = log.date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, day);
    return {
      name: dayNames[dateObj.getDay()] + ' ' + d,
      Fisica: log.physical,
      Mentale: log.mental,
      Emotiva: log.emotional,
    };
  });

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-sm">Caricamento...</p>
      </div>
    );
  }

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buongiorno';
    if (hour < 18) return 'Buon pomeriggio';
    return 'Buonasera';
  };

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold">{greeting()}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          La tua dashboard energetica
        </p>
      </div>

      {/* Pending Approvals Banner */}
      {pendingCount > 0 && (
        <button
          onClick={() => navigate('/settings')}
          className="w-full rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-left transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/30"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white text-sm font-bold shrink-0">
              {pendingCount}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {pendingCount === 1 ? 'Nuovo utente in attesa' : `${pendingCount} utenti in attesa`}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Tocca per approvare o rifiutare
              </p>
            </div>
            <svg className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      )}

      {/* Admin Widgets */}
      {user?.isAdmin && adminStats && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/settings')}
            className="rounded-xl border border-border bg-card p-3 text-left hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
              <span className="text-xs text-muted-foreground">Utenti</span>
            </div>
            <p className="text-xl font-bold">{adminStats.approvedUsers}</p>
            <p className="text-[10px] text-muted-foreground">{adminStats.totalUsers} totali</p>
          </button>

          <button
            onClick={() => navigate('/admin')}
            className="rounded-xl border border-border bg-card p-3 text-left hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <svg className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </span>
              <span className="text-xs text-muted-foreground">Feedback</span>
            </div>
            <p className="text-xl font-bold">
              {adminStats.unreadFeedback}
              {adminStats.unreadFeedback > 0 && (
                <span className="text-xs font-normal text-red-500 ml-1">nuovi</span>
              )}
            </p>
            <p className="text-[10px] text-muted-foreground">da leggere</p>
          </button>

          <button
            onClick={() => navigate('/admin')}
            className="rounded-xl border border-border bg-card p-3 text-left hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-7 h-7 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                <svg className="w-3.5 h-3.5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </span>
              <span className="text-xs text-muted-foreground">Sessioni</span>
            </div>
            <p className="text-xl font-bold">{adminStats.totalSessions}</p>
            <p className="text-[10px] text-muted-foreground">totali app</p>
          </button>

          <button
            onClick={() => navigate('/admin')}
            className="rounded-xl border border-border bg-card p-3 text-left hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-7 h-7 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
                <svg className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <span className="text-xs text-muted-foreground">Attivi oggi</span>
            </div>
            <p className="text-xl font-bold">{adminStats.activeTodayCount}</p>
            <p className="text-[10px] text-muted-foreground">utenti online</p>
          </button>
        </div>
      )}

      {/* Smart Habit Notifications — risposte rapide basate su abitudini */}
      {user?.id && <SmartHabitPrompt userId={user.id} />}

      {/* Quick Check-ins — in alto per accesso rapido */}
      {user?.id && <QuickCheckins userId={user.id} />}

      {/* Screen Time — tempo di utilizzo app */}
      {user?.id && <ScreenTimeCard userId={user.id} />}

      {/* Today's Energy */}
      {todayLog ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Energia di oggi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-around py-2">
              <EnergyRing value={todayLog.physical} label="Fisica" color="#3b82f6" />
              <EnergyRing value={todayLog.mental} label="Mentale" color="#22c55e" />
              <EnergyRing value={todayLog.emotional} label="Emotiva" color="#f59e0b" />
            </div>
            {todayLog.notes && (
              <p className="text-xs text-muted-foreground mt-3 text-center italic">
                "{todayLog.notes}"
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <p className="text-muted-foreground text-sm">
              Non hai ancora registrato l'energia di oggi
            </p>
            <Button size="sm" onClick={() => navigate('/log')}>
              Registra ora
            </Button>
          </CardContent>
        </Card>
      )}

      {/* AI Insights */}
      {isAIAvailable() && weekLogs.length >= 2 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Insight IA</CardTitle>
              {!aiLoading && (
                <button
                  onClick={loadInsights}
                  className="text-xs text-primary hover:underline"
                >
                  Aggiorna
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {aiLoading && (
              <div className="py-4 text-center">
                <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-xs text-muted-foreground mt-2">Analisi in corso...</p>
              </div>
            )}
            {aiError && (
              <p className="text-xs text-red-600 dark:text-red-400 py-2">{aiError}</p>
            )}
            {aiInsights && !aiLoading && (
              <div className="space-y-3">
                <p className="text-sm font-medium">{aiInsights.summary}</p>
                {aiInsights.insights.map((insight, i) => (
                  <div key={i} className="flex gap-2.5">
                    <span className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">
                      {insight.tag}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{insight.title}</p>
                      <p className="text-xs text-muted-foreground">{insight.body}</p>
                    </div>
                  </div>
                ))}
                {aiInsights.energyForecast && (
                  <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Previsione energia</p>
                    <p className="text-xs mt-1">{aiInsights.energyForecast}</p>
                  </div>
                )}
                <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
                  <p className="text-sm font-medium text-primary">Consiglio per adesso</p>
                  <p className="text-xs mt-1">{aiInsights.suggestion}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Weekly Chart */}
      {chartData.length >= 2 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ultimi 7 giorni</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[0, 10]}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={25}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--card)',
                    }}
                  />
                  <Line type="monotone" dataKey="Fisica" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Mentale" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Emotiva" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                <span className="text-xs text-muted-foreground">Fisica</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                <span className="text-xs text-muted-foreground">Mentale</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span className="text-xs text-muted-foreground">Emotiva</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Trend settimanale</CardTitle>
          </CardHeader>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              {chartData.length === 0
                ? 'Registra la tua energia per vedere il grafico'
                : 'Servono almeno 2 giorni per il grafico'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Average Energy Level */}
      {weekLogs.length > 0 && (() => {
        const avgPhysical = weekLogs.reduce((s, l) => s + l.physical, 0) / weekLogs.length;
        const avgMental = weekLogs.reduce((s, l) => s + l.mental, 0) / weekLogs.length;
        const avgEmotional = weekLogs.reduce((s, l) => s + l.emotional, 0) / weekLogs.length;
        const overallAvg = Math.round(((avgPhysical + avgMental + avgEmotional) / 3) * 10) / 10;
        const percentage = overallAvg * 10;
        const radius = 44;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percentage / 100) * circumference;
        const color = overallAvg >= 7 ? '#22c55e' : overallAvg >= 4 ? '#f59e0b' : '#ef4444';

        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Livello medio energia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="relative w-28 h-28 shrink-0">
                  <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" className="text-muted" strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r={radius} fill="none"
                      stroke={color}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={offset}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold" style={{ color }}>{overallAvg}</span>
                    <span className="text-xs text-muted-foreground">/10</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                      <span className="text-sm">Fisica</span>
                    </div>
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{avgPhysical.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                      <span className="text-sm">Mentale</span>
                    </div>
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">{avgMental.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                      <span className="text-sm">Emotiva</span>
                    </div>
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{avgEmotional.toFixed(1)}</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-3">
                Media degli ultimi {weekLogs.length} giorni
              </p>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
