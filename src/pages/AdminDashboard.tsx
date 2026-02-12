import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import { useAuthState } from '../contexts/AuthContext';
import { getAllUsers, adminResetPassword } from '../lib/auth';
import { getAllFeedbacks, markFeedbackRead, replyToFeedback, deleteAttachments, type ChatMessage } from '../lib/feedback';
import { getAllUserActivity, type UserActivity } from '../lib/useActivityTracker';
import { runHybridAnalysis, getCachedHybridAnalysis, cacheHybridAnalysis, type HybridAnalysis } from '../lib/ai-hybrid';
import { db } from '../db/db';
import type { User, UserProfile, EnergyLog, SahhaScoreLog, SahhaBiomarkerLog, UserFeedback } from '../db/schema';

interface UserData {
  user: User;
  profile: UserProfile | null;
  recentLogs: EnergyLog[];
  scores: SahhaScoreLog[];
  biomarkers: SahhaBiomarkerLog[];
}

const goalLabels: Record<string, string> = {
  more_energy: 'Piu energia',
  better_sleep: 'Dormire meglio',
  fitness: 'Fitness',
  stress: 'Gestire lo stress',
  general_wellness: 'Benessere',
};

const activityLabels: Record<string, string> = {
  sedentary: 'Sedentario',
  light: 'Leggero',
  moderate: 'Moderato',
  active: 'Attivo',
  very_active: 'Molto attivo',
};

const genderLabels: Record<string, string> = {
  male: 'M',
  female: 'F',
  other: 'Altro',
  prefer_not_to_say: '-',
};

const occupationLabels: Record<string, string> = {
  student: 'Studente',
  worker: 'Lavoratore',
  student_worker: 'Stud-lav',
  unemployed: 'Disoccupato',
  retired: 'Pensionato',
};

const scheduleLabels: Record<string, string> = {
  regular: 'Fisso',
  shifts: 'Turni',
  flexible: 'Flessibile',
  irregular: 'Irregolare',
};

const smokingLabels: Record<string, string> = {
  never: 'Mai',
  occasional: 'Occasionale',
  daily: 'Quotidiano',
  heavy: 'Pesante',
};

const alcoholLabels: Record<string, string> = {
  never: 'Mai',
  occasional: 'Occasionale',
  weekly: 'Settimanale',
  daily: 'Quotidiano',
};

const stressLabels: Record<string, string> = {
  low: 'Basso',
  moderate: 'Moderato',
  high: 'Alto',
  very_high: 'Molto alto',
};

const energyPatternLabels: Record<string, string> = {
  morning: 'Mattiniero',
  afternoon: 'Pomeridiano',
  evening: 'Serale',
  variable: 'Variabile',
};

const scoreLabels: Record<string, string> = {
  wellbeing: 'Benessere',
  activity: 'Attivita',
  sleep: 'Sonno',
  readiness: 'Prontezza',
  mental_wellbeing: 'Benessere mentale',
};

const stateColors: Record<string, string> = {
  high: 'text-green-600 dark:text-green-400',
  medium: 'text-amber-600 dark:text-amber-400',
  low: 'text-red-600 dark:text-red-400',
  minimal: 'text-red-700 dark:text-red-300',
};

