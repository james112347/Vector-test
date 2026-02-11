import { useState } from 'react';
import { Moon, Sun, LogOut, User, Pencil } from 'lucide-react';
import { Button } from '../ui/button';
import { useDarkMode } from '../../lib/useDarkMode';
import { useAuth } from '../../contexts/AuthContext';
import { useUserProfile } from '../../lib/useUserProfile';
import { useNavigate } from 'react-router-dom';

export function Header() {
  const { isDark, toggleDark } = useDarkMode();
  const { user, signOut } = useAuth();
  const { profile } = useUserProfile(user?.id);
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const initials = profile?.name
    ? profile.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : null;

  const goalLabels: Record<string, string> = {
    more_energy: 'Piu energia',
    better_sleep: 'Dormire meglio',
    fitness: 'Fitness',
    stress: 'Gestire lo stress',
    general_wellness: 'Benessere',
  };

  const occupationLabels: Record<string, string> = {
    student: 'Studente',
    worker: 'Lavoratore',
    student_worker: 'Studente-lavoratore',
    unemployed: 'Disoccupato',
    retired: 'Pensionato',
  };

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border safe-area-top">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <h1
          className="text-lg font-bold text-primary cursor-pointer"
          onClick={() => navigate('/')}
        >
          Vector
        </h1>

        <div className="flex items-center gap-1">
          {/* Profile button */}
          {profile && (
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-muted transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                {initials ? (
                  <span className="text-xs font-bold text-primary">{initials}</span>
                ) : (
                  <User className="h-4 w-4 text-primary" />
                )}
              </div>
              <span className="text-sm font-medium hidden sm:inline max-w-[100px] truncate">
                {profile.name}
              </span>
            </button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDark}
            aria-label="Toggle dark mode"
            className="w-10 h-10"
          >
            {isDark ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            aria-label="Esci"
            className="w-10 h-10"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Profile dropdown */}
      {showProfile && profile && (
        <div className="absolute right-4 top-14 w-72 bg-background border border-border rounded-lg shadow-lg p-4 z-50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              {initials ? (
                <span className="text-base font-bold text-primary">{initials}</span>
              ) : (
                <User className="h-6 w-6 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium truncate">{profile.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <div className="space-y-1.5 text-sm border-t border-border pt-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Eta</span>
              <span>{new Date().getFullYear() - profile.birthYear} anni</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fisico</span>
              <span>{profile.heightCm}cm, {profile.weightKg}kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Occupazione</span>
              <span>{occupationLabels[profile.occupation] || profile.occupation}</span>
            </div>
            {profile.workType && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lavoro</span>
                <span className="truncate max-w-[140px]">{profile.workType}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sonno</span>
              <span>{profile.sleepHours}h/notte</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Obiettivo</span>
              <span>{goalLabels[profile.goal] || profile.goal}</span>
            </div>
          </div>
          <button
            onClick={() => {
              setShowProfile(false);
              navigate('/profile');
            }}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Modifica profilo
          </button>
        </div>
      )}
    </header>
  );
}
