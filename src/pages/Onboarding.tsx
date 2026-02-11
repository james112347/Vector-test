import { useState, type FormEvent } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { useAuthState } from '../contexts/AuthContext';
import { db } from '../db/db';
import type { UserProfile } from '../db/schema';

const STEPS = ['Dati personali', 'Stile di vita', 'Obiettivi'];

const GENDER_OPTIONS = [
  { value: 'male', label: 'Maschio' },
  { value: 'female', label: 'Femmina' },
  { value: 'other', label: 'Altro' },
  { value: 'prefer_not_to_say', label: 'Preferisco non dire' },
] as const;

const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Sedentario', desc: 'Poco o nessun esercizio' },
  { value: 'light', label: 'Leggero', desc: '1-2 volte a settimana' },
  { value: 'moderate', label: 'Moderato', desc: '3-4 volte a settimana' },
  { value: 'active', label: 'Attivo', desc: '5+ volte a settimana' },
  { value: 'very_active', label: 'Molto attivo', desc: 'Atleta / lavoro fisico' },
] as const;

const GOAL_OPTIONS = [
  { value: 'more_energy', label: 'Piu energia', desc: 'Sentirmi meno stanco durante il giorno' },
  { value: 'better_sleep', label: 'Dormire meglio', desc: 'Migliorare qualita e durata del sonno' },
  { value: 'fitness', label: 'Fitness', desc: 'Migliorare forma fisica e prestazioni' },
  { value: 'stress', label: 'Gestire lo stress', desc: 'Ridurre ansia e tensione' },
  { value: 'general_wellness', label: 'Benessere generale', desc: 'Monitorare e migliorare la salute' },
] as const;

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const { user } = useAuthState();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form data
  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [gender, setGender] = useState<UserProfile['gender']>('prefer_not_to_say');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [activityLevel, setActivityLevel] = useState<UserProfile['activityLevel']>('moderate');
  const [sleepHours, setSleepHours] = useState('7');
  const [goal, setGoal] = useState<UserProfile['goal']>('general_wellness');
  const [notes, setNotes] = useState('');

  const canNext = () => {
    if (step === 0) return name.trim().length >= 2 && birthYear && heightCm && weightKg;
    if (step === 1) return true; // defaults are fine
    return true;
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    setError('');

    try {
      const profile: UserProfile = {
        userId: user.id,
        name: name.trim(),
        birthYear: parseInt(birthYear),
        gender,
        heightCm: parseInt(heightCm),
        weightKg: parseFloat(weightKg),
        activityLevel,
        sleepHours: parseFloat(sleepHours),
        goal,
        notes: notes.trim() || undefined,
        completedAt: new Date(),
        updatedAt: new Date(),
      };

      const existing = await db.userProfiles.where('userId').equals(user.id).first();
      if (existing?.id) {
        await db.userProfiles.update(existing.id, profile);
      } else {
        await db.userProfiles.add(profile);
      }

      onComplete();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleSave();
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Completa il tuo profilo</CardTitle>
          <CardDescription>
            Passo {step + 1} di {STEPS.length}: {STEPS[step]}
          </CardDescription>
          {/* Progress bar */}
          <div className="flex gap-1.5 mt-3">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {/* Step 1: Personal data */}
            {step === 0 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    placeholder="Il tuo nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="h-12 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthYear">Anno di nascita</Label>
                  <Input
                    id="birthYear"
                    type="number"
                    placeholder="es. 1990"
                    min={1920}
                    max={2010}
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    required
                    className="h-12 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Genere</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {GENDER_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setGender(opt.value)}
                        className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                          gender === opt.value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="height">Altezza (cm)</Label>
                    <Input
                      id="height"
                      type="number"
                      placeholder="170"
                      min={100}
                      max={250}
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                      required
                      className="h-12 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight">Peso (kg)</Label>
                    <Input
                      id="weight"
                      type="number"
                      placeholder="70"
                      min={30}
                      max={300}
                      step={0.1}
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      required
                      className="h-12 text-base"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Lifestyle */}
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label>Livello di attivita fisica</Label>
                  <div className="space-y-2">
                    {ACTIVITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setActivityLevel(opt.value)}
                        className={`w-full p-3 rounded-lg border text-left transition-colors ${
                          activityLevel === opt.value
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <p className={`text-sm font-medium ${activityLevel === opt.value ? 'text-primary' : ''}`}>
                          {opt.label}
                        </p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sleepHours">Ore di sonno tipiche per notte</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="sleepHours"
                      type="number"
                      min={3}
                      max={14}
                      step={0.5}
                      value={sleepHours}
                      onChange={(e) => setSleepHours(e.target.value)}
                      className="h-12 text-base w-24"
                    />
                    <span className="text-sm text-muted-foreground">ore</span>
                  </div>
                </div>
              </>
            )}

            {/* Step 3: Goals */}
            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label>Qual e il tuo obiettivo principale?</Label>
                  <div className="space-y-2">
                    {GOAL_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setGoal(opt.value)}
                        className={`w-full p-3 rounded-lg border text-left transition-colors ${
                          goal === opt.value
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <p className={`text-sm font-medium ${goal === opt.value ? 'text-primary' : ''}`}>
                          {opt.label}
                        </p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Note aggiuntive (opzionale)</Label>
                  <textarea
                    id="notes"
                    placeholder="Condizioni mediche, intolleranze, obiettivi specifici..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    rows={3}
                  />
                </div>
              </>
            )}

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </CardContent>

          <CardFooter className="flex gap-3 px-6 pb-6">
            {step > 0 && (
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-12 text-base"
                onClick={() => setStep(step - 1)}
              >
                Indietro
              </Button>
            )}
            <Button
              type="submit"
              className="flex-1 h-12 text-base"
              disabled={!canNext() || saving}
            >
              {saving
                ? 'Salvataggio...'
                : step < STEPS.length - 1
                  ? 'Avanti'
                  : 'Completa'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
