import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuthState } from '../contexts/AuthContext';
import { saveEnergyLog, getTodayLog } from '../lib/energy';

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
  const [physical, setPhysical] = useState(5);
  const [mental, setMental] = useState(5);
  const [emotional, setEmotional] = useState(5);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [existingLog, setExistingLog] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    getTodayLog(user.id).then(log => {
      if (log) {
        setPhysical(log.physical);
        setMental(log.mental);
        setEmotional(log.emotional);
        setNotes(log.notes || '');
        setExistingLog(true);
      }
    });
  }, [user?.id]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    await saveEnergyLog(user.id, { physical, mental, emotional, notes: notes || undefined });
    setSaving(false);
    setSaved(true);
    setExistingLog(true);
    setTimeout(() => setSaved(false), 2000);
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
    </div>
  );
}
