import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuthState } from '../contexts/AuthContext';
import { getAllUsers, approveUser } from '../lib/auth';
import type { User } from '../db/schema';

export default function AdminUsers() {
  const { user: currentUser } = useAuthState();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    const all = await getAllUsers();
    setUsers(all);
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const handleApprove = async (userId: number) => {
    await approveUser(userId);
    await loadUsers();
  };

  if (!currentUser?.isAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Accesso non autorizzato.</p>
      </div>
    );
  }

  const pendingUsers = users.filter(u => !u.isApproved);
  const approvedUsers = users.filter(u => u.isApproved);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gestione Utenti</h1>
        <p className="text-muted-foreground mt-1">Approva o gestisci gli utenti registrati</p>
      </div>

      {pendingUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-amber-600 dark:text-amber-400">
              In attesa di approvazione ({pendingUsers.length})
            </CardTitle>
            <CardDescription>Questi utenti attendono la tua approvazione per accedere</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingUsers.map(u => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{u.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Registrato: {u.createdAt.toLocaleDateString('it-IT')}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="ml-3 h-10 px-4"
                    onClick={() => handleApprove(u.id!)}
                  >
                    Approva
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {pendingUsers.length === 0 && !loading && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Nessun utente in attesa di approvazione.</p>
          </CardContent>
        </Card>
      )}

      {approvedUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Utenti approvati ({approvedUsers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {approvedUsers.map(u => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {u.email}
                      {u.isAdmin && (
                        <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          Admin
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="text-xs text-green-600 dark:text-green-400 shrink-0">Attivo</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Caricamento...</p>
        </div>
      )}
    </div>
  );
}
