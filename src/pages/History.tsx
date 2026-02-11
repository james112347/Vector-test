import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuthState } from '../contexts/AuthContext';
import { getAllLogs, deleteEnergyLog } from '../lib/energy';
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
  const [logs, setLogs] = useState<EnergyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const loadLogs = async () => {
    if (!user?.id) return;
    const all = await getAllLogs(user.id);
    setLogs(all);
    setLoading(false);
  };

  useEffect(() => { loadLogs(); }, [user?.id]);

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
