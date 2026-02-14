import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthState } from '../contexts/AuthContext';
import { getCheckinSummaries } from '../lib/checkins';
import { usePendingUsers } from '../lib/usePendingUsers';
import { useUserProfile } from '../lib/useUserProfile';
import { getAppSettings } from '../lib/useAppSettings';
import { getUnreadFeedbackCount } from '../lib/feedback';
import { getAllUsers } from '../lib/auth';
import { getAllUserActivity } from '../lib/useActivityTracker';
import QuickCheckins from '../components/QuickCheckins';
import DailyHistory from '../components/DailyHistory';
import { getActiveGoals } from '../lib/goals';
import { useEnergyOrientation } from '../lib/useEnergyOrientation';
import { CATEGORY_LABELS } from '../lib/energy-orientation';
import type { Goal } from '../db/schema';
import type { DailyCheckinSummary } from '../lib/checkins';
import { Compass } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuthState();
  const navigate = useNavigate();
  const pendingCount = usePendingUsers();
  useUserProfile(user?.id); // keeps profile cache warm for sub-components
  const [checkinSummaries, setCheckinSummaries] = useState<DailyCheckinSummary[]>([]);
  const [activeGoals, setActiveGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  // Admin widget stats
  const [adminStats, setAdminStats] = useState<{
    totalUsers: number;
    approvedUsers: number;
    unreadFeedback: number;
    totalSessions: number;
    activeTodayCount: number;
  } | null>(null);

  const refreshing = useRef(false);

  // Orientation system
  const { recommendations } = useEnergyOrientation(user?.id);
  const topRec = recommendations[0];

  const loadData = useCallback(async (showLoader = true) => {
    const uid = user?.id;
    if (!uid || refreshing.current) return;
    refreshing.current = true;
    if (showLoader) setLoading(true);
    try {
      const [summaries, goals] = await Promise.all([
        getCheckinSummaries(uid, 7),
        getActiveGoals(uid).catch(() => [] as Goal[]),
      ]);
      setCheckinSummaries(summaries);
      setActiveGoals(goals);
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
      {/* 1. Greeting header */}
      <div>
        <h1 className="text-2xl font-bold">{greeting()}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Il tuo centro decisionale
        </p>
      </div>

      {/* 2. Admin widgets (if admin) */}
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

      {/* Admin Stats Grid */}
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

      {/* 3. Quick Check-ins — data collection (in alto per priorita) */}
      {user?.id && <QuickCheckins userId={user.id} />}

      {/* 4. Cosa fare adesso — top recommendation from orientation system */}
      {topRec && (
        <button
          onClick={() => navigate('/orientation')}
          className="w-full rounded-xl border-2 border-primary/20 bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10"
        >
          <div className="flex items-center gap-2 mb-1">
            <Compass className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wide">Cosa fare adesso</span>
          </div>
          <p className="text-sm font-medium">{topRec.activity.name}</p>
          <p className="text-xs text-muted-foreground">{topRec.reason}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span>{topRec.durationMin} min</span>
            <span>{CATEGORY_LABELS[topRec.activity.category]}</span>
            <span>Intensita {Math.round(topRec.intensity * 100)}%</span>
            <span className="ml-auto text-primary font-medium">Vedi Energy</span>
          </div>
        </button>
      )}

      {/* 6. Goals Widget (if goals exist) */}
      {activeGoals.length > 0 && (
        <button
          onClick={() => navigate('/goals')}
          className="w-full rounded-xl border border-border bg-card p-4 text-left hover:bg-muted/50 transition-colors shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Obiettivi</p>
              <p className="text-xs text-muted-foreground">
                {activeGoals.length} attiv{activeGoals.length === 1 ? 'o' : 'i'}
                {activeGoals.some(g => g.streak > 0) && (
                  <span className="text-orange-500 ml-1">
                    — streak {Math.max(...activeGoals.map(g => g.streak))} gg
                  </span>
                )}
              </p>
            </div>
            <svg className="h-5 w-5 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      )}

      {/* 7. Daily History — storico completo giornate */}
      {user?.id && <DailyHistory userId={user.id} />}

      {/* 8. Intelligence Link (if enough data) */}
      {checkinSummaries.length >= 3 && (
        <button
          onClick={() => navigate('/insights')}
          className="w-full rounded-xl border border-border bg-card p-4 text-left hover:bg-muted/50 transition-colors shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Intelligence</p>
              <p className="text-xs text-muted-foreground">
                Trend, pattern e previsioni dai tuoi dati
              </p>
            </div>
            <svg className="h-5 w-5 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      )}

      {/* 8-10. Removed: old AI insights, weekly chart, average rings — replaced by Intelligence page */}
    </div>
  );
}