// Deterministic color from string for avatar disambiguation
const avatarColors = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-rose-500',
  'bg-amber-500', 'bg-cyan-500', 'bg-pink-500', 'bg-teal-500',
  'bg-indigo-500', 'bg-orange-500',
];
function getAvatarColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = ((hash << 5) - hash + email.charCodeAt(i)) | 0;
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function timeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'ora';
  if (mins < 60) return `${mins}min fa`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h fa`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ieri';
  return `${days}gg fa`;
}

export default function AdminDashboard() {
  const { user: currentUser } = useAuthState();
  const [usersData, setUsersData] = useState<UserData[]>([]);
  const [feedbacks, setFeedbacks] = useState<UserFeedback[]>([]);
  const [activityData, setActivityData] = useState<UserActivity[]>([]);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [resetPasswordFor, setResetPasswordFor] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [hybridAnalysis, setHybridAnalysis] = useState<HybridAnalysis | null>(null);
  const [hybridLoading, setHybridLoading] = useState(false);

  const loadHybridAnalysis = useCallback(async () => {
    if (!currentUser?.id) return;
    const cached = getCachedHybridAnalysis();
    if (cached) { setHybridAnalysis(cached); return; }
    setHybridLoading(true);
    try {
      const result = await runHybridAnalysis(currentUser.id);
      setHybridAnalysis(result);
      cacheHybridAnalysis(result);
    } catch { /* non-critical */ }
    finally { setHybridLoading(false); }
  }, [currentUser?.id]);

  useEffect(() => {
    loadAllData();
    getAllFeedbacks().then(setFeedbacks);
    getAllUserActivity().then(setActivityData);
  }, []);

  useEffect(() => {
    if (currentUser?.isAdmin) loadHybridAnalysis();
  }, [currentUser?.isAdmin, loadHybridAnalysis]);

  async function loadAllData() {
    const users = await getAllUsers();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const startStr = startDate.toISOString().slice(0, 10);

    const data: UserData[] = [];

    for (const user of users) {
      if (!user.id) continue;

      const profile = await db.userProfiles.where('userId').equals(user.id).first() ?? null;

      const recentLogs = await db.energyLogs
        .where('userId')
        .equals(user.id)
        .and(log => log.date >= startStr)
        .sortBy('date');

      const scores = await db.sahhaScores
        .where('userId')
        .equals(user.id)
        .toArray();
      // Get latest score per type
      const latestScores = new Map<string, SahhaScoreLog>();
      for (const s of scores) {
        const existing = latestScores.get(s.type);
        if (!existing || s.scoreDateTime > existing.scoreDateTime) {
          latestScores.set(s.type, s);
        }
      }

      const biomarkers = await db.sahhaBiomarkers
        .where('userId')
        .equals(user.id)
        .toArray();
      // Get latest biomarker per type
      const latestBio = new Map<string, SahhaBiomarkerLog>();
      for (const b of biomarkers) {
        const existing = latestBio.get(b.type);
        if (!existing || b.startDateTime > existing.startDateTime) {
          latestBio.set(b.type, b);
        }
      }

      data.push({
        user,
        profile,
        recentLogs,
        scores: Array.from(latestScores.values()),
        biomarkers: Array.from(latestBio.values()),
      });
    }

    setUsersData(data);
    setLoading(false);
  }

  if (!currentUser?.isAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Accesso non autorizzato</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-sm">Caricamento dati utenti...</p>
      </div>
    );
  }

  const approvedWithProfiles = usersData.filter(d => d.user.isApproved && d.profile);
  const approvedWithoutProfiles = usersData.filter(d => d.user.isApproved && !d.profile);
  const totalLogs = usersData.reduce((sum, d) => sum + d.recentLogs.length, 0);

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Utenti</h1>
        <p className="text-muted-foreground mt-1 text-sm">Panoramica dati degli utenti</p>
      </div>

      {/* Feedback Section */}
      {feedbacks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                Feedback
                {feedbacks.filter(f => f.status === 'sent').length > 0 && (
                  <span className="text-xs bg-red-500 text-white rounded-full px-2 py-0.5">
                    {feedbacks.filter(f => f.status === 'sent').length} nuovi
                  </span>
                )}
              </CardTitle>
            </div>
            <CardDescription>Feedback e segnalazioni degli utenti</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {feedbacks.map(fb => {
              const catColors: Record<string, string> = {
                bug: 'bg-red-500/10 text-red-600 dark:text-red-400',
                feature: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                improvement: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                support: 'bg-green-500/10 text-green-600 dark:text-green-400',
                other: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
              };
              const catLabels: Record<string, string> = {
                bug: 'Bug', feature: 'Funzione', improvement: 'Miglioramento', support: 'Supporto', other: 'Altro',
              };
              const isUnread = fb.status === 'sent';
              return (
                <div
                  key={fb.id}
                  className={`rounded-lg border p-3 space-y-2 ${isUnread ? 'border-primary/30 bg-primary/5' : 'border-border'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${catColors[fb.category]}`}>
                        {catLabels[fb.category]}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">{fb.userEmail}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(fb.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <p className="text-sm">{fb.message}</p>
                  <FeedbackAttachments feedback={fb} onDeleteAttachments={async () => {
                    await deleteAttachments(fb.id!);
                    setFeedbacks(await getAllFeedbacks());
                  }} />
                  {fb.adminReply && (
                    <div className="rounded bg-muted p-2">
                      <p className="text-[10px] font-medium text-muted-foreground mb-0.5">La tua risposta</p>
                      <p className="text-xs">{fb.adminReply}</p>
                    </div>
                  )}
                  {replyingTo === fb.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder="Scrivi una risposta..."
                        rows={2}
                        className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-8 flex-1"
                          disabled={!replyText.trim()}
                          onClick={async () => {
                            await replyToFeedback(fb.id!, replyText.trim());
                            setReplyingTo(null);
                            setReplyText('');
                            setFeedbacks(await getAllFeedbacks());
                          }}
                        >
                          Invia
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => { setReplyingTo(null); setReplyText(''); }}
                        >
                          Annulla
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => { setReplyingTo(fb.id!); setReplyText(''); }}
                      >
                        Rispondi
                      </Button>
                      {isUnread && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={async () => {
                            await markFeedbackRead(fb.id!);
                            setFeedbacks(await getAllFeedbacks());
                          }}
                        >
                          Segna come letto
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-primary">{approvedWithProfiles.length}</p>
            <p className="text-xs text-muted-foreground">Profili completi</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{approvedWithoutProfiles.length}</p>
            <p className="text-xs text-muted-foreground">Senza profilo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{totalLogs}</p>
            <p className="text-xs text-muted-foreground">Log 7gg</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Hybrid Analysis — Suggerimenti per l'admin */}
      {(hybridAnalysis || hybridLoading) && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                Suggerimenti IA
                {hybridAnalysis && (
                  <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    Qualita dati: {hybridAnalysis.dataQualityScore}/100
                  </span>
                )}
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                disabled={hybridLoading}
                onClick={() => {
                  sessionStorage.removeItem('vector_hybrid_analysis');
                  loadHybridAnalysis();
                }}
              >
                {hybridLoading ? 'Analisi...' : 'Aggiorna'}
              </Button>
            </div>
            <CardDescription>Suggerimenti generati dall'IA per migliorare precisione</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {hybridLoading && !hybridAnalysis && (
              <div className="py-4 text-center">
                <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-xs text-muted-foreground mt-2">Analisi ibrida in corso...</p>
              </div>
            )}
            {hybridAnalysis && (
              <>
                {/* Data quality bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Qualita dati complessiva</span>
                    <span className="font-bold">{hybridAnalysis.dataQualityScore}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${hybridAnalysis.dataQualityScore}%`,
                        backgroundColor:
                          hybridAnalysis.dataQualityScore >= 70 ? '#22c55e'
                            : hybridAnalysis.dataQualityScore >= 40 ? '#f59e0b'
                              : '#ef4444',
                      }}
                    />
                  </div>
                </div>

                {/* Data gaps */}
                {hybridAnalysis.dataGaps.length > 0 && (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1">Gap nei dati</p>
                    {hybridAnalysis.dataGaps.map((gap, i) => (
                      <p key={i} className="text-[11px] text-amber-700 dark:text-amber-300">- {gap}</p>
                    ))}
                  </div>
                )}

                {/* Correlations */}
                {hybridAnalysis.correlations.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Correlazioni rilevate</p>
                    <div className="space-y-1">
                      {hybridAnalysis.correlations.slice(0, 5).map((c, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            c.strength === 'strong' ? 'bg-green-500' : c.strength === 'moderate' ? 'bg-amber-500' : 'bg-muted-foreground'
                          }`} />
                          <span className="text-muted-foreground">{c.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Admin suggestions */}
                {hybridAnalysis.adminSuggestions.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Azioni consigliate</p>
                    <div className="space-y-2">
                      {hybridAnalysis.adminSuggestions.map((s, i) => {
                        const priorityColors: Record<string, string> = {
                          critical: 'border-red-500/30 bg-red-500/5',
                          high: 'border-orange-500/20 bg-orange-500/5',
                          medium: 'border-blue-500/20 bg-blue-500/5',
                          low: 'border-border',
                        };
                        const priorityLabels: Record<string, string> = {
                          critical: 'Critico', high: 'Alto', medium: 'Medio', low: 'Basso',
                        };
                        const catLabels: Record<string, string> = {
                          data_quality: 'Dati', feature: 'Funzione', algorithm: 'Algoritmo',
                          ux: 'UX', notification: 'Notifiche',
                        };
                        return (
                          <div key={s.id || i} className={`rounded-lg border p-2.5 ${priorityColors[s.priority] || ''}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted">
                                {priorityLabels[s.priority]}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {catLabels[s.category] || s.category}
                              </span>
                            </div>
                            <p className="text-sm font-medium">{s.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                            {s.expectedImpact && (
                              <p className="text-[10px] text-green-600 dark:text-green-400 mt-1">Impatto: {s.expectedImpact}</p>
                            )}
                            {s.actionRequired && (
                              <p className="text-[10px] text-primary mt-0.5">Azione: {s.actionRequired}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Local patterns */}
                {hybridAnalysis.localPatterns.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Pattern locali</p>
                    <div className="space-y-1">
                      {hybridAnalysis.localPatterns.map((p, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                            p.impact > 0 ? 'bg-green-500' : p.impact < -0.3 ? 'bg-red-500' : 'bg-amber-500'
                          }`} />
                          <span className="text-muted-foreground">{p.description} <span className="text-[10px]">(conf: {p.confidence})</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* User Activity Analytics */}
      {activityData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Utilizzo App</CardTitle>
            <CardDescription>Tempo e frequenza di utilizzo per utente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pb-1 border-b border-border">
                <span>Utente</span>
                <span className="text-center w-14">Sessioni</span>
                <span className="text-center w-16">Tempo tot</span>
                <span className="text-center w-14">Oggi</span>
              </div>
              {activityData.map(a => {
                const totalHours = Math.floor(a.total_minutes / 60);
                const totalMins = a.total_minutes % 60;
                const totalStr = totalHours > 0 ? `${totalHours}h ${totalMins}m` : `${totalMins}m`;
                const todayStr = a.today_date === new Date().toISOString().slice(0, 10) ? `${a.today_minutes}m` : '-';
                const lastActive = a.last_active_at ? timeAgo(new Date(a.last_active_at)) : '-';

                return (
                  <div key={a.email} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center py-1.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.email.split('@')[0]}</p>
                      <p className="text-[10px] text-muted-foreground">Attivo {lastActive}</p>
                    </div>
                    <span className="text-sm font-bold text-center w-14">{a.total_sessions}</span>
                    <span className="text-sm font-medium text-center w-16">{totalStr}</span>
                    <span className={`text-sm font-medium text-center w-14 ${todayStr !== '-' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>{todayStr}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* User cards */}
      {usersData
        .filter(d => d.user.isApproved)
        .map((d) => {
          const { user, profile, recentLogs, scores, biomarkers } = d;
          const isExpanded = expandedUser === user.id;
          const avgPhysical = recentLogs.length > 0
            ? (recentLogs.reduce((s, l) => s + l.physical, 0) / recentLogs.length).toFixed(1)
            : '-';
          const avgMental = recentLogs.length > 0
            ? (recentLogs.reduce((s, l) => s + l.mental, 0) / recentLogs.length).toFixed(1)
            : '-';
          const avgEmotional = recentLogs.length > 0
            ? (recentLogs.reduce((s, l) => s + l.emotional, 0) / recentLogs.length).toFixed(1)
            : '-';

          return (
            <Card key={user.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-full ${getAvatarColor(user.email)} flex items-center justify-center shrink-0`}>
                      <span className="text-sm font-bold text-white">
                        {profile?.name
                          ? profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
                          : user.email[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base truncate">
                          {profile?.name || user.email.split('@')[0]}
                        </CardTitle>
                        <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">
                          #{user.id}
                        </span>
                      </div>
                      <CardDescription className="truncate">{user.email}</CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedUser(isExpanded ? null : user.id!)}
                  >
                    {isExpanded ? 'Chiudi' : 'Dettagli'}
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-2">
                {/* Quick summary row */}
                {profile && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{new Date().getFullYear() - profile.birthYear}a</span>
                    <span>{genderLabels[profile.gender]}</span>
                    <span>{profile.heightCm}cm</span>
                    <span>{profile.weightKg}kg</span>
                    <span>{occupationLabels[profile.occupation] || profile.occupation}</span>
                    <span>{goalLabels[profile.goal]}</span>
                  </div>
                )}

                {/* Energy averages */}
                {recentLogs.length > 0 && (
                  <div className="flex items-center gap-4 rounded-lg bg-muted/40 px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      <span className="text-sm font-medium">{avgPhysical}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      <span className="text-sm font-medium">{avgMental}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span className="text-sm font-medium">{avgEmotional}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground ml-auto">{recentLogs.length} log/7gg</span>
                  </div>
                )}

                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-4 space-y-4">
                    {/* Profile details */}
                    {profile && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="text-sm font-medium mb-2">Profilo</h4>
                          <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                            <span className="text-muted-foreground">Occupazione</span>
                            <span>{occupationLabels[profile.occupation] || profile.occupation}</span>
                            {profile.workType && (
                              <>
                                <span className="text-muted-foreground">Lavoro</span>
                                <span>{profile.workType}</span>
                              </>
                            )}
                            <span className="text-muted-foreground">Ore/giorno</span>
                            <span>{profile.dailyWorkHours ?? profile.weeklyWorkHours ?? '-'}h</span>
                            <span className="text-muted-foreground">Orario</span>
                            <span>{scheduleLabels[profile.workSchedule] || profile.workSchedule}</span>
                            <span className="text-muted-foreground">Attivita</span>
                            <span>{activityLabels[profile.activityLevel]}</span>
                            <span className="text-muted-foreground">Sonno tipico</span>
                            <span>{profile.sleepHours}h/notte</span>
                            <span className="text-muted-foreground">Fumo</span>
                            <span>{smokingLabels[profile.smokingFrequency] || '-'}</span>
                            <span className="text-muted-foreground">Alcol</span>
                            <span>{alcoholLabels[profile.alcoholFrequency] || '-'}</span>
                            <span className="text-muted-foreground">Caffeina</span>
                            <span>{profile.caffeineDaily} tazzine/gg</span>
                            {profile.stressLevel && (
                              <>
                                <span className="text-muted-foreground">Stress</span>
                                <span>{stressLabels[profile.stressLevel] || '-'}</span>
                              </>
                            )}
                            {profile.energyPattern && (
                              <>
                                <span className="text-muted-foreground">Pattern energia</span>
                                <span>{energyPatternLabels[profile.energyPattern] || '-'}</span>
                              </>
                            )}
                            <span className="text-muted-foreground">Obiettivo</span>
                            <span>{goalLabels[profile.goal]}</span>
                          </div>
                        </div>
                        {(profile.baselinePhysical || profile.baselineMental || profile.baselineEmotional) && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Energia di base</h4>
                            <div className="flex gap-4">
                              {profile.baselinePhysical && (
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                  <span className="text-sm">Fisica: {profile.baselinePhysical}/10</span>
                                </div>
                              )}
                              {profile.baselineMental && (
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                  <span className="text-sm">Mentale: {profile.baselineMental}/10</span>
                                </div>
                              )}
                              {profile.baselineEmotional && (
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                  <span className="text-sm">Emotiva: {profile.baselineEmotional}/10</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {profile.notes && (
                          <div>
                            <h4 className="text-sm font-medium mb-1">Note</h4>
                            <p className="text-xs text-muted-foreground">{profile.notes}</p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Energy log details */}
                    {recentLogs.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="text-sm font-medium mb-2">Energia ultimi 7 giorni</h4>
                          <div className="space-y-1.5">
                            {recentLogs.map((log) => (
                              <div key={log.id} className="flex items-center gap-2 text-sm">
                                <span className="text-xs text-muted-foreground w-16 shrink-0">
                                  {new Date(log.date + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' })}
                                </span>
                                <div className="flex gap-3 flex-1">
                                  <span className="text-blue-600 dark:text-blue-400 w-6 text-center">{log.physical}</span>
                                  <span className="text-green-600 dark:text-green-400 w-6 text-center">{log.mental}</span>
                                  <span className="text-amber-600 dark:text-amber-400 w-6 text-center">{log.emotional}</span>
                                </div>
                                {log.notes && (
                                  <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={log.notes}>
                                    {log.notes}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Sahha scores */}
                    {scores.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="text-sm font-medium mb-2">Scores Sahha</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {scores.map((s) => (
                              <div key={s.type} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{scoreLabels[s.type] || s.type}</span>
                                <span className={`font-medium ${stateColors[s.state] || ''}`}>
                                  {(s.score * 100).toFixed(0)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Key biomarkers */}
                    {biomarkers.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="text-sm font-medium mb-2">Biomarker chiave</h4>
                          <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                            {biomarkers
                              .filter(b => ['steps', 'heart_rate_resting', 'sleep_duration', 'active_energy_burned', 'oxygen_saturation', 'sleep_debt'].includes(b.type))
                              .map((b) => {
                                const labels: Record<string, string> = {
                                  steps: 'Passi',
                                  heart_rate_resting: 'FC riposo',
                                  sleep_duration: 'Durata sonno',
                                  active_energy_burned: 'Cal. attive',
                                  oxygen_saturation: 'SpO2',
                                  sleep_debt: 'Debito sonno',
                                };
                                const val = parseFloat(b.value);
                                let display = b.value;
                                if (Number.isFinite(val)) {
                                  if (b.type === 'oxygen_saturation') display = `${(val * 100).toFixed(1)}%`;
                                  else if (b.type === 'sleep_duration') display = `${Math.round(val / 60)}h ${val % 60}min`;
                                  else if (b.type === 'sleep_debt') display = `${val.toFixed(1)}h`;
                                  else display = val % 1 === 0 ? val.toLocaleString('it-IT') : val.toFixed(1);
                                }
                                return (
                                  <div key={b.type} className="contents">
                                    <span className="text-muted-foreground">{labels[b.type] || b.type}</span>
                                    <span>{display}</span>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      </>
                    )}

                    {!profile && recentLogs.length === 0 && scores.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Nessun dato disponibile per questo utente
                      </p>
                    )}

                    {/* User Activity */}
                    {(() => {
                      const activity = activityData.find(a => a.email === user.email);
                      if (!activity) return null;
                      const totalH = Math.floor(activity.total_minutes / 60);
                      const totalM = activity.total_minutes % 60;
                      return (
                        <>
                          <Separator />
                          <div>
                            <h4 className="text-sm font-medium mb-2">Utilizzo app</h4>
                            <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                              <span className="text-muted-foreground">Sessioni totali</span>
                              <span className="font-medium">{activity.total_sessions}</span>
                              <span className="text-muted-foreground">Tempo totale</span>
                              <span className="font-medium">{totalH > 0 ? `${totalH}h ${totalM}m` : `${totalM}m`}</span>
                              <span className="text-muted-foreground">Oggi</span>
                              <span className="font-medium">
                                {activity.today_date === new Date().toISOString().slice(0, 10) ? `${activity.today_minutes}min` : '-'}
                              </span>
                              <span className="text-muted-foreground">Ultimo accesso</span>
                              <span className="font-medium">{activity.last_active_at ? timeAgo(new Date(activity.last_active_at)) : '-'}</span>
                            </div>
                          </div>
                        </>
                      );
                    })()}

                    {/* Admin: Reset Password */}
                    <Separator />
                    <div>
                      <h4 className="text-sm font-medium mb-2">Azioni admin</h4>
                      {resetPasswordFor === user.email ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={tempPassword}
                            onChange={e => setTempPassword(e.target.value)}
                            placeholder="Nuova password temporanea"
                            className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                          {resetMsg && (
                            <p className={`text-xs ${resetMsg.includes('Errore') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                              {resetMsg}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="h-8 flex-1"
                              disabled={!tempPassword.trim() || tempPassword.length < 6}
                              onClick={async () => {
                                try {
                                  await adminResetPassword(user.email, tempPassword);
                                  setResetMsg('Password aggiornata! Comunica la nuova password all\'utente.');
                                  setTempPassword('');
                                } catch (e) {
                                  setResetMsg(`Errore: ${(e as Error).message}`);
                                }
                              }}
                            >
                              Conferma reset
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={() => { setResetPasswordFor(null); setTempPassword(''); setResetMsg(''); }}
                            >
                              Annulla
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => { setResetPasswordFor(user.email); setResetMsg(''); }}
                        >
                          Reset password
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
    </div>
  );
}

function FeedbackAttachments({ feedback, onDeleteAttachments }: { feedback: UserFeedback; onDeleteAttachments: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  let attachments: Array<{ type: string; data: string; name: string }> = [];
  try {
    const msgs: ChatMessage[] = JSON.parse(feedback.chatHistory);
    attachments = msgs.flatMap(m => (m.attachments ?? []) as Array<{ type: string; data: string; name: string }>);
  } catch { /* ignore */ }

  if (attachments.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {attachments.map((att, i) => (
          <div key={i} className="relative">
            {att.type === 'image' ? (
              <img
                src={att.data}
                alt={att.name}
                className="rounded-md h-20 w-auto cursor-pointer border border-border"
                onClick={() => setExpanded(att.data)}
              />
            ) : (
              <video src={att.data} controls className="rounded-md h-20 w-auto border border-border" preload="metadata" />
            )}
          </div>
        ))}
      </div>
      {expanded && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setExpanded(null)}>
          <img src={expanded} alt="Allegato" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
      {confirmDelete ? (
        <div className="flex gap-2 items-center">
          <span className="text-xs text-muted-foreground">Eliminare tutti gli allegati?</span>
          <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2" onClick={() => { onDeleteAttachments(); setConfirmDelete(false); }}>
            Conferma
          </Button>
          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => setConfirmDelete(false)}>
            Annulla
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-muted-foreground" onClick={() => setConfirmDelete(true)}>
          Elimina allegati ({attachments.length})
        </Button>
      )}
    </div>
  );
}
