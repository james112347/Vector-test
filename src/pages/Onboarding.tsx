import { useState, type FormEvent } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { useAuthState } from '../contexts/AuthContext';
import { db } from '../db/db';
import type { UserProfile } from '../db/schema';
import { pushDataToSupabase } from '../lib/data-sync';

const STEPS = [
  'Dati personali',
  'Occupazione',
  'Abitudini',
  'Obiettivi',
];

const STEP_DESC = [
  'Ci servono per calcolare il tuo metabolismo basale e personalizzare le raccomandazioni in base a eta, corporatura e genere.',
  'Sapere che lavoro fai e i tuoi orari ci aiuta a capire quanto il lavoro influisce sulla tua energia quotidiana.',
  'Le abitudini quotidiane hanno un impatto diretto sui tuoi livelli di energia. Questo ci aiuta a identificare fattori che potresti migliorare.',
  'Il tuo obiettivo guida le raccomandazioni che riceverai. Potrai cambiarlo in qualsiasi momento.',
];

// --- Options ---

const GENDER_OPTIONS = [
  { value: 'male', label: 'Maschio' },
  { value: 'female', label: 'Femmina' },
  { value: 'other', label: 'Altro' },
  { value: 'prefer_not_to_say', label: 'Non dire' },
] as const;

const OCCUPATION_OPTIONS = [
  { value: 'student', label: 'Studente' },
  { value: 'worker', label: 'Lavoratore' },
  { value: 'student_worker', label: 'Studente-lavoratore' },
  { value: 'unemployed', label: 'Disoccupato' },
  { value: 'retired', label: 'Pensionato' },
] as const;

const SCHEDULE_OPTIONS = [
  { value: 'regular', label: 'Fisso', desc: 'Orari regolari (es. 9-18)' },
  { value: 'shifts', label: 'Turni', desc: 'Rotazione mattina/pomeriggio/notte' },
  { value: 'flexible', label: 'Flessibile', desc: 'Orari variabili a scelta' },
  { value: 'irregular', label: 'Irregolare', desc: 'Senza orari fissi' },
] as const;

const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Sedentario', desc: 'Poco o nessun esercizio' },
  { value: 'light', label: 'Leggero', desc: '1-2 volte/settimana' },
  { value: 'moderate', label: 'Moderato', desc: '3-4 volte/settimana' },
  { value: 'active', label: 'Attivo', desc: '5+ volte/settimana' },
  { value: 'very_active', label: 'Molto attivo', desc: 'Atleta / lavoro fisico' },
] as const;

const SMOKING_OPTIONS = [
  { value: 'never', label: 'Mai' },
  { value: 'occasional', label: 'Occasionale' },
  { value: 'daily', label: 'Ogni giorno' },
  { value: 'heavy', label: 'Pesante (10+/giorno)' },
] as const;

const ALCOHOL_OPTIONS = [
  { value: 'never', label: 'Mai' },
  { value: 'occasional', label: 'Occasionale' },
  { value: 'weekly', label: 'Settimanale' },
  { value: 'daily', label: 'Quotidiano' },
] as const;

const GOAL_OPTIONS = [
  { value: 'more_energy', label: 'Piu energia', desc: 'Meno stanchezza durante il giorno' },
  { value: 'better_sleep', label: 'Dormire meglio', desc: 'Qualita e durata del sonno' },
  { value: 'fitness', label: 'Fitness', desc: 'Forma fisica e prestazioni' },
  { value: 'stress', label: 'Gestire lo stress', desc: 'Ridurre ansia e tensione' },
  { value: 'general_wellness', label: 'Benessere generale', desc: 'Monitorare la salute' },
] as const;

// --- Shared UI ---

