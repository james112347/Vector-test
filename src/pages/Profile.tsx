import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import {
  User, Pencil, Briefcase, Heart,
  Ruler, Weight, Coffee, Moon, Wine, Cigarette,
  Dumbbell, Clock, Calendar,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUserProfile } from '../lib/useUserProfile';

// ---------------------------------------------------------------------------
// Label maps
// ---------------------------------------------------------------------------

const genderLabels: Record<string, string> = {
  male: 'Maschio',
  female: 'Femmina',
  other: 'Altro',
  prefer_not_to_say: 'Non specificato',
};

const occupationLabels: Record<string, string> = {
  student: 'Studente',
  worker: 'Lavoratore',
  student_worker: 'Studente-lavoratore',
  unemployed: 'Disoccupato',
  retired: 'Pensionato',
};

const scheduleLabels: Record<string, string> = {
  regular: 'Regolare',
  shifts: 'A turni',
  flexible: 'Flessibile',
  irregular: 'Irregolare',
};

const activityLabels: Record<string, string> = {
  sedentary: 'Sedentario',
  light: 'Leggero',
  moderate: 'Moderato',
  active: 'Attivo',
  very_active: 'Molto attivo',
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

const goalLabels: Record<string, string> = {
  more_energy: 'Piu energia',
  better_sleep: 'Dormire meglio',
  fitness: 'Fitness',
  stress: 'Gestire lo stress',
  general_wellness: 'Benessere generale',
};

const goalIcons: Record<string, string> = {
  more_energy: '⚡',
  better_sleep: '🌙',
  fitness: '💪',
  stress: '🧘',
  general_wellness: '🌿',
};

// ---------------------------------------------------------------------------
// Sotto-componenti
// ---------------------------------------------------------------------------

function StatItem({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof User;
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: color ? `${color}15` : undefined }}
      >
        <Icon className="h-4 w-4" style={{ color: color || 'var(--color-muted-foreground)' }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground leading-none mb-0.5">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
      {children}
    </h3>
  );
}

// ---------------------------------------------------------------------------
// Pagina profilo
// ---------------------------------------------------------------------------

export default function Profile() {
  const { user } = useAuth();
  const { profile, loading } = useUserProfile(user?.id);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Caricamento profilo...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">Profilo non trovato</p>
        <Button onClick={() => navigate('/')}>Torna alla home</Button>
      </div>
    );
  }

  const age = new Date().getFullYear() - profile.birthYear;
  const bmi = (profile.weightKg / ((profile.heightCm / 100) ** 2)).toFixed(1);

  const bmiCategory = (v: number) => {
    if (v < 18.5) return { label: 'Sottopeso', color: '#f59e0b' };
    if (v < 25) return { label: 'Normopeso', color: '#22c55e' };
    if (v < 30) return { label: 'Sovrappeso', color: '#f59e0b' };
    return { label: 'Obesita', color: '#ef4444' };
  };
  const bmiInfo = bmiCategory(parseFloat(bmi));

  const initials = profile.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const memberSince = profile.completedAt
    ? new Date(profile.completedAt).toLocaleDateString('it-IT', {
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className="space-y-4 pb-6">
      {/* Header profilo */}
      <Card>
        <CardContent className="pt-6 pb-4">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">{initials}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold">{profile.name}</h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <div className="flex items-center justify-center gap-3 mt-1.5">
                <span className="text-xs text-muted-foreground">
                  {age} anni
                </span>
                <span className="text-xs text-muted-foreground">
                  {genderLabels[profile.gender] || profile.gender}
                </span>
                {memberSince && (
                  <span className="text-xs text-muted-foreground">
                    dal {memberSince}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/profile/edit')}
              className="mt-1"
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Modifica profilo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Obiettivo */}
      <Card>
        <CardContent className="py-4">
          <SectionTitle>Obiettivo</SectionTitle>
          <div className="flex items-center gap-3 mt-2">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">
              {goalIcons[profile.goal] || '🎯'}
            </div>
            <div>
              <p className="font-semibold">{goalLabels[profile.goal] || profile.goal}</p>
              {profile.notes && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{profile.notes}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dati fisici */}
      <Card>
        <CardContent className="py-4">
          <SectionTitle>Dati fisici</SectionTitle>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="text-center p-2.5 rounded-xl bg-muted/30">
              <Ruler className="h-4 w-4 mx-auto mb-1 text-blue-500" />
              <p className="text-lg font-bold">{profile.heightCm}</p>
              <p className="text-[10px] text-muted-foreground">cm</p>
            </div>
            <div className="text-center p-2.5 rounded-xl bg-muted/30">
              <Weight className="h-4 w-4 mx-auto mb-1 text-green-500" />
              <p className="text-lg font-bold">{profile.weightKg}</p>
              <p className="text-[10px] text-muted-foreground">kg</p>
            </div>
            <div className="text-center p-2.5 rounded-xl bg-muted/30">
              <Heart className="h-4 w-4 mx-auto mb-1" style={{ color: bmiInfo.color }} />
              <p className="text-lg font-bold">{bmi}</p>
              <p className="text-[10px]" style={{ color: bmiInfo.color }}>{bmiInfo.label}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Occupazione */}
      <Card>
        <CardContent className="py-4">
          <SectionTitle>Occupazione</SectionTitle>
          <div className="mt-1">
            <StatItem
              icon={Briefcase}
              label="Tipo"
              value={occupationLabels[profile.occupation] || profile.occupation}
              color="#6366f1"
            />
            {profile.workType && (
              <StatItem icon={Briefcase} label="Lavoro" value={profile.workType} color="#6366f1" />
            )}
            <StatItem
              icon={Clock}
              label="Ore al giorno"
              value={`${profile.dailyWorkHours}h`}
              color="#8b5cf6"
            />
            <StatItem
              icon={Calendar}
              label="Orario"
              value={scheduleLabels[profile.workSchedule] || profile.workSchedule}
              color="#a78bfa"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stile di vita */}
      <Card>
        <CardContent className="py-4">
          <SectionTitle>Stile di vita</SectionTitle>
          <div className="mt-1">
            <StatItem
              icon={Dumbbell}
              label="Attivita fisica"
              value={activityLabels[profile.activityLevel] || profile.activityLevel}
              color="#22c55e"
            />
            <Separator className="my-1" />
            <StatItem
              icon={Moon}
              label="Sonno"
              value={`${profile.sleepHours}h per notte`}
              color="#6366f1"
            />
            <Separator className="my-1" />
            <StatItem
              icon={Coffee}
              label="Caffeina"
              value={profile.caffeineDaily === 0 ? 'Nessuna' : `${profile.caffeineDaily} al giorno`}
              color="#92400e"
            />
            <Separator className="my-1" />
            <StatItem
              icon={Cigarette}
              label="Fumo"
              value={smokingLabels[profile.smokingFrequency] || profile.smokingFrequency}
              color="#ef4444"
            />
            <Separator className="my-1" />
            <StatItem
              icon={Wine}
              label="Alcol"
              value={alcoholLabels[profile.alcoholFrequency] || profile.alcoholFrequency}
              color="#f59e0b"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
