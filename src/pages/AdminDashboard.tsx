import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import { useAuthState } from '../contexts/AuthContext';
import { getAllUsers } from '../lib/auth';
import { db } from '../db/db';
import type { User, UserProfile, EnergyLog, SahhaScoreLog, SahhaBiomarkerLog } from '../db/schema';

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

export default function AdminDashboard() {
  const { user: currentUser } = useAuthState();
  const [usersData, setUsersData] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<number | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

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
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
    </div>
  );
}