function OptionButton({
  selected,
  onClick,
  label,
  desc,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  desc?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full py-2.5 px-3 rounded-lg border text-left transition-colors ${
        selected
          ? 'border-primary bg-primary/10'
          : 'border-border hover:border-primary/50'
      }`}
    >
      <span className={`text-sm font-medium ${selected ? 'text-primary' : ''}`}>
        {label}
      </span>
      {desc && <span className="text-xs text-muted-foreground ml-2">{desc}</span>}
    </button>
  );
}

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  cols = 2,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  cols?: number;
}) {
  return (
    <div className={`grid gap-1.5 ${cols === 2 ? 'grid-cols-2' : cols === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`py-2 px-2 rounded-lg border text-sm font-medium transition-colors ${
            value === opt.value
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:border-primary/50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function StepHint({ text }: { text: string }) {
  return (
    <div className="rounded-md bg-muted/60 px-3 py-2 mb-1">
      <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}

// --- Main component ---

interface OnboardingProps {
  onComplete: () => void;
  initialProfile?: UserProfile;
  editMode?: boolean;
}

export default function Onboarding({ onComplete, initialProfile, editMode }: OnboardingProps) {
  const { user } = useAuthState();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Dati personali
  const [name, setName] = useState(initialProfile?.name ?? '');
  const [birthYear, setBirthYear] = useState(initialProfile?.birthYear?.toString() ?? '');
  const [gender, setGender] = useState<UserProfile['gender']>(initialProfile?.gender ?? 'prefer_not_to_say');
  const [heightCm, setHeightCm] = useState(initialProfile?.heightCm?.toString() ?? '');
  const [weightKg, setWeightKg] = useState(initialProfile?.weightKg?.toString() ?? '');

  // Step 2: Occupazione
  const [occupation, setOccupation] = useState<UserProfile['occupation']>(initialProfile?.occupation ?? 'worker');
  const [workType, setWorkType] = useState(initialProfile?.workType ?? '');
  const [dailyWorkHours, setDailyWorkHours] = useState(initialProfile?.dailyWorkHours?.toString() ?? '8');
  const [workSchedule, setWorkSchedule] = useState<UserProfile['workSchedule']>(initialProfile?.workSchedule ?? 'regular');

  // Step 3: Abitudini
  const [activityLevel, setActivityLevel] = useState<UserProfile['activityLevel']>(initialProfile?.activityLevel ?? 'moderate');
  const [sleepHours, setSleepHours] = useState(initialProfile?.sleepHours?.toString() ?? '7');
  const [smokingFrequency, setSmokingFrequency] = useState<UserProfile['smokingFrequency']>(initialProfile?.smokingFrequency ?? 'never');
  const [alcoholFrequency, setAlcoholFrequency] = useState<UserProfile['alcoholFrequency']>(initialProfile?.alcoholFrequency ?? 'never');
  const [caffeineDaily, setCaffeineDaily] = useState(initialProfile?.caffeineDaily?.toString() ?? '2');

  // Step 4: Obiettivi
  const [goal, setGoal] = useState<UserProfile['goal']>(initialProfile?.goal ?? 'general_wellness');
  const [notes, setNotes] = useState(initialProfile?.notes ?? '');

  const canNext = () => {
    if (step === 0) return name.trim().length >= 2 && birthYear && heightCm && weightKg;
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
        occupation,
        workType: workType.trim() || undefined,
        dailyWorkHours: parseFloat(dailyWorkHours) || 0,
        workSchedule,
        activityLevel,
        sleepHours: parseFloat(sleepHours),
        smokingFrequency,
        alcoholFrequency,
        caffeineDaily: parseInt(caffeineDaily) || 0,
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

      // Sync profile to Supabase for cross-device access
      pushDataToSupabase(user.email, user.id!).catch(() => {});

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
    <div className="min-h-[100dvh] bg-background px-4 py-6 overflow-y-auto">
      <Card className="w-full max-w-md mx-auto mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">{editMode ? 'Modifica profilo' : 'Completa il tuo profilo'}</CardTitle>
          <CardDescription>
            Passo {step + 1} di {STEPS.length}: {STEPS[step]}
          </CardDescription>
          <div className="flex gap-1 mt-3">
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
            <StepHint text={STEP_DESC[step]} />

            {/* --- Step 1: Dati personali --- */}
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
                    className="h-11 text-base"
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
                    className="h-11 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Genere</Label>
                  <ChipGroup options={GENDER_OPTIONS} value={gender} onChange={setGender} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="height">Altezza (cm)</Label>
                    <Input id="height" type="number" placeholder="170" min={100} max={250}
                      value={heightCm} onChange={(e) => setHeightCm(e.target.value)} required className="h-11 text-base" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight">Peso (kg)</Label>
                    <Input id="weight" type="number" placeholder="70" min={30} max={300} step={0.1}
                      value={weightKg} onChange={(e) => setWeightKg(e.target.value)} required className="h-11 text-base" />
                  </div>
                </div>
              </>
            )}

            {/* --- Step 2: Occupazione --- */}
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label>Che cosa fai?</Label>
                  <ChipGroup options={OCCUPATION_OPTIONS} value={occupation} onChange={setOccupation} cols={3} />
                </div>

                {(occupation === 'worker' || occupation === 'student_worker') && (
                  <div className="space-y-2">
                    <Label htmlFor="workType">Tipo di lavoro</Label>
                    <Input
                      id="workType"
                      placeholder="es. Impiegato, cameriere, operaio..."
                      value={workType}
                      onChange={(e) => setWorkType(e.target.value)}
                      className="h-11 text-base"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="dailyHours">In media quante ore al giorno lavori/studi?</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="dailyHours"
                      type="number"
                      min={0}
                      max={16}
                      step={0.5}
                      value={dailyWorkHours}
                      onChange={(e) => setDailyWorkHours(e.target.value)}
                      className="h-11 text-base w-24"
                    />
                    <span className="text-sm text-muted-foreground">ore/giorno</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Tipo di orario</Label>
                  <div className="space-y-1.5">
                    {SCHEDULE_OPTIONS.map((opt) => (
                      <OptionButton
                        key={opt.value}
                        selected={workSchedule === opt.value}
                        onClick={() => setWorkSchedule(opt.value)}
                        label={opt.label}
                        desc={opt.desc}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* --- Step 3: Abitudini --- */}
            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label>Attivita fisica</Label>
                  <div className="space-y-1.5">
                    {ACTIVITY_OPTIONS.map((opt) => (
                      <OptionButton
                        key={opt.value}
                        selected={activityLevel === opt.value}
                        onClick={() => setActivityLevel(opt.value)}
                        label={opt.label}
                        desc={opt.desc}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sleepHours">Ore di sonno tipiche</Label>
                  <div className="flex items-center gap-3">
                    <Input id="sleepHours" type="number" min={3} max={14} step={0.5}
                      value={sleepHours} onChange={(e) => setSleepHours(e.target.value)}
                      className="h-11 text-base w-24" />
                    <span className="text-sm text-muted-foreground">ore/notte</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Fumo</Label>
                  <ChipGroup options={SMOKING_OPTIONS} value={smokingFrequency} onChange={setSmokingFrequency} />
                </div>

                <div className="space-y-2">
                  <Label>Alcol</Label>
                  <ChipGroup options={ALCOHOL_OPTIONS} value={alcoholFrequency} onChange={setAlcoholFrequency} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="caffeine">Caffeina (tazzine/giorno)</Label>
                  <div className="flex items-center gap-3">
                    <Input id="caffeine" type="number" min={0} max={15}
                      value={caffeineDaily} onChange={(e) => setCaffeineDaily(e.target.value)}
                      className="h-11 text-base w-24" />
                    <span className="text-sm text-muted-foreground">tazzine</span>
                  </div>
                </div>
              </>
            )}

            {/* --- Step 4: Obiettivi --- */}
            {step === 3 && (
              <>
                <div className="space-y-2">
                  <Label>Qual e il tuo obiettivo principale?</Label>
                  <div className="space-y-1.5">
                    {GOAL_OPTIONS.map((opt) => (
                      <OptionButton
                        key={opt.value}
                        selected={goal === opt.value}
                        onClick={() => setGoal(opt.value)}
                        label={opt.label}
                        desc={opt.desc}
                      />
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
                    className="w-full min-h-[70px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    rows={3}
                  />
                </div>
              </>
            )}

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </CardContent>

          <CardFooter className="flex gap-3 px-6 pb-8 pt-4">
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
                  : editMode ? 'Salva modifiche' : 'Completa'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
